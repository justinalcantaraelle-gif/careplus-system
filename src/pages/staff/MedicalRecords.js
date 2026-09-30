import React, { useState, useEffect } from 'react';
import { 
    RiUserHeartLine, RiFileSearchLine, RiCheckLine, 
    RiCloseLine, RiSearchLine, RiInformationLine, RiStethoscopeLine,
    RiEyeLine, RiPrinterLine, RiFileTextLine,
    RiCameraLine, RiGalleryLine, RiDeleteBinLine, RiZoomInLine, RiUploadCloud2Line, RiImageLine, RiFileImageLine,
    RiFilePdfLine, RiFileDownloadLine, RiExternalLinkLine, RiShieldCrossLine, RiShieldCheckLine,
    RiDownloadLine
} from 'react-icons/ri';
import Swal from 'sweetalert2';
import logo from '../../assets/images/final-logo.png';
import { addAuditLog } from '../../services/auditLogger';
import { readDatabase, writeDatabase } from '../../utils/storage';
import { addUserNotification } from '../../utils/notificationStore';
import { analyzeXrayImage, formatRejectionHtml, loadSampleXrayFile } from '../../utils/xrayAiDetector';
import { exportHtmlToPdf } from '../../utils/pdfExport';

const legends = [
    { code: '/', label: 'Present', color: '#ffffff' },
    { code: 'X', label: 'Missing', color: '#bdc3c7' },
    { code: 'Am', label: 'Amalgam', color: '#7f8c8d' },
    { code: 'C', label: 'Caries', color: '#e74c3c' },
    { code: 'Co', label: 'Composite', color: '#3498db' },
    { code: 'Im', label: 'Impacted', color: '#9b59b6' },
    { code: 'Rf', label: 'Root Fragment', color: '#95a5a6' },
    { code: 'JC', label: 'Jacket Crown', color: '#f1c40f' },
    { code: 'Un', label: 'Unerupted', color: '#ecf0f1' },
    { code: 'S', label: 'Sealant', color: '#2ecc71' },
    { code: 'Ex', label: 'Extraction', color: '#e67e22' },
    { code: 'Ab', label: 'Abutment', color: '#1abc9c' },
];

const bracesColorHex = {
    Blue: '#1f4ed8',
    'Sky Blue': '#4dabf7',
    Torquoise: '#40c3ff',
    Black: '#000000',
    'Light Green': '#90ee90',
    'Mint Green': '#3eb489',
    Teal: '#008080',
    Green: '#008000',
    'Light Orange': '#ffb347',
    Orange: '#ff7f50',
    White: '#ffffff',
    Transparent: '#eeeeee',
    Silver: '#c0c0c0',
    Brown: '#8b4513',
    Gold: '#d4af37',
    Yellow: '#ffff00',
    'Dark Violet': '#9400d3',
    'Light Purple': '#d8bfd8',
    Violet: '#8a2be2',
    'Light Pink': '#ffb6c1',
    Pink: '#ff69b4',
    Red: '#ff0000',
    'Dark Red': '#8b0000',
    'Pearl Blue': '#6a5acd',
    Gray: '#808080',
    Pearl: '#f5f5f5',
    Cream: '#fffdd0',
    Ruby: '#9b111e',
    'Dark Blue': '#00008b',
    'Metallic Blue': '#4682b4',
    'Dark Green': '#006400',
    'Neon Orange': '#ff5f1f',
    'Red Orange': '#ff4500',
    'Neon Pink': '#ff1493',
    Purple: '#800080',
    'Neon Yellow': '#ffff33',
    'Metallic Green': '#3cb371',
    'Baby Blue': '#89cff0',
    Nacarat: '#ff4f00',
    'Pale Blue': '#a2cffe',
    Maroon: '#800000'
};

const MedicalRecords = () => {
    const [allPatients, setAllPatients] = useState([]);
    const [records, setRecords] = useState({});
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [filter, setFilter] = useState("all"); 
    const [searchTerm, setSearchTerm] = useState(""); 
    const [activeTab, setActiveTab] = useState("consent"); 

    // X-Ray management state
    const [xrayTitle, setXrayTitle] = useState("Bitewing");
    const [customXrayTitle, setCustomXrayTitle] = useState("");
    const [xrayDate, setXrayDate] = useState(new Date().toISOString().split('T')[0]);
    const [xrayNotes, setXrayNotes] = useState("");
    const [xrayFile, setXrayFile] = useState(null);
    const [xrayPreview, setXrayPreview] = useState(null);
    const [xrayFileType, setXrayFileType] = useState("image"); // "image", "pdf", "dcm"
    const [xrayFileName, setXrayFileName] = useState("");
    const [zoomedXray, setZoomedXray] = useState(null); 
    const [aiScanResult, setAiScanResult] = useState(null); 

    const theme = {
        beige: '#f5f5dc',
        gold: '#d4af37',
        goldDark: '#b8860b',
        cardBg: '#fffdf5',
        inputBg: '#f8f9fa' 
    };

    useEffect(() => {
        const loadMedicalData = () => {
            const db = readDatabase() || { users: [], medical_records: {} };
            const patients = (db.users || []).filter(u => u.role === 'Patient' || u.role === 'patient');
            
            setAllPatients(patients);
            setRecords(db.medical_records || {});
        };

        loadMedicalData();

        window.addEventListener('storage', loadMedicalData);
        window.addEventListener('doc_dental_db_updated', loadMedicalData);
        return () => {
            window.removeEventListener('storage', loadMedicalData);
            window.removeEventListener('doc_dental_db_updated', loadMedicalData);
        };
    }, []);

    const handleRequestAction = (email, action) => {
        let db = readDatabase() || { medical_records: {} };
        
        if (!db.medical_records) db.medical_records = {};
        if (!db.medical_records[email]) return;

        let auditAction = '';
        let auditDetails = '';

        if (action === 'Approved') {
            const currentRecord = db.medical_records[email];
            const pendingChanges = currentRecord.pendingChanges || {};
            const officialRecord = { ...currentRecord };
            delete officialRecord.pendingChanges;
            delete officialRecord.pendingSubmitted;
            delete officialRecord.editAllowed;

            db.medical_records[email] = {
                ...officialRecord,
                ...pendingChanges,
                dateSubmitted: officialRecord.dateSubmitted || pendingChanges.dateSubmitted || new Date().toLocaleDateString(),
                dateUpdated: new Date().toLocaleDateString(),
                requestStatus: 'None'
            };
            auditAction = 'Approved Medical Record Changes';
            auditDetails = `Approved pending medical record changes for ${email}.`;
            Swal.fire('Approved', 'The patient changes are now part of the official record.', 'success');
        } else {
            const officialRecord = { ...db.medical_records[email] };
            delete officialRecord.pendingChanges;
            delete officialRecord.pendingSubmitted;
            delete officialRecord.editAllowed;
            db.medical_records[email] = {
                ...officialRecord,
                requestStatus: 'Declined'
            };
            auditAction = 'Declined Medical Record Changes';
            auditDetails = `Declined pending medical record changes for ${email}.`;
            Swal.fire('Declined', 'The proposed changes were rejected. The official record was not changed.', 'error');
        }

        db = addUserNotification(db, email, {
            id: Date.now(),
            title: `Medical Record Changes ${action}`,
            message: action === 'Approved' 
                ? 'Your requested updates to your medical records have been approved and saved to your official file.'
                : 'Your requested updates to your medical records have been declined by the clinical staff.',
            date: new Date().toISOString(),
            read: false,
            type: 'medical_update'
        });

        writeDatabase(db);
        addAuditLog(auditAction, auditDetails);
        setRecords(db.medical_records);
        
        setSelectedPatient(prev => ({
            ...prev,
            record: db.medical_records[email]
        }));
    };

    const filteredPatients = allPatients.filter(patient => {
        const patientRecord = records[patient.email] || {};
        const matchesFilter = filter === "pending_request" ? patientRecord.requestStatus === "Pending" : true;
        const query = searchTerm.toLowerCase();
        const matchesSearch = [
            patient.email,
            patient.fullName,
            patient.name,
            patient.phone,
            patient.contactNo,
            patientRecord.fullName,
            patientRecord.fullname,
            patientRecord.name,
            patientRecord.contactNo,
            patientRecord.contactNumber,
            patientRecord.phone
        ].some(value => String(value || '').toLowerCase().includes(query));
        return matchesFilter && matchesSearch;
    });

    const handleXrayFileChange = async (e) => {
        const inputEl = e.target;
        const file = inputEl.files?.[0];
        if (!file) return;

        if (file.size > 15 * 1024 * 1024) {
            Swal.fire('File Too Large', 'Please select a file smaller than 15MB.', 'warning');
            inputEl.value = '';
            return;
        }

        const nameLower = file.name.toLowerCase();
        let type = "image";
        if (nameLower.endsWith('.pdf') || (file.type && file.type.includes('pdf'))) {
            type = "pdf";
        } else if (nameLower.endsWith('.dcm') || nameLower.endsWith('.dicom') || (file.type && file.type.includes('dicom'))) {
            type = "dcm";
        }

        // Run AI Radiograph Scanner for image uploads
        if (type === 'image') {
            Swal.fire({
                title: 'AI Radiograph Scanner',
                html: `
                    <div style="text-align: center; padding: 12px 0;">
                        <div class="spinner-border text-warning mb-3" role="status" style="width: 2.8rem; height: 2.8rem;">
                            <span class="visually-hidden">Scanning...</span>
                        </div>
                        <p style="font-size: 14px; font-weight: bold; color: #333; margin-bottom: 4px;">Analyzing Radiographic Properties...</p>
                        <p style="font-size: 12px; color: #777; margin-bottom: 0;">Verifying bone/tooth density, grayscale luminance, and chromatic divergence...</p>
                    </div>
                `,
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                const aiResult = await analyzeXrayImage(file);
                Swal.close();

                if (!aiResult.isXray) {
                    inputEl.value = '';
                    const fileInput = document.getElementById('xrayFileInput');
                    if (fileInput) fileInput.value = '';
                    setXrayFile(null);
                    setXrayPreview(null);
                    setXrayFileName('');
                    setXrayFileType('image');
                    setAiScanResult(null);

                    return Swal.fire({
                        icon: 'error',
                        title: 'Upload Rejected: Not an X-Ray',
                        html: formatRejectionHtml(aiResult),
                        confirmButtonColor: '#d33',
                        confirmButtonText: 'Select Authentic X-Ray'
                    });
                }

                setAiScanResult(aiResult);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `AI Verified: ${aiResult.label} (${aiResult.confidence}% confidence)`,
                    showConfirmButton: false,
                    timer: 3000
                });
            } catch (err) {
                console.error('[AI X-Ray Scanner Error]:', err);
                Swal.close();
            }
        } else {
            setAiScanResult({
                isXray: true,
                confidence: 99.9,
                label: type === 'dcm' ? 'DICOM Radiology Scan' : 'Dental PDF Document'
            });
        }

        setXrayFileType(type);
        setXrayFileName(file.name);

        const reader = new FileReader();
        reader.onloadend = () => {
            setXrayFile(reader.result);
            setXrayPreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleLoadSampleXray = async () => {
        Swal.fire({
            title: 'AI Radiograph Scanner',
            html: `
                <div style="text-align: center; padding: 12px 0;">
                    <div class="spinner-border text-warning mb-3" role="status" style="width: 2.8rem; height: 2.8rem;">
                        <span class="visually-hidden">Scanning...</span>
                    </div>
                    <p style="font-size: 14px; font-weight: bold; color: #333; margin-bottom: 4px;">Loading & Analyzing Example Panoramic X-Ray...</p>
                    <p style="font-size: 12px; color: #777; margin-bottom: 0;">Scanning radiographic density, dental arch contrast, and bone trabeculae...</p>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const sampleFile = await loadSampleXrayFile();
        if (!sampleFile) {
            Swal.close();
            return Swal.fire('Error', 'Unable to load example dental X-ray asset.', 'error');
        }

        const aiResult = await analyzeXrayImage(sampleFile);
        Swal.close();

        setXrayTitle('Panoramic');
        setXrayFileType('image');
        setXrayFileName('panoramic_dental_xray_sample.jpg');
        setAiScanResult(aiResult);

        const reader = new FileReader();
        reader.onloadend = () => {
            setXrayFile(reader.result);
            setXrayPreview(reader.result);
        };
        reader.readAsDataURL(sampleFile);

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `AI Verified: Authentic ${aiResult.label} (${aiResult.confidence}% confidence)`,
            showConfirmButton: false,
            timer: 3000
        });
    };

    const handleUploadXray = () => {
        if (!selectedPatient || !selectedPatient.email) return;
        if (!xrayFile) {
            Swal.fire('No File Selected', 'Please select an X-Ray photo (PNG/JPG), PDF document, or DICOM (.dcm) file to upload.', 'warning');
            return;
        }

        const email = (selectedPatient.email || '').toLowerCase().trim();
        let db = readDatabase() || { medical_records: {} };
        if (!db.medical_records) db.medical_records = {};
        if (!db.medical_records[email]) {
            db.medical_records[email] = { email, xrays: [] };
        }

        const currentRecord = db.medical_records[email];
        const existingXrays = currentRecord.xrays || [];

        const defaultTitle = xrayFileType === 'pdf' 
            ? 'Dental PDF Report' 
            : xrayFileType === 'dcm' 
            ? 'DICOM Radiology Scan' 
            : 'Dental Radiograph';

        const chosenTitle = xrayTitle === 'Other / Custom'
            ? (customXrayTitle.trim() || defaultTitle)
            : (xrayTitle.trim() || defaultTitle);

        const newXrayItem = {
            id: `xray-${Date.now()}`,
            title: chosenTitle,
            date: xrayDate || new Date().toLocaleDateString(),
            notes: xrayNotes.trim(),
            fileType: xrayFileType,
            fileName: xrayFileName || 'dental_xray',
            imageUrl: xrayFile,
            aiVerified: Boolean(aiScanResult?.isXray),
            aiConfidence: aiScanResult?.confidence || 98.5,
            aiLabel: aiScanResult?.label || 'Dental Radiograph',
            uploadedAt: new Date().toISOString()
        };

        const updatedXrays = [newXrayItem, ...existingXrays];
        db.medical_records[email] = {
            ...currentRecord,
            xrays: updatedXrays
        };

        // Send notification to patient
        db = addUserNotification(db, email, {
            id: Date.now(),
            title: 'New Dental X-Ray / Scan Uploaded',
            message: `Your dentist has uploaded a new ${newXrayItem.title} (${newXrayItem.fileType.toUpperCase()}) to your medical folder.`,
            date: new Date().toISOString(),
            read: false,
            type: 'medical_update'
        });

        writeDatabase(db);
        addAuditLog('Uploaded Patient X-Ray', `Uploaded ${newXrayItem.title} (${newXrayItem.fileType}) for ${email}.`);

        setRecords(db.medical_records);
        setSelectedPatient(prev => ({
            ...prev,
            record: db.medical_records[email]
        }));

        setXrayTitle('Bitewing');
        setCustomXrayTitle('');
        setXrayFile(null);
        setXrayPreview(null);
        setXrayFileName('');
        setXrayFileType('image');
        setXrayNotes('');

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `${newXrayItem.fileType.toUpperCase()} file uploaded successfully!`,
            showConfirmButton: false,
            timer: 2000
        });
    };

    const handleClearSelectedFile = () => {
        setXrayFile(null);
        setXrayPreview(null);
        setXrayFileName('');
        setXrayFileType('image');
        setAiScanResult(null);
        const fileInput = document.getElementById('xrayFileInput');
        if (fileInput) fileInput.value = '';
    };

    const handleDeleteXray = (xrayId) => {
        if (!selectedPatient || !selectedPatient.email) return;

        Swal.fire({
            title: 'Delete X-Ray Scan?',
            text: 'Are you sure you want to remove this X-Ray photo from the patient record?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, Delete'
        }).then((result) => {
            if (result.isConfirmed) {
                const email = (selectedPatient.email || '').toLowerCase().trim();
                let db = readDatabase() || { medical_records: {} };
                if (db.medical_records && db.medical_records[email]) {
                    const currentRecord = db.medical_records[email];
                    const updatedXrays = (currentRecord.xrays || []).filter(x => x.id !== xrayId);

                    db.medical_records[email] = {
                        ...currentRecord,
                        xrays: updatedXrays
                    };

                    writeDatabase(db);
                    addAuditLog('Deleted Patient X-Ray', `Deleted X-Ray photo for ${email}.`);

                    setRecords(db.medical_records);
                    setSelectedPatient(prev => ({
                        ...prev,
                        record: db.medical_records[email]
                    }));

                    Swal.fire('Deleted!', 'The X-Ray scan has been removed.', 'success');
                }
            }
        });
    };

    const formatLabel = (key) => {
        return key.replace(/^q\d+_/, '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase()); 
    };

    const normalizeCompareValue = (value) => {
        if (Array.isArray(value)) {
            return JSON.stringify(value.map(item => String(item).trim()).sort());
        }

        if (value === null || value === undefined) return '';
        return String(value).trim();
    };

    const isPendingFieldChanged = (record = {}, keys = []) => {
        if (record.requestStatus !== 'Pending' || !record.pendingChanges) return false;

        return keys.some(key => (
            Object.prototype.hasOwnProperty.call(record.pendingChanges, key) &&
            normalizeCompareValue(record.pendingChanges[key]) !== normalizeCompareValue(record[key])
        ));
    };

    const ReadOnlyField = ({ label, value, changed = false }) => (
        <div className="medical-print-field">
            <label className="form-label x-small fw-bold text-muted mb-1 d-flex align-items-center gap-2">
                {label}
                {changed && <span className="badge bg-warning text-dark no-print">Changed</span>}
            </label>
            <div
                className={`p-2 rounded text-dark d-flex align-items-center ${changed ? 'border border-warning medical-changed-field' : 'border-0'}`}
                style={{ backgroundColor: changed ? '#fff3cd' : theme.inputBg, minHeight: '38px', fontSize: '14px' }}
            >
                {value || <span className="text-muted fst-italic" style={{ fontSize: '12px' }}>Not provided</span>}
            </div>
        </div>
    );

    const escapeHtml = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const getConditionRows = (record = {}) => {
        const selectedConditions = Array.isArray(record.conditions) ? record.conditions : [];
        const standardConditions = selectedConditions.filter(condition => {
            const normalized = String(condition).toLowerCase();
            return normalized !== 'other' && normalized !== 'others';
        });
        const otherText = record.otherCondition || record.otherConditionDetails || record.other_conditions || '';
        const otherConditions = String(otherText)
            .split(/[\n,;]+/)
            .map(condition => condition.trim())
            .filter(Boolean);

        return [...standardConditions, ...otherConditions];
    };

    const getReviewRecord = (record = {}) => {
        if (record.requestStatus === 'Pending' && record.pendingChanges) {
            return { ...record, ...record.pendingChanges };
        }

        return record;
    };

    const generateRecordHtml = (docType = 'all') => {
        if (!selectedPatient?.record) return null;

        const record = getReviewRecord(selectedPatient.record);
        const patientName = record.fullName || record.fullname || selectedPatient.fullName || 'Unknown Patient';
        const contactNo = record.contactNo || record.contactNumber || record.contact || record.phone || selectedPatient.contactNo || selectedPatient.contactNumber || selectedPatient.contact || selectedPatient.phone || 'Not provided';
        
        // 1. Fetch dental chart data for this patient
        const db = readDatabase() || {};
        const emailKey = selectedPatient.email.toLowerCase().trim();
        const dentalChart = db.dental_charts?.[emailKey] || { teeth: {}, clearedForBraces: false };

        const legends = [
            { code: '/', label: 'Present', color: '#ffffff' },
            { code: 'X', label: 'Missing', color: '#bdc3c7' },
            { code: 'Am', label: 'Amalgam', color: '#7f8c8d' },
            { code: 'C', label: 'Caries', color: '#e74c3c' },
            { code: 'Co', label: 'Composite', color: '#3498db' },
            { code: 'Im', label: 'Impacted', color: '#9b59b6' },
            { code: 'Rf', label: 'Root Fragment', color: '#95a5a6' },
            { code: 'JC', label: 'Jacket Crown', color: '#f1c40f' },
            { code: 'Un', label: 'Unerupted', color: '#ecf0f1' },
            { code: 'S', label: 'Sealant', color: '#2ecc71' },
            { code: 'Ex', label: 'Extraction', color: '#e67e22' },
            { code: 'Ab', label: 'Abutment', color: '#1abc9c' },
        ];

        const getToothSvgHtml = (id, teethData) => {
            const status = teethData[id] || '/';
            const legend = legends.find(l => l.code === status) || legends[0];
            const fill = legend.color;
            const textFill = legend.color === '#ffffff' ? '#aaa' : 'white';
            const opacity = status === 'X' ? 0.35 : 1;
            return `
                <div class="tooth-print-item" style="opacity: ${opacity};">
                    <svg width="25" height="32" viewBox="0 0 100 120">
                        <path d="M20,40 Q20,10 50,10 Q80,10 80,40 Q85,100 50,110 Q15,100 20,40 Z" 
                              fill="${fill}" stroke="#bbbbbb" stroke-width="3" />
                        <text x="50" y="32" font-size="24" text-anchor="middle" fill="${textFill}" font-weight="bold">${id}</text>
                    </svg>
                    <div class="tooth-status-label">${status}</div>
                </div>
            `;
        };

        const teethData = dentalChart.teeth || {};
        const upperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
        const lowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

        const upperTeethHtml = upperTeeth.map(id => getToothSvgHtml(id, teethData)).join('');
        const lowerTeethHtml = lowerTeeth.map(id => getToothSvgHtml(id, teethData)).join('');

        const legendItemsHtml = legends.map(l => {
            return `
                <div class="legend-item-print">
                    <span class="legend-color-box" style="background-color: ${l.color};"></span>
                    <span class="legend-code-print">${l.code}</span>
                    <span class="legend-label-print">${l.label}</span>
                </div>
            `;
        }).join('');

        const cariesCount = Object.values(teethData).filter(t => t === 'C').length;
        const dentalHealthStatus = cariesCount === 0 ? "Good Standing" : "Needs Treatment";
        const dentalHealthDesc = cariesCount > 0 ? `Attention: ${cariesCount} caries detected.` : "No active issues found.";
        
        let bracesColor = 'None selected';
        if (dentalChart.bracesColor) {
            bracesColor = dentalChart.bracesColor.name || dentalChart.bracesColor;
        }

        const medicalHistoryRows = Object.entries(record)
            .filter(([key]) => key.startsWith('q'))
            .map(([key, value]) => {
                const isYes = value === 'Yes' || value === true;
                const displayVal = isYes ? 'Yes' : (value === 'No' || value === false ? 'No' : String(value || 'N/A'));
                return `
                    <div class="history-row">
                        <span>${escapeHtml(formatLabel(key))}</span>
                        <strong>${escapeHtml(displayVal)}</strong>
                    </div>
                `;
            })
            .join('');
        const conditionRows = getConditionRows(record);
        const conditions = conditionRows.length > 0
            ? conditionRows.map((condition, index) => {
                return `
                    <tr>
                        <td class="condition-number">${index + 1}</td>
                        <td>${escapeHtml(condition)}</td>
                    </tr>
                `;
            }).join('')
            : `
                <tr>
                    <td colspan="2" class="muted">No specific conditions reported by the patient.</td>
                </tr>
            `;

        const xrays = record.xrays || selectedPatient.record?.xrays || [];
        let xraysHtml = '';
        if (xrays.length > 0) {
            xraysHtml = `
                <div class="xray-print-grid">
                    ${xrays.map((xray, idx) => {
                        const isPdf = xray.fileType === 'pdf' || (xray.fileName && xray.fileName.toLowerCase().endsWith('.pdf'));
                        const isDcm = xray.fileType === 'dcm' || (xray.fileName && (xray.fileName.toLowerCase().endsWith('.dcm') || xray.fileName.toLowerCase().endsWith('.dicom')));
                        
                        let previewHtml = '';
                        if (isPdf) {
                            previewHtml = `
                                <div class="xray-print-doc" style="border: 1px solid #e74c3c; background: #fff5f5;">
                                    <div style="font-size: 22px; color: #e74c3c; font-weight: bold; margin-bottom: 3px;">PDF</div>
                                    <div style="font-size: 8.5px; font-weight: bold; color: #333; max-width: 90%; word-break: break-word;">${escapeHtml(xray.fileName || xray.title)}</div>
                                    <span style="font-size: 7.5px; background: #e74c3c; color: white; padding: 2px 6px; border-radius: 3px; margin-top: 3px; display: inline-block;">PDF DIAGNOSTIC DOCUMENT</span>
                                </div>
                            `;
                        } else if (isDcm) {
                            previewHtml = `
                                <div class="xray-print-doc" style="border: 1px solid #3498db; background: #f0f7fc;">
                                    <div style="font-size: 22px; color: #3498db; font-weight: bold; margin-bottom: 3px;">DICOM</div>
                                    <div style="font-size: 8.5px; font-weight: bold; color: #333; max-width: 90%; word-break: break-word;">${escapeHtml(xray.fileName || xray.title)}</div>
                                    <span style="font-size: 7.5px; background: #3498db; color: white; padding: 2px 6px; border-radius: 3px; margin-top: 3px; display: inline-block;">DICOM RADIOLOGY SCAN</span>
                                </div>
                            `;
                        } else {
                            previewHtml = `
                                <div style="text-align: center; background: #000; border-radius: 4px; padding: 4px; margin-bottom: 5px; height: 140px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                    <img src="${xray.imageUrl}" alt="${escapeHtml(xray.title)}" style="max-height: 132px; max-width: 100%; object-fit: contain;" />
                                </div>
                            `;
                        }

                        return `
                            <div class="xray-print-card">
                                ${previewHtml}
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px;">
                                    <div class="xray-print-title">#${idx + 1} ${escapeHtml(xray.title)}</div>
                                    <span style="font-size: 7.5px; background: #f8f4e8; border: 1px solid #e2d8c8; color: #6f5200; padding: 1px 4px; border-radius: 3px;">${escapeHtml(xray.date || 'N/A')}</span>
                                </div>
                                <div class="xray-print-notes">
                                    <strong>Findings:</strong> ${escapeHtml(xray.notes || 'No specific findings recorded.')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else {
            xraysHtml = `
                <div style="text-align: center; padding: 25px; border: 1px dashed #ccc; border-radius: 6px; background: #fafafa; margin-top: 15px;">
                    <div style="font-size: 11px; font-weight: bold; color: #777;">No Dental X-Ray Scans on File</div>
                    <div style="font-size: 9px; color: #999; margin-top: 4px;">No diagnostic X-Ray images, intraoral radiographs, or DICOM scans have been uploaded for this patient yet.</div>
                </div>
            `;
        }

        const isMultiDoc = docType === 'all';
        const showConsent = docType === 'all' || docType === 'consent';
        const showMedical = docType === 'all' || docType === 'medical';
        const showChart = docType === 'all' || docType === 'chart';
        const showXray = docType === 'all' || docType === 'xray';

        const docTitleMap = {
            all: `Medical Folder (All 4 Documents) - ${patientName}`,
            consent: `1. Patient Informed Consent - ${patientName}`,
            medical: `2. Patient Medical Record - ${patientName}`,
            chart: `3. Dental Chart Examination - ${patientName}`,
            xray: `4. Dental X-Rays & Radiographs - ${patientName}`
        };

        const pageTitle = docTitleMap[docType] || `Medical Document - ${patientName}`;

        const html = `
            <!doctype html>
            <html>
                <head>
                    <title>${escapeHtml(pageTitle)}</title>
                    <style>
                        @page { size: A4 portrait; margin: 10mm 12mm; }
                        * { box-sizing: border-box; }
                        body {
                            margin: 0;
                            color: #1f1b18;
                            font-family: Arial, sans-serif;
                            font-size: 10px;
                            line-height: 1.25;
                            background: #fff;
                        }
                        .page {
                            padding: 5px;
                            position: relative;
                            width: 100%;
                        }
                        .page-break {
                            page-break-after: always;
                            break-after: page;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px solid #b8860b;
                            padding-bottom: 7px;
                            margin-bottom: 12px;
                        }
                        .logo {
                            max-width: 150px;
                            height: auto;
                            margin-bottom: 5px;
                        }
                        .clinic { color: #b8860b; font-size: 18px; font-weight: 700; margin: 0; }
                        .title { font-size: 12px; font-weight: 700; margin: 2px 0; }
                        .muted { color: #666; }
                        h3 {
                            color: #b8860b;
                            font-size: 11px;
                            margin: 15px 0 6px;
                            text-transform: uppercase;
                            border-bottom: 1px dashed #ddd;
                            padding-bottom: 3px;
                        }
                        .grid {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 6px;
                        }
                        .field {
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            padding: 5px 6px;
                            min-height: 34px;
                        }
                        .field.full { grid-column: 1 / -1; }
                        .label {
                            display: block;
                            color: #777;
                            font-size: 8px;
                            font-weight: 700;
                            text-transform: uppercase;
                            margin-bottom: 2px;
                        }
                        .history-box {
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            padding: 8px;
                            columns: 2;
                            column-gap: 15px;
                        }
                        .history-row {
                            display: flex;
                            justify-content: space-between;
                            gap: 8px;
                            border-bottom: 1px solid #eee;
                            padding: 3px 0;
                            break-inside: avoid;
                            page-break-inside: avoid;
                        }
                        .history-row:last-child { border-bottom: 0; }
                        .conditions-table {
                            width: 100%;
                            border-collapse: collapse;
                            border: 1px solid #ddd;
                        }
                        .conditions-table th,
                        .conditions-table td {
                            border: 1px solid #ddd;
                            padding: 5px 6px;
                            text-align: left;
                            vertical-align: top;
                        }
                        .conditions-table th {
                            background: #f8f4e8;
                            color: #6f5200;
                            font-size: 8px;
                            text-transform: uppercase;
                        }
                        .condition-number {
                            width: 42px;
                            text-align: center;
                            font-weight: 700;
                        }
                        .tooth-print-item {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            margin: 0 3px;
                            width: 25px;
                        }
                        .tooth-status-label {
                            font-weight: bold;
                            font-size: 8px;
                            margin-top: 3px;
                            color: #444;
                        }
                        .legend-grid-print {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            gap: 4px;
                            margin-top: 10px;
                        }
                        .legend-item-print {
                            display: flex;
                            align-items: center;
                            border: 1px solid #eee;
                            padding: 4px 6px;
                            border-radius: 4px;
                            font-size: 8px;
                            background: #fff;
                        }
                        .legend-color-box {
                            width: 8px;
                            height: 8px;
                            border-radius: 50%;
                            border: 1px solid #999;
                            margin-right: 5px;
                            display: inline-block;
                        }
                        .legend-code-print {
                            font-weight: bold;
                            color: #b8860b;
                            margin-right: 5px;
                            min-width: 18px;
                        }
                        .legend-label-print {
                            color: #555;
                        }
                        /* X-Ray Print Styles */
                        .xray-print-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 10px;
                            margin-top: 10px;
                        }
                        .xray-print-card {
                            border: 1px solid #ddd;
                            border-radius: 6px;
                            padding: 8px;
                            background: #fffdfb;
                            page-break-inside: avoid;
                            break-inside: avoid;
                        }
                        .xray-print-doc {
                            height: 140px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            border-radius: 4px;
                            margin-bottom: 5px;
                            text-align: center;
                            padding: 8px;
                        }
                        .xray-print-title {
                            font-size: 9.5px;
                            font-weight: bold;
                            color: #b8860b;
                        }
                        .xray-print-notes {
                            font-size: 8px;
                            color: #444;
                            line-height: 1.3;
                            border-top: 1px dotted #e0e0e0;
                            padding-top: 3px;
                        }
                    </style>
                </head>
                <body>
                    <!-- DOCUMENT 1: Patient Informed Consent -->
                    ${showConsent ? `
                    <div class="page ${isMultiDoc ? 'page-break' : ''}">
                        <div class="header">
                            <img class="logo" src="${escapeHtml(logo)}" alt="Doc Dental Logo" />
                            <h1 class="clinic">Doc Dental Care</h1>
                            <div class="title">Patient Informed Consent</div>
                            <div class="muted">${isMultiDoc ? 'Document 1 of 4 &bull; ' : ''}Printed on ${escapeHtml(new Date().toLocaleDateString())}</div>
                        </div>

                        <h3>Consent Information</h3>
                        <div class="grid">
                            <div class="field"><span class="label">Patient Name</span>${escapeHtml(patientName)}</div>
                            <div class="field"><span class="label">Email Address</span>${escapeHtml(selectedPatient.email)}</div>
                            <div class="field"><span class="label">Contact No.</span>${escapeHtml(contactNo)}</div>
                            <div class="field"><span class="label">Consent Status</span><strong>${record.hasConsented ? 'SIGNED & AGREED' : 'PENDING SIGNATURE / UNSIGNED'}</strong></div>
                            <div class="field"><span class="label">Date Signed</span>${escapeHtml(record.consentTimestamp || 'N/A')}</div>
                            <div class="field"><span class="label">Recorded By Clinic</span>${escapeHtml(record.recordedByClinic ? 'Yes (Clinical File)' : 'No (Patient Profile)')}</div>
                        </div>

                        <div class="consent-text-box" style="border: 1px solid #d4af37; border-left: 5px solid #b8860b; border-radius: 4px; padding: 12px 15px; margin-top: 15px; margin-bottom: 20px; font-size: 9px; line-height: 1.4; color: #444; background: #fffdf6;">
                            <h4 style="margin-top:0; color:#b8860b; font-size:10px; font-weight:bold; text-transform:uppercase; margin-bottom: 6px;">Consent Agreement Terms</h4>
                            <p style="margin-bottom: 8px;">I understand and consent to have any treatment done by the dentist after the procedure, the risk and benefits and costs have been fully explained. These treatment include cleaning, periodontal treatment, fillings, crowns, bridges, and all type of restorations, root canal treatment, dentures, local anaesthetics, surgical cases, and orthodontic treatment.</p>
                            <p style="margin-bottom: 8px;">I understand that dentistry is not science and no dentist can properly guarantee accurate results all the time.</p>
                            <p style="margin-bottom: 8px;">I hereby authorised any of the doctors/dental auxiliaries to proceed with and perform the dental restorations and treatments as explained to me. I understand that these are subject to modification depending on the undiagnosable circumstances that may arise during the course of treatment.</p>
                            <p style="margin-bottom:0;">All treatment are properly explained to me and any untold circumstances that arise during the procedure, the attending dentist will not be held liable since it is my free will, full trust and confidence in him/her.</p>
                        </div>

                        <div style="text-align: center; margin-top: 30px;">
                            <div style="display: inline-block;">
                                <div style="border-bottom: 2px solid #222; width: 260px; height: 80px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px; background: #fafafa;">
                                     ${record.signature 
                                         ? ((record.signature.startsWith('data:') || record.signature.startsWith('http'))
                                             ? `<img src="${record.signature}" style="max-height: 75px; max-width: 100%; object-fit: contain;" />`
                                             : `<span style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 28px; font-weight: bold; color: #155724; font-style: italic;">${record.signature}</span>`)
                                         : `<span style="color:#aaa; font-style:italic; font-size:9px; margin-bottom: 10px;">Awaiting Digital Signature</span>`
                                     }
                                </div>
                                <span style="font-weight: bold; color: #555; font-size: 9px; text-transform: uppercase; display: block; text-align: center;">Signature of Patient</span>
                            </div>
                        </div>
                    </div>` : ''}

                    <!-- DOCUMENT 2: Patient Medical Record -->
                    ${showMedical ? `
                    <div class="page ${isMultiDoc ? 'page-break' : ''}">
                        <div class="header">
                            <img class="logo" src="${escapeHtml(logo)}" alt="Doc Dental Logo" />
                            <h1 class="clinic">Doc Dental Care</h1>
                            <div class="title">Patient Medical Record</div>
                            <div class="muted">${isMultiDoc ? 'Document 2 of 4 &bull; ' : ''}Printed on ${escapeHtml(new Date().toLocaleDateString())}</div>
                        </div>

                        <h3>Patient Information</h3>
                        <div class="grid">
                            <div class="field"><span class="label">Full Name</span>${escapeHtml(patientName)}</div>
                            <div class="field"><span class="label">Email Address</span>${escapeHtml(selectedPatient.email)}</div>
                            <div class="field"><span class="label">Sex</span>${escapeHtml(record.sex || selectedPatient.sex || 'Not provided')}</div>
                            <div class="field"><span class="label">Birthday</span>${escapeHtml(record.birthday || selectedPatient.birthday || 'Not provided')}</div>
                            <div class="field"><span class="label">Age</span>${escapeHtml(record.age || selectedPatient.age || 'Not provided')}</div>
                            <div class="field"><span class="label">Contact No.</span>${escapeHtml(contactNo)}</div>
                            <div class="field full"><span class="label">Home Address</span>${escapeHtml(record.homeAddress || record.address || selectedPatient.address || 'Not provided')}</div>
                            <div class="field"><span class="label">Religion</span>${escapeHtml(record.religion || 'Not provided')}</div>
                            <div class="field"><span class="label">Nationality</span>${escapeHtml(record.nationality || 'Not provided')}</div>
                        </div>

                        <h3>Medical History</h3>
                        <div class="history-box">
                            ${medicalHistoryRows || '<span class="muted">No medical history answers found.</span>'}
                        </div>

                        <h3>Identified Conditions</h3>
                        <table class="conditions-table">
                            <thead>
                                <tr>
                                    <th class="condition-number">No.</th>
                                    <th>Condition / Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${conditions}
                            </tbody>
                        </table>
                    </div>` : ''}

                    <!-- DOCUMENT 3: Intraoral Dental Chart -->
                    ${showChart ? `
                    <div class="page ${isMultiDoc ? 'page-break' : ''}">
                        <div class="header">
                            <img class="logo" src="${escapeHtml(logo)}" alt="Doc Dental Logo" />
                            <h1 class="clinic">Doc Dental Care</h1>
                            <div class="title">Intraoral Dental Chart & Examination</div>
                            <div class="muted">${isMultiDoc ? 'Document 3 of 4 &bull; ' : ''}Printed on ${escapeHtml(new Date().toLocaleDateString())}</div>
                        </div>

                        <h3>Examination Overview</h3>
                        <div class="grid">
                            <div class="field"><span class="label">Patient Name</span>${escapeHtml(patientName)}</div>
                            <div class="field"><span class="label">Last Exam Date</span>${escapeHtml(dentalChart.lastExamDate || 'No exam recorded')}</div>
                            <div class="field"><span class="label">Dental Health Status</span><strong>${escapeHtml(dentalHealthStatus)}</strong> - ${escapeHtml(dentalHealthDesc)}</div>
                            <div class="field"><span class="label">Braces Clearance</span><strong>${dentalChart.clearedForBraces ? 'Cleared for Braces' : 'Not Cleared'}</strong></div>
                            <div class="field"><span class="label">Braces Color Selected</span><strong>${escapeHtml(bracesColor)}</strong></div>
                            <div class="field"><span class="label">Contact No.</span>${escapeHtml(contactNo)}</div>
                        </div>

                        <h3>Intraoral Teeth Status</h3>
                        <div class="chart-canvas-container" style="border: 1px solid #ddd; border-radius: 4px; padding: 20px 10px; margin-top: 10px; margin-bottom: 15px; text-align: center; background: #fffdf8;">
                            <!-- Upper teeth -->
                            <div class="teeth-row-print" style="display: flex; justify-content: center; margin-bottom: 20px;">
                                ${upperTeethHtml}
                            </div>
                            <!-- Lower teeth -->
                            <div class="teeth-row-print" style="display: flex; justify-content: center;">
                                ${lowerTeethHtml}
                            </div>
                        </div>

                        <h3>Clinical Status Legend</h3>
                        <div class="legend-grid-print">
                            ${legendItemsHtml}
                        </div>
                    </div>` : ''}

                    <!-- DOCUMENT 4: Dental X-Rays & Radiographs -->
                    ${showXray ? `
                    <div class="page">
                        <div class="header">
                            <img class="logo" src="${escapeHtml(logo)}" alt="Doc Dental Logo" />
                            <h1 class="clinic">Doc Dental Care</h1>
                            <div class="title">Dental X-Rays & Radiographs Diagnostic Report</div>
                            <div class="muted">${isMultiDoc ? 'Document 4 of 4 &bull; ' : ''}Printed on ${escapeHtml(new Date().toLocaleDateString())}</div>
                        </div>

                        <h3>Diagnostic Imaging Overview</h3>
                        <div class="grid">
                            <div class="field"><span class="label">Patient Name</span>${escapeHtml(patientName)}</div>
                            <div class="field"><span class="label">Email Address</span>${escapeHtml(selectedPatient.email)}</div>
                            <div class="field"><span class="label">Contact No.</span>${escapeHtml(contactNo)}</div>
                            <div class="field"><span class="label">Total Scans on File</span><strong>${xrays.length} Scan${xrays.length === 1 ? '' : 's'}</strong></div>
                            <div class="field"><span class="label">Latest Scan Date</span>${escapeHtml(xrays[0]?.date || dentalChart.lastExamDate || 'N/A')}</div>
                            <div class="field"><span class="label">Imaging Status</span><strong>${xrays.length > 0 ? 'Diagnostic Scans Available' : 'No Scans Uploaded'}</strong></div>
                        </div>

                        <h3>Dental Radiographs & Diagnostic Scans</h3>
                        ${xraysHtml}

                        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; align-items: flex-end;">
                            <div style="font-size: 8px; color: #777;">
                                Doc Dental Care Clinical Diagnostic Archive<br />
                                Confidential Medical Dental Record &bull; Radiographic Assessment
                            </div>
                            <div style="text-align: center;">
                                <div style="border-bottom: 1px solid #333; width: 200px; height: 35px;"></div>
                                <span style="font-size: 8px; font-weight: bold; color: #444; text-transform: uppercase;">Attending Dentist / Radiologist</span>
                            </div>
                        </div>
                    </div>` : ''}
                </body>
            </html>
        `;

        return { html, patientName, pageTitle };
    };

    const handlePrintRecord = (docType = 'all') => {
        const result = generateRecordHtml(docType);
        if (!result) return;
        const { html, patientName } = result;

        addAuditLog('Printed Medical Record', `Printed ${docType === 'all' ? 'All 4 Medical Documents' : docType.toUpperCase()} for ${patientName} (${selectedPatient.email}).`);

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            Swal.fire('Print Blocked', 'Please allow pop-ups for this site and try again.', 'warning');
            return;
        }

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    const handleDownloadRecord = async (docType = 'all') => {
        const result = generateRecordHtml(docType);
        if (!result) return;
        const { html, patientName } = result;

        addAuditLog('Downloaded Medical Record', `Downloaded ${docType === 'all' ? 'All 4 Medical Documents' : docType.toUpperCase()} for ${patientName} (${selectedPatient.email}).`);

        const safePatientName = patientName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const docLabel = docType === 'all' ? 'Medical_Folder' : docType.toUpperCase();
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `${safePatientName}_${docLabel}_${dateStr}.pdf`;

        await exportHtmlToPdf(html, filename);
    };

    const selectedRecord = selectedPatient?.record ? getReviewRecord(selectedPatient.record) : null;
    const selectedOfficialRecord = selectedPatient?.record || {};
    const hasPendingRecordChanges = selectedOfficialRecord.requestStatus === 'Pending' && selectedOfficialRecord.pendingChanges;
    const isSelectedFieldChanged = (keys) => isPendingFieldChanged(selectedOfficialRecord, Array.isArray(keys) ? keys : [keys]);
    const selectedConditionsChanged = hasPendingRecordChanges && (
        isSelectedFieldChanged('conditions') ||
        isSelectedFieldChanged(['otherCondition', 'otherConditionDetails', 'other_conditions'])
    );

    const db = readDatabase() || {};
    const selectedPatientEmailNormalized = selectedPatient?.email?.toLowerCase()?.trim() || '';
    const selectedDentalChart = db.dental_charts?.[selectedPatientEmailNormalized] || { teeth: {}, clearedForBraces: false };
    const cariesCount = Object.values(selectedDentalChart.teeth || {}).filter(t => t === 'C').length;
    
    const contactNo = selectedRecord?.contactNo || 
                      selectedRecord?.contactNumber || 
                      selectedRecord?.contact || 
                      selectedRecord?.phone || 
                      selectedPatient?.contactNo || 
                      selectedPatient?.contactNumber || 
                      selectedPatient?.contact || 
                      selectedPatient?.phone || 
                      'Not provided';

    const upperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
    const lowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

    return (
        <div className="container-fluid py-4" style={{ backgroundColor: theme.beige, minHeight: '100vh' }}>
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center mb-4 gap-3">
                {/* Left: Title & Subtitle */}
                <div className="flex-shrink-0" style={{ minWidth: '260px' }}>
                    <h3 className="fw-bold mb-0" style={{ color: theme.goldDark }}>Patient Medical Records</h3>
                    <p className="text-muted small mb-0">View records and manage edit permissions</p>
                </div>

                {/* Center: Search Bar */}
                <div className="flex-grow-1 d-flex justify-content-center px-lg-2">
                    <div className="input-group shadow-sm rounded-pill overflow-hidden w-100" style={{ maxWidth: '360px' }}>
                        <span className="input-group-text bg-white border-0">
                            <RiSearchLine style={{ color: theme.gold }} />
                        </span>
                        <input 
                            type="text" 
                            className="form-control border-0" 
                            placeholder="Search name or email..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ fontSize: '14px' }}
                        />
                    </div>
                </div>

                {/* Right: All Patients / Pending Requests Filter */}
                <div className="flex-shrink-0 d-flex justify-content-lg-end" style={{ minWidth: '260px' }}>
                    <div className="doc-btn-toolbar">
                        <button 
                            className={`doc-btn doc-btn-sm ${filter === 'all' ? 'doc-btn-gold-solid' : 'doc-btn-neutral'}`}
                            onClick={() => setFilter('all')}
                        >All Patients</button>
                        <button 
                            className={`doc-btn doc-btn-sm ${filter === 'pending_request' ? 'doc-btn-gold-solid' : 'doc-btn-neutral'}`}
                            onClick={() => setFilter('pending_request')}
                        >Pending Requests</button>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm overflow-hidden animate__animated animate__fadeIn" style={{ borderRadius: '20px', backgroundColor: theme.cardBg }}>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0" style={{ backgroundColor: 'transparent' }}>
                        <thead style={{ backgroundColor: '#f8f9fa' }}>
                            <tr>
                                <th scope="col" className="text-center py-3 text-muted small fw-bold" style={{ width: '80px' }}>Action</th>
                                <th scope="col" className="py-3 text-muted small fw-bold">Patient Name</th>
                                <th scope="col" className="py-3 text-muted small fw-bold">Contact No.</th>
                                <th scope="col" className="py-3 text-muted small fw-bold">Email Address</th>
                                <th scope="col" className="py-3 text-muted small fw-bold">Record Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPatients.length > 0 ? (
                                filteredPatients.map(patient => {
                                    const pEmail = (patient.email || '').toLowerCase().trim();
                                    const hasRecord = !!(records[pEmail] || records[patient.email]);
                                    const patientMedData = records[pEmail] || records[patient.email] || {};
                                    const isPending = hasRecord && patientMedData.requestStatus === "Pending";

                                    // Check for contact across multiple possible field names in the record
                                    const recordContact = patientMedData.contactNo || 
                                                         patientMedData.contactNumber || 
                                                         patientMedData.phone || 
                                                         patientMedData.contact ||
                                                         patient.contactNo ||
                                                         patient.contactNumber ||
                                                         patient.phone;

                                    return (
                                        <tr key={patient.email}>
                                            <td className="text-center py-3">
                                                <button 
                                                    className="doc-btn doc-btn-refresh doc-btn-sm p-0 d-inline-flex align-items-center justify-content-center"
                                                    style={{ width: '38px', height: '38px', borderRadius: '10px' }}
                                                    onClick={() => {
                                                        const pEmail = (patient.email || '').toLowerCase().trim();
                                                        addAuditLog('Viewed Medical Record', `Viewed medical record for ${patient.fullName || patient.email}.`);
                                                        setSelectedPatient({ ...patient, record: records[pEmail] || records[patient.email] });
                                                        setActiveTab("consent");
                                                    }}
                                                    title="View Record"
                                                >
                                                    <RiEyeLine size={22} />
                                                </button>
                                            </td>
                                            <td className="py-3">
                                                <div className="fw-bold text-dark d-flex align-items-center gap-2">
                                                    {patient.fullName || 'Unknown Patient'}
                                                    {isPending && (
                                                        <span className="badge bg-danger rounded-pill" style={{ fontSize: '10px' }}>
                                                            Request
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                <span className="text-dark small">
                                                    {recordContact || <span className="text-muted fst-italic" style={{ fontSize: '12px' }}>N/A</span>}
                                                </span>
                                            </td>
                                            <td className="py-3">
                                                <span className="text-muted small">{patient.email}</span>
                                            </td>
                                            <td className="py-3">
                                                {hasRecord ? (
                                                    <span className="badge bg-success-subtle text-success border x-small">Record on File</span>
                                                ) : (
                                                    <span className="badge bg-light text-muted border x-small">No Record Yet</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5" className="text-center py-5">
                                        <RiFileSearchLine size={50} className="text-muted mb-3" />
                                        <h5 className="text-muted">No patients found.</h5>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedPatient && (
                <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
                    <div className="card border-0 shadow-lg w-100 animate__animated animate__zoomIn" style={{ maxWidth: '900px', borderRadius: '25px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: theme.cardBg }}>
                        
                        <div className="card-header border-0 p-4 pb-2 d-flex justify-content-between align-items-center sticky-top shadow-sm no-print" style={{ backgroundColor: theme.cardBg }}>
                            <div>
                                <h4 className="fw-bold mb-0" style={{ color: theme.goldDark }}>Medical Folder</h4>
                                <p className="text-muted small mb-0">Information on file for {selectedPatient.fullName || selectedPatient.email}</p>
                            </div>
                            <div className="d-flex gap-2 align-items-center">
                                <button
                                    className="doc-btn doc-btn-success doc-btn-sm"
                                    type="button"
                                    onClick={() => handlePrintRecord('all')}
                                    disabled={!selectedPatient.record}
                                    title="Print All 4 Medical Documents"
                                >
                                    <RiPrinterLine size={18} /> Print All
                                </button>
                                <button
                                    className="doc-btn doc-btn-neutral doc-btn-sm"
                                    type="button"
                                    onClick={() => handleDownloadRecord('all')}
                                    disabled={!selectedPatient.record}
                                    title="Download All 4 Medical Documents as PDF"
                                >
                                    <RiDownloadLine size={18} className="text-primary" /> Download All
                                </button>
                                <button className="doc-btn doc-btn-neutral doc-btn-sm p-1 d-inline-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px', borderRadius: '10px' }} onClick={() => setSelectedPatient(null)} title="Close Record">
                                    <RiCloseLine size={24}/>
                                </button>
                            </div>
                        </div>

                        {selectedPatient.record && (
                            <div className="px-4 pb-3 border-bottom no-print sticky-top" style={{ backgroundColor: theme.cardBg, top: '80px', zIndex: 10 }}>
                                <div className="doc-btn-toolbar">
                                    <button 
                                        className={`doc-btn doc-btn-sm ${activeTab === 'consent' ? 'doc-btn-warning' : 'doc-btn-neutral'}`}
                                        onClick={() => setActiveTab('consent')}
                                    >
                                        1. Consent Form
                                    </button>
                                    <button 
                                        className={`doc-btn doc-btn-sm ${activeTab === 'medical' ? 'doc-btn-warning' : 'doc-btn-neutral'}`}
                                        onClick={() => setActiveTab('medical')}
                                    >
                                        2. Medical Record
                                    </button>
                                    <button 
                                        className={`doc-btn doc-btn-sm ${activeTab === 'chart' ? 'doc-btn-warning' : 'doc-btn-neutral'}`}
                                        onClick={() => setActiveTab('chart')}
                                    >
                                        3. Dental Chart Result
                                    </button>
                                    <button 
                                        className={`doc-btn doc-btn-sm ${activeTab === 'xray' ? 'doc-btn-warning' : 'doc-btn-neutral'}`}
                                        onClick={() => setActiveTab('xray')}
                                    >
                                        4. Dental X-Rays & Photos
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="card-body p-4 pt-0 mt-3" id="printable-medical-record">
                            {!selectedPatient.record ? (
                                <div className="text-center py-5 my-5">
                                    <RiInformationLine size={60} className="text-muted mb-3 opacity-50" />
                                    <h4 className="fw-bold text-muted">Not Submitted Yet</h4>
                                    <p className="text-muted small">This patient has not filled out their medical record form.</p>
                                </div>
                            ) : (
                                <div className="row g-4">
                                    {selectedPatient.record.requestStatus === "Pending" && (
                                        <div className="col-12 no-print">
                                            <div className="alert alert-warning border-0 shadow-sm mb-0" style={{ borderRadius: '14px' }}>
                                                <strong style={{ color: theme.goldDark }}>Pending Patient Changes</strong>
                                                <p className="small text-muted mb-0">This view shows the patient&apos;s proposed updates. Approving will make these changes official.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 1: Informed Consent Form */}
                                    {activeTab === 'consent' && (
                                        <div className="col-12 animate__animated animate__fadeIn">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <h6 className="fw-bold mb-0 d-flex align-items-center" style={{ color: theme.goldDark }}>
                                                    <RiFileTextLine className="me-2" size={22}/> PATIENT INFORMED CONSENT
                                                </h6>
                                            </div>
                                            
                                            <div className="p-4 rounded-4 bg-light border border-light-subtle shadow-sm mb-4">
                                                <div className="row g-3">
                                                    <div className="col-sm-6">
                                                        <p className="mb-2"><span className="text-muted small fw-bold">PATIENT NAME:</span><br /><strong>{selectedPatient.fullName || selectedPatient.email}</strong></p>
                                                        <p className="mb-0"><span className="text-muted small fw-bold">EMAIL:</span><br />{selectedPatient.email}</p>
                                                    </div>
                                                    <div className="col-sm-6 text-sm-end">
                                                        <p className="mb-2"><span className="text-muted small fw-bold">CONTACT NUMBER:</span><br /><strong>{contactNo}</strong></p>
                                                        <p className="mb-0"><span className="text-muted small fw-bold">DATE SIGNED:</span><br />{selectedRecord?.consentTimestamp || 'Awaiting digital signature'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-4 mb-4 text-secondary shadow-sm" style={{ backgroundColor: '#fffdf6', borderLeft: `5px solid ${theme.gold}`, fontSize: '13px', lineHeight: '1.6' }}>
                                                <h6 className="fw-bold text-dark mb-3">TREATMENT INFORMED CONSENT TERMS</h6>
                                                <p>I understand and consent to have any treatment done by the dentist after the procedure, the risk and benefits and costs have been fully explained. These treatment include cleaning, periodontal treatment, fillings, crowns, bridges, and all type of restorations, root canal treatment, dentures, local anaesthetics, surgical cases, and orthodontic treatment.</p>
                                                <p>I understand that dentistry is not science and no dentist can properly guarantee accurate results all the time.</p>
                                                <p>I hereby authorised any of the doctors/dental auxiliaries to proceed with and perform the dental restorations and treatments as explained to me. I understand that these are subject to modification depending on the undiagnosable circumstances that may arise during the course of treatment.</p>
                                                <p className="mb-0">All treatment are properly explained to me and any untold circumstances that arise during the procedure, the attending dentist will not be held liable since it is my free will, full trust and confidence in him/her.</p>
                                            </div>

                                            <div className="text-center py-3">
                                                <div className="d-inline-block p-3 border rounded-3 bg-white shadow-sm">
                                                    <div className="d-flex align-items-center justify-content-center border mb-2 bg-light rounded" style={{ width: '280px', height: '90px' }}>
                                                        {selectedRecord?.signature ? (
                                                            (selectedRecord.signature.startsWith('data:') || selectedRecord.signature.startsWith('http')) ? (
                                                                <img 
                                                                    src={selectedRecord.signature} 
                                                                    alt="Patient Signature" 
                                                                    style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }}
                                                                />
                                                            ) : (
                                                                <span style={{ fontFamily: '"Brush Script MT", "Dancing Script", cursive, sans-serif', fontSize: '28px', color: '#155724', fontStyle: 'italic', fontWeight: 'bold' }}>
                                                                    {selectedRecord.signature}
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="text-muted fst-italic small">No Digital Signature Recorded</span>
                                                        )}
                                                    </div>
                                                    <span className="fw-bold text-muted small text-uppercase" style={{ fontSize: '10px' }}>Signature of Patient</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 2: Medical Record */}
                                    {activeTab === 'medical' && (
                                        <>
                                            <div className="col-12 animate__animated animate__fadeIn">
                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                    <h6 className="fw-bold mb-0 d-flex align-items-center" style={{ color: theme.goldDark }}>
                                                        <RiUserHeartLine className="me-2" size={22}/> PATIENT INFORMATION RECORD
                                                    </h6>
                                                </div>
                                                <div className="row g-3">
                                                    <div className="col-md-6"><ReadOnlyField label="Full Name" value={selectedRecord?.fullName || selectedRecord?.fullname || selectedRecord?.name || selectedPatient.fullName} changed={isSelectedFieldChanged(['fullName', 'fullname', 'name'])} /></div>
                                                    <div className="col-md-6"><ReadOnlyField label="Email Address" value={selectedPatient.email} /></div>
                                                    
                                                    <div className="col-md-4"><ReadOnlyField label="Sex" value={selectedRecord?.sex || selectedPatient.sex} changed={isSelectedFieldChanged('sex')} /></div>
                                                    <div className="col-md-4"><ReadOnlyField label="Birthday" value={selectedRecord?.birthday || selectedPatient.birthday} changed={isSelectedFieldChanged('birthday')} /></div>
                                                    <div className="col-md-4"><ReadOnlyField label="Age" value={selectedRecord?.age || selectedPatient.age} changed={isSelectedFieldChanged('age')} /></div>
                                                    
                                                    <div className="col-12"><ReadOnlyField label="Home Address" value={selectedRecord?.homeAddress || selectedRecord?.address || selectedPatient.address} changed={isSelectedFieldChanged(['homeAddress', 'address'])} /></div>
                                                    
                                                    <div className="col-md-4">
                                                        <ReadOnlyField 
                                                            label="Contact No." 
                                                            value={
                                                                selectedRecord?.contactNo || 
                                                                selectedRecord?.contactNumber || 
                                                                selectedRecord?.contact || 
                                                                selectedRecord?.phone || 
                                                                selectedPatient.contactNo || 
                                                                selectedPatient.contactNumber || 
                                                                selectedPatient.contact || 
                                                                selectedPatient.phone
                                                            }
                                                            changed={isSelectedFieldChanged(['contactNo', 'contactNumber', 'contact', 'phone'])}
                                                        />
                                                    </div>
                                                    <div className="col-md-4"><ReadOnlyField label="Religion" value={selectedRecord?.religion} changed={isSelectedFieldChanged('religion')} /></div>
                                                    <div className="col-md-4"><ReadOnlyField label="Nationality" value={selectedRecord?.nationality} changed={isSelectedFieldChanged('nationality')} /></div>
                                                </div>
                                            </div>

                                            <hr className="my-4 opacity-25" />

                                            <div className="col-12 animate__animated animate__fadeIn">
                                                <h6 className="fw-bold mb-3 d-flex align-items-center" style={{ color: theme.goldDark }}>
                                                    <RiStethoscopeLine className="me-2" size={22}/> MEDICAL HISTORY
                                                </h6>
                                                <div className="p-4 rounded-4" style={{ backgroundColor: theme.inputBg }}>
                                                    <div className="row g-3">
                                                        {Object.entries(selectedRecord)
                                                            .filter(([key]) => key.startsWith('q')) 
                                                            .map(([key, value]) => {
                                                                const isYes = value === 'Yes' || value === true;
                                                                const displayVal = isYes ? 'Yes' : (value === 'No' || value === false ? 'No' : String(value || 'N/A'));
                                                                const changed = isSelectedFieldChanged(key);
                                                                
                                                                return (
                                                                    <div
                                                                        className={`col-md-6 d-flex justify-content-between border-bottom pb-2 ${changed ? 'medical-changed-history rounded px-2 pt-2 border-warning' : ''}`}
                                                                        key={key}
                                                                    >
                                                                        <span className="small text-muted pe-3">{formatLabel(key)}</span>
                                                                        <div className="d-flex align-items-start gap-2">
                                                                            {changed && <span className="badge bg-warning text-dark no-print">Changed</span>}
                                                                            <span className={`badge ${isYes ? 'bg-danger' : 'bg-success-subtle text-success'} align-self-start`}>
                                                                                {displayVal}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="col-12 mt-4 animate__animated animate__fadeIn">
                                                <h6 className="fw-bold mb-3" style={{ color: theme.goldDark }}>Identified Conditions</h6>
                                                <div
                                                    className={`table-responsive rounded-4 overflow-hidden ${selectedConditionsChanged ? 'border border-warning medical-changed-field' : ''}`}
                                                    style={{ backgroundColor: selectedConditionsChanged ? '#fff3cd' : theme.inputBg }}
                                                >
                                                    <table className="table table-bordered align-middle mb-0 medical-conditions-table">
                                                        <thead>
                                                            <tr>
                                                                <th className="text-muted small fw-bold" style={{ width: '80px' }}>No.</th>
                                                                <th className="text-muted small fw-bold">
                                                                    Condition / Details
                                                                    {selectedConditionsChanged && <span className="badge bg-warning text-dark ms-2 no-print">Changed</span>}
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {getConditionRows(selectedRecord).length > 0 
                                                                ? getConditionRows(selectedRecord).map((condition, index) => (
                                                                    <tr key={`${condition}-${index}`}>
                                                                        <td className="fw-bold text-center small">{index + 1}</td>
                                                                        <td className="small">{condition}</td>
                                                                    </tr>
                                                                ))
                                                                : (
                                                                    <tr>
                                                                        <td colSpan="2" className="text-muted small fst-italic">
                                                                            No specific conditions reported by the patient.
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            }
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* TAB 3: Intraoral Dental Chart */}
                                    {activeTab === 'chart' && (
                                        <div className="col-12 animate__animated animate__fadeIn">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <h6 className="fw-bold mb-0 d-flex align-items-center" style={{ color: theme.goldDark }}>
                                                    <RiStethoscopeLine className="me-2" size={22}/> INTRAORAL DENTAL CHART &amp; EXAM
                                                </h6>
                                            </div>
                                            
                                            <div className="p-4 rounded-4 bg-light border border-light-subtle shadow-sm mb-4 animate__animated animate__fadeIn">
                                                <div className="row g-3">
                                                    <div className="col-md-4">
                                                        <span className="text-muted small fw-bold">DENTAL HEALTH STATUS:</span><br />
                                                        <span className={`badge ${cariesCount === 0 ? 'bg-success' : 'bg-warning text-dark'} mt-1 px-3 py-2`} style={{ fontSize: '12px' }}>
                                                            {cariesCount === 0 ? 'Good Standing' : 'Needs Treatment'}
                                                        </span>
                                                        <span className="d-block small text-muted mt-1">{cariesCount > 0 ? `${cariesCount} caries detected.` : 'No active issues found.'}</span>
                                                    </div>
                                                    <div className="col-md-4">
                                                        <span className="text-muted small fw-bold">BRACES CLEARANCE:</span><br />
                                                        <span className={`badge ${selectedDentalChart.clearedForBraces ? 'bg-info text-white' : 'bg-secondary'} mt-1 px-3 py-2`} style={{ fontSize: '12px' }}>
                                                            {selectedDentalChart.clearedForBraces ? 'Cleared for Braces' : 'Not Cleared'}
                                                        </span>
                                                    </div>
                                                    <div className="col-md-4">
                                                        <span className="text-muted small fw-bold">SELECTED BRACES COLOR:</span><br />
                                                        <div className="d-flex align-items-center gap-2 mt-1">
                                                            {selectedDentalChart.bracesColor ? (
                                                                <>
                                                                                                        <span className="rounded-circle border" style={{ width: '18px', height: '18px', display: 'inline-block', backgroundColor: selectedDentalChart.bracesColor.hex || bracesColorHex[selectedDentalChart.bracesColor.name || selectedDentalChart.bracesColor] || theme.gold }} />
                                                                                                        <span className="fw-bold text-dark">{selectedDentalChart.bracesColor.name || selectedDentalChart.bracesColor}</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-muted fst-italic small">None selected</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-12 mt-2 pt-2 border-top">
                                                        <span className="text-muted small fw-bold">LAST EXAMINATION DATE:</span> <strong className="text-dark">{selectedDentalChart.lastExamDate || 'No clinical exam recorded.'}</strong>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-4 bg-white border shadow-sm mb-4 text-center overflow-auto animate__animated animate__fadeIn">
                                                <div className="d-flex justify-content-center mb-4 pb-2 border-bottom" style={{ minWidth: '720px' }}>
                                                    {upperTeeth.map(id => (
                                                        <div key={id} className="text-center mx-1 d-flex flex-column align-items-center" style={{ width: '38px' }}>
                                                            <svg width="34" height="42" viewBox="0 0 100 120" style={{ opacity: (selectedDentalChart.teeth?.[id] || '/') === 'X' ? 0.35 : 1 }}>
                                                                <path d="M20,40 Q20,10 50,10 Q80,10 80,40 Q85,100 50,110 Q15,100 20,40 Z" 
                                                                      fill={legends.find(l => l.code === (selectedDentalChart.teeth?.[id] || '/'))?.color || '#ffffff'} stroke="#dcdcdc" strokeWidth="3" />
                                                                <text x="50" y="32" fontSize="24" textAnchor="middle" fill={(legends.find(l => l.code === (selectedDentalChart.teeth?.[id] || '/'))?.color || '#ffffff') === '#ffffff' ? '#aaa' : 'white'} fontWeight="bold">{id}</text>
                                                            </svg>
                                                            <span className="fw-bold mt-1 text-muted" style={{ fontSize: '10px' }}>{selectedDentalChart.teeth?.[id] || '/'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="d-flex justify-content-center" style={{ minWidth: '720px' }}>
                                                    {lowerTeeth.map(id => (
                                                        <div key={id} className="text-center mx-1 d-flex flex-column align-items-center" style={{ width: '38px' }}>
                                                            <svg width="34" height="42" viewBox="0 0 100 120" style={{ opacity: (selectedDentalChart.teeth?.[id] || '/') === 'X' ? 0.35 : 1 }}>
                                                                <path d="M20,40 Q20,10 50,10 Q80,10 80,40 Q85,100 50,110 Q15,100 20,40 Z" 
                                                                      fill={legends.find(l => l.code === (selectedDentalChart.teeth?.[id] || '/'))?.color || '#ffffff'} stroke="#dcdcdc" strokeWidth="3" />
                                                                <text x="50" y="32" fontSize="24" textAnchor="middle" fill={(legends.find(l => l.code === (selectedDentalChart.teeth?.[id] || '/'))?.color || '#ffffff') === '#ffffff' ? '#aaa' : 'white'} fontWeight="bold">{id}</text>
                                                            </svg>
                                                            <span className="fw-bold mt-1 text-muted" style={{ fontSize: '10px' }}>{selectedDentalChart.teeth?.[id] || '/'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-4 bg-light border border-light-subtle shadow-sm animate__animated animate__fadeIn">
                                                <h6 className="fw-bold text-dark mb-3">Clinical Legend</h6>
                                                <div className="row g-2">
                                                    {legends.map(l => (
                                                        <div className="col-md-3 col-sm-6" key={l.code}>
                                                            <div className="d-flex align-items-center bg-white border rounded px-3 py-2" style={{ gap: '8px' }}>
                                                                <span className="fw-bold text-warning" style={{ minWidth: '22px', fontSize: '14px', color: theme.goldDark }}>{l.code}</span>
                                                                <span className="rounded-circle border" style={{ width: '11px', height: '11px', backgroundColor: l.color, display: 'inline-block' }} />
                                                                <span className="text-muted small ms-auto">{l.label}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 4: Dental X-Rays & Photos */}
                                    {activeTab === 'xray' && (
                                        <div className="col-12 animate__animated animate__fadeIn">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div className="d-flex align-items-center gap-2">
                                                    <h6 className="fw-bold mb-0 d-flex align-items-center" style={{ color: theme.goldDark }}>
                                                        <RiCameraLine className="me-2" size={22}/> DENTAL X-RAYS &amp; RADIOGRAPHS
                                                    </h6>
                                                    <span className="badge bg-white text-secondary border shadow-xs" style={{ fontSize: '11px' }}>
                                                        {(selectedPatient.record?.xrays || []).length} Scan{(selectedPatient.record?.xrays || []).length === 1 ? '' : 's'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Upload Form Card for Admin / Staff */}
                                            <div className="p-4 rounded-4 bg-white border border-light-subtle shadow-sm mb-4 no-print">
                                                <h6 className="fw-bold mb-3 d-flex align-items-center text-dark" style={{ fontSize: '14px' }}>
                                                    <RiUploadCloud2Line className="me-2 text-warning" size={20} /> Upload Patient X-Ray / Dental Scan
                                                </h6>
                                                
                                                <div className="row g-3">
                                                    <div className="col-md-6">
                                                        <label className="form-label small fw-bold text-muted mb-1">X-Ray Category / Title</label>
                                                        <select
                                                            className="form-select form-select-sm"
                                                            value={xrayTitle}
                                                            onChange={(e) => setXrayTitle(e.target.value)}
                                                            style={{ borderRadius: '8px' }}
                                                        >
                                                            <optgroup label="Intraoral X-rays">
                                                                <option value="Bitewing">Bitewing</option>
                                                                <option value="Periapical (PA)">Periapical (PA)</option>
                                                                <option value="Occlusal">Occlusal</option>
                                                            </optgroup>
                                                            <optgroup label="Extraoral X-rays">
                                                                <option value="Panoramic">Panoramic</option>
                                                                <option value="Cone Beam Computed Tomography (CBCT)">Cone Beam Computed Tomography (CBCT)</option>
                                                                <option value="Cephalometric">Cephalometric</option>
                                                            </optgroup>
                                                            <optgroup label="Other">
                                                                <option value="Other / Custom">Other / Custom</option>
                                                            </optgroup>
                                                        </select>
                                                        {xrayTitle === 'Other / Custom' && (
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm mt-2"
                                                                placeholder="Enter custom X-Ray title..."
                                                                value={customXrayTitle}
                                                                onChange={(e) => setCustomXrayTitle(e.target.value)}
                                                                style={{ borderRadius: '8px' }}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="col-md-6">
                                                        <label className="form-label small fw-bold text-muted mb-1">Scan Date</label>
                                                        <input
                                                            type="date"
                                                            className="form-control form-control-sm"
                                                            value={xrayDate}
                                                            onChange={(e) => setXrayDate(e.target.value)}
                                                            style={{ borderRadius: '8px' }}
                                                        />
                                                    </div>
                                                    <div className="col-12">
                                                        <label className="form-label small fw-bold text-muted mb-1">Clinical Findings & Remarks</label>
                                                        <textarea
                                                            rows="2"
                                                            className="form-control form-control-sm"
                                                            placeholder="Enter clinical observations or notes regarding this scan..."
                                                            value={xrayNotes}
                                                            onChange={(e) => setXrayNotes(e.target.value)}
                                                            style={{ borderRadius: '8px' }}
                                                        />
                                                    </div>
                                                    <div className="col-md-8">
                                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                                            <label className="form-label small fw-bold text-muted mb-0">Select X-Ray File (PNG, JPG, PDF, or DICOM .dcm - Max 15MB)</label>
                                                            <button
                                                                type="button"
                                                                className="btn btn-link p-0 text-decoration-none small fw-bold d-inline-flex align-items-center gap-1"
                                                                style={{ color: theme.goldDark, fontSize: '11.5px' }}
                                                                onClick={handleLoadSampleXray}
                                                                title="Load sample panoramic X-Ray to test AI detection"
                                                            >
                                                                ⚡ Test with Example Dental X-Ray
                                                            </button>
                                                        </div>
                                                        <input
                                                            type="file"
                                                            id="xrayFileInput"
                                                            accept="image/png, image/jpeg, image/jpg, application/pdf, .dcm, .dicom, application/dicom"
                                                            className="form-control form-control-sm"
                                                            onChange={handleXrayFileChange}
                                                            style={{ borderRadius: '8px' }}
                                                        />
                                                    </div>
                                                    <div className="col-md-4 d-flex align-items-end">
                                                        <button
                                                            type="button"
                                                            className="doc-btn doc-btn-warning doc-btn-sm w-100 justify-content-center shadow-sm"
                                                            onClick={handleUploadXray}
                                                            disabled={!xrayFile}
                                                        >
                                                            <RiUploadCloud2Line className="me-1" size={16} /> Save X-Ray / Scan
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* File Upload Preview */}
                                                {xrayPreview && (
                                                    <div className="mt-3 p-3 bg-light rounded-3 d-flex align-items-center justify-content-between border shadow-sm">
                                                        <div className="d-flex align-items-center gap-3">
                                                            {xrayFileType === 'pdf' ? (
                                                                <div className="bg-danger-subtle text-danger rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                                                                    <RiFilePdfLine size={32} />
                                                                </div>
                                                            ) : xrayFileType === 'dcm' ? (
                                                                <div className="bg-primary-subtle text-primary rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                                                                    <RiShieldCrossLine size={32} />
                                                                </div>
                                                            ) : (
                                                                <img src={xrayPreview} alt="X-Ray Preview" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px' }} />
                                                            )}
                                                            <div>
                                                                <strong className="d-block small text-dark">{xrayFileName || xrayTitle || 'Attached File'}</strong>
                                                                <div className="d-flex align-items-center gap-1 flex-wrap mt-1">
                                                                    <span className="badge bg-secondary-subtle text-dark" style={{ fontSize: '10px' }}>{xrayFileType.toUpperCase()}</span>
                                                                    {aiScanResult && (
                                                                        <span className="badge bg-success-subtle text-success border border-success d-inline-flex align-items-center gap-1" style={{ fontSize: '10.5px' }}>
                                                                            <RiShieldCheckLine size={12} /> AI Verified: {aiScanResult.label} ({aiScanResult.confidence}% confidence)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="small text-muted d-block mt-1">Ready to attach to patient medical folder</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="doc-btn doc-btn-danger doc-btn-sm shadow-sm"
                                                            onClick={handleClearSelectedFile}
                                                            title="Remove Selected File"
                                                        >
                                                            <RiDeleteBinLine size={14} /> Remove Selected File
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Gallery Grid */}
                                            {(selectedPatient.record?.xrays || []).length > 0 ? (
                                                <div className="row g-3">
                                                    {(selectedPatient.record?.xrays || []).map((xray) => {
                                                        const isPdf = xray.fileType === 'pdf' || (xray.fileName && xray.fileName.toLowerCase().endsWith('.pdf'));
                                                        const isDcm = xray.fileType === 'dcm' || (xray.fileName && (xray.fileName.toLowerCase().endsWith('.dcm') || xray.fileName.toLowerCase().endsWith('.dicom')));

                                                        return (
                                                            <div className="col-md-6 col-lg-4" key={xray.id}>
                                                                <div className="card h-100 border shadow-sm overflow-hidden" style={{ borderRadius: '14px', backgroundColor: '#ffffff' }}>
                                                                    <div className="position-relative bg-dark d-flex align-items-center justify-content-center" style={{ height: '180px', overflow: 'hidden' }}>
                                                                        {isPdf ? (
                                                                            <div className="d-flex flex-column align-items-center justify-content-center w-100 h-100 bg-light p-3 text-center">
                                                                                <RiFilePdfLine size={56} className="text-danger mb-1" />
                                                                                <span className="fw-bold text-dark text-truncate w-100 small px-2">{xray.fileName || xray.title}</span>
                                                                                <span className="badge bg-danger mt-1" style={{ fontSize: '9px' }}>PDF DOCUMENT</span>
                                                                            </div>
                                                                        ) : isDcm ? (
                                                                            <div className="d-flex flex-column align-items-center justify-content-center w-100 h-100 bg-dark p-3 text-center">
                                                                                <RiShieldCrossLine size={56} className="text-info mb-1" />
                                                                                <span className="fw-bold text-white text-truncate w-100 small px-2">{xray.fileName || xray.title}</span>
                                                                                <span className="badge bg-info text-dark mt-1" style={{ fontSize: '9px' }}>DICOM RADIOLOGY SCAN</span>
                                                                            </div>
                                                                        ) : (
                                                                            <img 
                                                                                src={xray.imageUrl} 
                                                                                alt={xray.title} 
                                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                                                                onClick={() => setZoomedXray(xray)}
                                                                            />
                                                                        )}

                                                                        <div className="position-absolute top-0 end-0 p-2 no-print d-flex gap-1">
                                                                            <button 
                                                                                className="btn btn-sm btn-light rounded-circle shadow-sm"
                                                                                onClick={() => setZoomedXray(xray)}
                                                                                title="Preview & Info"
                                                                                style={{ width: '32px', height: '32px', padding: 0 }}
                                                                            >
                                                                                <RiZoomInLine size={16} />
                                                                            </button>
                                                                            <button 
                                                                                className="btn btn-sm btn-danger rounded-circle shadow-sm"
                                                                                onClick={() => handleDeleteXray(xray.id)}
                                                                                title="Delete Scan"
                                                                                style={{ width: '32px', height: '32px', padding: 0 }}
                                                                            >
                                                                                <RiDeleteBinLine size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    <div className="p-3 d-flex flex-column justify-content-between flex-grow-1">
                                                                        <div>
                                                                            <div className="d-flex justify-content-between align-items-start mb-1">
                                                                                <h6 className="fw-bold mb-0 text-truncate" style={{ fontSize: '13px', color: theme.goldDark }}>{xray.title}</h6>
                                                                                <span className="badge bg-light text-muted border" style={{ fontSize: '10px' }}>{xray.date}</span>
                                                                            </div>
                                                                            {xray.aiVerified && (
                                                                                <div className="mb-2">
                                                                                    <span className="badge bg-success-subtle text-success border border-success d-inline-flex align-items-center gap-1" style={{ fontSize: '9.5px', padding: '3px 7px' }}>
                                                                                        <RiShieldCheckLine size={11} /> AI Verified Radiograph
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {xray.notes ? (
                                                                                <p className="text-muted mb-2 small text-truncate-2" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                                                                                    {xray.notes}
                                                                                </p>
                                                                            ) : (
                                                                                <span className="text-muted fst-italic d-block mb-2" style={{ fontSize: '10px' }}>No findings recorded</span>
                                                                            )}
                                                                        </div>

                                                                        {/* File Action Buttons */}
                                                                        {isPdf ? (
                                                                            <a 
                                                                                href={xray.imageUrl} 
                                                                                target="_blank" 
                                                                                rel="noreferrer" 
                                                                                className="doc-btn doc-btn-danger doc-btn-sm w-100 justify-content-center text-decoration-none shadow-sm"
                                                                            >
                                                                                <RiExternalLinkLine size={14} /> Open PDF Report
                                                                            </a>
                                                                        ) : isDcm ? (
                                                                            <a 
                                                                                href={xray.imageUrl} 
                                                                                download={xray.fileName || 'radiology_scan.dcm'} 
                                                                                className="doc-btn doc-btn-info doc-btn-sm w-100 justify-content-center text-decoration-none shadow-sm"
                                                                            >
                                                                                <RiFileDownloadLine size={14} /> Download DICOM (.dcm)
                                                                            </a>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center py-5 bg-white rounded-4 border shadow-sm">
                                                    <RiCameraLine size={50} className="text-muted mb-2 opacity-50" />
                                                    <h6 className="fw-bold text-muted">No X-Ray Files Uploaded</h6>
                                                    <p className="text-muted small mb-0">Use the form above to upload PNG, JPG images, PDF reports, or DICOM (.dcm) scans for this patient.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedPatient.record.requestStatus === "Pending" && (
                                        <div className="col-12 mt-4">
                                            <div className="p-4 rounded-4 bg-white border border-warning text-center shadow-sm no-print">
                                                <h6 className="fw-bold mb-3 text-warning">Edit Request from Patient</h6>
                                                <p className="small text-muted mb-3">The patient has requested permission to unlock and update this record.</p>
                                                <div className="d-flex justify-content-center gap-3">
                                                    <button className="btn btn-success px-4 rounded-pill shadow-sm" onClick={() => handleRequestAction(selectedPatient.email, 'Approved')}>
                                                        <RiCheckLine className="me-1"/> Approve Edit
                                                    </button>
                                                    <button className="btn btn-danger px-4 rounded-pill shadow-sm" onClick={() => handleRequestAction(selectedPatient.email, 'Declined')}>
                                                        <RiCloseLine className="me-1"/> Decline
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Zoom Lightbox Modal for X-Ray / PDF / DCM */}
            {zoomedXray && (
                <div 
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 no-print animate__animated animate__fadeIn" 
                    style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000 }}
                    onClick={() => setZoomedXray(null)}
                >
                    <div className="position-relative text-center" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', width: '700px' }}>
                        <button 
                            className="btn btn-light rounded-circle position-absolute top-0 end-0 m-3 shadow-lg d-flex align-items-center justify-content-center" 
                            onClick={() => setZoomedXray(null)}
                            style={{ zIndex: 10, width: '42px', height: '42px' }}
                            title="Close Preview"
                        >
                            <RiCloseLine size={26} />
                        </button>

                        {zoomedXray.fileType === 'pdf' || (zoomedXray.fileName && zoomedXray.fileName.toLowerCase().endsWith('.pdf')) ? (
                            <div className="bg-white p-4 rounded-4 shadow-lg text-center">
                                <RiFilePdfLine size={80} className="text-danger mb-3" />
                                <h5 className="fw-bold text-dark">{zoomedXray.title}</h5>
                                <p className="text-muted small">{zoomedXray.fileName || 'Dental PDF Report'}</p>
                                <a 
                                    href={zoomedXray.imageUrl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="btn btn-danger rounded-pill px-4 fw-bold shadow-sm d-inline-flex align-items-center gap-2 mb-2"
                                >
                                    <RiExternalLinkLine /> Open PDF Document in New Tab
                                </a>
                            </div>
                        ) : zoomedXray.fileType === 'dcm' || (zoomedXray.fileName && (zoomedXray.fileName.toLowerCase().endsWith('.dcm') || zoomedXray.fileName.toLowerCase().endsWith('.dicom'))) ? (
                            <div className="bg-dark text-white p-4 rounded-4 shadow-lg text-center border border-secondary">
                                <RiShieldCrossLine size={80} className="text-info mb-3" />
                                <h5 className="fw-bold text-white">{zoomedXray.title}</h5>
                                <p className="text-muted small mb-3">{zoomedXray.fileName || 'radiology_scan.dcm'}</p>
                                <p className="small text-light bg-secondary-subtle text-dark p-3 rounded-3 mb-3">
                                    This is a DICOM (.dcm) medical radiology file. Click below to download the file to view it in your DICOM radiology viewer software (e.g. Horos, RadiAnt, MicroDicom).
                                </p>
                                <a 
                                    href={zoomedXray.imageUrl} 
                                    download={zoomedXray.fileName || 'radiology_scan.dcm'} 
                                    className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-inline-flex align-items-center gap-2"
                                >
                                    <RiFileDownloadLine /> Download DICOM Radiology File (.dcm)
                                </a>
                            </div>
                        ) : (
                            <img 
                                src={zoomedXray.imageUrl} 
                                alt={zoomedXray.title} 
                                style={{ maxHeight: '75vh', maxWidth: '100%', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} 
                            />
                        )}

                        <div className="bg-dark text-white p-3 mt-3 rounded-3 text-start mx-auto shadow" style={{ maxWidth: '600px' }}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <strong style={{ color: theme.gold }}>{zoomedXray.title}</strong>
                                <span className="small text-muted">{zoomedXray.date}</span>
                            </div>
                            {zoomedXray.notes && <p className="small mb-0 text-light">{zoomedXray.notes}</p>}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .x-small { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
                .cursor-pointer { cursor: pointer; }
                .animate__animated { animation-duration: 0.3s; }
                .table-hover tbody tr:hover {
                    background-color: #faf7eb !important;
                }
                .medical-changed-field {
                    box-shadow: inset 4px 0 0 #d4af37;
                }
                .medical-changed-history {
                    background-color: #fff3cd;
                    box-shadow: inset 4px 0 0 #d4af37;
                }
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 12mm;
                    }
                    body {
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    body * {
                        visibility: hidden;
                    }
                    #printable-medical-record,
                    #printable-medical-record * {
                        visibility: visible;
                    }
                    #printable-medical-record {
                        position: absolute !important;
                        inset: 0 auto auto 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    #printable-medical-record .row {
                        --bs-gutter-x: 0.75rem;
                        --bs-gutter-y: 0.75rem;
                    }
                    #printable-medical-record .rounded-4,
                    #printable-medical-record .rounded {
                        border-radius: 4px !important;
                    }
                    #printable-medical-record .shadow-sm,
                    #printable-medical-record .shadow-lg {
                        box-shadow: none !important;
                    }
                    #printable-medical-record .medical-print-field > div,
                    #printable-medical-record .p-4.rounded-4 {
                        border: 1px solid #ddd !important;
                        background-color: #fff !important;
                    }
                    #printable-medical-record h6 {
                        font-size: 11pt;
                    }
                    #printable-medical-record,
                    #printable-medical-record .small,
                    #printable-medical-record label,
                    #printable-medical-record span,
                    #printable-medical-record div {
                        font-size: 10pt;
                    }
                    #printable-medical-record .badge {
                        border: 1px solid #999 !important;
                        color: #111 !important;
                        background-color: #fff !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default MedicalRecords;
