import { readDatabase, writeDatabase } from '../../utils/storage';
import { addAuditLog } from '../../services/auditLogger';
import { broadcastRealtimeEvent } from '../../utils/realtimeClient';
import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { 
    RiShieldCheckLine, RiAlertLine, RiStethoscopeLine, 
    RiCheckDoubleLine, RiSendPlaneLine,
    RiLockPasswordLine
} from 'react-icons/ri';
import {
    addUserNotification,
    getSession,
    getUserNotifications,
    markUserNotificationsRead,
    normalizeEmail,
    normalizeNotificationStore,
    normalizeRole
} from '../../utils/notificationStore';

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
    { code: 'Ab', label: 'Abutment', color: '#1abc9c' }
];

const ToothSVG = React.memo(({ id, teethData, palette, selectedColor, savedColor, themeColors }) => {
    const status = teethData[id] || '/';
    const legend = legends.find(l => l.code === status) || legends[0];
    const hasExamResult = Object.keys(teethData).length > 0;
    const cannotHaveBraces = ['X', 'Ex', 'Un', 'Rf', 'Im'].includes(status);

    const getHexForColor = (colorVal) => {
        if (!colorVal) return null;
        if (typeof colorVal === 'object' && colorVal.hex) return colorVal.hex;
        const name = typeof colorVal === 'string' ? colorVal : (colorVal.name || colorVal.color || '');
        const found = palette.find(p => p.name.toLowerCase() === name.toLowerCase());
        return found ? found.hex : (typeof colorVal === 'object' ? colorVal.hex : null);
    };

    const elasticColor = getHexForColor(selectedColor) || getHexForColor(savedColor) || '#E0E0E0';

    return (
        <div className="text-center tooth-container d-flex flex-column align-items-center flex-shrink-0" style={{ position: 'relative', width: '36px', margin: '0 3px' }}>
            <svg width="36" height="48" viewBox="0 0 100 120" style={{ opacity: status === 'X' ? 0.2 : 1 }}>
                <path d="M20,40 Q20,10 50,10 Q80,10 80,40 Q85,100 50,110 Q15,100 20,40 Z" 
                      fill={legend.color} stroke="#dcdcdc" strokeWidth="2" />
                
                {hasExamResult && !cannotHaveBraces && (
                    <g>
                        <line x1="0" y1="60" x2="100" y2="60" stroke="#999" strokeWidth="3" />
                        <rect x="30" y="50" width="40" height="25" rx="3" fill="#bdc3c7" stroke="#7f8c8d" strokeWidth="1" />
                        <rect x="35" y="55" width="30" height="15" rx="2" fill={elasticColor} />
                    </g>
                )}

                <text x="50" y="32" fontSize="28" textAnchor="middle" fill={legend.color === '#ffffff' ? '#aaa' : 'white'} fontWeight="bold">{id}</text>
            </svg>
            
            <div className="mt-1 text-center fw-bold rounded-pill shadow-sm d-flex align-items-center justify-content-center" 
                 style={{ fontSize: '10px', height: '20px', width: '30px', backgroundColor: '#fff', color: themeColors.goldDark, border: '1px solid #eee' }}>
                {status}
            </div>
        </div>
    );
});

const DentalChartView = () => {
    const [patientRecord, setPatientRecord] = useState({ teeth: {} });
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedColor, setSelectedColor] = useState(null);
    const [savedColor, setSavedColor] = useState(null);
    const [pendingColorRequest, setPendingColorRequest] = useState(null);
    const [notifications, setNotifications] = useState([]);

    const themeColors = { gold: '#D4AF37', goldDark: '#B8860B', beige: '#F5F5DC' };

    const palette = [
        { id: 1, name: "Blue", hex: "#1f4ed8" }, { id: 2, name: "Sky Blue", hex: "#4dabf7" }, 
        { id: 3, name: "Torquoise", hex: "#40c3ff" }, { id: 4, name: "Black", hex: "#000" }, 
        { id: 5, name: "Light Green", hex: "#90ee90" }, { id: 6, name: "Mint Green", hex: "#3eb489" }, 
        { id: 7, name: "Teal", hex: "#008080" }, { id: 8, name: "Green", hex: "#008000" }, 
        { id: 9, name: "Light Orange", hex: "#ffb347" }, { id: 10, name: "Orange", hex: "#ff7f50" }, 
        { id: 11, name: "White", hex: "#fff" }, { id: 12, name: "Transparent", hex: "#eee" }, 
        { id: 13, name: "Silver", hex: "#c0c0c0" }, { id: 14, name: "Brown", hex: "#8b4513" }, 
        { id: 15, name: "Gold", hex: "#d4af37" }, { id: 16, name: "Yellow", hex: "#ffff00" }, 
        { id: 17, name: "Dark Violet", hex: "#9400d3" }, { id: 18, name: "Light Purple", hex: "#d8bfd8" }, 
        { id: 19, name: "Violet", hex: "#8a2be2" }, { id: 20, name: "Light Pink", hex: "#ffb6c1" }, 
        { id: 21, name: "Pink", hex: "#ff69b4" }, { id: 22, name: "Red", hex: "#ff0000" }, 
        { id: 23, name: "Dark Red", hex: "#8b0000" }, { id: 24, name: "Pearl Blue", hex: "#6a5acd" }, 
        { id: 25, name: "Gray", hex: "#808080" }, { id: 26, name: "Pearl", hex: "#f5f5f5" }, 
        { id: 27, name: "Cream", hex: "#fffdd0" }, { id: 28, name: "Ruby", hex: "#9b111e" }, 
        { id: 29, name: "Dark Blue", hex: "#00008b" }, { id: 30, name: "Metallic Blue", hex: "#4682b4" }, 
        { id: 31, name: "Dark Green", hex: "#006400" }, { id: 32, name: "Neon Orange", hex: "#ff5f1f" }, 
        { id: 33, name: "Red Orange", hex: "#ff4500" }, { id: 34, name: "Neon Pink", hex: "#ff1493" }, 
        { id: 35, name: "Purple", hex: "#800080" }, { id: 36, name: "Neon Yellow", hex: "#ffff33" }, 
        { id: 37, name: "Metallic Green", hex: "#3cb371" }, { id: 38, name: "Baby Blue", hex: "#89cff0" }, 
        { id: 39, name: "Nacarat", hex: "#ff4f00" }, { id: 40, name: "Pale Blue", hex: "#a2cffe" }, 
        { id: 41, name: "Maroon", hex: "#800000" }
    ];



    const treatmentRequiredCodes = ['C', 'Ex', 'Rf', 'Im'];

    const getBracesAccess = () => {
        const teeth = patientRecord?.teeth || {};
        const hasExamResult = Object.keys(teeth).length > 0;
        const needsTreatment = Object.values(teeth).some(status => treatmentRequiredCodes.includes(status));
        const isClearedForBraces = !!patientRecord?.clearedForBraces;

        // If the dentist has explicitly cleared the patient, grant access immediately
        if (isClearedForBraces) {
            return { allowed: true };
        }

        if (!hasExamResult) {
            return {
                allowed: false,
                title: 'Clearance Required',
                message: 'Your dentist must submit your exam results before you can select a braces color.'
            };
        }

        if (needsTreatment) {
            return {
                allowed: false,
                title: 'Treatment Required',
                message: 'Your dentist noted teeth that need treatment before braces color selection can be opened.'
            };
        }

        return {
            allowed: false,
            title: 'Clearance Required',
            message: 'Your dentist must turn on braces color clearance before you can choose a color.'
        };
    };

    useEffect(() => {
        const loadPatientData = () => {
            let db = normalizeNotificationStore(readDatabase() || {});
            
            const loggedInUser = getSession() || {};
            const emailKey = normalizeEmail(loggedInUser.email);
            setCurrentUser(loggedInUser);

            const intraoral = (db && db.intraoral_charts && db.intraoral_charts[emailKey]) || {};
            const dental = (db && db.dental_charts && db.dental_charts[emailKey]) || {};
            const patientChart = (db && db.patient_charts && db.patient_charts[emailKey]) || {};

            const record = {
                ...patientChart,
                ...dental,
                ...intraoral,
                teeth: {
                    ...(patientChart.teeth || {}),
                    ...(dental.teeth || {}),
                    ...(intraoral.teeth || {})
                },
                clearedForBraces: Boolean(dental.clearedForBraces ?? intraoral.clearedForBraces ?? patientChart.clearedForBraces),
                bracesColor: dental.bracesColor || intraoral.bracesColor || patientChart.bracesColor || null,
                bracesColorLocked: Boolean(dental.bracesColorLocked ?? intraoral.bracesColorLocked ?? patientChart.bracesColorLocked),
                pendingBracesColorChange: dental.pendingBracesColorChange || intraoral.pendingBracesColorChange || null,
                remarks: intraoral.remarks || intraoral.dentalNotes || dental.remarks || patientChart.remarks || '',
                hasBeenExamined: Boolean(intraoral.hasBeenExamined ?? dental.hasBeenExamined ?? patientChart.hasBeenExamined ?? (Object.keys(intraoral.teeth || dental.teeth || {}).length > 0))
            };

            setPatientRecord(record);

            const resolveColorObj = (c) => {
                if (!c) return null;
                if (typeof c === 'object' && c.name && c.hex) return c;
                const name = typeof c === 'string' ? c : (c.name || c.color || '');
                return palette.find(p => p.name.toLowerCase() === name.toLowerCase()) || (typeof c === 'object' ? c : null);
            };

            const savedObj = resolveColorObj(record.bracesColor);
            const pendingObj = record.pendingBracesColorChange ? resolveColorObj(record.pendingBracesColorChange.colorData || record.pendingBracesColorChange.color) : null;

            setSavedColor(savedObj);
            setPendingColorRequest(record.pendingBracesColorChange || null);

            setSelectedColor(prev => {
                if (prev && !record.pendingBracesColorChange && !record.bracesColor) return prev;
                return pendingObj || savedObj || prev || null;
            });

            const unread = getUserNotifications(db, emailKey).filter(n => !n.read);
            setNotifications(unread);
        };

        loadPatientData();
        window.addEventListener('storage', loadPatientData);
        window.addEventListener('doc_dental_db_updated', loadPatientData);
        return () => {
            window.removeEventListener('storage', loadPatientData);
            window.removeEventListener('doc_dental_db_updated', loadPatientData);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // eslint-disable-next-line no-unused-vars
    const dismissNotification = (id) => {
        let db = readDatabase();
        if (currentUser?.email) {
            db = markUserNotificationsRead(db, currentUser.email, [id]);
            writeDatabase(db);
            setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
        }
    };

    const handleConfirmColor = () => {
        if (!selectedColor) return;
        const bracesAccess = getBracesAccess();
        if (!bracesAccess.allowed) {
            Swal.fire({
                title: bracesAccess.title,
                text: bracesAccess.message,
                icon: 'info',
                confirmButtonColor: themeColors.gold
            });
            return;
        }

        try {
            let db = normalizeNotificationStore(readDatabase());
            const emailKey = normalizeEmail(currentUser.email);
            if (!db.dental_charts) db.dental_charts = {};
            if (!db.dental_charts[emailKey]) db.dental_charts[emailKey] = { teeth: {} };

            const getColorName = (c) => typeof c === 'string' ? c : (c?.name || '');
            const isColorChangeRequest = Boolean(savedColor && getColorName(savedColor) && getColorName(savedColor) !== getColorName(selectedColor));
            const requestId = Date.now();

            if (!db.bracesSelections) db.bracesSelections = [];
            
            // Remove previous pending color requests for this patient so only the current color request remains
            db.bracesSelections = db.bracesSelections.filter(s => {
                const sEmail = normalizeEmail(s.patientEmail || s.email);
                const sName = (s.patientName || s.name || '').trim().toLowerCase();
                const isSamePatient = (emailKey && sEmail === emailKey) || (sName && sName === (currentUser.fullName || '').trim().toLowerCase());
                return !isSamePatient || s.status === 'Approved' || s.status === 'Checked';
            });

            const selectionRecord = {
                id: requestId,
                patientEmail: currentUser.email,
                patientName: currentUser.fullName,
                date: new Date().toLocaleDateString(),
                color: selectedColor.name,
                colorData: selectedColor,
                status: isColorChangeRequest ? 'Pending Approval' : 'Finalized',
                requiresApproval: isColorChangeRequest
            };

            db.bracesSelections.push(selectionRecord);

            const staffMembers = (db.users || []).filter(u => ['admin', 'staff', 'superadmin'].includes(normalizeRole(u.role)));
            const newNotification = {
                id: requestId,
                title: isColorChangeRequest ? "Braces Color Change Requested" : "Braces Color Selected",
                message: isColorChangeRequest
                    ? `${currentUser.fullName} requested to change braces color to ${selectedColor.name}.`
                    : `${currentUser.fullName} has selected ${selectedColor.name}.`,
                date: new Date().toISOString(),
                read: false,
                type: "braces_update"
            };

            if (!db.intraoral_charts) db.intraoral_charts = {};
            if (!db.dental_charts) db.dental_charts = {};
            if (!db.intraoral_charts[emailKey]) db.intraoral_charts[emailKey] = db.dental_charts[emailKey] || { teeth: {} };
            if (!db.dental_charts[emailKey]) db.dental_charts[emailKey] = db.intraoral_charts[emailKey] || { teeth: {} };

            if (isColorChangeRequest) {
                const reqObj = {
                    id: requestId,
                    color: selectedColor.name,
                    colorData: selectedColor,
                    status: 'Pending',
                    requestedAt: new Date().toISOString()
                };
                db.intraoral_charts[emailKey].pendingBracesColorChange = reqObj;
                db.dental_charts[emailKey].pendingBracesColorChange = reqObj;
                setPendingColorRequest(reqObj);
            } else {
                db.intraoral_charts[emailKey].bracesColor = selectedColor;
                db.intraoral_charts[emailKey].bracesColorLocked = true;
                db.intraoral_charts[emailKey].bracesColorLockedAt = new Date().toISOString();

                db.dental_charts[emailKey].bracesColor = selectedColor;
                db.dental_charts[emailKey].bracesColorLocked = true;
                db.dental_charts[emailKey].bracesColorLockedAt = new Date().toISOString();

                setSavedColor(selectedColor);
                setPendingColorRequest(null);
            }

            setPatientRecord(db.intraoral_charts[emailKey]);

            staffMembers.forEach(staff => {
                db = addUserNotification(db, staff.email, newNotification);
            });

            writeDatabase(db);

            // Reflect in audit logs
            addAuditLog(
                isColorChangeRequest ? 'Requested Braces Color Change' : 'Selected Braces Color',
                `${currentUser.fullName} ${isColorChangeRequest ? 'requested braces color change to' : 'selected braces color'} ${selectedColor.name}.`
            );

            // Broadcast real-time event to Admin, Staff, and SuperAdmin
            broadcastRealtimeEvent('notification_new', {
                title: isColorChangeRequest ? 'Braces Color Change Requested' : 'Braces Color Selected',
                message: `${currentUser.fullName} ${isColorChangeRequest ? 'requested to change braces color to' : 'selected braces color'} ${selectedColor.name}.`,
                patientEmail: currentUser.email,
                targetRoles: ['admin', 'staff', 'superadmin']
            }, null, ['admin', 'staff', 'superadmin']);

            Swal.fire({
                title: isColorChangeRequest ? 'Request Sent!' : 'Confirmed!',
                text: isColorChangeRequest
                    ? 'Your new braces color is waiting for admin approval.'
                    : 'The clinic has been notified of your selection.',
                icon: 'success',
                confirmButtonColor: themeColors.gold
            });
        } catch (error) {
            Swal.fire('Save Failed', 'Unable to save your color selection. Please try again.', 'error');
        }
    };

    const summary = (() => {
        if (!patientRecord || !patientRecord.teeth || Object.keys(patientRecord.teeth).length === 0) {
            return { status: "Awaiting Exam", description: "Your dentist has not uploaded your exam yet.", color: "#6c757d" };
        }
        const teethValues = Object.values(patientRecord.teeth);
        const cariesCount = teethValues.filter(t => t === 'C').length;
        const extractionCount = teethValues.filter(t => t === 'Ex').length;
        const rootFragCount = teethValues.filter(t => t === 'Rf').length;
        const impactedCount = teethValues.filter(t => t === 'Im').length;
        const missingCount = teethValues.filter(t => t === 'X').length;

        const totalDiagnoses = cariesCount + extractionCount + rootFragCount + impactedCount;

        if (totalDiagnoses > 0) {
            const details = [];
            if (cariesCount > 0) details.push(`${cariesCount} caries (decay)`);
            if (extractionCount > 0) details.push(`${extractionCount} extraction required`);
            if (rootFragCount > 0) details.push(`${rootFragCount} root fragment`);
            if (impactedCount > 0) details.push(`${impactedCount} impacted tooth`);

            return {
                status: "Treatment Required",
                description: `Clinical exam noted ${details.join(', ')}. Please consult your dentist for treatment options.`,
                color: "#e74c3c"
            };
        } else if (missingCount > 0) {
            return {
                status: "Good Condition",
                description: `Oral health is sound with ${missingCount} missing teeth noted.`,
                color: "#0d6efd"
            };
        }

        return {
            status: "Great Oral Health!",
            description: "All teeth examined are in good condition with no active caries or extraction concerns.",
            color: "#198754"
        };
    })();

    const bracesAccess = getBracesAccess();
    const getColorName = (c) => typeof c === 'string' ? c : (c?.name || '');
    const hasPendingColorRequest = pendingColorRequest?.status === 'Pending';
    const isSelectedSavedColor = Boolean(savedColor && selectedColor && getColorName(selectedColor) === getColorName(savedColor));
    const isRequestingColorChange = Boolean(savedColor && selectedColor && getColorName(selectedColor) !== getColorName(savedColor));

    // eslint-disable-next-line no-unused-vars
    const getHexForColor = (colorVal) => {
        if (!colorVal) return null;
        if (typeof colorVal === 'object' && colorVal.hex) return colorVal.hex;
        const name = typeof colorVal === 'string' ? colorVal : (colorVal.name || colorVal.color || '');
        const found = palette.find(p => p.name.toLowerCase() === name.toLowerCase());
        return found ? found.hex : (typeof colorVal === 'object' ? colorVal.hex : null);
    };

    return (
        <>
            <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <div className="container-fluid animate__animated animate__fadeIn pb-5 mt-3">
                <div className="row">
                    <div className="col-lg-8">
                        <div className="card border-0 shadow-sm mb-4 overflow-hidden" style={{ borderRadius: '20px' }}>
                            <div className="row g-0">
                                <div className="col-md-3 d-flex align-items-center justify-content-center p-3 text-white" style={{ backgroundColor: summary.color }}>
                                    <div className="text-center">
                                        {summary.status === "Great Oral Health!" ? <RiShieldCheckLine size={40} /> : <RiAlertLine size={40} />}
                                        <h6 className="fw-bold mt-2 mb-0" style={{fontSize: '14px'}}>{summary.status}</h6>
                                    </div>
                                </div>
                                <div className="col-md-9 p-3">
                                    <h6 className="text-muted small fw-bold mb-1">Dentist's Notes</h6>
                                    <p className="mb-0 small">{summary.description}</p>
                                    {(patientRecord.remarks || patientRecord.dentalNotes) && (
                                        <div className="mt-2 p-3 rounded-3" style={{ backgroundColor: '#fffcf5', border: '1px solid #f3e5ab' }}>
                                            <div className="fw-bold text-dark small mb-1 d-flex align-items-center gap-1" style={{ color: themeColors.goldDark }}>
                                                Clinical Remarks & Advice:
                                            </div>
                                            <p className="mb-0 text-dark small" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                                {patientRecord.remarks || patientRecord.dentalNotes}
                                            </p>
                                        </div>
                                    )}
                                    {patientRecord.lastExamDate && (
                                        <p className="mt-2 mb-0 text-muted" style={{ fontSize: '12px' }}>
                                            <RiStethoscopeLine className="me-1"/> Last Examined: {patientRecord.lastExamDate}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm p-4 mb-4" style={{ borderRadius: '20px' }}>
                            <h5 className="fw-bold mb-4" style={{ color: themeColors.goldDark }}>Interactive Chart</h5>
                            
                            <div className="w-100 position-relative text-center" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '12px' }}>
                                <div className="d-inline-flex flex-column align-items-center px-2" style={{ minWidth: '640px' }}>
                                    <div className="d-flex justify-content-center mb-5 flex-nowrap">
                                        {[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28].map(id => (
                                            <ToothSVG 
                                                key={id} 
                                                id={id} 
                                                teethData={patientRecord?.teeth || {}} 
                                                palette={palette} 
                                                selectedColor={selectedColor} 
                                                savedColor={savedColor} 
                                                themeColors={themeColors} 
                                            />
                                        ))}
                                    </div>
                                    <div className="d-flex justify-content-center flex-nowrap">
                                        {[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].map(id => (
                                            <ToothSVG 
                                                key={id} 
                                                id={id} 
                                                teethData={patientRecord?.teeth || {}} 
                                                palette={palette} 
                                                selectedColor={selectedColor} 
                                                savedColor={savedColor} 
                                                themeColors={themeColors} 
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-4">
                        <div className="card border-0 shadow-sm p-4 h-100 d-flex flex-column" style={{ borderRadius: '20px', minHeight: '520px' }}>
                            <h5 className="fw-bold mb-1" style={{ color: themeColors.goldDark }}>Braces Band Color</h5>
                            <p className="text-muted small mb-3">
                                {savedColor 
                                    ? `Current Color: ${getColorName(savedColor)}` 
                                    : 'Select your band color preference:'}
                            </p>
                            
                            {/* Braces Clearance Conditional Rendering */}
                            {bracesAccess.allowed ? (
                                <>
                                    <div className="overflow-auto mb-4 flex-grow-1" style={{ maxHeight: '400px', paddingRight: '5px' }}>
                                        <div className="row g-3">
                                            {palette.map((color) => {
                                                const isSelected = selectedColor && getColorName(selectedColor) === color.name;
                                                const isSaved = savedColor && getColorName(savedColor) === color.name;
                                                return (
                                                    <div className="col-4 d-flex flex-column align-items-center" key={color.id}>
                                                        <div 
                                                            onClick={() => {
                                                                setSelectedColor(color);
                                                            }}
                                                            className="rounded-circle shadow-sm"
                                                            style={{ 
                                                                width: '45px',
                                                                height: '45px',
                                                                backgroundColor: color.hex,
                                                                cursor: 'pointer',
                                                                opacity: 1,
                                                                transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                                                                border: isSelected 
                                                                    ? `4px solid ${themeColors.goldDark}` 
                                                                    : (isSaved ? '3px solid #198754' : '2px solid #e2e8f0'),
                                                                boxShadow: isSelected ? '0 4px 12px rgba(184, 134, 11, 0.4)' : '0 2px 4px rgba(0,0,0,0.05)',
                                                                transition: 'all 0.2s ease-in-out'
                                                            }}
                                                        ></div>
                                                        <span className="small mt-1 text-muted fw-bold text-center" style={{fontSize: '10px', lineHeight: '1.2'}}>
                                                            {color.name}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleConfirmColor} 
                                        disabled={!selectedColor || isSelectedSavedColor}
                                        className={`btn w-100 py-2 mt-auto flex-shrink-0 fw-bold ${isSelectedSavedColor ? 'btn-success' : 'btn-primary'}`}
                                        style={{ borderRadius: '12px' }}
                                    >
                                        {isSelectedSavedColor
                                            ? <><RiCheckDoubleLine/> Current Color</>
                                            : isRequestingColorChange
                                                ? <><RiSendPlaneLine/> Request Admin Approval</>
                                                : <><RiSendPlaneLine/> Finalize Color</>}
                                    </button>

                                    {hasPendingColorRequest ? (
                                        <p className="small text-muted text-center mt-3 mb-0">
                                            Your request for {pendingColorRequest.color} is waiting for admin approval.
                                        </p>
                                    ) : savedColor && (
                                        <p className="small text-muted text-center mt-3 mb-0">
                                            You can choose another color, but changes require admin approval.
                                        </p>
                                    )}
                                </>
                            ) : (
                                <div className="text-center text-muted d-flex flex-column align-items-center justify-content-center h-100 pb-5">
                                    <RiLockPasswordLine size={48} className="mb-3 text-secondary" style={{ opacity: 0.5 }} />
                                    <p className="fw-bold mb-1 text-dark">{bracesAccess.title}</p>
                                    <p className="small mb-0">{bracesAccess.message}</p>
                                </div>
                            )}
                            
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DentalChartView;
