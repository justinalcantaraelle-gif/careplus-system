import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    RiShieldCheckLine, RiAlertLine, RiStethoscopeLine,
    RiEditLine, RiCheckLine, RiUserSearchLine, RiSendPlaneLine,
    RiListSettingsLine,
    RiPaletteLine, RiEyeLine, RiFileTextLine
} from 'react-icons/ri';
import {
    addUserNotification,
    getSession,
    getUserNotifications,
    markUserNotificationsRead,
    normalizeEmail,
    normalizeNotificationStore
} from '../../utils/notificationStore';
import { addAuditLog } from '../../services/auditLogger';
import { readDatabase, writeDatabase } from '../../utils/storage';

const DentalChart = () => {
    const [patients, setPatients] = useState([]);
    const [selectedPatientEmail, setSelectedPatientEmail] = useState("");
    const [patientSearchTerm, setPatientSearchTerm] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [patientRecord, setPatientRecord] = useState({ teeth: {}, clearedForBraces: false });
    const [isEditing, setIsEditing] = useState(false);

    const [notifications, setNotifications] = useState([]);
    const [colorHistory, setColorHistory] = useState([]);
    const [checkedColors, setCheckedColors] = useState([]);

    const colors = {
        gold: '#D4AF37',
        goldDark: '#B8860B',
        beige: '#F5F5DC'
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

    const getColorKey = (item) => String(item?.id || `${item?.patientName || ''}-${item?.date || ''}-${item?.color || ''}`);

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const getPatientAccountKey = (item, usersList = []) => {
        const rawEmail = normalizeEmail(item.patientEmail || item.email);
        if (rawEmail) return rawEmail;

        const rawName = (item.patientName || item.name || '').trim().toLowerCase();
        if (rawName && Array.isArray(usersList)) {
            const foundUser = usersList.find(u => (u.fullName || '').trim().toLowerCase() === rawName || (u.username || '').trim().toLowerCase() === rawName);
            if (foundUser && foundUser.email) {
                return normalizeEmail(foundUser.email);
            }
            return rawName;
        }
        return rawName || 'unknown';
    };

    // Load Initial Data
    useEffect(() => {
        const loadChartData = () => {
            let db = readDatabase({ users: [], appointments: [], dental_charts: {}, medical_records: {} });

            if (db && Array.isArray(db.users)) {
                const patientList = db.users.filter(u => (u.role || '').toLowerCase().trim() === 'patient');
                setPatients(patientList);
            }

            const currentUser = getSession();
            const unread = currentUser?.email
                ? getUserNotifications(db, currentUser.email).filter(n => !n.read)
                : [];
            setNotifications(unread);

            // Filter pending/un-checked items for colorHistory top bar (EXCLUDE ALREADY APPROVED PATIENTS)
            const pendingSelectionsMap = new Map();

            (db.bracesSelections || []).forEach(s => {
                const patientKey = getPatientAccountKey(s, db.users || []);
                const chart = db.dental_charts ? db.dental_charts[patientKey] : null;
                const isApprovedInChart = chart && chart.bracesColor && !chart.pendingBracesColorChange;
                const isAlreadyApproved = s.status === 'Approved' || s.status === 'Checked' || isApprovedInChart;

                if (!isAlreadyApproved && (s.requiresApproval || s.status === 'Pending Approval' || s.status === 'Pending')) {
                    if (patientKey && patientKey !== 'unknown') {
                        pendingSelectionsMap.set(patientKey, s);
                    }
                }
            });

            if (db.dental_charts) {
                Object.keys(db.dental_charts).forEach(email => {
                    const chart = db.dental_charts[email];
                    if (chart && chart.pendingBracesColorChange && chart.pendingBracesColorChange.status === 'Pending') {
                        const req = chart.pendingBracesColorChange;
                        const userObj = (db.users || []).find(u => normalizeEmail(u.email) === normalizeEmail(email));
                        const patientName = userObj ? userObj.fullName : email;
                        const patientKey = normalizeEmail(email);

                        pendingSelectionsMap.set(patientKey, {
                            id: req.id || Date.now(),
                            patientEmail: email,
                            patientName,
                            date: req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : 'Today',
                            color: req.color,
                            colorData: req.colorData,
                            status: 'Pending Approval',
                            requiresApproval: true
                        });
                    }
                });
            }

            setColorHistory(Array.from(pendingSelectionsMap.values()).reverse());

            // Deduplicate checked colors to keep ONLY 1 latest record per patient account
            const uniqueCheckedMap = new Map();
            (Array.isArray(db.checkedBracesSelections) ? [...db.checkedBracesSelections].reverse() : []).forEach(item => {
                const patientKey = getPatientAccountKey(item, db.users || []);
                if (!uniqueCheckedMap.has(patientKey)) {
                    uniqueCheckedMap.set(patientKey, item);
                }
            });

            setCheckedColors(Array.from(uniqueCheckedMap.values()));
        };

        loadChartData();
        window.addEventListener('storage', loadChartData);
        window.addEventListener('doc_dental_db_updated', loadChartData);

        return () => {
            window.removeEventListener('storage', loadChartData);
            window.removeEventListener('doc_dental_db_updated', loadChartData);
        };
    }, []);

    // Load Selected Patient Data
    useEffect(() => {
        if (!selectedPatientEmail) {
            setPatientRecord({ teeth: {}, clearedForBraces: false });
            return;
        }

        const emailKey = normalizeEmail(selectedPatientEmail);
        let db = readDatabase() || {};

        if (db && db.intraoral_charts && db.intraoral_charts[emailKey]) {
            setPatientRecord(db.intraoral_charts[emailKey]);
        } else if (db && db.dental_charts && db.dental_charts[emailKey]) {
            setPatientRecord(db.dental_charts[emailKey]);
        } else {
            setPatientRecord({ teeth: {}, clearedForBraces: false });
        }
    }, [selectedPatientEmail]);

    // --- BULLETPROOF UNIFIED SAVE FUNCTION ---
    const updatePatientDatabase = (updates) => {
        if (!selectedPatientEmail) return;

        // Standardize email to prevent case-mismatch bugs between Patient and Staff
        const emailKey = normalizeEmail(selectedPatientEmail);
        let db = normalizeNotificationStore(readDatabase());

        if (!db.intraoral_charts) db.intraoral_charts = {};
        if (!db.dental_charts) db.dental_charts = {};

        const existingRecord = db.intraoral_charts[emailKey] || db.dental_charts[emailKey] || { teeth: {}, clearedForBraces: false };
        const newRecord = { ...existingRecord, ...updates };

        db.intraoral_charts[emailKey] = newRecord;
        db.dental_charts[emailKey] = newRecord;
        writeDatabase(db);

        setPatientRecord(newRecord);
    };

    const handleToothUpdate = (id, code) => {
        const updatedTeeth = { ...patientRecord.teeth, [id]: code };
        updatePatientDatabase({ teeth: updatedTeeth });
    };

    const handleToggleEditing = () => {
        if (isEditing) {
            // Finishing exam session: count all tooth updates as 1 single audit log entry
            addAuditLog('Updated Intraoral Exam', `Updated intraoral charting exam for ${selectedPatientEmail}.`);
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Intraoral exam saved!',
                showConfirmButton: false,
                timer: 2000
            });
        }
        setIsEditing(!isEditing);
    };

    const handleToggleClearance = (e) => {
        const isCleared = e.target.checked;
        updatePatientDatabase({ clearedForBraces: isCleared });
        addAuditLog(isCleared ? 'Approved Braces Clearance' : 'Revoked Braces Clearance', `${selectedPatientEmail} braces clearance changed to ${isCleared ? 'cleared' : 'not cleared'}.`);

        let db = readDatabase();
        db = addUserNotification(db, selectedPatientEmail, {
            id: `clearance-${Date.now()}`,
            title: isCleared ? 'Braces Clearance Approved' : 'Braces Clearance Revoked',
            message: isCleared
                ? 'You have been cleared by the dentist to select your braces color. Please go to your Dental Chart to choose!'
                : 'Your braces color selection clearance has been revoked.',
            date: new Date().toISOString(),
            read: false,
            type: 'clearance_update'
        });
        writeDatabase(db);

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: isCleared ? 'success' : 'info',
            title: isCleared ? 'Patient cleared for braces!' : 'Braces clearance revoked.',
            showConfirmButton: false,
            timer: 2000
        });
    };

    const handleSendResults = () => {
        if (!selectedPatientEmail) return;

        const emailKey = normalizeEmail(selectedPatientEmail);
        let db = normalizeNotificationStore(readDatabase());

        // Ensure the chart has minimum data to trigger the Patient view to unlock
        const finalTeeth = { ...patientRecord.teeth };
        if (Object.keys(finalTeeth).length === 0) {
            finalTeeth[18] = '/'; // Marks at least one tooth to bypass empty checks
        }

        const currentRemarks = (patientRecord.remarks || patientRecord.dentalNotes || '').trim();

        // 1. Update Chart
        updatePatientDatabase({
            teeth: finalTeeth,
            remarks: currentRemarks,
            dentalNotes: currentRemarks,
            lastExamDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            hasBeenExamined: true
        });

        const notePreview = currentRemarks
            ? ` Remarks: "${currentRemarks.length > 70 ? currentRemarks.slice(0, 70) + '...' : currentRemarks}"`
            : '';

        // 2. Send 1 Single Notification for the entire exam update
        db = addUserNotification(readDatabase(), emailKey, {
            id: Date.now(),
            title: "Intraoral Exam & Dental Notes Updated",
            message: `The clinic has updated your intraoral charting results & notes.${notePreview} Please review them in your dental chart portal.`,
            date: new Date().toISOString(),
            read: false,
            type: "clinical_update"
        });

        writeDatabase(db);

        // 3. Record 1 Single Audit Log entry for the entire exam update
        addAuditLog('Updated Intraoral Exam', `Sent intraoral charting exam results and notes to ${selectedPatientEmail}.`);

        // Disable editing mode automatically
        setIsEditing(false);

        Swal.fire({
            title: 'Results & Notes Sent!',
            text: 'The patient has been notified and their intraoral examination chart & dental notes are now visible to them.',
            icon: 'success',
            confirmButtonColor: colors.gold
        });
    };

    // eslint-disable-next-line no-unused-vars
    const dismissNotification = (id) => {
        let db = readDatabase() || {};
        const currentUser = getSession();
        if (currentUser?.email) {
            db = markUserNotificationsRead(db, currentUser.email, [id]);
            writeDatabase(db);
            setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
        }
    };

    const getHealthSummary = () => {
        if (!selectedPatientEmail) return { status: "No Patient Selected", description: "Select a patient to view chart.", color: "#6c757d" };
        if (!patientRecord || !patientRecord.teeth || Object.keys(patientRecord.teeth).length === 0) return { status: "Awaiting Data", description: "No clinical record found yet.", color: "#6c757d" };

        const teethValues = Object.values(patientRecord.teeth);
        const cariesCount = teethValues.filter(t => t === 'C').length;
        const extractionCount = teethValues.filter(t => t === 'Ex').length;
        const rootFragCount = teethValues.filter(t => t === 'Rf').length;
        const impactedCount = teethValues.filter(t => t === 'Im').length;
        const missingCount = teethValues.filter(t => t === 'X').length;

        const totalDiagnoses = cariesCount + extractionCount + rootFragCount + impactedCount;

        if (totalDiagnoses > 0) {
            const details = [];
            if (cariesCount > 0) details.push(`${cariesCount} caries`);
            if (extractionCount > 0) details.push(`${extractionCount} extraction required`);
            if (rootFragCount > 0) details.push(`${rootFragCount} root frag`);
            if (impactedCount > 0) details.push(`${impactedCount} impacted`);

            return {
                status: "Needs Treatment",
                description: `Patient chart contains ${details.join(', ')}.`,
                color: "#e74c3c"
            };
        } else if (missingCount > 0) {
            return {
                status: "Good Standing",
                description: `Patient has ${missingCount} missing teeth. No active caries or extractions required.`,
                color: "#0d6efd"
            };
        }

        return {
            status: "Good Standing",
            description: "All examined teeth are sound and in good condition. No active treatment needed.",
            color: "#198754"
        };
    };

    const summary = getHealthSummary();
    const selectedPatient = patients.find(p => normalizeEmail(p.email) === normalizeEmail(selectedPatientEmail));
    const selectedPatientLabel = selectedPatient ? `${selectedPatient.fullName || selectedPatient.name || 'Patient'} (${selectedPatient.email})` : "";
    const patientSearchValue = patientSearchTerm.trim().toLowerCase();
    const isSearchingPatients = isSearchFocused || (!!patientSearchValue && patientSearchTerm !== selectedPatientLabel);

    const filteredPatients = (patientSearchValue && patientSearchTerm !== selectedPatientLabel)
        ? patients
            .filter(p =>
                (p.fullName || p.name || '').toLowerCase().includes(patientSearchValue) ||
                (p.email || '').toLowerCase().includes(patientSearchValue)
            )
            .slice(0, 10)
        : patients.slice(0, 10);

    const handlePatientSearchChange = (value) => {
        setPatientSearchTerm(value);
        setIsSearchFocused(true);
        if (!value.trim()) {
            setSelectedPatientEmail("");
            setIsEditing(false);
            return;
        }

        if (selectedPatient && value !== selectedPatientLabel) {
            setSelectedPatientEmail("");
            setIsEditing(false);
        }
    };

    const handleSelectPatient = (patient) => {
        setSelectedPatientEmail(patient.email);
        setPatientSearchTerm(`${patient.fullName || patient.name || 'Patient'} (${patient.email})`);
        setIsEditing(false);
        setIsSearchFocused(false);
    };



    const handleCheckColor = (item) => {
        const needsApproval = item.requiresApproval || item.status === 'Pending Approval';
        const checkedItem = {
            ...item,
            checkedAt: new Date().toISOString(),
            status: needsApproval ? 'Approved' : (item.status || 'Checked')
        };
        const itemKey = getColorKey(item);
        let db = normalizeNotificationStore(readDatabase() || {});

        // 1. Remove from pending bracesSelections so it moves into Eye Icon!
        const targetEmail = item.patientEmail || selectedPatientEmail;
        const targetEmailKey = normalizeEmail(targetEmail);
        const targetAccountKey = getPatientAccountKey(item, db.users || []);

        db.bracesSelections = (db.bracesSelections || []).filter(selection => {
            const selKey = getPatientAccountKey(selection, db.users || []);
            return selKey !== targetAccountKey && getColorKey(selection) !== itemKey;
        });

        // 2. Save into checkedBracesSelections (1 SINGLE LATEST record per patient account!)
        const targetNameKey = (item.patientName || '').trim().toLowerCase();

        const existingChecked = db.checkedBracesSelections || [];
        const filteredChecked = existingChecked.filter(selection => {
            const selEmailKey = normalizeEmail(selection.patientEmail || selection.email);
            const selNameKey = (selection.patientName || selection.name || '').trim().toLowerCase();

            const matchesEmail = targetEmailKey && selEmailKey && selEmailKey === targetEmailKey;
            const matchesName = targetNameKey && selNameKey && selNameKey === targetNameKey;
            return !matchesEmail && !matchesName;
        });

        db.checkedBracesSelections = [checkedItem, ...filteredChecked];

        if (targetEmail) {
            const emailKey = normalizeEmail(targetEmail);
            if (!db.dental_charts) db.dental_charts = {};
            if (!db.dental_charts[emailKey]) db.dental_charts[emailKey] = { teeth: {} };

            const approvedAt = new Date().toISOString();
            db.dental_charts[emailKey] = {
                ...db.dental_charts[emailKey],
                bracesColor: item.colorData || { name: item.color, hex: bracesColorHex[item.color] || colors.beige },
                bracesColorLocked: true,
                bracesColorLockedAt: approvedAt,
                bracesColorApprovedAt: approvedAt
            };
            delete db.dental_charts[emailKey].pendingBracesColorChange;

            db = addUserNotification(db, targetEmail, {
                id: Date.now(),
                title: 'Braces Color Approved',
                message: `Your request to change braces color to ${item.color} has been approved.`,
                date: new Date().toISOString(),
                read: false,
                type: 'braces_update'
            });
        }

        writeDatabase(db);
        addAuditLog(needsApproval ? 'Approved Braces Color' : 'Checked Braces Color', `${item.color} for ${item.patientEmail || item.patientName || 'patient'}.`);

        // Move item out of pending colorHistory bar into checkedColors (1 record per patient!)
        setColorHistory(prev => prev.filter(s => {
            const sKey = getPatientAccountKey(s, []);
            return sKey !== targetAccountKey && getColorKey(s) !== itemKey;
        }));
        setCheckedColors(prev => {
            const filtered = prev.filter(selection => {
                const selEmailKey = normalizeEmail(selection.patientEmail || selection.email);
                const selNameKey = (selection.patientName || selection.name || '').trim().toLowerCase();

                const matchesEmail = targetEmailKey && selEmailKey && selEmailKey === targetEmailKey;
                const matchesName = targetNameKey && selNameKey && selNameKey === targetNameKey;
                return !matchesEmail && !matchesName;
            });
            return [checkedItem, ...filtered];
        });

        if (selectedPatientEmail && targetEmail && normalizeEmail(selectedPatientEmail) === normalizeEmail(targetEmail)) {
            setPatientRecord(db.dental_charts[normalizeEmail(selectedPatientEmail)]);
        }

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: needsApproval ? `${item.color} approved & moved to eye icon list` : `${item.color} checked & moved to eye icon list`,
            showConfirmButton: false,
            timer: 1500
        });
    };

    const showCheckedColor = () => {
        let db = readDatabase() || {};
        const uniquePatientMap = new Map();

        // 1. From checkedColors / checkedBracesSelections
        (checkedColors || []).forEach((item) => {
            const patientKey = getPatientAccountKey(item, db.users || []);
            if (patientKey && !uniquePatientMap.has(patientKey)) {
                uniquePatientMap.set(patientKey, item);
            }
        });

        // 2. Include all patients from dental_charts who have an approved bracesColor
        if (db.dental_charts) {
            Object.keys(db.dental_charts).forEach(email => {
                const chart = db.dental_charts[email];
                if (chart && chart.bracesColor) {
                    const patientKey = normalizeEmail(email);
                    if (!uniquePatientMap.has(patientKey)) {
                        const userObj = (db.users || []).find(u => normalizeEmail(u.email) === patientKey);
                        const patientName = userObj ? userObj.fullName : email;
                        const colorObj = chart.bracesColor;
                        const colorName = typeof colorObj === 'string' ? colorObj : (colorObj.name || '');

                        uniquePatientMap.set(patientKey, {
                            id: `chart-${email}`,
                            patientEmail: email,
                            patientName,
                            date: chart.bracesColorApprovedAt ? new Date(chart.bracesColorApprovedAt).toLocaleDateString() : 'Saved',
                            color: colorName,
                            colorData: typeof colorObj === 'object' ? colorObj : { name: colorName, hex: bracesColorHex[colorName] || colors.beige },
                            status: 'Approved'
                        });
                    }
                }
            });
        }

        const displayList = Array.from(uniquePatientMap.values());

        if (displayList.length === 0) {
            Swal.fire({
                title: 'No Checked Colors',
                text: 'Checked patient colors will appear here.',
                icon: 'info',
                confirmButtonColor: colors.gold
            });
            return;
        }

        const tableRows = displayList.map((item) => {
            const colorValue = item.colorData?.hex || bracesColorHex[item.color] || colors.beige;
            return `
                <tr>
                    <td style="padding:10px;border-bottom:1px solid #eee;text-align:left;font-weight:700;">${escapeHtml(item.patientName || 'Patient')}</td>
                    <td style="padding:10px;border-bottom:1px solid #eee;text-align:left;">${escapeHtml(item.date || 'N/A')}</td>
                    <td style="padding:10px;border-bottom:1px solid #eee;text-align:left;">
                        <span style="display:inline-flex;align-items:center;gap:8px;">
                            <span style="width:18px;height:18px;border-radius:50%;background:${colorValue};border:1px solid #ccc;display:inline-block;"></span>
                            <strong>${escapeHtml(item.color || 'N/A')}</strong>
                        </span>
                    </td>
                    <td style="padding:10px;border-bottom:1px solid #eee;text-align:left;">${escapeHtml(item.status || 'Approved')}</td>
                </tr>
            `;
        }).join('');

        Swal.fire({
            title: 'Checked Patient Colors',
            html: `
                <div style="max-height:360px;overflow:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:14px;">
                        <thead>
                            <tr style="background:#fff8df;color:#6f5200;">
                                <th style="padding:10px;text-align:left;border-bottom:1px solid #e8d58a;">Patient</th>
                                <th style="padding:10px;text-align:left;border-bottom:1px solid #e8d58a;">Date</th>
                                <th style="padding:10px;text-align:left;border-bottom:1px solid #e8d58a;">Color</th>
                                <th style="padding:10px;text-align:left;border-bottom:1px solid #e8d58a;">Status</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            `,
            width: 650,
            confirmButtonColor: colors.gold
        });
    };

    const ToothSVG = React.memo(({ id, teethData, isEditing, legends, colors, handleToothUpdate }) => {
        const status = teethData[id] || '/';
        const legend = legends.find(l => l.code === status) || legends[0];

        return (
            <div className="text-center tooth-container mx-1 d-flex flex-column align-items-center" style={{ position: 'relative', width: '45px' }}>
                <svg width="40" height="50" viewBox="0 0 100 120" style={{ opacity: status === 'X' ? 0.2 : 1 }}>
                    <path d="M20,40 Q20,10 50,10 Q80,10 80,40 Q85,100 50,110 Q15,100 20,40 Z"
                        fill={legend.color} stroke="#dcdcdc" strokeWidth="2" />
                    <text x="50" y="32" fontSize="22" textAnchor="middle" fill={legend.color === '#ffffff' ? '#aaa' : 'white'} fontWeight="bold">{id}</text>
                </svg>

                {isEditing && (
                    <select
                        className="form-control form-control-sm mt-1 text-center fw-bold shadow-sm"
                        style={{
                            fontSize: '12px',
                            height: '26px',
                            width: '45px',
                            color: colors.goldDark,
                            cursor: 'pointer',
                            padding: '2px'
                        }}
                        value={status}
                        onChange={(e) => handleToothUpdate(id, e.target.value)}
                    >
                        {legends.map(l => <option key={l.code} value={l.code} title={l.label}>{l.code}</option>)}
                    </select>
                )}
            </div>
        );
    });

    return (
        <div className="container-fluid animate__animated animate__fadeIn pb-5 mt-3">

            <div className="card border-0 shadow-sm mb-4 p-3" style={{ borderRadius: '4px' }}>
                <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-3">
                    <div className="d-flex align-items-center gap-2 flex-shrink-0" style={{ minWidth: '225px' }}>
                        <h6 className="fw-bold mb-0 d-flex align-items-center" style={{ color: colors.goldDark }}>
                            <RiPaletteLine className="me-2" size={20} /> PATIENT COLORS
                        </h6>
                        <button
                            type="button"
                            className="doc-btn doc-btn-neutral doc-btn-sm d-inline-flex align-items-center justify-content-center"
                            style={{ width: '36px', height: '36px', borderRadius: '10px', padding: 0 }}
                            onClick={showCheckedColor}
                            title="Show checked color"
                        >
                            <RiEyeLine size={20} />
                        </button>
                    </div>

                    <div className="flex-grow-1 overflow-auto">
                        {colorHistory.length > 0 ? (
                            <div className="d-flex gap-3 pb-1" style={{ minWidth: 'max-content' }}>
                                {colorHistory.slice(0, 6).map((item) => {
                                    const itemKey = getColorKey(item);
                                    return (
                                        <div
                                            key={itemKey}
                                            className="d-flex justify-content-between align-items-center bg-light px-3 py-2 border gap-2"
                                            style={{ width: '310px', borderRadius: '4px' }}
                                        >
                                            <div className="text-truncate me-3">
                                                <strong className="d-block text-dark">{item.patientName}</strong>
                                                <span className="text-muted small">{item.date}</span>
                                                {(item.requiresApproval || item.status === 'Pending Approval') && (
                                                    <span className="badge bg-warning-subtle text-warning border ms-2">Approval Needed</span>
                                                )}
                                            </div>
                                            <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                                <button
                                                    type="button"
                                                    className="doc-btn doc-btn-success doc-btn-sm"
                                                    style={{ width: '30px', height: '30px', padding: 0 }}
                                                    onClick={() => handleCheckColor(item)}
                                                    title={(item.requiresApproval || item.status === 'Pending Approval') ? 'Approve this color change' : 'Check this color'}
                                                >
                                                    <RiCheckLine size={16} />
                                                </button>
                                                <span className="badge text-dark border shadow-sm px-3 py-2" style={{ backgroundColor: colors.beige, borderRadius: '4px' }}>
                                                    {item.color}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-muted small mb-0 py-2">No colors selected yet.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4 p-3" style={{ borderRadius: '15px' }}>
                <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-2">
                    <RiUserSearchLine size={24} className="me-2 text-secondary" />
                    <div className="position-relative flex-grow-1">
                        <input
                            type="search"
                            className="form-control border-0 bg-light shadow-none"
                            placeholder="Click or type to search patient by name or email..."
                            value={patientSearchTerm}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                            onChange={(e) => handlePatientSearchChange(e.target.value)}
                            style={{ height: '46px', borderRadius: '10px' }}
                        />

                        {isSearchingPatients && filteredPatients.length > 0 && (
                            <div
                                className="position-absolute start-0 end-0 bg-white border shadow-lg mt-2"
                                style={{ zIndex: 100, borderRadius: '10px', maxHeight: '280px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
                            >
                                {filteredPatients.map(patient => (
                                    <button
                                        key={patient.email}
                                        type="button"
                                        className="btn btn-link text-start text-decoration-none w-100 px-3 py-2 border-bottom"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelectPatient(patient);
                                        }}
                                        style={{ color: '#212529' }}
                                    >
                                        <span className="fw-bold d-block">{patient.fullName || patient.name || 'Unnamed Patient'}</span>
                                        <span className="small text-muted">{patient.email}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {isSearchingPatients && filteredPatients.length === 0 && (
                            <div
                                className="position-absolute start-0 end-0 bg-white border shadow-sm mt-2 px-3 py-2 text-muted small"
                                style={{ zIndex: 100, borderRadius: '10px' }}
                            >
                                No registered patients found.
                            </div>
                        )}
                    </div>
                </div>
                {selectedPatient && (
                    <div className="mt-3 small text-muted">
                        Viewing chart for <span className="fw-bold text-dark">{selectedPatient.fullName || selectedPatient.email}</span>
                    </div>
                )}
            </div>

            <div className="intraoral-print-area">
                <div className="print-only intraoral-print-header">
                    <div>
                        <h2>Doc Dental Care</h2>
                        <p>Intraoral Examination</p>
                    </div>
                    <div className="text-end">
                        <strong>{selectedPatient?.fullName || 'No patient selected'}</strong>
                        <span>{selectedPatientEmail || 'N/A'}</span>
                        <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                </div>

                <div className="card border-0 shadow-sm mb-4 overflow-hidden clinical-briefing-card" style={{ borderRadius: '20px' }}>
                    <div className="row g-0">
                        <div className="col-md-3 d-flex align-items-center justify-content-center p-4 text-white clinical-status-panel"
                            style={{ backgroundColor: summary.color, transition: '0.3s' }}>
                            <div className="text-center">
                                {summary.status === "Good Standing" ? <RiShieldCheckLine size={50} /> : <RiAlertLine size={50} />}
                                <h6 className="fw-bold mt-2 mb-0">{summary.status}</h6>
                            </div>
                        </div>
                        <div className="col-md-9">
                            <div className="card-body p-4 d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted small fw-bold mb-1"><RiStethoscopeLine className="me-1" /> CLINICAL BRIEFING</h6>
                                    <p className="mb-2 small">{summary.description}</p>

                                    {selectedPatientEmail && (
                                        <div className="form-check form-switch mt-2">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id="clearanceSwitch"
                                                checked={!!patientRecord.clearedForBraces}
                                                onChange={handleToggleClearance}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <label className="form-check-label small fw-bold text-primary ms-2" htmlFor="clearanceSwitch" style={{ cursor: 'pointer' }}>
                                                Clear patient to choose braces color
                                            </label>
                                        </div>
                                    )}

                                    {selectedPatientEmail && (
                                        <div className="mt-3 p-3 rounded-3 border bg-white d-flex align-items-center justify-content-between shadow-sm" style={{ borderLeft: `6px solid ${patientRecord.bracesColor?.hex || bracesColorHex[patientRecord.bracesColor?.name || patientRecord.bracesColor] || patientRecord.pendingBracesColorChange?.colorData?.hex || bracesColorHex[patientRecord.pendingBracesColorChange?.color] || colors.gold}` }}>
                                            <div className="d-flex align-items-center gap-3">
                                                <span
                                                    className="rounded-circle border shadow-sm flex-shrink-0"
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        display: 'inline-block',
                                                        backgroundColor: patientRecord.bracesColor?.hex || bracesColorHex[patientRecord.bracesColor?.name || patientRecord.bracesColor] || patientRecord.pendingBracesColorChange?.colorData?.hex || bracesColorHex[patientRecord.pendingBracesColorChange?.color] || colors.beige
                                                    }}
                                                />
                                                <div>
                                                    <strong className="d-block text-dark small text-uppercase" style={{ letterSpacing: '0.5px' }}>Selected Brace Color</strong>
                                                    <div className="d-flex align-items-center gap-2 mt-1">
                                                        <span className="fw-bold fs-6 text-dark">
                                                            {patientRecord.bracesColor?.name || (typeof patientRecord.bracesColor === 'string' ? patientRecord.bracesColor : null) || patientRecord.pendingBracesColorChange?.color || 'None selected'}
                                                        </span>
                                                        {patientRecord.pendingBracesColorChange && (
                                                            <span className="badge bg-warning text-dark border">Approval Needed</span>
                                                        )}
                                                        {patientRecord.bracesColor && !patientRecord.pendingBracesColorChange && (
                                                            <span className="badge bg-success-subtle text-success border border-success-subtle">Approved</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {patientRecord.pendingBracesColorChange && (
                                                <button
                                                    type="button"
                                                    className="doc-btn doc-btn-success doc-btn-sm shadow-sm"
                                                    onClick={() => handleCheckColor({
                                                        patientEmail: selectedPatientEmail,
                                                        patientName: selectedPatient?.fullName || selectedPatientEmail,
                                                        color: patientRecord.pendingBracesColorChange.color,
                                                        colorData: patientRecord.pendingBracesColorChange.colorData,
                                                        status: 'Pending Approval',
                                                        requiresApproval: true
                                                    })}
                                                >
                                                    <RiCheckLine size={16} /> Approve Color
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="doc-btn-toolbar no-print flex-wrap">
                                    <button
                                        onClick={handleToggleEditing}
                                        disabled={!selectedPatientEmail}
                                        className={`doc-btn ${isEditing ? 'doc-btn-success' : 'doc-btn-warning'}`}
                                    >
                                        {isEditing ? <><RiCheckLine size={16} /> Finish Exam</> : <><RiEditLine size={16} /> Intraoral Exam</>}
                                    </button>


                                    <button
                                        onClick={handleSendResults}
                                        disabled={!selectedPatientEmail}
                                        className="doc-btn doc-btn-info"
                                    >
                                        <RiSendPlaneLine size={16} /> Send Results
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="row intraoral-chart-row">
                    <div className="col-md-3 d-flex flex-column gap-4">
                        <div className="card border-0 shadow-sm p-4 clinical-legend-card" style={{ borderRadius: '20px', backgroundColor: '#FFFAF0' }}>
                            <h6 className="fw-bold mb-4 d-flex align-items-center" style={{ color: colors.goldDark }}>
                                <RiListSettingsLine className="me-2" size={20} /> CLINICAL LEGEND
                            </h6>
                            <div className="d-flex flex-column gap-3 clinical-legend-list">
                                {legends.map(l => (
                                    <div key={l.code} className="d-flex justify-content-between align-items-center px-3 py-2 clinical-legend-item"
                                        style={{ backgroundColor: '#FFFCF5', border: '1px solid #EADDCA', borderRadius: '8px' }}>
                                        <div className="d-flex align-items-center">
                                            <span className="fw-bold fs-5" style={{ color: colors.goldDark, minWidth: '40px' }}>{l.code}</span>
                                            <div className="rounded-circle shadow-sm ms-1" style={{ width: '12px', height: '12px', backgroundColor: l.color, border: '1px solid #ccc' }} />
                                        </div>
                                        <span className="text-muted" style={{ fontSize: '15px' }}>{l.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="col-md-9">
                        <div className="card border-0 shadow-sm p-4 h-100 intraoral-chart-card" style={{ borderRadius: '20px' }}>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h5 className="fw-bold mb-0" style={{ color: colors.goldDark }}>Intraoral Chart</h5>
                            </div>

                            {selectedPatientEmail ? (
                                <div className="text-center overflow-auto py-3 intraoral-chart-canvas">
                                    <div className="d-flex justify-content-center mb-5 tooth-row" style={{ minWidth: '700px' }}>
                                        {[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28].map(id => (
                                            <ToothSVG
                                                key={id}
                                                id={id}
                                                teethData={patientRecord?.teeth || {}}
                                                isEditing={isEditing}
                                                legends={legends}
                                                colors={colors}
                                                handleToothUpdate={handleToothUpdate}
                                            />
                                        ))}
                                    </div>
                                    <div className="d-flex justify-content-center tooth-row" style={{ minWidth: '700px' }}>
                                        {[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].map(id => (
                                            <ToothSVG
                                                key={id}
                                                id={id}
                                                teethData={patientRecord?.teeth || {}}
                                                isEditing={isEditing}
                                                legends={legends}
                                                colors={colors}
                                                handleToothUpdate={handleToothUpdate}
                                            />
                                        ))}
                                    </div>

                                    {/* Dental Notes & Clinical Remarks Input */}
                                    <div className="mt-4 pt-3 border-top text-start">
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <label className="form-label fw-bold mb-0 text-uppercase small d-flex align-items-center gap-1" style={{ color: colors.goldDark, letterSpacing: '0.5px' }}>
                                                <RiFileTextLine size={16} /> Dental Examination Notes & Remarks
                                            </label>
                                            <span className="badge bg-light text-muted border" style={{ fontSize: '10px' }}>
                                                Automatically sent to patient with Intraoral Exam
                                            </span>
                                        </div>
                                        <textarea
                                            className="form-control shadow-none"
                                            rows="3"
                                            placeholder="Enter dentist's clinical notes, remarks, treatment plan, or advice for the patient..."
                                            value={patientRecord.remarks || patientRecord.dentalNotes || ''}
                                            disabled={!selectedPatientEmail}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                updatePatientDatabase({ remarks: val, dentalNotes: val });
                                            }}
                                            style={{
                                                borderRadius: '12px',
                                                borderColor: '#e2d8c8',
                                                backgroundColor: '#fffdf9',
                                                fontSize: '13px',
                                                lineHeight: '1.5'
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-5 text-muted h-100 d-flex align-items-center justify-content-center">
                                    Search for a patient above to view or edit their intraoral chart.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .print-only { display: none; }
                .transition-all { transition: 0.2s; }
                .tooth-container:hover { transform: scale(1.05); transition: 0.2s; }
                .overflow-auto::-webkit-scrollbar { width: 4px; }
                .overflow-auto::-webkit-scrollbar-thumb { background-color: #dcdcdc; border-radius: 4px; }

                @page {
                    size: A4;
                    margin: 12mm;
                }

                @media print {
                    html,
                    body {
                        width: 210mm;
                        min-height: 297mm;
                        background: #ffffff !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    body * {
                        visibility: hidden;
                    }

                    .intraoral-print-area,
                    .intraoral-print-area * {
                        visibility: visible;
                    }

                    .intraoral-print-area {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 186mm;
                        padding: 0;
                        margin: 0;
                        color: #111111;
                        background: #ffffff;
                        font-size: 11px;
                    }

                    .print-only {
                        display: flex !important;
                    }

                    .no-print,
                    .no-print *,
                    .form-check-input,
                    .tooth-container select {
                        display: none !important;
                    }

                    .intraoral-print-header {
                        align-items: flex-start;
                        justify-content: space-between;
                        border-bottom: 2px solid #222222;
                        padding-bottom: 8px;
                        margin-bottom: 10px;
                    }

                    .intraoral-print-header h2 {
                        margin: 0;
                        font-size: 20px;
                        font-weight: 800;
                    }

                    .intraoral-print-header p,
                    .intraoral-print-header span {
                        display: block;
                        margin: 0;
                        font-size: 11px;
                    }

                    .intraoral-print-area .card,
                    .clinical-briefing-card,
                    .clinical-legend-card,
                    .intraoral-chart-card {
                        box-shadow: none !important;
                        border: 1px solid #d8d8d8 !important;
                        border-radius: 0 !important;
                        break-inside: avoid;
                    }

                    .clinical-briefing-card {
                        margin-bottom: 8px !important;
                    }

                    .clinical-status-panel {
                        color: #ffffff !important;
                        min-height: 72px;
                    }

                    .clinical-status-panel svg {
                        width: 28px;
                        height: 28px;
                    }

                    .clinical-briefing-card .card-body {
                        padding: 10px !important;
                    }

                    .intraoral-chart-row {
                        display: flex !important;
                        flex-wrap: nowrap !important;
                        gap: 8px;
                    }

                    .intraoral-chart-row .col-md-3 {
                        width: 42mm !important;
                        flex: 0 0 42mm !important;
                        max-width: 42mm !important;
                    }

                    .intraoral-chart-row .col-md-9 {
                        width: 142mm !important;
                        flex: 0 0 142mm !important;
                        max-width: 142mm !important;
                    }

                    .clinical-legend-card,
                    .intraoral-chart-card {
                        padding: 8px !important;
                        height: auto !important;
                    }

                    .clinical-legend-card h6,
                    .intraoral-chart-card h5 {
                        margin-bottom: 8px !important;
                        font-size: 12px !important;
                    }

                    .clinical-legend-list {
                        gap: 4px !important;
                    }

                    .clinical-legend-item {
                        padding: 3px 5px !important;
                    }

                    .clinical-legend-item span {
                        font-size: 9px !important;
                    }

                    .intraoral-chart-canvas {
                        overflow: visible !important;
                        padding: 8px 0 !important;
                    }

                    .tooth-row {
                        min-width: 0 !important;
                        margin-bottom: 14px !important;
                    }

                    .tooth-container {
                        width: 25px !important;
                        margin-left: 1px !important;
                        margin-right: 1px !important;
                        transform: none !important;
                    }

                    .tooth-container svg {
                        width: 24px !important;
                        height: 32px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default DentalChart;
