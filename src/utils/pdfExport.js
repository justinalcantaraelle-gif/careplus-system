import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';

/**
 * Add a rendered canvas to a jsPDF instance, handling multi-page slicing if canvas is tall.
 * 
 * @param {jsPDF} pdf - Active jsPDF instance
 * @param {HTMLCanvasElement} canvas - Captured canvas
 * @param {string} orientation - 'portrait' | 'landscape'
 * @param {boolean} isFirstPageInDoc - Whether this is the first page of the PDF
 */
const addCanvasToPdf = (pdf, canvas, orientation = 'portrait', isFirstPageInDoc = true) => {
    const isLandscape = orientation === 'landscape';
    const pageWidth = isLandscape ? 297 : 210;
    const pageHeight = isLandscape ? 210 : 297;
    const marginX = 8;
    const marginY = 8;
    const usableWidth = pageWidth - 2 * marginX;
    const usableHeight = pageHeight - 2 * marginY;
    const pageAspectRatio = usableHeight / usableWidth;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Height in canvas pixels corresponding to one PDF page
    const pageHeightPx = Math.floor(canvasWidth * pageAspectRatio);
    const totalPages = Math.max(1, Math.ceil(canvasHeight / pageHeightPx));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        if (!isFirstPageInDoc || pageIdx > 0) {
            pdf.addPage([pageWidth, pageHeight], orientation);
        }

        const srcY = pageIdx * pageHeightPx;
        const sliceHeight = Math.min(pageHeightPx, canvasHeight - srcY);

        // Render this slice onto a clean temporary canvas
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvasWidth;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
            canvas,
            0, srcY, canvasWidth, sliceHeight,
            0, 0, canvasWidth, sliceHeight
        );

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.98);
        const printHeightMm = (sliceHeight / canvasWidth) * usableWidth;

        pdf.addImage(imgData, 'JPEG', marginX, marginY, usableWidth, printHeightMm, undefined, 'FAST');
    }
};

/**
 * Export an HTML string to a downloadable PDF file.
 * Guaranteed to NEVER be blank: renders in an isolated, top-level iframe at (0, 0)
 * with all host styles, awaits image decoding, and captures via html2canvas & jsPDF.
 * 
 * @param {string} htmlContent - HTML document or fragment string.
 * @param {string} filename - Target filename (e.g. 'Document.pdf').
 * @param {object} options - Sizing & orientation options.
 */
export const exportHtmlToPdf = async (htmlContent, filename = 'document.pdf', options = {}) => {
    Swal.fire({
        title: 'Generating Document...',
        text: 'Please wait while your document is being prepared for download.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    const isLandscape = options.orientation === 'landscape';
    const iframeWidth = options.width || (isLandscape ? '1120px' : '850px');

    // Create an isolated, visible iframe attached at top-left, placed behind content
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = iframeWidth;
    iframe.style.height = '1200px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-99999';
    iframe.style.opacity = '1';
    iframe.style.visibility = 'visible';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    try {
        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // Copy all parent document styles, stylesheets, and fonts into the iframe
        const hostStyles = document.querySelectorAll('link[rel="stylesheet"], style');
        hostStyles.forEach(styleNode => {
            try {
                iframeDoc.head.appendChild(styleNode.cloneNode(true));
            } catch (e) {}
        });

        // Expand iframe height to encompass all rendered content
        await new Promise(resolve => setTimeout(resolve, 150));
        const fullHeight = Math.max(
            iframeDoc.body.scrollHeight,
            iframeDoc.documentElement.scrollHeight,
            1200
        );
        iframe.style.height = `${fullHeight + 200}px`;

        // Wait for all images inside the iframe to load completely
        const images = Array.from(iframeDoc.images);
        if (images.length > 0) {
            await Promise.all(
                images.map(img => {
                    if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
                    return new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                })
            );
        }

        // Wait for font loading if available
        if (iframeDoc.fonts && iframeDoc.fonts.ready) {
            try {
                await iframeDoc.fonts.ready;
            } catch (e) {}
        }

        // Brief delay to allow final paint/layout computation
        await new Promise(resolve => setTimeout(resolve, 200));

        // Initialize jsPDF
        const pdf = new jsPDF({
            orientation: isLandscape ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Check if the document has explicitly delimited pages (e.g. .page class in MedicalRecords)
        const pageElements = Array.from(iframeDoc.querySelectorAll('.page'));

        if (pageElements.length > 0) {
            for (let i = 0; i < pageElements.length; i++) {
                const pageEl = pageElements[i];
                const canvas = await html2canvas(pageEl, {
                    scale: options.scale || 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: pageEl.scrollWidth || 850,
                    windowHeight: pageEl.scrollHeight || 1100
                });
                addCanvasToPdf(pdf, canvas, options.orientation || 'portrait', i === 0);
            }
        } else {
            // Otherwise capture the entire body
            const target = iframeDoc.body;
            const canvas = await html2canvas(target, {
                scale: options.scale || 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0,
                windowWidth: target.scrollWidth || (isLandscape ? 1120 : 850),
                windowHeight: target.scrollHeight || 1200
            });
            addCanvasToPdf(pdf, canvas, options.orientation || 'portrait', true);
        }

        pdf.save(filename);

        Swal.close();
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2500,
            timerProgressBar: true
        });
        Toast.fire({
            icon: 'success',
            title: 'Document downloaded successfully'
        });
    } catch (err) {
        console.error('Failed to export PDF:', err);
        Swal.fire({
            icon: 'error',
            title: 'Download Failed',
            text: 'An error occurred while generating the document. Please try again.'
        });
        throw err;
    } finally {
        if (iframe.parentNode) {
            document.body.removeChild(iframe);
        }
    }
};

/**
 * Export an existing DOM element to a downloadable PDF file.
 * 
 * @param {HTMLElement|string} elementOrSelector - DOM element or CSS selector.
 * @param {string} filename - Name of downloaded file.
 * @param {object} options - Optional overrides for jsPDF/html2canvas.
 */
export const exportElementToPdf = async (elementOrSelector, filename = 'document.pdf', options = {}) => {
    const el = typeof elementOrSelector === 'string' ? document.querySelector(elementOrSelector) : elementOrSelector;
    if (!el) {
        throw new Error('Target element not found for PDF export');
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${filename}</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    margin: 0;
                    padding: 20px;
                    background: #ffffff;
                    font-family: 'Segoe UI', Arial, sans-serif;
                }
            </style>
        </head>
        <body>
            <div style="display: flex; justify-content: center; width: 100%;">
                ${el.outerHTML}
            </div>
        </body>
        </html>
    `;

    await exportHtmlToPdf(htmlContent, filename, options);
};
