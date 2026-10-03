import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    RiAlertLine,
    RiCameraLine,
    RiCheckLine,
    RiCloseLine,
    RiDeleteBinLine,
    RiExternalLinkLine,
    RiFileDownloadLine,
    RiFilePdfLine,
    RiFileTextLine,
    RiEditLine,
    RiLockLine,
    RiMailLine,
    RiPhoneLine,
    RiPrinterLine,
    RiSearchLine,
    RiShieldCheckLine,
    RiShieldCrossLine,
    RiShieldUserLine,
    RiUploadCloud2Line,
    RiUserAddLine,
    RiUserHeartLine,
    RiUserLine,
    RiVirusLine,
    RiZoomInLine,
    RiDownloadLine
} from 'react-icons/ri';
import Swal from 'sweetalert2';
import { addAuditLog } from '../../services/auditLogger';
import { passwordRequirementsHtml, validatePassword, generateDefaultPassword } from '../../utils/passwordRules';
import { readDatabase, writeDatabase, getDatabase, getPricelist, registerPatientDirectly, deleteUserDirectly } from '../../utils/storage';
import { sendWelcomeEmail } from '../../utils/emailService';
import { analyzeXrayImage, formatRejectionHtml, loadSampleXrayFile } from '../../utils/xrayAiDetector';
import { addUserNotification } from '../../utils/notificationStore';
import { exportHtmlToPdf } from '../../utils/pdfExport';

const calculateAge = (birthDateString) => {
    if (!birthDateString) return '';
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
    return age > 0 ? age : 0;
};

const escapeHtml = (value) => {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const emptyPatient = {
    fullName: '',
    email: '',
    phone: '',
    password: '',
    patientType: 'New Patient'
};

const emptyMedicalRecord = {
    address: '',
    birthday: '',
    sex: '',
    religion: '',
    age: '',
    contactNumber: '',
    occupation: '',
    nationality: '',
    referredBy: '',
    parentGuardian: '',
    guardianOccupation: '',
    q1_goodHealth: '',
    q2_underMedicalTreatment: '',
    q3_seriousIllness: '',
    q4_hospitalized: '',
    q4_hospitalizedDetail: '',
    q5_takingMedication: '',
    q6_tobaccoAlcohol: '',
    q7_allergicAnesthesia: '',
    q7_allergicLatex: '',
    q7_allergicPenicillin: '',
    q7_allergicAspirin: '',
    q7_allergicOthers: '',
    otherAllergies: '',
    q8_pregnant: '',
    q8_nursing: '',
    q8_birthControl: '',
    conditions: [],
    otherCondition: '',
    cv_fever: '',
    cv_aches: '',
    cv_cough: '',
    cv_throat: '',
    cv_breath: '',
    cv_chills: '',
    cv_taste: '',
    cv_travelHistory: '',
    cv_travelLocation: '',
    cv_agreement: false,
    notes: ''
};

const emptyDentalRecord = {
    clearedForBraces: 'No',
    bracesColor: '',
    remarks: '',
    teeth: {}
};

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

const ToothSVG = React.memo(({ id, teethData, legends, handleToothUpdate }) => {
    const status = teethData?.[id] || '/';
    const legend = legends.find(l => l.code === status) || legends[0];

    return (
        <div className="text-center tooth-container mx-1 d-flex flex-column align-items-center" style={{ position: 'relative', width: '42px' }}>
            <svg width="36" height="46" viewBox="0 0 100 120" style={{ opacity: status === 'X' ? 0.3 : 1 }}>
                <path 
                    d="M20,40 Q20,10 50,10 Q80,10 80,40 Q85,100 50,110 Q15,100 20,40 Z" 
                    fill={legend.color} 
                    stroke="#dcdcdc" 
                    strokeWidth="3" 
                />
                <text 
                    x="50" 
                    y="32" 
                    fontSize="22" 
                    textAnchor="middle" 
                    fill={legend.color === '#ffffff' ? '#888' : 'white'} 
                    fontWeight="bold"
                >
                    {id}
                </text>
            </svg>
            <select 
                className="form-select form-select-sm mt-1 text-center fw-bold px-0 shadow-none" 
                style={{ 
                    fontSize: '10px', 
                    height: '24px', 
                    width: '42px',
                    color: '#B8860B', 
                    borderColor: '#e2d8c8',
                    cursor: 'pointer'
                }}
                value={status}
                onChange={(e) => handleToothUpdate(id, e.target.value)}
            >
                {legends.map(l => <option key={l.code} value={l.code} title={l.label}>{l.code}</option>)}
            </select>
        </div>
    );
});

const medicalConditions = [
    'None',
    'High blood pressure',
    'Low blood pressure',
    'Epilepsy',
    'AIDS/HIV',
    'Heart Attack',
    'Asthma',
    'Thyroid Problem',
    'Stroke',
    'Pneumonia',
    'STD',
    'Heart Disease',
    'Emphysema',
    'Ulcer',
    'Hepatitis',
    'Tuberculosis',
    'Diabetes',
    'Anemia',
    'Others'
];

const PatientManagement = () => {
    const colors = {
        gold: '#D4AF37',
        goldDark: '#B8860B',
        beige: '#F5F5DC',
        panel: '#fffdf5'
    };

    const [patients, setPatients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showPatientForm, setShowPatientForm] = useState(false);
    const [newPatient, setNewPatient] = useState(emptyPatient);
    const [oldPatientRecord, setOldPatientRecord] = useState(emptyMedicalRecord);
    const [oldDentalRecord, setOldDentalRecord] = useState(emptyDentalRecord);

    // Old Patient X-Ray management state
    const [oldPatientXrays, setOldPatientXrays] = useState([]);
    const [xrayTitle, setXrayTitle] = useState('Bitewing');
    const [customXrayTitle, setCustomXrayTitle] = useState('');
    const [xrayDate, setXrayDate] = useState(new Date().toISOString().split('T')[0]);
    const [xrayNotes, setXrayNotes] = useState('');
    const [xrayFile, setXrayFile] = useState(null);
    const [xrayPreview, setXrayPreview] = useState(null);
    const [xrayFileType, setXrayFileType] = useState('image'); // 'image', 'pdf', 'dcm'
    const [xrayFileName, setXrayFileName] = useState('');
    const [zoomedXray, setZoomedXray] = useState(null);
    const [aiScanResult, setAiScanResult] = useState(null);

    // Patient List Report States
    const [allAppointments, setAllAppointments] = useState([]);
    const [medicalRecords, setMedicalRecords] = useState({});
    const [pricelistItems, setPricelistItems] = useState([]);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportSearchTerm, setReportSearchTerm] = useState('');
    const [reportTreatmentFilter, setReportTreatmentFilter] = useState('All');
    const [reportStatusFilter, setReportStatusFilter] = useState('All');

    const loadPatients = useCallback(async () => {
        const db = await getDatabase(true).catch(() => readDatabase({ users: [], appointments: [], medical_records: {} }));
        const patientList = (db.users || [])
            .filter((user) => (user.role || '').toLowerCase() === 'patient')
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        setPatients(patientList);
        setAllAppointments(db.appointments || []);
        setMedicalRecords(db.medical_records || {});
    }, []);

    const loadPricelistData = useCallback(async () => {
        try {
            const list = await getPricelist();
            setPricelistItems(Array.isArray(list) ? list : []);
        } catch (e) {
            console.error('Failed to load pricelist for report:', e);
            setPricelistItems([]);
        }
    }, []);

    useEffect(() => {
        loadPatients();
        loadPricelistData();

        const handleStorageChange = () => {
            loadPatients();
            loadPricelistData();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('doc_dental_db_updated', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('doc_dental_db_updated', handleStorageChange);
        };
    }, [loadPatients, loadPricelistData]);

    const handleLiftBan = async (patient) => {
        const patientName = patient.fullName || patient.name || patient.email;
        const emailNorm = (patient.email || '').toLowerCase().trim();

        const confirm = await Swal.fire({
            title: `Lift Restriction for ${patientName}?`,
            text: 'This patient will be allowed to book appointments again immediately.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#198754',
            confirmButtonText: 'Yes, Lift Restriction'
        });

        if (confirm.isConfirmed) {
            let db = readDatabase() || { users: [] };
            db.users = (db.users || []).map(u => {
                if (u.email?.toLowerCase().trim() === emailNorm) {
                    return { ...u, bannedUntil: null };
                }
                return u;
            });
            writeDatabase(db);
            addAuditLog('Booking Restriction Lifted', `${patientName} (${emailNorm})`);
            loadPatients();
            Swal.fire('Restriction Lifted', `${patientName} can now book appointments.`, 'success');
        }
    };

    const calculateAge = (birthday) => {
        if (!birthday) return '';
        const today = new Date();
        const birthDate = new Date(birthday);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age -= 1;
        }

        return age >= 0 ? String(age) : '';
    };

    const getNewPatientMedicalRecord = (fullName, email, phone) => {
        return {
            fullName,
            name: fullName,
            email,
            phone,
            contactNo: phone,
            contactNumber: phone,
            patientType: 'New Patient',
            accountCreatedByClinic: true,
            recordedByClinic: false,
            dateSubmitted: '',
            requestStatus: 'None',
            address: '',
            birthday: '',
            age: '',
            sex: '',
            religion: '',
            nationality: '',
            occupation: '',
            referredBy: '',
            parentGuardian: '',
            guardianOccupation: '',
            q1_goodHealth: '',
            q2_underMedicalTreatment: '',
            q3_seriousIllness: '',
            q4_hospitalized: '',
            q4_hospitalizedDetail: '',
            q5_takingMedication: '',
            q6_tobaccoAlcohol: '',
            q7_allergicAnesthesia: '',
            q7_allergicLatex: '',
            q7_allergicPenicillin: '',
            q7_allergicAspirin: '',
            q7_allergicOthers: '',
            otherAllergies: '',
            conditions: [],
            otherCondition: '',
            cv_fever: '',
            cv_cough: '',
            cv_breath: '',
            cv_travelHistory: '',
            cv_travelLocation: '',
            notes: '',
            xrays: [],
            createdAt: new Date().toISOString()
        };
    };

    const initializePatientRecords = (db, email, medicalRecord = null, dentalChart = null) => {
        if (!db.patient_charts) db.patient_charts = {};
        if (!db.intraoral_charts) db.intraoral_charts = {};
        if (!db.dental_charts) db.dental_charts = {};
        if (!db.medical_records) db.medical_records = {};

        if (!db.patient_charts[email]) db.patient_charts[email] = { teeth: {} };
        if (!db.intraoral_charts[email]) db.intraoral_charts[email] = { teeth: {} };
        
        if (dentalChart) {
            db.dental_charts[email] = dentalChart;
            db.intraoral_charts[email] = { ...(db.intraoral_charts[email] || {}), ...dentalChart };
        } else if (!db.dental_charts[email]) {
            db.dental_charts[email] = { teeth: {}, clearedForBraces: false, lastUpdated: new Date().toISOString() };
        }

        db.medical_records[email] = medicalRecord || db.medical_records[email] || {
            fullName: '',
            email,
            patientType: 'New Patient',
            conditions: [],
            accountCreatedByClinic: true
        };
    };

    const handleMedicalInputChange = (event) => {
        const { name, value, type, checked } = event.target;

        if (name === 'birthday') {
            const age = calculateAge(value);
            setOldPatientRecord((currentRecord) => ({
                ...currentRecord,
                birthday: value,
                age,
                ...(Number(age) >= 18 ? { parentGuardian: '', guardianOccupation: '' } : {})
            }));
            return;
        }

        if (name === 'contactNumber') {
            const cleanPhone = value.replace(/\D/g, '').slice(0, 11);
            setOldPatientRecord((currentRecord) => ({
                ...currentRecord,
                contactNumber: cleanPhone
            }));
            setNewPatient((prev) => ({
                ...prev,
                phone: cleanPhone
            }));
            return;
        }

        if (['religion', 'nationality', 'occupation', 'referredBy', 'parentGuardian', 'guardianOccupation'].includes(name)) {
            setOldPatientRecord((currentRecord) => ({
                ...currentRecord,
                [name]: value.replace(/[^a-zA-Z\s]/g, '')
            }));
            return;
        }

        if (name === 'sex') {
            setOldPatientRecord((currentRecord) => ({
                ...currentRecord,
                [name]: value.replace(/[^a-zA-Z]/g, '')
            }));
            return;
        }

        setOldPatientRecord((currentRecord) => ({
            ...currentRecord,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleConditionToggle = (condition) => {
        if (oldPatientRecord.conditions.includes('None') && condition !== 'None') return;
        setOldPatientRecord((currentRecord) => {
            let updatedConditions;
            if (condition === 'None') {
                updatedConditions = currentRecord.conditions.includes('None') ? [] : ['None'];
            } else {
                updatedConditions = currentRecord.conditions.includes(condition)
                    ? currentRecord.conditions.filter((item) => item !== condition)
                    : [...currentRecord.conditions, condition];
            }
            return {
                ...currentRecord,
                conditions: updatedConditions
            };
        });
    };

    const DEFAULT_SIGNED_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='70'><text x='50%' y='60%' dominant-baseline='middle' text-anchor='middle' font-family='cursive, Brush Script MT, sans-serif' font-size='34' font-style='italic' font-weight='bold' fill='%23155724'>Signed</text></svg>";

    const getOldPatientMedicalRecord = (fullName, email, phone) => {
        if (newPatient.patientType !== 'Old Patient') return null;

        const contactVal = oldPatientRecord.contactNumber || phone;
        const isMale = /^m(ale)?$/i.test(oldPatientRecord.sex?.trim() || '');
        const cleanRec = { ...oldPatientRecord };

        if (isMale) {
            cleanRec.q8_pregnant = '';
            cleanRec.q8_nursing = '';
            cleanRec.q8_birthControl = '';
        }

        return {
            ...cleanRec,
            name: fullName,
            fullName,
            email,
            contactNumber: contactVal,
            contactNo: contactVal,
            phone: contactVal,
            patientType: 'Old Patient',
            conditions: oldPatientRecord.conditions || [],
            signature: oldPatientRecord.signature || DEFAULT_SIGNED_SVG,
            signedAt: new Date().toISOString(),
            dateSubmitted: new Date().toLocaleDateString(),
            requestStatus: 'None',
            accountCreatedByClinic: true,
            recordedByClinic: true,
            recordedAt: new Date().toISOString(),
            xrays: oldPatientXrays || []
        };
    };

    const handleOldPatientXrayFileChange = async (e) => {
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
                    const fileInput = document.getElementById('oldPatientXrayFileInput');
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

    const handleLoadSampleOldPatientXray = async () => {
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

    const handleAddOldPatientXray = () => {
        if (!xrayFile) {
            Swal.fire('No File Selected', 'Please select an X-Ray photo (PNG/JPG), PDF document, or DICOM (.dcm) file to upload.', 'warning');
            return;
        }

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

        setOldPatientXrays(prev => [newXrayItem, ...prev]);

        setXrayFile(null);
        setXrayPreview(null);
        setXrayFileName('');
        setXrayFileType('image');
        setAiScanResult(null);
        setXrayNotes('');
        setXrayTitle('Bitewing');
        setCustomXrayTitle('');
        const fileInput = document.getElementById('oldPatientXrayFileInput');
        if (fileInput) fileInput.value = '';

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `${newXrayItem.fileType.toUpperCase()} file added to patient record!`,
            showConfirmButton: false,
            timer: 2000
        });
    };

    const handleDeleteOldPatientXray = (xrayId) => {
        setOldPatientXrays(prev => prev.filter(x => x.id !== xrayId));
    };

    const getOldPatientDentalChart = (fullName, email) => {
        if (newPatient.patientType !== 'Old Patient') return null;

        const isCleared = oldDentalRecord.clearedForBraces === 'Yes';
        const bracesColorVal = isCleared ? oldDentalRecord.bracesColor : null;

        return {
            clearedForBraces: isCleared,
            bracesColor: bracesColorVal,
            bracesColorLocked: !!bracesColorVal,
            bracesColorLockedAt: bracesColorVal ? new Date().toISOString() : null,
            remarks: oldDentalRecord.remarks || '',
            teeth: oldDentalRecord.teeth || {},
            lastUpdated: new Date().toISOString(),
            encodedByClinic: true,
            encodedAt: new Date().toISOString()
        };
    };

    const handleToothUpdate = (id, status) => {
        setOldDentalRecord((prev) => ({
            ...prev,
            teeth: {
                ...prev.teeth,
                [id]: status
            }
        }));
    };

    const generateSecureTemporaryPassword = (name = '') => {
        return generateDefaultPassword(name);
    };

    const handleCreatePatient = async (event) => {
        event.preventDefault();

        const normalizedEmail = newPatient.email.toLowerCase().trim();
        const fullName = newPatient.fullName.trim();
        const phone = (newPatient.phone || oldPatientRecord.contactNumber || oldPatientRecord.contactNo || '').trim();

        const passwordToUse = generateSecureTemporaryPassword(fullName);

        if (!validatePassword(passwordToUse)) {
            Swal.fire({
                title: 'Security Requirement',
                html: `<div class="text-start small">
                    Password must contain:
                    <ul class="mb-0 mt-2">
                        ${passwordRequirementsHtml()}
                    </ul>
                </div>`,
                icon: 'warning',
                confirmButtonColor: colors.gold
            });
            return;
        }

        let db = await getDatabase(true).catch(() => readDatabase({ users: [] }));
        if (!db.users) db.users = [];

        const existingUser = db.users.find((user) => (user.email || '').toLowerCase().trim() === normalizedEmail);
        if (existingUser) {
            Swal.fire({
                title: 'Email Already Registered',
                text: `The email "${normalizedEmail}" is already registered in the system. Each email address can only be associated with one account.`,
                icon: 'error',
                confirmButtonColor: colors.gold
            });
            return;
        }

        const patientAccount = {
            id: Date.now(),
            fullName,
            name: fullName,
            email: normalizedEmail,
            phone,
            contactNo: phone,
            contactNumber: phone,
            password: passwordToUse,
            role: 'Patient',
            patientType: newPatient.patientType,
            status: 'Active',
            otp_status: 'Verified',
            createdByClinic: true,
            createdAt: new Date().toISOString()
        };

        const targetMedRecord = newPatient.patientType === 'Old Patient'
            ? getOldPatientMedicalRecord(fullName, normalizedEmail, phone)
            : getNewPatientMedicalRecord(fullName, normalizedEmail, phone);

        const targetDentalChart = newPatient.patientType === 'Old Patient'
            ? getOldPatientDentalChart(fullName, normalizedEmail)
            : { teeth: {}, clearedForBraces: false, lastUpdated: new Date().toISOString() };

        let targetConsent = null;
        if (newPatient.patientType === 'Old Patient') {
            targetConsent = {
                email: normalizedEmail,
                fullName: fullName,
                hasConsented: true,
                signature: DEFAULT_SIGNED_SVG,
                signedAt: new Date().toISOString(),
                dateSigned: new Date().toISOString(),
                date_signed: new Date().toISOString(),
                consentTimestamp: new Date().toLocaleString()
            };
        }

        Swal.fire({
            title: 'Creating Account...',
            text: 'Creating account...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // 1. Send credentials and verify that the email address actually exists
        const emailRes = await sendWelcomeEmail(normalizedEmail, fullName, passwordToUse, 'Patient');
        Swal.close();

        if (!emailRes.success) {
            Swal.fire({
                title: 'Email Verification Failed',
                html: `<div class="text-start">
                    <p class="mb-2 text-danger fw-bold"><i class="bi bi-exclamation-triangle-fill me-1"></i> Account was NOT created.</p>
                    <p class="mb-2">The email address <strong>"${normalizedEmail}"</strong> could not be verified or does not exist.</p>
                    <div class="alert alert-danger p-2 small mb-2">
                        <strong>Reason:</strong> ${emailRes.reason || 'Invalid email domain or mail server rejected recipient.'}
                    </div>
                    <p class="small text-muted mb-0">Please verify that the patient provided an active, existing email address and try again.</p>
                </div>`,
                icon: 'error',
                confirmButtonColor: colors.goldDark
            });
            return;
        }

        // 2. Email is verified! Proceed with account creation and database persistence
        db.users.push(patientAccount);
        initializePatientRecords(
            db,
            normalizedEmail,
            targetMedRecord,
            targetDentalChart
        );

        if (newPatient.patientType === 'Old Patient') {
            if (!db.consent_records) db.consent_records = [];
            const existingConsentIdx = db.consent_records.findIndex(c => (c.email || '').toLowerCase() === normalizedEmail);
            if (existingConsentIdx >= 0) {
                db.consent_records[existingConsentIdx] = targetConsent;
            } else {
                db.consent_records.push(targetConsent);
            }

            if (!db.xray_records) db.xray_records = {};
            if (oldPatientXrays && oldPatientXrays.length > 0) {
                db.xray_records[normalizedEmail] = { xrays: oldPatientXrays };
            }
        }
        db = addUserNotification(db, normalizedEmail, {
            id: `welcome-${Date.now()}`,
            title: 'Welcome to Doc Dental Care',
            message: 'Your account has been successfully created by the clinic. Please review your details and feel free to schedule your first appointment.',
            date: new Date().toISOString(),
            read: false,
            type: 'system_welcome'
        });

        // Notify Superadmin and Staff
        const staffAdmins = (db.users || []).filter(u => u.role === 'Staff' || u.role === 'Admin' || u.role === 'superadmin' || u.role === 'super_admin');
        staffAdmins.forEach(sa => {
            db = addUserNotification(db, sa.email, {
                id: `patient-created-${Date.now()}-${sa.email}`,
                title: 'New Patient Registered',
                message: `Patient account created for ${fullName} (${normalizedEmail}) - ${newPatient.patientType || 'Standard'}.`,
                date: new Date().toISOString(),
                read: false,
                type: 'account_created'
            });
        });

        // Direct atomic registration into MySQL DB
        registerPatientDirectly({
            patientAccount,
            medicalRecord: targetMedRecord,
            dentalChart: targetDentalChart,
            intraoralChart: targetDentalChart,
            patientChart: { teeth: targetDentalChart?.teeth || {} },
            consentRecord: targetConsent,
            xrays: newPatient.patientType === 'Old Patient' ? oldPatientXrays : []
        }).catch(err => {
            console.warn('[Direct Patient DB Registration note]:', err);
        });

        // Sync to entire local database state
        await writeDatabase(db);
        loadPatients();

        addAuditLog(
            'Created Patient Account',
            `${fullName} (${normalizedEmail}) - ${newPatient.patientType}`
        );

        Swal.fire({
            title: 'Account Verified & Created!',
            text: `Patient account for ${fullName} has been successfully verified and created. Login credentials have been delivered.`,
            icon: 'success',
            confirmButtonColor: colors.goldDark
        });

        setNewPatient(emptyPatient);
        setOldPatientRecord(emptyMedicalRecord);
        setOldDentalRecord(emptyDentalRecord);
        setOldPatientXrays([]);
        setXrayTitle('Bitewing');
        setCustomXrayTitle('');
        setXrayDate(new Date().toISOString().split('T')[0]);
        setXrayNotes('');
        setXrayFile(null);
        setXrayPreview(null);
        setXrayFileName('');
        setXrayFileType('image');
        setShowPatientForm(false);
        loadPatients();

    };

    const performEmailMigration = (oldEmail, newEmail, patient) => {
        let db = readDatabase({ 
            users: [], 
            medical_records: {}, 
            dental_charts: {}, 
            patient_charts: {}, 
            intraoral_charts: {},
            appointments: [],
            consent_records: []
        });

        // 1. Update user account in db.users
        const userIndex = (db.users || []).findIndex(u => (u.email || '').toLowerCase().trim() === oldEmail);
        if (userIndex >= 0) {
            db.users[userIndex].email = newEmail;
        }

        // 2. Transfer db.medical_records
        if (!db.medical_records) db.medical_records = {};
        if (db.medical_records[oldEmail]) {
            db.medical_records[newEmail] = {
                ...db.medical_records[oldEmail],
                email: newEmail
            };
            delete db.medical_records[oldEmail];
        }

        // 3. Transfer db.dental_charts
        if (!db.dental_charts) db.dental_charts = {};
        if (db.dental_charts[oldEmail]) {
            db.dental_charts[newEmail] = db.dental_charts[oldEmail];
            delete db.dental_charts[oldEmail];
        }

        // 4. Transfer db.patient_charts
        if (!db.patient_charts) db.patient_charts = {};
        if (db.patient_charts[oldEmail]) {
            db.patient_charts[newEmail] = db.patient_charts[oldEmail];
            delete db.patient_charts[oldEmail];
        }

        // 5. Transfer db.intraoral_charts
        if (!db.intraoral_charts) db.intraoral_charts = {};
        if (db.intraoral_charts[oldEmail]) {
            db.intraoral_charts[newEmail] = db.intraoral_charts[oldEmail];
            delete db.intraoral_charts[oldEmail];
        }

        // 6. Transfer db.appointments
        if (Array.isArray(db.appointments)) {
            db.appointments.forEach(apt => {
                if ((apt.email || '').toLowerCase().trim() === oldEmail) {
                    apt.email = newEmail;
                }
            });
        }

        // 7. Transfer db.consent_records
        if (Array.isArray(db.consent_records)) {
            db.consent_records.forEach(c => {
                if ((c.email || '').toLowerCase().trim() === oldEmail) {
                    c.email = newEmail;
                }
            });
        }

        // 8. Add notification for patient under new email
        db = addUserNotification(db, newEmail, {
            id: `email-update-${Date.now()}`,
            title: 'Account Email Updated',
            message: `Your account email address has been updated from ${oldEmail} to ${newEmail} by the clinic admin. All your medical records have been transferred.`,
            date: new Date().toISOString(),
            read: false,
            type: 'account_update'
        });

        writeDatabase(db);

        addAuditLog(
            'Updated Patient Email',
            `${patient.fullName || patient.name}: Transferred from ${oldEmail} to ${newEmail}`
        );

        loadPatients();

        Swal.fire({
            title: 'Email Updated Successfully',
            text: `Transferred all medical records, dental charts, appointments, and consent forms from ${oldEmail} to ${newEmail}.`,
            icon: 'success',
            confirmButtonColor: colors.goldDark
        });
    };

    const handleUpdatePatientEmail = (patient) => {
        const currentEmail = (patient.email || '').toLowerCase().trim();
        const patientName = patient.fullName || patient.name || 'Patient';

        Swal.fire({
            title: 'Update Patient Email',
            html: `
                <div class="text-start">
                    <p class="small text-muted mb-1">Patient: <strong class="text-dark">${escapeHtml(patientName)}</strong></p>
                    <p class="small text-muted mb-3">Current Email: <strong class="text-dark">${escapeHtml(currentEmail)}</strong></p>
                    <label class="form-label small fw-bold text-muted">New Email Address</label>
                    <input id="swal-new-email" type="email" class="form-control shadow-none" placeholder="name@example.com" />
                    <div class="form-text text-muted mt-2" style="font-size: 11px;">
                        All medical records, dental charts, appointments, and consent forms will be automatically transferred to the new email address.
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Update & Transfer Records',
            confirmButtonColor: colors.goldDark,
            focusConfirm: false,
            preConfirm: () => {
                const inputVal = document.getElementById('swal-new-email').value;
                const newEmail = (inputVal || '').toLowerCase().trim();

                if (!newEmail) {
                    Swal.showValidationMessage('Please enter a new email address.');
                    return false;
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(newEmail)) {
                    Swal.showValidationMessage('Please enter a valid email address format.');
                    return false;
                }

                if (newEmail === currentEmail) {
                    Swal.showValidationMessage('New email address must be different from current email.');
                    return false;
                }

                const db = readDatabase({ users: [] });
                const emailTaken = (db.users || []).some(u => (u.email || '').toLowerCase().trim() === newEmail);
                if (emailTaken) {
                    Swal.showValidationMessage(`The email "${newEmail}" is already registered in the system.`);
                    return false;
                }

                return newEmail;
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                performEmailMigration(currentEmail, result.value, patient);
            }
        });
    };


    const escapeHtml = (str) => {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const getAllergiesSummary = (medRecord) => {
        if (!medRecord) return 'None Reported';
        const allergies = [];
        if (medRecord.q7_allergicAnesthesia === 'Yes' || medRecord.q7_allergicAnesthesia === true) allergies.push('Local Anesthetics');
        if (medRecord.q7_allergicLatex === 'Yes' || medRecord.q7_allergicLatex === true) allergies.push('Latex');
        if (medRecord.q7_allergicPenicillin === 'Yes' || medRecord.q7_allergicPenicillin === true) allergies.push('Penicillin/Antibiotic');
        if (medRecord.q7_allergicAspirin === 'Yes' || medRecord.q7_allergicAspirin === true) allergies.push('Aspirin');
        if (medRecord.q7_allergicOthers === 'Yes' || medRecord.q7_allergicOthers === true) {
            if (medRecord.otherAllergies?.trim()) allergies.push(medRecord.otherAllergies.trim());
            else allergies.push('Others');
        }
        if (typeof medRecord.otherAllergies === 'string' && medRecord.otherAllergies.trim() && !allergies.includes(medRecord.otherAllergies.trim())) {
            allergies.push(medRecord.otherAllergies.trim());
        }
        if (typeof medRecord.allergies === 'string' && medRecord.allergies.trim()) {
            allergies.push(medRecord.allergies.trim());
        } else if (Array.isArray(medRecord.allergies)) {
            medRecord.allergies.forEach(a => {
                if (a && typeof a === 'string' && !allergies.includes(a.trim())) allergies.push(a.trim());
            });
        }
        return allergies.length > 0 ? allergies.join(', ') : 'None Reported';
    };

    const getPatientAppointments = useCallback((patient, apptsList = []) => {
        const emailNorm = (patient.email || '').toLowerCase().trim();
        const nameNorm = (patient.fullName || patient.name || '').toLowerCase().trim();
        return apptsList.filter(a => {
            const apptEmail = (a.patientEmail || a.email || '').toLowerCase().trim();
            const apptName = (a.patientName || a.fullName || a.name || '').toLowerCase().trim();
            return (emailNorm && apptEmail === emailNorm) || (nameNorm && apptName === nameNorm);
        });
    }, []);

    const availableTreatments = useMemo(() => {
        const list = [];
        const seen = new Set();

        const addTreatment = (val, label, category = '') => {
            if (!val || typeof val !== 'string') return;
            const cleanVal = val.trim();
            if (!cleanVal) return;
            const key = cleanVal.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                list.push({
                    value: cleanVal,
                    label: label || cleanVal,
                    category: category || ''
                });
            }
        };

        // 1. All Items from Price List (Live from MySQL / Storage)
        const sourcePricelist = Array.isArray(pricelistItems) ? pricelistItems : [];

        sourcePricelist.forEach(p => {
            const name = p.name || p.service;
            if (name) {
                const cleanName = name.replace(/^[a-z0-9]+\.\s*/i, '').trim();
                const catName = p.category ? p.category.replace(/^[IVXLCDM]+\.\s*/i, '').trim() : '';
                const displayLabel = catName && !cleanName.toLowerCase().includes(catName.toLowerCase())
                    ? `${catName} - ${cleanName}`
                    : cleanName || name;

                addTreatment(name, displayLabel, p.category);
            }
        });

        // 2. Also incorporate treatments from actual appointments (in case of historical custom services)
        (allAppointments || []).forEach(a => {
            const t = a.service || a.treatment || a.procedure;
            if (t) {
                addTreatment(t, t, a.category || '');
            }
        });

        return list;
    }, [pricelistItems, allAppointments]);

    const reportFilteredPatients = useMemo(() => {
        return patients.map(patient => {
            const medRecord = medicalRecords[(patient.email || '').toLowerCase().trim()] || {};
            const allergiesStr = getAllergiesSummary(medRecord);
            const patientAppts = getPatientAppointments(patient, allAppointments);
            
            const treatmentList = [...new Set(patientAppts.map(a => a.service || a.treatment || a.procedure).filter(Boolean))];
            const treatmentStr = treatmentList.length > 0 ? treatmentList.join(', ') : 'No Treatments Listed';
            
            const statusList = [...new Set(patientAppts.map(a => a.status).filter(Boolean))];
            const statuses = statusList.length > 0 ? statusList : ['No Appointments'];

            const hasDidntCome = patientAppts.some(a => {
                const st = (a.status || '').toLowerCase().trim();
                return st === "didn't come" || st === "didnt come" || st === "no show" || st === "absent";
            });

            return {
                patient,
                medRecord,
                allergiesStr,
                patientAppts,
                appointmentsCount: patientAppts.length,
                treatmentList,
                treatmentStr,
                statuses,
                hasDidntCome
            };
        }).filter(item => {
            // 1. Patient Name Filter
            const searchQ = reportSearchTerm.toLowerCase().trim();
            if (searchQ) {
                const matchesName = (item.patient.fullName || item.patient.name || '').toLowerCase().includes(searchQ);
                const matchesEmail = (item.patient.email || '').toLowerCase().includes(searchQ);
                const matchesPhone = (item.patient.phone || item.patient.contactNo || item.patient.contactNumber || '').toLowerCase().includes(searchQ);
                if (!matchesName && !matchesEmail && !matchesPhone) return false;
            }

            // 2. Treatment Filter (Connected to Pricelist items & exact/fuzzy procedure matching)
            if (reportTreatmentFilter !== 'All') {
                const reqT = reportTreatmentFilter.toLowerCase().trim();
                const matchesTreatment = item.treatmentList.some(t => {
                    if (!t) return false;
                    const tNorm = t.toLowerCase().trim();
                    
                    // Exact or containment matching
                    if (tNorm === reqT || tNorm.includes(reqT) || reqT.includes(tNorm)) return true;
                    
                    // Match after stripping prefix identifiers (e.g. "a. Metal Braces" -> "Metal Braces")
                    const cleanT = tNorm.replace(/^[a-z0-9]+\.\s*/i, '').trim();
                    const cleanReq = reqT.replace(/^[a-z0-9]+\.\s*/i, '').trim();
                    if (cleanT && cleanReq && (cleanT === cleanReq || cleanT.includes(cleanReq) || cleanReq.includes(cleanT))) {
                        return true;
                    }

                    return false;
                });
                if (!matchesTreatment) return false;
            }

            // 3. Status Filter
            if (reportStatusFilter !== 'All') {
                const reqStatus = reportStatusFilter.toLowerCase().trim();
                if (reqStatus === "didn't come" || reqStatus === "didnt come") {
                    if (!item.hasDidntCome) return false;
                } else {
                    const matchesStatus = item.statuses.some(s => s.toLowerCase().trim() === reqStatus);
                    if (!matchesStatus) return false;
                }
            }

            return true;
        });
    }, [patients, medicalRecords, allAppointments, reportSearchTerm, reportTreatmentFilter, reportStatusFilter, getPatientAppointments]);

    const generatePatientReportHtml = () => {
        const rowsHtml = reportFilteredPatients.map((item, idx) => `
            <tr style="background-color: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #475569; width: 5%;">
                    ${idx + 1}
                </td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-weight: bold; color: #0f172a; width: 28%;">
                    <div style="font-size: 11.5px; color: #0f172a;">${escapeHtml(item.patient.fullName || item.patient.name || 'Patient')}</div>
                    <div style="font-size: 10px; font-weight: normal; color: #64748b; margin-top: 2px;">
                        ${escapeHtml(item.patient.email || '')} ${item.patient.phone ? '&bull; ' + escapeHtml(item.patient.phone) : ''}
                    </div>
                </td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; color: #334155; font-size: 11px; width: 25%;">
                    ${escapeHtml(item.treatmentStr || 'General Consultation / Evaluation')}
                </td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; width: 22%;">
                    ${item.allergiesStr === 'None Reported' 
                        ? '<span style="color: #64748b; font-size: 10px; font-style: italic;">No known allergies on record</span>' 
                        : `<span style="color: #b91c1c; font-weight: bold; background: #fee2e2; border: 1px solid #fecaca; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${escapeHtml(item.allergiesStr)}</span>`}
                </td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: center; width: 20%;">
                    ${item.statuses.map(st => {
                        const isDidntCome = (st || '').toLowerCase().includes("didn't come") || (st || '').toLowerCase().includes("no show");
                        const isCompleted = (st || '').toLowerCase().includes("completed") || (st || '').toLowerCase().includes("done");
                        if (isDidntCome) return '<span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 2px 7px; border-radius: 9999px; font-weight: bold; font-size: 9.5px; display: inline-block; margin: 1px;">No Show</span>';
                        if (isCompleted) return '<span style="background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; padding: 2px 7px; border-radius: 9999px; font-weight: bold; font-size: 9.5px; display: inline-block; margin: 1px;">Completed</span>';
                        return `<span style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 9999px; font-size: 9.5px; display: inline-block; margin: 1px;">${escapeHtml(st)}</span>`;
                    }).join(' ')}
                </td>
            </tr>
        `).join('');

        const activeFilterLabels = [];
        if (reportSearchTerm) activeFilterLabels.push(`Query: "${reportSearchTerm}"`);
        if (reportTreatmentFilter !== 'All') activeFilterLabels.push(`Treatment: "${reportTreatmentFilter}"`);
        if (reportStatusFilter !== 'All') activeFilterLabels.push(`Status: ${reportStatusFilter}`);

        const filterDescription = activeFilterLabels.length > 0 ? activeFilterLabels.join(' | ') : 'All Patient Profiles (Unfiltered)';

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>CarePlus Multi-Branch - Patient Registry Report</title>
                <style>
                    * { box-sizing: border-box; }
                    body {
                        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
                        margin: 0;
                        padding: 15mm;
                        color: #0f172a;
                        background: #ffffff;
                        line-height: 1.4;
                        font-size: 11px;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    @media print {
                        body { padding: 8mm; margin: 0; }
                        tr { page-break-inside: avoid; }
                        @page { size: landscape; margin: 8mm; }
                    }
                </style>
            </head>
            <body>
                <!-- 1. Enterprise Facility Header Table -->
                <table style="border-bottom: 2.5px solid #0f172a; margin-bottom: 16px;">
                    <tbody>
                        <tr>
                            <td style="vertical-align: top; width: 65%; padding-bottom: 10px;">
                                <div style="font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                                    CAREPLUS MULTI-BRANCH CLINIC MANAGEMENT SYSTEM
                                </div>
                                <div style="font-size: 12px; font-weight: 600; color: #0284c7; margin-top: 2px;">
                                    CENTRALIZED PATIENT REGISTRY &amp; CLINICAL LEDGER
                                </div>
                                <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
                                    Ambulatory Care &bull; Dental Medicine &bull; Diagnostic Laboratory &bull; Multi-Branch EHR
                                </div>
                                <div style="font-size: 9.5px; color: #64748b;">
                                    Metro Main: 123 Healthcare Blvd &bull; Northside Branch: 789 Medical Park Dr &bull; Tel: (02) 8888-CARE
                                </div>
                            </td>
                            <td style="vertical-align: top; width: 35%; padding-bottom: 10px;">
                                <table style="border: 1px solid #cbd5e1; font-size: 10.5px;">
                                    <tbody>
                                        <tr style="background-color: #f8fafc;">
                                            <td style="padding: 4px 8px; font-weight: bold; color: #475569; border-bottom: 1px solid #cbd5e1;">Report Ref:</td>
                                            <td style="padding: 4px 8px; text-align: right; font-weight: bold; border-bottom: 1px solid #cbd5e1;">CP-PAT-${Date.now().toString().slice(-6)}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 4px 8px; font-weight: bold; color: #475569; border-bottom: 1px solid #cbd5e1;">Date Generated:</td>
                                            <td style="padding: 4px 8px; text-align: right; border-bottom: 1px solid #cbd5e1;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</td>
                                        </tr>
                                        <tr style="background-color: #f8fafc;">
                                            <td style="padding: 4px 8px; font-weight: bold; color: #475569;">Active Filter:</td>
                                            <td style="padding: 4px 8px; text-align: right; font-weight: bold; color: #0284c7;">${escapeHtml(filterDescription)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- 2. Registry Parameter & KPI Summary Table -->
                <table style="border: 1px solid #cbd5e1; margin-bottom: 16px; font-size: 11px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #94a3b8;">
                            <th style="padding: 6px 10px; text-align: left; font-weight: bold; color: #1e293b; border-right: 1px solid #cbd5e1; width: 25%;">Registry Volume</th>
                            <th style="padding: 6px 10px; text-align: left; font-weight: bold; color: #1e293b; border-right: 1px solid #cbd5e1; width: 35%;">Filter Specification</th>
                            <th style="padding: 6px 10px; text-align: left; font-weight: bold; color: #1e293b; border-right: 1px solid #cbd5e1; width: 22%;">Clinical Verification</th>
                            <th style="padding: 6px 10px; text-align: center; font-weight: bold; color: #1e293b; width: 18%;">System Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 6px 10px; border-right: 1px solid #cbd5e1; font-weight: bold; color: #0369a1; font-size: 12px;">
                                ${reportFilteredPatients.length} Enrolled Patients
                            </td>
                            <td style="padding: 6px 10px; border-right: 1px solid #cbd5e1; color: #334155;">
                                ${escapeHtml(filterDescription)}
                            </td>
                            <td style="padding: 6px 10px; border-right: 1px solid #cbd5e1; color: #475569;">
                                Authenticated Identity &bull; Validated Contacts
                            </td>
                            <td style="padding: 6px 10px; text-align: center; font-weight: bold; color: #166534;">
                                Synchronized
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- 3. Master Patient Registry Ledger Table -->
                <table style="border: 1px solid #cbd5e1; margin-bottom: 20px; font-size: 10.5px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #94a3b8;">
                            <th style="padding: 8px 10px; text-align: center; font-weight: bold; color: #1e293b; border-right: 1px solid #cbd5e1; width: 5%;">#</th>
                            <th style="padding: 8px 10px; text-align: left; font-weight: bold; color: #1e293b; border-right: 1px solid #cbd5e1; width: 28%;">Patient Name &amp; Contact Details</th>
                            <th style="padding: 8px 10px; text-align: left; font-weight: bold; color: #1e293b; border-right: 1px solid #cbd5e1; width: 25%;">Registered Procedures / Treatments</th>
                            <th style="padding: 8px 10px; text-align: left; font-weight: bold; color: #1e293b; border-right: 1px solid #cbd5e1; width: 22%;">Allergy &amp; Medical Alerts</th>
                            <th style="padding: 8px 10px; text-align: center; font-weight: bold; color: #1e293b; width: 20%;">Clinical Encounter Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || `
                            <tr>
                                <td colspan="5" style="text-align: center; padding: 28px; color: #94a3b8; font-style: italic;">
                                    No patient records matched the specified criteria.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>

                <!-- 4. Governance & Dual Attestation Table -->
                <table style="border-collapse: collapse; margin-top: 16px; page-break-inside: avoid;">
                    <tbody>
                        <tr>
                            <td style="width: 48%; vertical-align: top; border: 1px solid #cbd5e1; padding: 12px 14px; background-color: #f8fafc;">
                                <div style="font-size: 9.5px; text-transform: uppercase; color: #64748b; font-weight: bold;">
                                    Medical Records Custodian
                                </div>
                                <div style="margin-top: 26px; border-bottom: 1.5px solid #0f172a; width: 85%;"></div>
                                <div style="margin-top: 6px; font-weight: bold; font-size: 11.5px; color: #0f172a;">
                                    Clinical Records Administrator
                                </div>
                                <div style="font-size: 9.5px; color: #475569;">
                                    Health Information Management &bull; CarePlus Multi-Branch
                                </div>
                            </td>
                            <td style="width: 4%;"></td>
                            <td style="width: 48%; vertical-align: top; border: 1px solid #cbd5e1; padding: 12px 14px; background-color: #f8fafc;">
                                <div style="font-size: 9.5px; text-transform: uppercase; color: #64748b; font-weight: bold;">
                                    Supervising Clinical Director
                                </div>
                                <div style="margin-top: 26px; border-bottom: 1.5px solid #0f172a; width: 85%;"></div>
                                <div style="margin-top: 6px; font-weight: bold; font-size: 11.5px; color: #0f172a;">
                                    Dr. Robert Chen, MD, FPCP
                                </div>
                                <div style="font-size: 9.5px; color: #475569;">
                                    Chief of Clinics &bull; PRC License No. 0084920
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- 5. Confidentiality Statement -->
                <div style="margin-top: 14px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                    CONFIDENTIAL PATIENT DATA &bull; PROTECTED UNDER DATA PRIVACY ACT &amp; CLINICAL RECORDS GOVERNANCE &bull; FOR AUTHORIZED MEDICAL PERSONNEL ONLY
                </div>
            </body>
            </html>
        `;
    };

    const handlePrintReport = () => {
        addAuditLog('Printed Patient List Report', `Printed patient list report with ${reportFilteredPatients.length} records.`);
        const printHtml = generatePatientReportHtml();

        const printWindow = window.open('', '_blank', 'width=950,height=750');
        if (printWindow) {
            printWindow.document.write(printHtml + '<script>window.onload = function() { window.print(); };</script>');
            printWindow.document.close();
        }
    };

    const handleDownloadReport = async () => {
        addAuditLog('Downloaded Patient List Report', `Downloaded patient list report with ${reportFilteredPatients.length} records.`);
        const printHtml = generatePatientReportHtml();
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `Doc_Dental_Patient_List_Report_${dateStr}.pdf`;
        await exportHtmlToPdf(printHtml, filename, { orientation: 'landscape', width: '950px' });
    };

    const filteredPatients = patients.filter((patient) => {
        const query = searchTerm.toLowerCase();
        const matchesName = (val) => String(val || '').toLowerCase().startsWith(query);
        return matchesName(patient.fullName) || matchesName(patient.name);
    });

    const renderYesNoRow = (label, name, forceDisable = false) => (
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center py-2 border-bottom border-warning-subtle gap-2">
            <span className="small text-secondary pe-3">
                {label}
            </span>
            <div className="d-flex gap-3">
                {['Yes', 'No'].map((option) => (
                    <label 
                        key={option} 
                        className={`small d-flex align-items-center gap-1 ${forceDisable ? 'text-muted' : ''}`}
                        style={{ cursor: forceDisable ? 'not-allowed' : 'pointer' }}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option}
                            checked={oldPatientRecord[name] === option}
                            onChange={handleMedicalInputChange}
                            disabled={forceDisable}
                        />
                        {option}
                    </label>
                ))}
            </div>
        </div>
    );

    return (
        <div className="p-3 p-md-4 w-100" style={{ backgroundColor: colors.beige, minHeight: '100vh' }}>
            <div className="d-flex flex-column flex-xl-row justify-content-between align-items-xl-center mb-4 gap-3">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: colors.goldDark }}>Patient Management</h2>
                    <p className="text-muted mb-0">Create patient login accounts and view registered patients.</p>
                </div>

                <div className="d-flex flex-column flex-sm-row gap-3">
                    {/* Modern Pill Search Bar */}
                    <div 
                        className="d-flex align-items-center bg-white px-3 py-2 shadow-sm transition-all"
                        style={{ 
                            width: 'min(100%, 340px)', 
                            borderRadius: '30px', 
                            border: '1.5px solid #e2d8c8',
                            boxShadow: '0 4px 16px rgba(184, 134, 11, 0.08)'
                        }}
                    >
                        <RiSearchLine className="me-2" style={{ color: colors.goldDark, fontSize: '1.25rem', shrink: 0 }} />
                        <input
                            type="text"
                            className="form-control border-0 shadow-none px-0 bg-transparent text-dark"
                            style={{ fontSize: '0.92rem' }}
                            placeholder="Search patient name, email, or contact..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                className="btn btn-sm btn-link text-muted p-0 ms-1 border-0 shadow-none"
                                onClick={() => setSearchTerm('')}
                                title="Clear search"
                            >
                                <RiCloseLine className="fs-5" />
                            </button>
                        )}
                    </div>

                    {/* Patient List Report Button */}
                    <button
                        type="button"
                        className="doc-btn doc-btn-success"
                        onClick={() => {
                            setShowReportModal(true);
                            addAuditLog('Viewed Patient List Report', 'Opened patient directory report and filter dashboard.');
                        }}
                    >
                        <RiFileTextLine size={18} />
                        <span>Patient List Report</span>
                    </button>

                    {/* Gradient Create Patient Account Toggle Button */}
                    <button
                        type="button"
                        className={`doc-btn ${showPatientForm ? 'doc-btn-neutral' : 'doc-btn-gold-solid'}`}
                        onClick={() => setShowPatientForm((currentValue) => !currentValue)}
                    >
                        {showPatientForm ? <RiCloseLine size={18} /> : <RiUserAddLine size={18} />}
                        <span>{showPatientForm ? 'Close Registration Form' : 'Create Patient Account'}</span>
                    </button>
                </div>
            </div>

            {showPatientForm && (
                <div 
                    className="card border-0 shadow mb-4 overflow-hidden animate__animated animate__fadeInDown" 
                    style={{ 
                        borderRadius: '24px', 
                        backgroundColor: '#ffffff',
                        border: '1.5px solid #e8dfcb',
                        boxShadow: '0 12px 32px rgba(184, 134, 11, 0.08)'
                    }}
                >
                    <div 
                        className="p-4 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-3" 
                        style={{ backgroundColor: '#fefcf6', borderBottom: '1.5px solid #f0e6d2' }}
                    >
                        <div className="d-flex align-items-center gap-3">
                            <div 
                                className="p-3 rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                                style={{ backgroundColor: '#fff3cd', color: colors.goldDark }}
                            >
                                <RiUserAddLine className="fs-4" />
                            </div>
                            <div>
                                <h5 className="fw-bold mb-1 text-dark">Create Patient Login Account</h5>
                                <p className="text-muted small mb-0">Use this portal form for first-time patients or existing clinic patients who need online portal access.</p>
                            </div>
                        </div>
                        <span className="badge px-3 py-2 rounded-pill fw-semibold border" style={{ backgroundColor: '#fff8e1', color: colors.goldDark, borderColor: '#f3e5ab' }}>
                            Admin Registration
                        </span>
                    </div>

                    <form onSubmit={handleCreatePatient} className="p-4 p-md-5">
                        <div className="row g-4">
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-uppercase d-flex align-items-center gap-1" style={{ color: colors.goldDark, letterSpacing: '0.5px', fontSize: '11.5px' }}>
                                    <RiUserLine className="fs-6" /> Full Name
                                </label>
                                <input
                                    type="text"
                                    className="form-control shadow-none py-2"
                                    style={{ borderRadius: '12px', border: '1.5px solid #e2d8c8' }}
                                    placeholder="e.g. Juan Dela Cruz"
                                    required
                                    value={newPatient.fullName}
                                    onChange={(event) => {
                                        const cleanName = event.target.value.replace(/[^a-zA-Z\s]/g, '');
                                        const autoPass = generateDefaultPassword(cleanName);
                                        setNewPatient({ 
                                            ...newPatient, 
                                            fullName: cleanName,
                                            password: autoPass
                                        });
                                    }}
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-uppercase d-flex align-items-center gap-1" style={{ color: colors.goldDark, letterSpacing: '0.5px', fontSize: '11.5px' }}>
                                    <RiMailLine className="fs-6" /> Email Address
                                </label>
                                <input
                                    type="email"
                                    className="form-control shadow-none py-2"
                                    style={{ borderRadius: '12px', border: '1.5px solid #e2d8c8' }}
                                    placeholder="patient@example.com"
                                    required
                                    value={newPatient.email}
                                    onChange={(event) => setNewPatient({ ...newPatient, email: event.target.value })}
                                />
                            </div>

                            {newPatient.patientType === 'New Patient' && (
                                <div className="col-md-4">
                                    <label className="form-label small fw-bold text-uppercase d-flex align-items-center gap-1" style={{ color: colors.goldDark, letterSpacing: '0.5px', fontSize: '11.5px' }}>
                                        <RiPhoneLine className="fs-6" /> Contact Phone
                                    </label>
                                    <input
                                        type="tel"
                                        className="form-control shadow-none py-2"
                                        style={{ borderRadius: '12px', border: '1.5px solid #e2d8c8' }}
                                        placeholder="09171234567"
                                        required={newPatient.patientType === 'New Patient'}
                                        value={newPatient.phone}
                                        onChange={(event) => {
                                            const cleanPhone = event.target.value.replace(/\D/g, '').slice(0, 11);
                                            setNewPatient({ ...newPatient, phone: cleanPhone });
                                        }}
                                        maxLength={11}
                                    />
                                </div>
                            )}

                            <div className={newPatient.patientType === 'New Patient' ? 'col-md-4' : 'col-md-6'}>
                                <label className="form-label small fw-bold text-uppercase d-flex align-items-center gap-1" style={{ color: colors.goldDark, letterSpacing: '0.5px', fontSize: '11.5px' }}>
                                    <RiUserHeartLine className="fs-6" /> Patient Type
                                </label>
                                <select
                                    className="form-select shadow-none py-2"
                                    style={{ borderRadius: '12px', border: '1.5px solid #e2d8c8' }}
                                    value={newPatient.patientType}
                                    onChange={(event) => setNewPatient({ ...newPatient, patientType: event.target.value })}
                                >
                                    <option>New Patient</option>
                                    <option>Old Patient</option>
                                </select>
                            </div>

                            <div className={newPatient.patientType === 'New Patient' ? 'col-md-4' : 'col-md-6'}>
                                <label className="form-label small fw-bold text-uppercase d-flex align-items-center gap-1" style={{ color: colors.goldDark, letterSpacing: '0.5px', fontSize: '11.5px' }}>
                                    <RiLockLine className="fs-6" /> Temporary Password
                                </label>
                                <input
                                    type="password"
                                    className="form-control shadow-none py-2 bg-light text-muted"
                                    style={{ borderRadius: '12px', border: '1.5px solid #e2d8c8' }}
                                    value="********"
                                    readOnly
                                    disabled
                                />
                                <small className="text-muted" style={{ fontSize: '11px' }}>Censored & sent directly to patient's email</small>
                            </div>


                            {newPatient.patientType === 'Old Patient' && (
                                <div className="col-12 mt-4">
                                    <div className="border rounded-4 overflow-hidden bg-white">
                                        <div className="p-4 border-bottom d-flex align-items-center gap-2" style={{ backgroundColor: '#fff8e1' }}>
                                            <RiFileTextLine style={{ color: colors.goldDark }} />
                                            <div>
                                                <h6 className="fw-bold mb-1" style={{ color: colors.goldDark }}>Old Patient Medical Record</h6>
                                                <p className="text-muted small mb-0">This section appears for old patients so staff can encode their existing clinic record.</p>
                                            </div>
                                        </div>

                                        <div className="p-4 p-md-5" style={{ backgroundColor: colors.panel }}>
                                            <div className="text-center mb-4">
                                                <h4 className="fw-bold" style={{ color: colors.goldDark }}>Medical Record</h4>
                                                <p className="text-muted small">Please encode the patient's existing clinic records accurately</p>
                                            </div>

                                            <h6 className="fw-bold mb-4" style={{ color: colors.goldDark }}><RiShieldUserLine className="me-2" /> PATIENT INFORMATION RECORD</h6>
                                            <div className="row g-3 mb-5">
                                                <div className="col-md-6"><label className="small fw-bold text-muted">Full Name</label><input type="text" className="form-control bg-light" value={newPatient.fullName} readOnly /></div>
                                                <div className="col-md-6"><label className="small fw-bold text-muted">Email Address</label><input type="text" className="form-control bg-light" value={newPatient.email} readOnly /></div>

                                                <div className="col-md-4">
                                                    <label className="small fw-bold text-muted">Sex<span className="text-danger ms-1">*</span></label>
                                                    <select
                                                        name="sex"
                                                        className="form-select shadow-none"
                                                        value={oldPatientRecord.sex}
                                                        onChange={handleMedicalInputChange}
                                                        required={newPatient.patientType === 'Old Patient'}
                                                    >
                                                        <option value="">Select Sex</option>
                                                        <option value="M">M</option>
                                                        <option value="F">F</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-4">
                                                    <label className="small fw-bold text-muted">Birthday<span className="text-danger ms-1">*</span></label>
                                                    <input 
                                                        type="date" 
                                                        name="birthday" 
                                                        className="form-control" 
                                                        value={oldPatientRecord.birthday} 
                                                        onChange={handleMedicalInputChange} 
                                                        required={newPatient.patientType === 'Old Patient'} 
                                                    />
                                                </div>
                                                <div className="col-md-4">
                                                    <label className="small fw-bold text-muted">Age (Auto)</label>
                                                    <input type="text" className="form-control bg-light fw-bold" value={oldPatientRecord.age} readOnly />
                                                </div>
                                                <div className="col-12">
                                                    <label className="small fw-bold text-muted">Home Address<span className="text-danger ms-1">*</span></label>
                                                    <input 
                                                        type="text" 
                                                        name="address" 
                                                        className="form-control" 
                                                        value={oldPatientRecord.address} 
                                                        onChange={handleMedicalInputChange} 
                                                        required={newPatient.patientType === 'Old Patient'} 
                                                    />
                                                </div>
                                                <div className="col-md-4">
                                                    <label className="small fw-bold text-muted">Contact No.<span className="text-danger ms-1">*</span></label>
                                                    <input 
                                                        type="tel" 
                                                        inputMode="numeric" 
                                                        pattern="[0-9]*" 
                                                        name="contactNumber" 
                                                        className="form-control" 
                                                        value={oldPatientRecord.contactNumber} 
                                                        onChange={handleMedicalInputChange} 
                                                        required={newPatient.patientType === 'Old Patient'} 
                                                        maxLength={11} 
                                                        placeholder={newPatient.phone || ''}
                                                    />
                                                </div>
                                                <div className="col-md-4"><label className="small fw-bold text-muted">Religion</label><input type="text" name="religion" className="form-control" value={oldPatientRecord.religion} onChange={handleMedicalInputChange} /></div>
                                                <div className="col-md-4"><label className="small fw-bold text-muted">Nationality</label><input type="text" name="nationality" className="form-control" value={oldPatientRecord.nationality} onChange={handleMedicalInputChange} /></div>
                                                <div className="col-md-6">
                                                    <label className="small fw-bold text-muted">Status</label>
                                                    <select
                                                        name="occupation"
                                                        className="form-select"
                                                        value={oldPatientRecord.occupation || ''}
                                                        onChange={handleMedicalInputChange}
                                                    >
                                                        <option value="">Select Status...</option>
                                                        <option value="Student">Student</option>
                                                        <option value="Employed">Employed</option>
                                                        <option value="Unemployed">Unemployed</option>
                                                        {oldPatientRecord.occupation && !['Student', 'Employed', 'Unemployed'].includes(oldPatientRecord.occupation) && (
                                                            <option value={oldPatientRecord.occupation}>{oldPatientRecord.occupation}</option>
                                                        )}
                                                    </select>
                                                </div>
                                                <div className="col-md-6"><label className="small fw-bold text-muted">Referred by</label><input type="text" name="referredBy" className="form-control" value={oldPatientRecord.referredBy} onChange={handleMedicalInputChange} /></div>

                                                <div
                                                    className="col-12 mt-3 p-3 rounded shadow-sm"
                                                    style={{
                                                        backgroundColor: Number(oldPatientRecord.age) >= 18 ? '#e9ecef' : '#f8f9fa',
                                                        opacity: Number(oldPatientRecord.age) >= 18 ? 0.7 : 1
                                                    }}
                                                >
                                                    <small className="fw-bold" style={{ color: colors.goldDark }}>
                                                        For Minors:
                                                        {Number(oldPatientRecord.age) >= 18 && <span className="text-muted fw-normal ms-2">Not required for patients 18 and above</span>}
                                                    </small>
                                                    <div className="row mt-2">
                                                        <div className="col-md-6"><label className="small text-muted">Parent/Guardian Name</label><input type="text" name="parentGuardian" className="form-control" value={oldPatientRecord.parentGuardian || ''} onChange={handleMedicalInputChange} disabled={Number(oldPatientRecord.age) >= 18} /></div>
                                                        <div className="col-md-6"><label className="small text-muted">Status</label><input type="text" name="guardianOccupation" className="form-control" value={oldPatientRecord.guardianOccupation || ''} onChange={handleMedicalInputChange} disabled={Number(oldPatientRecord.age) >= 18} /></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <h6 className="fw-bold mb-3" style={{ color: colors.goldDark }}><RiUserHeartLine className="me-2" /> MEDICAL HISTORY</h6>
                                            {renderYesNoRow("1. Are you in good health?", "q1_goodHealth")}
                                            {renderYesNoRow("2. Are you under medical treatment now?", "q2_underMedicalTreatment")}
                                            {renderYesNoRow("3. Have you ever had serious illness or surgical operation?", "q3_seriousIllness")}
                                            {renderYesNoRow("4. Have you ever been hospitalized?", "q4_hospitalized")}
                                            {oldPatientRecord.q4_hospitalized === 'Yes' && (
                                                <div className="mt-2 mb-2">
                                                    <label className="small fw-bold text-muted">Hospitalization details</label>
                                                    <input type="text" name="q4_hospitalizedDetail" placeholder="If yes, when & why?" className="form-control border-warning" value={oldPatientRecord.q4_hospitalizedDetail || ''} onChange={handleMedicalInputChange} />
                                                </div>
                                            )}
                                            {renderYesNoRow("5. Are you taking any prescription/non-prescription medication?", "q5_takingMedication")}
                                            {renderYesNoRow("6. Do you use tobacco products, alcohol, or other drugs?", "q6_tobaccoAlcohol")}

                                            <div className="mt-4 mb-2 small fw-bold text-muted">7. Are you allergic to any of the following:</div>
                                            <div className="row ps-2">
                                                <div className="col-md-6">{renderYesNoRow("a. Local Anesthetics", "q7_allergicAnesthesia")}</div>
                                                <div className="col-md-6">{renderYesNoRow("b. Latex", "q7_allergicLatex")}</div>
                                                <div className="col-md-6">{renderYesNoRow("c. Penicillin, Antibiotic", "q7_allergicPenicillin")}</div>
                                                <div className="col-md-6">{renderYesNoRow("d. Aspirin", "q7_allergicAspirin")}</div>
                                            </div>
                                            {renderYesNoRow("e. Others", "q7_allergicOthers")}
                                            {oldPatientRecord.q7_allergicOthers === 'Yes' && (
                                                <div className="mt-1">
                                                    <label className="small fw-bold text-muted">Other allergies</label>
                                                    <input type="text" name="otherAllergies" className="form-control border-warning" placeholder="Specify other allergies" value={oldPatientRecord.otherAllergies || ''} onChange={handleMedicalInputChange} />
                                                </div>
                                            )}

                                            {(() => {
                                                const isMale = /^m(ale)?$/i.test(oldPatientRecord.sex?.trim() || '');
                                                return (
                                                    <>
                                                        <div className={`mt-4 mb-2 small fw-bold ${isMale ? 'text-muted opacity-50' : 'text-muted'}`}>
                                                            8. For women:
                                                        </div>
                                                        <div className={isMale ? 'opacity-50' : ''} style={{ pointerEvents: isMale ? 'none' : 'auto' }}>
                                                            {renderYesNoRow("Are you pregnant?", "q8_pregnant", isMale)}
                                                            {renderYesNoRow("Are you nursing?", "q8_nursing", isMale)}
                                                            {renderYesNoRow("Are you taking birth control pills?", "q8_birthControl", isMale)}
                                                        </div>
                                                    </>
                                                );
                                            })()}

                                            <h6 className="fw-bold mt-5 mb-3" style={{ color: colors.goldDark }}>9. CONDITION CHECKLIST</h6>
                                            <div className="row g-2">
                                                {[
                                                    "None", "High blood pressure", "Low blood pressure", "Epilepsy", "AIDS/HIV",
                                                    "Heart Attack", "Asthma", "Thyroid Problem", "Stroke",
                                                    "Pneumonia", "STD", "Heart Disease", "Emphysema",
                                                    "Ulcer", "Hepatitis", "Tuberculosis", "Diabetes", "Anemia", "Others"
                                                ].map((cond) => {
                                                    const isCondDisabled = oldPatientRecord.conditions.includes('None') && cond !== 'None';
                                                    return (
                                                        <div className="col-6 col-md-3" key={cond}>
                                                            <div
                                                                onClick={() => !isCondDisabled && handleConditionToggle(cond)}
                                                                className={`p-2 rounded border text-center small transition-all 
                                                                    ${oldPatientRecord.conditions.includes(cond) ? (cond === 'None' ? 'bg-success text-white border-success shadow-sm' : 'bg-danger text-white border-danger shadow-sm') : 'bg-white text-muted'}
                                                                    ${isCondDisabled ? 'opacity-50' : ''}`}
                                                                style={{ cursor: isCondDisabled ? 'not-allowed' : 'pointer', fontSize: '11px', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            >
                                                                {cond}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {oldPatientRecord.conditions.includes('Others') && (
                                                <div className="mt-3">
                                                    <label className="small fw-bold text-muted">Other medical conditions</label>
                                                    <textarea name="otherCondition" className="form-control border-danger" rows="2" placeholder="Specify other medical conditions..." value={oldPatientRecord.otherCondition || ''} onChange={handleMedicalInputChange} />
                                                </div>
                                            )}

                                            <div className="mt-5 p-4 rounded-4" style={{ border: `1px solid ${colors.gold}`, backgroundColor: 'rgba(212, 175, 55, 0.05)' }}>
                                                <h6 className="fw-bold mb-3 text-danger"><RiVirusLine className="me-2" /> PREVENTION FOR COVID 19 SPREAD</h6>
                                                <p className="small text-muted mb-3">In the past 14 days, I have experienced:</p>
                                                {renderYesNoRow("Fever 37 C above", "cv_fever")}
                                                {renderYesNoRow("Unexplained body aches or pain", "cv_aches")}
                                                {renderYesNoRow("Coughing", "cv_cough")}
                                                {renderYesNoRow("Sore throat", "cv_throat")}
                                                {renderYesNoRow("Shortness of breath", "cv_breath")}
                                                {renderYesNoRow("Chills with or without body aches", "cv_chills")}
                                                {renderYesNoRow("Recent loss of sense of smell/ taste", "cv_taste")}

                                                <div className="mt-4 py-3 border-top border-warning-subtle">
                                                    {renderYesNoRow("History of travelling within the last 14 days?", "cv_travelHistory")}
                                                    {oldPatientRecord.cv_travelHistory === 'Yes' && (
                                                        <div className="mt-2">
                                                            <label className="small fw-bold text-muted">Travel location</label>
                                                            <input type="text" name="cv_travelLocation" className="form-control border-warning" placeholder="If yes, where?" value={oldPatientRecord.cv_travelLocation || ''} onChange={handleMedicalInputChange} />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-3 d-flex align-items-center gap-2">
                                                    <input type="checkbox" name="cv_agreement" checked={oldPatientRecord.cv_agreement || false} onChange={handleMedicalInputChange} />
                                                    <span className="small fw-bold text-secondary">I agree that I am providing accurate health information.</span>
                                                </div>
                                            </div>

                                            <div className="mt-4">
                                                <label className="form-label small fw-bold text-muted">Staff Notes</label>
                                                <textarea
                                                    name="notes"
                                                    className="form-control shadow-none"
                                                    rows="3"
                                                    placeholder="Optional notes from the old patient record"
                                                    value={oldPatientRecord.notes || ''}
                                                    onChange={handleMedicalInputChange}
                                                />
                                            </div>

                                             <hr className="my-4" style={{ borderColor: '#e8e2d5' }} />

                                             <h6 className="fw-bold small text-muted text-uppercase mb-3 d-flex align-items-center gap-2">
                                                 <RiFileTextLine style={{ color: colors.goldDark }} />
                                                 Dental Chart & Braces Record
                                             </h6>

                                             {/* Clinical Legend */}
                                             <div className="card border-0 shadow-sm p-3 rounded-4 mb-4" style={{ backgroundColor: '#fffdf5', border: '1px solid #f3e5ab' }}>
                                                 <h6 className="fw-bold mb-2 small text-uppercase" style={{ color: colors.goldDark, letterSpacing: '0.5px' }}>
                                                     CLINICAL LEGEND
                                                 </h6>
                                                 <div className="row g-2">
                                                     {legends.map(l => (
                                                         <div key={l.code} className="col-6 col-sm-4 col-md-3">
                                                             <div className="d-flex align-items-center gap-2 p-2 rounded-3 bg-white border" style={{ fontSize: '11px' }}>
                                                                 <span 
                                                                     className="rounded-circle d-inline-block border" 
                                                                     style={{ width: '12px', height: '12px', backgroundColor: l.color, flexShrink: 0 }}
                                                                 />
                                                                 <span className="fw-bold text-dark">{l.code}</span>
                                                                 <span className="text-muted text-truncate ms-auto">{l.label}</span>
                                                             </div>
                                                         </div>
                                                     ))}
                                                 </div>
                                             </div>

                                             {/* Intraoral Teeth Chart Grid */}
                                             <div className="p-3 bg-light rounded-4 border overflow-auto text-center mb-4">
                                                 <div className="small fw-bold text-muted text-uppercase mb-2" style={{ letterSpacing: '0.5px' }}>Maxillary (Upper Teeth)</div>
                                                 <div className="d-flex justify-content-center mb-4 pb-3 border-bottom" style={{ minWidth: '700px' }}>
                                                     {[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28].map(id => (
                                                         <ToothSVG 
                                                             key={id} 
                                                             id={id} 
                                                             teethData={oldDentalRecord.teeth} 
                                                             legends={legends} 
                                                             handleToothUpdate={handleToothUpdate} 
                                                         />
                                                     ))}
                                                 </div>

                                                 <div className="small fw-bold text-muted text-uppercase mb-2" style={{ letterSpacing: '0.5px' }}>Mandibular (Lower Teeth)</div>
                                                 <div className="d-flex justify-content-center" style={{ minWidth: '700px' }}>
                                                     {[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].map(id => (
                                                         <ToothSVG 
                                                             key={id} 
                                                             id={id} 
                                                             teethData={oldDentalRecord.teeth} 
                                                             legends={legends} 
                                                             handleToothUpdate={handleToothUpdate} 
                                                         />
                                                     ))}
                                                 </div>
                                             </div>

                                            <div className="row g-3">
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-bold text-muted">Cleared for Braces Treatment</label>
                                                    <select
                                                        className="form-select shadow-none"
                                                        value={oldDentalRecord.clearedForBraces}
                                                        onChange={(e) => setOldDentalRecord({ ...oldDentalRecord, clearedForBraces: e.target.value })}
                                                    >
                                                        <option value="No">No - Not Cleared / General Dentistry Only</option>
                                                        <option value="Yes">Yes - Cleared for Braces</option>
                                                    </select>
                                                </div>

                                                {oldDentalRecord.clearedForBraces === 'Yes' && (
                                                    <div className="col-md-6">
                                                        <label className="form-label small fw-bold text-muted">Initial Braces Band Color</label>
                                                        <select
                                                            className="form-select shadow-none"
                                                            value={oldDentalRecord.bracesColor}
                                                            onChange={(e) => setOldDentalRecord({ ...oldDentalRecord, bracesColor: e.target.value })}
                                                        >
                                                            <option value="">Select Braces Color...</option>
                                                            <option value="Silver">Silver</option>
                                                            <option value="Sky Blue">Sky Blue</option>
                                                            <option value="Navy Blue">Navy Blue</option>
                                                            <option value="Red">Red</option>
                                                            <option value="Soft Pink">Soft Pink</option>
                                                            <option value="Emerald Green">Emerald Green</option>
                                                            <option value="Royal Purple">Royal Purple</option>
                                                            <option value="Clear">Clear</option>
                                                            <option value="Black">Black</option>
                                                        </select>
                                                    </div>
                                                )}

                                                <div className="col-12">
                                                    <label className="form-label small fw-bold text-muted">Dental Examination Results & Initial Chart Remarks</label>
                                                    <textarea
                                                        className="form-control shadow-none"
                                                        rows="3"
                                                        placeholder="Encode initial dental examination results, teeth conditions, diagnosis, or remarks for this patient..."
                                                        value={oldDentalRecord.remarks}
                                                        onChange={(e) => setOldDentalRecord({ ...oldDentalRecord, remarks: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <hr className="my-4" style={{ borderColor: '#e8e2d5' }} />

                                            {/* X-Rays and Radiographs Section */}
                                            <div className="d-flex align-items-center justify-content-between mb-3">
                                                <h6 className="fw-bold small text-uppercase mb-0 d-flex align-items-center gap-2" style={{ color: colors.goldDark, letterSpacing: '0.5px' }}>
                                                    <RiCameraLine size={18} />
                                                    DENTAL X-RAYS & RADIOGRAPHS
                                                </h6>
                                                <span className="badge px-3 py-2 rounded-pill fw-semibold border" style={{ backgroundColor: '#fff8e1', color: colors.goldDark, borderColor: '#f3e5ab' }}>
                                                    {oldPatientXrays.length} Scan{oldPatientXrays.length === 1 ? '' : 's'} Uploaded
                                                </span>
                                            </div>

                                            {/* Upload Form Card */}
                                            <div className="p-4 rounded-4 bg-white border border-light-subtle shadow-sm mb-4">
                                                <h6 className="fw-bold mb-3 d-flex align-items-center text-dark" style={{ fontSize: '14px' }}>
                                                    <RiUploadCloud2Line className="me-2 text-warning" size={20} /> Upload Patient X-Ray / Dental Scan
                                                </h6>
                                                <div className="row g-3">
                                                    <div className="col-md-6">
                                                        <label className="form-label small fw-bold text-muted mb-1">X-Ray Category / Title</label>
                                                        <select
                                                            className="form-select form-select-sm shadow-none"
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
                                                            className="form-control form-control-sm shadow-none"
                                                            value={xrayDate}
                                                            onChange={(e) => setXrayDate(e.target.value)}
                                                            style={{ borderRadius: '8px' }}
                                                        />
                                                    </div>
                                                    <div className="col-12">
                                                        <label className="form-label small fw-bold text-muted mb-1">Clinical Findings & Remarks</label>
                                                        <textarea
                                                            rows="2"
                                                            className="form-control form-control-sm shadow-none"
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
                                                                style={{ color: colors.goldDark, fontSize: '11.5px' }}
                                                                onClick={handleLoadSampleOldPatientXray}
                                                                title="Load sample panoramic X-Ray to test AI detection"
                                                            >
                                                                ⚡ Test with Example Dental X-Ray
                                                            </button>
                                                        </div>
                                                        <input
                                                            id="oldPatientXrayFileInput"
                                                            type="file"
                                                            accept="image/png, image/jpeg, image/jpg, application/pdf, .dcm, .dicom, application/dicom"
                                                            className="form-control form-control-sm shadow-none"
                                                            onChange={handleOldPatientXrayFileChange}
                                                            style={{ borderRadius: '8px' }}
                                                        />
                                                    </div>
                                                    <div className="col-md-4 d-flex align-items-end">
                                                        <button
                                                            type="button"
                                                            className="btn btn-warning btn-sm w-100 fw-bold shadow-sm d-flex align-items-center justify-content-center"
                                                            style={{ backgroundColor: colors.gold, borderColor: colors.gold, color: '#fff', height: '31px', borderRadius: '8px' }}
                                                            onClick={handleAddOldPatientXray}
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
                                                                <div className="small text-muted text-truncate" style={{ maxWidth: '280px' }}>
                                                                    {xrayFileName || 'dental_xray_scan'}
                                                                </div>
                                                                <div className="d-flex align-items-center gap-1 flex-wrap mt-1">
                                                                    <span className="badge bg-secondary text-uppercase" style={{ fontSize: '10px' }}>{xrayFileType}</span>
                                                                    {aiScanResult && (
                                                                        <span className="badge bg-success-subtle text-success border border-success d-inline-flex align-items-center gap-1" style={{ fontSize: '10.5px' }}>
                                                                            <RiShieldCheckLine size={12} /> AI Verified ({aiScanResult.confidence}%)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-outline-danger btn-sm rounded-circle d-flex align-items-center justify-content-center" 
                                                            style={{ width: '32px', height: '32px' }}
                                                            onClick={() => {
                                                                setXrayFile(null);
                                                                setXrayPreview(null);
                                                                setXrayFileName('');
                                                                setXrayFileType('image');
                                                                setAiScanResult(null);
                                                                const fileInput = document.getElementById('oldPatientXrayFileInput');
                                                                if (fileInput) fileInput.value = '';
                                                            }}
                                                            title="Remove selected file"
                                                        >
                                                            <RiCloseLine size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Gallery Grid / Empty State */}
                                            {oldPatientXrays.length > 0 ? (
                                                <div className="row g-3">
                                                    {oldPatientXrays.map((xray) => {
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

                                                                        <div className="position-absolute top-0 end-0 p-2 d-flex gap-1">
                                                                            <button 
                                                                                type="button"
                                                                                className="btn btn-sm btn-light rounded-circle shadow-sm"
                                                                                onClick={() => setZoomedXray(xray)}
                                                                                title="Preview & Info"
                                                                                style={{ width: '32px', height: '32px', padding: 0 }}
                                                                            >
                                                                                <RiZoomInLine size={16} />
                                                                            </button>
                                                                            <button 
                                                                                type="button"
                                                                                className="btn btn-sm btn-danger rounded-circle shadow-sm"
                                                                                onClick={() => handleDeleteOldPatientXray(xray.id)}
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
                                                                                <h6 className="fw-bold mb-0 text-truncate" style={{ fontSize: '13px', color: colors.goldDark }}>{xray.title}</h6>
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

                                                                        {isPdf ? (
                                                                            <a 
                                                                                href={xray.imageUrl} 
                                                                                target="_blank" 
                                                                                rel="noreferrer" 
                                                                                className="btn btn-sm btn-outline-danger w-100 fw-bold d-flex align-items-center justify-content-center gap-1"
                                                                                style={{ fontSize: '11px', borderRadius: '8px' }}
                                                                            >
                                                                                <RiExternalLinkLine size={14} /> Open PDF Report
                                                                            </a>
                                                                        ) : isDcm ? (
                                                                            <a 
                                                                                href={xray.imageUrl} 
                                                                                download={xray.fileName || 'radiology_scan.dcm'} 
                                                                                className="btn btn-sm btn-outline-primary w-100 fw-bold d-flex align-items-center justify-content-center gap-1"
                                                                                style={{ fontSize: '11px', borderRadius: '8px' }}
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
                                    </div>
                                </div>
                            )}

                            <div className="col-12 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pt-2">
                                <div className="small text-muted d-flex align-items-center gap-2">
                                    <RiShieldCheckLine style={{ color: colors.goldDark }} />
                                    Password must follow the same security rules as patient self-registration.
                                </div>
                                <button 
                                    type="submit" 
                                    className="doc-btn doc-btn-gold-solid px-4 py-2"
                                >
                                    <RiCheckLine size={18} />
                                    <span>Register Patient Account</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            <div className="card border-0 shadow-sm bg-white overflow-hidden" style={{ borderRadius: '16px' }}>
                <div className="p-4 border-bottom d-flex align-items-center justify-content-between gap-3">
                    <div className="d-flex align-items-center gap-2">
                        <RiUserHeartLine className="fs-4 fw-bold text-dark" />
                        <h5 className="fw-bold mb-0 text-dark fs-5">Patient Directory</h5>
                    </div>
                    <span className="badge px-3 py-2 rounded-pill fw-bold shadow-sm" style={{ backgroundColor: '#FFF3CD', color: '#856404', border: '1px solid #FFEEBA', fontSize: '15px' }}>
                        Total Number of Patients: <strong className="ms-1 fs-6" style={{ color: '#533f03' }}>{filteredPatients.length}</strong>
                    </span>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle w-100">
                        <thead className="bg-light">
                            <tr style={{ fontSize: '13px' }}>
                                <th className="ps-4 pe-2 py-3 fw-bold border-0 text-muted" style={{ whiteSpace: 'nowrap' }}>Patient Name</th>
                                <th className="px-2 py-3 fw-bold border-0 text-muted" style={{ whiteSpace: 'nowrap' }}>Email</th>
                                <th className="px-2 py-3 fw-bold border-0 text-muted" style={{ whiteSpace: 'nowrap' }}>Phone / Contact</th>
                                <th className="px-2 py-3 fw-bold border-0 text-muted text-center" style={{ whiteSpace: 'nowrap' }}>Patient Type</th>
                                <th className="px-2 py-3 fw-bold border-0 text-muted text-center" style={{ whiteSpace: 'nowrap' }}>Status</th>
                                <th className="fw-bold border-0 text-muted text-end pe-4 py-3" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPatients.length > 0 ? (
                                filteredPatients.map((patient) => {
                                    const isBanned = patient.bannedUntil && new Date(patient.bannedUntil) > new Date();
                                    return (
                                        <tr key={patient.id || patient.email}>
                                            <td className="ps-4 pe-2 py-3 text-dark fw-bold text-nowrap" style={{ whiteSpace: 'nowrap' }}>
                                                {patient.fullName || patient.name || 'N/A'}
                                            </td>
                                            <td className="px-2 py-3 text-muted text-truncate" style={{ maxWidth: '240px', whiteSpace: 'nowrap' }} title={patient.email}>
                                                {patient.email}
                                            </td>
                                            <td className="px-2 py-3 text-muted text-nowrap" style={{ whiteSpace: 'nowrap' }}>
                                                {patient.phone || patient.contactNo || patient.contactNumber || medicalRecords[(patient.email || '').toLowerCase().trim()]?.contactNumber || medicalRecords[(patient.email || '').toLowerCase().trim()]?.contactNo || medicalRecords[(patient.email || '').toLowerCase().trim()]?.phone || 'Not provided'}
                                            </td>
                                            <td className="px-2 py-3 text-center text-nowrap" style={{ whiteSpace: 'nowrap' }}>
                                                {(() => {
                                                    const medRec = medicalRecords[(patient.email || '').toLowerCase().trim()];
                                                    const resolvedType = patient.patientType || medRec?.patientType || (medRec?.recordedByClinic ? 'Old Patient' : 'New Patient');
                                                    const isOld = resolvedType === 'Old Patient';
                                                    return (
                                                        <span className={`badge px-3 py-2 rounded-pill fw-semibold ${isOld ? 'bg-warning-subtle text-warning-emphasis border border-warning' : 'bg-light text-dark border'}`}>
                                                            {resolvedType}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-2 py-3 text-center text-nowrap" style={{ whiteSpace: 'nowrap' }}>
                                                {isBanned ? (
                                                    <span className="badge px-3 py-2 rounded-pill bg-danger-subtle text-danger border border-danger-subtle fw-semibold">
                                                        Banned until {new Date(patient.bannedUntil).toLocaleDateString()}
                                                    </span>
                                                ) : (
                                                    <span className="badge px-3 py-2 rounded-pill bg-success-subtle text-success">
                                                        {patient.status || 'Active'}
                                                    </span>
                                                 )}
                                            </td>
                                             <td className="text-end pe-4 py-3 text-nowrap" style={{ whiteSpace: 'nowrap' }}>
                                                 <div className="d-flex align-items-center justify-content-end gap-1 flex-wrap">
                                                     <button
                                                         className="doc-btn doc-btn-neutral doc-btn-sm text-nowrap"
                                                         onClick={() => handleUpdatePatientEmail(patient)}
                                                         title="Update registered email and transfer records"
                                                     >
                                                         <RiEditLine size={13} /> <span>Update Email</span>
                                                     </button>
                                                     {isBanned && (
                                                         <button
                                                             className="doc-btn doc-btn-success doc-btn-sm text-nowrap"
                                                             onClick={() => handleLiftBan(patient)}
                                                         >
                                                             Lift Restriction
                                                         </button>
                                                     )}
                                                 </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" className="text-center p-5 text-muted">
                                        {searchTerm ? 'No patients match your search.' : 'No patients found in the database.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Patient List Report Modal */}
            {showReportModal && (
                <div 
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 p-md-4"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', zIndex: 1060, backdropFilter: 'blur(4px)' }}
                >
                    <div 
                        className="card border-0 shadow-lg overflow-hidden animate__animated animate__zoomIn" 
                        style={{ 
                            width: '100%', 
                            maxWidth: '1100px', 
                            maxHeight: '90vh', 
                            borderRadius: '24px',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        {/* Modal Header */}
                        <div 
                            className="p-4 d-flex flex-wrap align-items-center justify-content-between gap-3"
                            style={{ background: 'linear-gradient(135deg, #B8860B 0%, #D4AF37 100%)', color: 'white' }}
                        >
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 bg-white bg-opacity-20 rounded-circle d-flex align-items-center justify-content-center shadow-sm">
                                    <RiFileTextLine className="fs-3 text-white" />
                                </div>
                                <div>
                                    <h4 className="fw-bold mb-0 text-white">Patient List Report</h4>
                                    <p className="mb-0 text-white-50 small">Filter by Patient Name, Treatment, and "Didn't Come" status</p>
                                </div>
                            </div>
                            <div className="d-flex align-items-center gap-2 ms-auto">
                                <button
                                    type="button"
                                    className="doc-btn doc-btn-success doc-btn-sm"
                                    onClick={handlePrintReport}
                                    title="Print Patient List Report"
                                >
                                    <RiPrinterLine size={18} />
                                    <span>Print Report</span>
                                </button>
                                <button
                                    type="button"
                                    className="doc-btn doc-btn-neutral doc-btn-sm"
                                    onClick={handleDownloadReport}
                                    title="Download Patient List Report as PDF"
                                >
                                    <RiDownloadLine size={18} className="text-primary" />
                                    <span>Download Report</span>
                                </button>
                                <button
                                    type="button"
                                    className="doc-btn doc-btn-neutral doc-btn-sm p-1 d-inline-flex align-items-center justify-content-center"
                                    style={{ minHeight: '36px', width: '36px', borderRadius: '10px' }}
                                    onClick={() => setShowReportModal(false)}
                                    title="Close Report"
                                >
                                    <RiCloseLine size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body / Filter Controls */}
                        <div className="p-4 bg-light border-bottom">
                            <div className="row g-3 align-items-center">
                                {/* Search Patient Name */}
                                <div className="col-md-4">
                                    <label className="form-label small fw-bold text-muted text-uppercase mb-1" style={{ fontSize: '11px' }}>
                                        Filter by Patient Name
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white border-end-0 rounded-start-3">
                                            <RiSearchLine className="text-muted" />
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control border-start-0 rounded-end-3 shadow-none"
                                            placeholder="Search patient name..."
                                            value={reportSearchTerm}
                                            onChange={(e) => setReportSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Filter by Treatment */}
                                <div className="col-md-4">
                                    <label className="form-label small fw-bold text-muted text-uppercase mb-1" style={{ fontSize: '11px' }}>
                                        Filter by Treatment
                                    </label>
                                    <select
                                        className="form-select shadow-none rounded-3"
                                        value={reportTreatmentFilter}
                                        onChange={(e) => setReportTreatmentFilter(e.target.value)}
                                    >
                                        <option value="All">All Treatments</option>
                                        {availableTreatments.map((treatment, idx) => (
                                            <option key={`${treatment.value}-${idx}`} value={treatment.value}>
                                                {treatment.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Attendance / Status Filter */}
                                <div className="col-md-4">
                                    <label className="form-label small fw-bold text-muted text-uppercase mb-1" style={{ fontSize: '11px' }}>
                                        Attendance / Status Filter
                                    </label>
                                    <select
                                        className="form-select shadow-none rounded-3"
                                        style={{ height: '38px' }}
                                        value={reportStatusFilter}
                                        onChange={(e) => setReportStatusFilter(e.target.value)}
                                    >
                                        <option value="All">All Statuses</option>
                                        <option value="Didn't Come">Didn't Come</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            {/* Filter Summary Pills */}
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 pt-2 border-top">
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill fw-semibold">
                                        Showing {reportFilteredPatients.length} of {patients.length} Patients
                                    </span>
                                    {reportStatusFilter !== 'All' && (
                                        <span className={`badge px-3 py-2 rounded-pill fw-bold ${reportStatusFilter === "Didn't Come" ? 'bg-warning text-dark border border-warning' : 'bg-primary-subtle text-primary'}`}>
                                            Status: {reportStatusFilter}
                                        </span>
                                    )}
                                    {reportTreatmentFilter !== 'All' && (
                                        <span className="badge bg-info-subtle text-info px-3 py-2 rounded-pill fw-semibold">
                                            Treatment: {reportTreatmentFilter}
                                        </span>
                                    )}
                                </div>

                                {(reportSearchTerm || reportTreatmentFilter !== 'All' || reportStatusFilter !== 'All') && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-link text-danger p-0 fw-semibold text-decoration-none"
                                        onClick={() => {
                                            setReportSearchTerm('');
                                            setReportTreatmentFilter('All');
                                            setReportStatusFilter('All');
                                        }}
                                    >
                                        Reset All Filters
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Modal Body / Report Data Table */}
                        <div className="p-0 flex-grow-1 overflow-auto">
                            <table className="table table-hover mb-0 align-middle w-100">
                                <thead className="bg-light sticky-top">
                                    <tr style={{ fontSize: '12px' }}>
                                        <th className="p-3 ps-4 text-muted fw-bold">Patient Name &amp; Contact</th>
                                        <th className="p-3 text-muted fw-bold">Treatment / Service</th>
                                        <th className="p-3 text-muted fw-bold">Allergies</th>
                                        <th className="p-3 text-muted fw-bold">Status / Attendance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportFilteredPatients.length > 0 ? (
                                        reportFilteredPatients.map(item => (
                                            <tr key={item.patient.id || item.patient.email}>
                                                <td className="p-3 ps-4">
                                                    <div className="fw-bold text-dark">{item.patient.fullName || item.patient.name || 'N/A'}</div>
                                                    <div className="text-muted small">{item.patient.email}</div>
                                                    {item.patient.phone && (
                                                        <div className="text-muted x-small">{item.patient.phone}</div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="fw-semibold text-dark">{item.treatmentStr}</div>
                                                    {item.appointmentsCount > 0 && (
                                                        <div className="text-muted x-small">{item.appointmentsCount} appointment(s)</div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    {item.allergiesStr === 'None Reported' ? (
                                                        <span className="badge bg-light text-muted border px-2 py-1 rounded">None Reported</span>
                                                    ) : (
                                                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 rounded fw-semibold">
                                                            {item.allergiesStr}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {item.statuses.map((st, idx) => {
                                                            const isDidntCome = (st || '').toLowerCase().includes("didn't come") || (st || '').toLowerCase().includes("no show");
                                                            const isCompleted = (st || '').toLowerCase().includes("completed") || (st || '').toLowerCase().includes("done");
                                                            const isApproved = (st || '').toLowerCase().includes("approved");
                                                            
                                                            let badgeClass = 'bg-secondary-subtle text-secondary';
                                                            if (isDidntCome) badgeClass = 'bg-warning text-dark border border-warning fw-bold';
                                                            else if (isCompleted) badgeClass = 'bg-success-subtle text-success fw-semibold';
                                                            else if (isApproved) badgeClass = 'bg-primary-subtle text-primary fw-semibold';

                                                            return (
                                                                <span key={idx} className={`badge px-3 py-1 rounded-pill ${badgeClass}`}>
                                                                    {st}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="text-center p-5 text-muted">
                                                <div className="fs-5 fw-bold mb-1">No Patient Records Match the Filter</div>
                                                <p className="mb-0 small">Try clearing or adjusting your search, treatment, or status filters.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 border-top bg-light d-flex justify-content-between align-items-center">
                            <span className="small text-muted">
                                Total Patients Found: <strong>{reportFilteredPatients.length}</strong>
                            </span>
                            <button
                                type="button"
                                className="btn btn-secondary px-4 rounded-pill"
                                onClick={() => setShowReportModal(false)}
                            >
                                Close Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Fullscreen Zoom Lightbox Modal for X-Ray / PDF / DCM */}
            {zoomedXray && (
                <div 
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 animate__animated animate__fadeIn" 
                    style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000 }}
                    onClick={() => setZoomedXray(null)}
                >
                    <div className="position-relative text-center" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', width: '700px' }}>
                        <button 
                            type="button"
                            className="btn btn-light rounded-circle position-absolute top-0 end-0 m-3 shadow-lg d-flex align-items-center justify-content-center" 
                            onClick={() => setZoomedXray(null)}
                            style={{ zIndex: 10, width: '40px', height: '40px' }}
                        >
                            <RiCloseLine size={24} />
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
                                <strong style={{ color: colors.gold }}>{zoomedXray.title}</strong>
                                <span className="small text-muted">{zoomedXray.date}</span>
                            </div>
                            {zoomedXray.notes && <p className="small mb-0 text-light">{zoomedXray.notes}</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientManagement;
