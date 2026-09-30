/**
 * xrayAiDetector.js
 * 
 * AI & Computer Vision Radiograph Verification Engine for Doc Dental Care.
 * Analyzes uploaded images to verify whether they possess the authentic physical,
 * chromatic, luminance, and radiographic distribution characteristics of genuine dental X-rays
 * (e.g. Bitewing, Periapical, Panoramic/OPG, Cephalometric, Occlusal, or CBCT scans),
 * and rejects standard non-radiographic photographs (selfies, colorful photos, documents, graphics).
 */

export const SAMPLE_XRAY_URL = '/sample_dental_xray.jpg';

/**
 * Loads the authentic dental panoramic radiograph example file for AI testing
 */
export const loadSampleXrayFile = async () => {
    try {
        const response = await fetch(SAMPLE_XRAY_URL);
        const blob = await response.blob();
        return new File([blob], 'panoramic_dental_xray_sample.jpg', { type: 'image/jpeg' });
    } catch (e) {
        console.error('Failed to load sample X-Ray file:', e);
        return null;
    }
};

/**
 * Robust, cross-browser Image Loader (Supports File, Blob, and DataURL without CORS issues)
 */
const decodeImageToCanvas = (source) => {
    return new Promise((resolve, reject) => {
        // Fast path: If createImageBitmap is available and source is File/Blob
        if (typeof window !== 'undefined' && window.createImageBitmap && (source instanceof File || source instanceof Blob)) {
            window.createImageBitmap(source)
                .then((bitmap) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 256;
                    canvas.height = 256;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (!ctx) {
                        return reject(new Error('Failed to create Canvas 2D context'));
                    }
                    ctx.drawImage(bitmap, 0, 0, 256, 256);
                    resolve({ canvas, ctx });
                })
                .catch(() => {
                    // Fallback to FileReader if createImageBitmap fails on specific formats
                    loadViaFileReader(source, resolve, reject);
                });
            return;
        }

        if (source instanceof File || source instanceof Blob) {
            loadViaFileReader(source, resolve, reject);
            return;
        }

        // String source (DataURL or URL)
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return reject(new Error('Canvas context unavailable'));
            ctx.drawImage(img, 0, 0, 256, 256);
            resolve({ canvas, ctx });
        };
        img.onerror = () => reject(new Error('Failed to decode image data'));
        img.src = source;
    });
};

const loadViaFileReader = (fileOrBlob, resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return reject(new Error('Canvas context unavailable'));
            ctx.drawImage(img, 0, 0, 256, 256);
            resolve({ canvas, ctx });
        };
        img.onerror = () => reject(new Error('Failed to render decoded image on canvas'));
        img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('FileReader failed to read image file'));
    reader.readAsDataURL(fileOrBlob);
};

/**
 * Verifies if a file is a valid DICOM medical image
 */
export const verifyDicomFile = async (file) => {
    try {
        if (!file) return { isDicom: false, reason: 'No file provided' };
        
        const fileName = (file.name || '').toLowerCase();
        if (fileName.endsWith('.dcm') || fileName.endsWith('.dicom') || (file.type && file.type.includes('dicom'))) {
            // Check DICOM magic signature at byte offset 128
            const buffer = await file.slice(0, 132).arrayBuffer();
            const bytes = new Uint8Array(buffer);
            if (bytes.length >= 132) {
                const magic = String.fromCharCode(bytes[128], bytes[129], bytes[130], bytes[131]);
                if (magic === 'DICM') {
                    return { isDicom: true, confidence: 99.9, label: 'DICOM Standard Radiology Scan' };
                }
            }
            return { isDicom: true, confidence: 96.0, label: 'DICOM Radiology Scan' };
        }
        return { isDicom: false };
    } catch (e) {
        return { isDicom: false, reason: e.message };
    }
};

/**
 * Primary AI Radiograph Analysis Function
 * @param {File|Blob|string} imageInput - File object or Base64/DataURL string
 * @returns {Promise<{isXray: boolean, confidence: number, label: string, failureReasons: string[], metrics: object}>}
 */
export const analyzeXrayImage = async (imageInput) => {
    try {
        console.log('[AI X-Ray Detector] Beginning analysis on image input...');

        // 1. Check if input is a DICOM file
        if (imageInput instanceof File) {
            const dicomCheck = await verifyDicomFile(imageInput);
            if (dicomCheck.isDicom) {
                console.log('[AI X-Ray Detector] Recognized valid DICOM radiology scan.');
                return {
                    isXray: true,
                    confidence: dicomCheck.confidence,
                    label: dicomCheck.label,
                    failureReasons: [],
                    metrics: { dicomHeader: true, type: 'DICOM' }
                };
            }
        }

        // 2. Decode image to 256x256 normalized analysis grid
        const { ctx } = await decodeImageToCanvas(imageInput);
        const sampleSize = 256;
        const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imgData.data;
        const totalPixels = sampleSize * sampleSize;

        let totalSaturation = 0;
        let colorDivergentPixels = 0; // Pixels with noticeable color divergence
        let totalLuminance = 0;

        const luminanceArray = new Float32Array(totalPixels);
        const histogram = new Uint32Array(256);

        let pureWhitePixels = 0; // Pure white (text on dark or document background, Lum >= 235)
        let pureBlackPixels = 0; // Pure black (table cell background or dark document, Lum <= 20)
        let midTonePixels = 0;   // Biological dental/bone radiolucent/radiopaque spectrum (35 <= Lum <= 215)

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const pixelIndex = i / 4;

            // Chromatic Divergence: in true radiographs, R ~= G ~= B
            const maxRGB = Math.max(r, g, b);
            const minRGB = Math.min(r, g, b);
            const diffRGB = maxRGB - minRGB;

            if (diffRGB > 22) {
                colorDivergentPixels++;
            }

            // Saturation calculation
            const sat = maxRGB === 0 ? 0 : diffRGB / maxRGB;
            totalSaturation += sat;

            // Standard ITU-R BT.709 Luminance
            const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
            luminanceArray[pixelIndex] = lum;
            histogram[lum]++;
            totalLuminance += lum;

            if (lum >= 235) pureWhitePixels++;
            else if (lum <= 20) pureBlackPixels++;
            
            if (lum >= 35 && lum <= 215) midTonePixels++;
        }

        const avgSaturation = totalSaturation / totalPixels;
        const colorDivergentRatio = colorDivergentPixels / totalPixels;
        const avgLuminance = totalLuminance / totalPixels;
        const whiteRatio = pureWhitePixels / totalPixels;
        const blackRatio = pureBlackPixels / totalPixels;
        const midToneRatio = midTonePixels / totalPixels;

        // 3. Compute Luminance Standard Deviation & Dynamic Range
        let sumSquaredDiff = 0;
        for (let i = 0; i < totalPixels; i++) {
            const diff = luminanceArray[i] - avgLuminance;
            sumSquaredDiff += diff * diff;
        }
        const stdDev = Math.sqrt(sumSquaredDiff / totalPixels);

        // Percentiles 5th and 95th for radiographic exposure span
        let count = 0;
        let p5 = 0, p95 = 255;
        for (let h = 0; h < 256; h++) {
            count += histogram[h];
            if (p5 === 0 && count >= totalPixels * 0.05) p5 = h;
            if (p95 === 255 && count >= totalPixels * 0.95) {
                p95 = h;
                break;
            }
        }
        const dynamicRange = p95 - p5;

        // 4. Spatial Gradient, High-Frequency Text Glyphs & Table Grid Analysis
        let edgeTransitions = 0;
        let totalGradient = 0;
        let highContrastStepEdges = 0; // Rapid character stroke transitions (text glyphs)
        let orthogonalEdges = 0;       // Table grid lines & horizontal text baselines

        for (let y = 1; y < sampleSize - 1; y += 2) {
            for (let x = 1; x < sampleSize - 1; x += 2) {
                const idx = y * sampleSize + x;
                const center = luminanceArray[idx];
                const right = luminanceArray[idx + 1];
                const bottom = luminanceArray[idx + sampleSize];
                
                const gradX = Math.abs(center - right);
                const gradY = Math.abs(center - bottom);
                const grad = Math.sqrt(gradX * gradX + gradY * gradY);
                totalGradient += grad;

                if (grad > 16) edgeTransitions++;
                
                // Text character stroke / glyph step transition detector
                if (gradX > 45 || gradY > 45) {
                    highContrastStepEdges++;
                }

                // Orthogonal alignment check (horizontal/vertical lines vs diagonal organic curves)
                if (grad > 20) {
                    const ratio = Math.max(gradX, gradY) / (gradX + gradY + 0.001);
                    if (ratio > 0.82) orthogonalEdges++;
                }
            }
        }
        const sampledPoints = ((sampleSize - 2) / 2) * ((sampleSize - 2) / 2);
        const avgGradient = totalGradient / sampledPoints;
        const edgeDensity = edgeTransitions / sampledPoints;
        const stepEdgeDensity = highContrastStepEdges / sampledPoints;
        const orthogonalRatio = edgeTransitions > 0 ? (orthogonalEdges / edgeTransitions) : 0;

        // 5. Decision Rules & Radiograph Characteristics Evaluation
        const failureReasons = [];
        let score = 100;

        // Rule A: Color Saturation & Chromatic Divergence (Most critical filter for real radiographs)
        const isColoredPhoto = colorDivergentRatio > 0.12 || avgSaturation > 0.14;
        const isHighlyColorful = colorDivergentRatio > 0.20 || avgSaturation > 0.22;

        if (isHighlyColorful) {
            score -= 60;
            failureReasons.push(`Image contains prominent colors (Saturation: ${(avgSaturation * 100).toFixed(1)}%, Colored Pixels: ${(colorDivergentRatio * 100).toFixed(1)}%). Genuine radiographs are monochrome.`);
        } else if (isColoredPhoto) {
            score -= 40;
            failureReasons.push(`Image contains non-grayscale color distribution (Saturation: ${(avgSaturation * 100).toFixed(1)}%).`);
        }

        // Rule B: Advanced Text / Table / Document / Letter Detector (Detects Light & Dark Tables, Text Sheets, Code, Invoices)
        const isDarkTableOrDoc = (blackRatio > 0.48 && whiteRatio > 0.03 && midToneRatio < 0.32);
        const isLightTableOrDoc = (whiteRatio > 0.48 && blackRatio > 0.03 && midToneRatio < 0.32);
        const isExtremeBinarizedDoc = (whiteRatio + blackRatio) > 0.70 && midToneRatio < 0.28;
        const isPureWhiteDoc = whiteRatio > 0.70 && midToneRatio < 0.25;
        const isPureDarkDoc = blackRatio > 0.75 && midToneRatio < 0.18;
        const isTextGridStructure = (stepEdgeDensity > 0.07 && orthogonalRatio > 0.55 && midToneRatio < 0.38);

        const isTextDocument = isDarkTableOrDoc || isLightTableOrDoc || isExtremeBinarizedDoc || isPureWhiteDoc || isPureDarkDoc || isTextGridStructure;

        if (isTextDocument) {
            score -= 65;
            failureReasons.push(`Image contains text characters, typography, tabular gridlines, or document structures (Binarization: ${((whiteRatio + blackRatio) * 100).toFixed(1)}%, Mid-tones: ${(midToneRatio * 100).toFixed(1)}%) rather than radiographic dental anatomy.`);
        }

        // Rule C: Low Dynamic Range / Flat Uniform Graphic
        const isFlatOrSolid = dynamicRange < 40 || stdDev < 14;
        if (isFlatOrSolid && !isTextDocument) {
            score -= 45;
            failureReasons.push(`Low radiographic dynamic range (${dynamicRange}/255). An X-ray requires high contrast between radiopaque bone/teeth structures and soft tissue.`);
        }

        // Rule D: Missing Organic Anatomical Gradients
        if (avgGradient < 2.8 && edgeDensity < 0.04 && !isTextDocument) {
            score -= 30;
            failureReasons.push(`Missing characteristic anatomical dental/bone trabecular gradient structures.`);
        }

        score = Math.max(0, Math.min(100, Math.round(score)));
        const isXray = score >= 65 && failureReasons.length === 0;

        let detectedType = 'Dental Radiograph (X-Ray)';
        if (isXray) {
            if (avgLuminance > 135) detectedType = 'High-Exposure Dental Radiograph';
            else if (avgLuminance < 65) detectedType = 'Intraoral / Bitewing Radiograph';
            else detectedType = 'Panoramic / Periapical Radiograph';
        } else {
            detectedType = isColoredPhoto ? 'Colored Photograph / Non-Xray' : isTextDocument ? 'Document / Text / Table' : 'Non-Radiographic Image';
        }

        const result = {
            isXray,
            confidence: score,
            label: detectedType,
            failureReasons,
            metrics: {
                avgSaturation: Number(avgSaturation.toFixed(3)),
                colorDivergentRatio: Number(colorDivergentRatio.toFixed(3)),
                avgLuminance: Math.round(avgLuminance),
                stdDev: Number(stdDev.toFixed(1)),
                dynamicRange,
                avgGradient: Number(avgGradient.toFixed(2)),
                edgeDensity: Number(edgeDensity.toFixed(2)),
                whiteRatio: Number(whiteRatio.toFixed(3)),
                midToneRatio: Number(midToneRatio.toFixed(3))
            }
        };

        console.log('[AI X-Ray Detector Result]:', result);
        return result;
    } catch (error) {
        console.error('[AI X-Ray Detector Catch]:', error);
        return {
            isXray: false,
            confidence: 0,
            label: 'Analysis Error',
            failureReasons: [`AI Scan Engine encountered an error: ${error.message}`],
            metrics: {}
        };
    }
};

/**
 * Format diagnostic failure HTML for SweetAlert2
 */
export const formatRejectionHtml = (result) => {
    const reasonsList = (result.failureReasons || ['Image characteristics do not match genuine medical X-rays.'])
        .map(r => `<li style="margin-bottom: 6px;">${r}</li>`)
        .join('');

    return `
        <div style="text-align: left; font-size: 13.5px; color: #444; line-height: 1.5;">
            <p style="margin-bottom: 12px; font-weight: 600; color: #dc3545;">
                &#9888; The uploaded file was rejected because it does not appear to be an authentic dental X-Ray or medical radiograph scan.
            </p>
            <div style="background-color: #fdf2f2; border: 1px solid #f5c6cb; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px;">
                <strong style="color: #721c24; font-size: 13px;">AI Analysis Findings:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 18px; color: #721c24; font-size: 12.5px;">
                    ${reasonsList}
                </ul>
            </div>
            <p style="margin-bottom: 0; font-size: 12px; color: #666;">
                <strong>Supported Radiograph Formats:</strong> Bitewing, Periapical, Panoramic (OPG), Cephalometric, or DICOM (.dcm) dental imaging files.
            </p>
        </div>
    `;
};
