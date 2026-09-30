/**
 * Doc Dental Care - Universal System Data Export & Download Utilities
 * Provides comprehensive CSV, JSON, and multi-dataset downloading across the entire system.
 */

// Helper to escape CSV cell content and enclose in quotes, neutralizing spreadsheet formula execution
export const formatCsvValue = (val) => {
    if (val === null || val === undefined) return '""';
    let str = String(val).trim();
    if (typeof val === 'object') {
        try {
            str = JSON.stringify(val);
        } catch (e) {
            str = String(val);
        }
    }
    // Neutralize formula injection characters (=, +, -, @, tab, carriage return)
    if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
    }
    // Escape internal double quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`;
};

// Generic CSV builder with UTF-8 Byte Order Mark (BOM) for seamless Microsoft Excel opening
export const buildCsvString = (columns, rows) => {
    const BOM = '\uFEFF';
    const headerRow = columns.map(c => formatCsvValue(c.label || c.key)).join(',');
    const bodyRows = rows.map(row => {
        return columns.map(c => {
            const rawVal = typeof c.accessor === 'function' 
                ? c.accessor(row) 
                : row[c.key];
            return formatCsvValue(rawVal);
        }).join(',');
    });
    return BOM + [headerRow, ...bodyRows].join('\r\n');
};

// Universal browser download trigger via Blob URL
export const triggerDownload = (content, fileName, mimeType = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 200);
};

export const getTimestampForFileName = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}_${hh}${min}`;
};

// Resolve patient contact phone number from DB
export const resolvePatientContact = (item = {}, db = {}) => {
    const email = String(item.patientEmail || item.email || '').toLowerCase();
    const matchingUser = (db.users || []).find(u => String(u.email || '').toLowerCase() === email) || {};
    const matchingRecord = db.medical_records?.[email] || db.medical_records?.[item.patientEmail] || {};

    return item.contactNumber ||
        item.contactNo ||
        item.phone ||
        item.contact ||
        matchingRecord.contactNumber ||
        matchingRecord.contactNo ||
        matchingRecord.phone ||
        matchingUser.contactNumber ||
        matchingUser.contactNo ||
        matchingUser.phone ||
        '';
};

// ============================================================================
// 1. APPOINTMENTS EXPORT
// ============================================================================
export const exportAppointmentsToCsv = (appointments = [], db = {}, customFileName = null) => {
    const columns = [
        { label: 'Appointment ID', key: 'id' },
        { label: 'Date', key: 'date' },
        { label: 'Time', key: 'time' },
        { label: 'Patient Name', accessor: a => a.patientName || a.fullName || a.name || 'Unknown Patient' },
        { label: 'Patient Email', accessor: a => a.patientEmail || a.email || '' },
        { label: 'Contact Number', accessor: a => a.contactNumber || resolvePatientContact(a, db) },
        { label: 'Service / Treatment', accessor: a => a.service || a.treatment || 'General Checkup' },
        { label: 'Category', key: 'category' },
        { label: 'Braces Color', accessor: a => a.braceColor || a.color || a.bracesColor || 'N/A' },
        { label: 'Status', accessor: a => a.status || 'Pending' },
        { label: 'Reason / Decline Reason', accessor: a => a.cancelReason || a.declineReason || a.emergencyReason || '' },
        { label: 'Patient Booking Remarks', accessor: a => a.notes || '' },
        { label: 'Created At', accessor: a => a.createdAt || '' }
    ];

    const fileName = customFileName || `DocDental_Appointments_${getTimestampForFileName()}.csv`;
    const csvContent = buildCsvString(columns, appointments);
    triggerDownload(csvContent, fileName);
    return fileName;
};

// ============================================================================
// 2. PATIENTS DIRECTORY EXPORT
// ============================================================================
export const exportPatientsToCsv = (patients = [], medicalRecords = {}, appointments = [], customFileName = null) => {
    const columns = [
        { label: 'Patient ID', key: 'id' },
        { label: 'Full Name', accessor: p => p.fullName || p.name || 'N/A' },
        { label: 'Email Address', key: 'email' },
        { label: 'Contact Number', accessor: p => p.contactNumber || p.phone || p.contactNo || '' },
        { label: 'Patient Type', accessor: p => p.patientType || 'New Patient' },
        { label: 'Age', accessor: p => {
            const med = medicalRecords[p.email?.toLowerCase()] || {};
            return p.age || med.age || '';
        }},
        { label: 'Birthday', accessor: p => {
            const med = medicalRecords[p.email?.toLowerCase()] || {};
            return p.birthday || med.birthday || '';
        }},
        { label: 'Sex / Gender', accessor: p => {
            const med = medicalRecords[p.email?.toLowerCase()] || {};
            return p.sex || med.sex || '';
        }},
        { label: 'Home Address', accessor: p => {
            const med = medicalRecords[p.email?.toLowerCase()] || {};
            return p.address || med.address || '';
        }},
        { label: 'Religion', accessor: p => {
            const med = medicalRecords[p.email?.toLowerCase()] || {};
            return p.religion || med.religion || '';
        }},
        { label: 'Nationality', accessor: p => {
            const med = medicalRecords[p.email?.toLowerCase()] || {};
            return p.nationality || med.nationality || '';
        }},
        { label: 'Occupation', accessor: p => {
            const med = medicalRecords[p.email?.toLowerCase()] || {};
            return p.occupation || med.occupation || '';
        }},
        { label: 'Referred By', accessor: p => {
            const med = medicalRecords[p.email?.toLowerCase()] || {};
            return p.referredBy || med.referredBy || '';
        }},
        { label: 'Parent / Guardian', accessor: p => {
            const med = medicalRecords[p.email?.toLowerCase()] || {};
            return p.parentGuardian || med.parentGuardian || '';
        }},
        { label: 'Guardian Occupation', accessor: p => {
            const med = medicalRecords[p.email?.toLowerCase()] || {};
            return p.guardianOccupation || med.guardianOccupation || '';
        }},
        { label: 'Medical Conditions / Allergies', accessor: p => {
            const med = medicalRecords[p.email?.toLowerCase()] || {};
            const conds = med.conditions || p.conditions || [];
            return Array.isArray(conds) ? conds.join('; ') : String(conds || 'None');
        }},
        { label: 'Total Appointments', accessor: p => {
            const pEmail = (p.email || '').toLowerCase();
            return appointments.filter(a => (a.patientEmail || a.email || '').toLowerCase() === pEmail).length;
        }},
        { label: 'Account Created', accessor: p => p.createdAt || '' }
    ];

    const fileName = customFileName || `DocDental_Patients_${getTimestampForFileName()}.csv`;
    const csvContent = buildCsvString(columns, patients);
    triggerDownload(csvContent, fileName);
    return fileName;
};

// ============================================================================
// 3. MEDICAL RECORDS EXPORT
// ============================================================================
export const exportMedicalRecordsToCsv = (medicalRecords = {}, users = [], customFileName = null) => {
    const recordsList = Object.keys(medicalRecords).map(email => {
        const record = medicalRecords[email] || {};
        const matchedUser = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase()) || {};
        return {
            email,
            ...record,
            fullName: record.fullName || record.patientName || matchedUser.fullName || email
        };
    });

    const columns = [
        { label: 'Patient Name', key: 'fullName' },
        { label: 'Email Address', key: 'email' },
        { label: 'Contact Number', accessor: r => r.contactNumber || r.phone || r.contactNo || '' },
        { label: 'Age', key: 'age' },
        { label: 'Sex', key: 'sex' },
        { label: 'Birthday', key: 'birthday' },
        { label: 'Home Address', key: 'address' },
        { label: 'Occupation', key: 'occupation' },
        { label: 'Emergency Contact Person', key: 'emergencyContact' },
        { label: 'Emergency Contact No', key: 'emergencyContactNumber' },
        { label: 'Physician Name', key: 'physician' },
        { label: 'Physician Office / Specialty', key: 'physicianSpecialty' },
        { label: 'Physician Office Address', key: 'physicianAddress' },
        { label: 'Physician Phone', key: 'physicianPhone' },
        { label: 'In Good Health?', key: 'q1_goodHealth' },
        { label: 'Under Medical Condition / Treatment?', key: 'q2_underCondition' },
        { label: 'Major Illness / Surgery?', key: 'q3_illnessOperation' },
        { label: 'Hospitalized?', key: 'q4_hospitalized' },
        { label: 'Taking Prescription Medicines?', key: 'q5_takingMeds' },
        { label: 'Uses Tobacco / Smokes?', key: 'q6_usesTobacco' },
        { label: 'Drinks Alcohol / Uses Drugs?', key: 'q7_usesAlcoholDrugs' },
        { label: 'Pregnant (Women)?', key: 'q8_pregnant' },
        { label: 'Nursing (Women)?', key: 'q8_nursing' },
        { label: 'Taking Birth Control (Women)?', key: 'q8_birthControl' },
        { label: 'Reported Medical Conditions', accessor: r => Array.isArray(r.conditions) ? r.conditions.join('; ') : '' },
        { label: 'Allergies Details', key: 'allergies' },
        { label: 'Blood Type', key: 'bloodType' },
        { label: 'Blood Pressure', key: 'bloodPressure' },
        { label: 'Date Submitted', key: 'dateSubmitted' },
        { label: 'Last Updated', key: 'lastUpdated' }
    ];

    const fileName = customFileName || `DocDental_Medical_Records_${getTimestampForFileName()}.csv`;
    const csvContent = buildCsvString(columns, recordsList);
    triggerDownload(csvContent, fileName);
    return fileName;
};

// ============================================================================
// 4. DENTAL CHARTS & TEETH EXPORT
// ============================================================================
export const exportDentalChartsToCsv = (dentalCharts = {}, intraoralCharts = {}, users = [], customFileName = null) => {
    const allEmails = Array.from(new Set([...Object.keys(dentalCharts), ...Object.keys(intraoralCharts)]));
    const flatRows = [];

    allEmails.forEach(email => {
        const dChart = dentalCharts[email] || {};
        const iChart = intraoralCharts[email] || {};
        const matchedUser = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase()) || {};
        const patientName = matchedUser.fullName || email;
        const bracesColor = dChart.bracesColor?.name || dChart.bracesColor || iChart.bracesColor || 'None';
        const clearedForBraces = dChart.clearedForBraces ? 'Yes' : 'No';

        const teethObj = { ...(dChart.teeth || {}), ...(iChart.teeth || {}) };
        const toothKeys = Object.keys(teethObj);

        if (toothKeys.length === 0) {
            flatRows.push({
                email,
                patientName,
                toothNumber: 'All Teeth',
                condition: 'General Exam',
                treatment: 'Routine Check',
                remarks: dChart.remarks || iChart.remarks || '',
                bracesColor,
                clearedForBraces,
                lastUpdated: dChart.lastUpdated || iChart.lastUpdated || ''
            });
        } else {
            toothKeys.forEach(tKey => {
                const tData = teethObj[tKey];
                const conditionStr = typeof tData === 'object' ? (tData.condition || tData.status || JSON.stringify(tData)) : String(tData);
                const treatmentStr = typeof tData === 'object' ? (tData.treatment || tData.procedure || '') : '';
                flatRows.push({
                    email,
                    patientName,
                    toothNumber: tKey,
                    condition: conditionStr,
                    treatment: treatmentStr,
                    remarks: dChart.remarks || iChart.remarks || '',
                    bracesColor,
                    clearedForBraces,
                    lastUpdated: dChart.lastUpdated || iChart.lastUpdated || ''
                });
            });
        }
    });

    const columns = [
        { label: 'Patient Name', key: 'patientName' },
        { label: 'Patient Email', key: 'email' },
        { label: 'Tooth Number', key: 'toothNumber' },
        { label: 'Tooth Condition / Status', key: 'condition' },
        { label: 'Treatment / Procedure', key: 'treatment' },
        { label: 'Braces Color Selected', key: 'bracesColor' },
        { label: 'Cleared For Braces?', key: 'clearedForBraces' },
        { label: 'Clinical Remarks', key: 'remarks' },
        { label: 'Last Charted Date', key: 'lastUpdated' }
    ];

    const fileName = customFileName || `DocDental_Dental_Charts_${getTimestampForFileName()}.csv`;
    const csvContent = buildCsvString(columns, flatRows);
    triggerDownload(csvContent, fileName);
    return fileName;
};

// ============================================================================
// 5. PRICE LIST EXPORT
// ============================================================================
export const exportPriceListToCsv = (pricelist = [], customFileName = null) => {
    const columns = [
        { label: 'Item ID', key: 'id' },
        { label: 'Category', key: 'category' },
        { label: 'Procedure / Service Name', accessor: item => item.name || item.service || '' },
        { label: 'Price (PHP)', accessor: item => item.price || '' }
    ];

    const fileName = customFileName || `DocDental_Price_List_${getTimestampForFileName()}.csv`;
    const csvContent = buildCsvString(columns, pricelist);
    triggerDownload(csvContent, fileName);
    return fileName;
};

// ============================================================================
// 6. AUDIT LOGS EXPORT
// ============================================================================
export const exportAuditLogsToCsv = (auditLogs = [], customFileName = null) => {
    const columns = [
        { label: 'Log ID', key: 'id' },
        { label: 'Timestamp', accessor: l => l.timestamp || (l.createdAt ? new Date(l.createdAt).toLocaleString() : '') },
        { label: 'Action Taken', key: 'action' },
        { label: 'Details / Record Target', key: 'details' }
    ];

    const fileName = customFileName || `DocDental_Audit_Logs_${getTimestampForFileName()}.csv`;
    const csvContent = buildCsvString(columns, auditLogs);
    triggerDownload(csvContent, fileName);
    return fileName;
};

// ============================================================================
// 7. USER ACCOUNTS EXPORT (STAFF & ADMINS)
// ============================================================================
export const exportUsersToCsv = (users = [], customFileName = null) => {
    const columns = [
        { label: 'User ID', key: 'id' },
        { label: 'Full Name', accessor: u => u.fullName || u.name || '' },
        { label: 'Email Address', key: 'email' },
        { label: 'Role', key: 'role' },
        { label: 'Contact Phone', accessor: u => u.phone || u.contactNumber || '' },
        { label: 'Patient Type', accessor: u => u.patientType || (u.role === 'Patient' ? 'New Patient' : 'N/A') },
        { label: 'Account Status', accessor: u => u.bannedUntil ? `Restricted until ${u.bannedUntil}` : 'Active' },
        { label: 'Created Date', key: 'createdAt' }
    ];

    const fileName = customFileName || `DocDental_Users_${getTimestampForFileName()}.csv`;
    const csvContent = buildCsvString(columns, users);
    triggerDownload(csvContent, fileName);
    return fileName;
};

// ============================================================================
// 8. COMPLETE SYSTEM BACKUP (JSON FORMAT)
// ============================================================================
export const exportCompleteSystemJson = (db = {}, customFileName = null) => {
    // Sanitize any sensitive tokens while preserving full operational data
    const exportDb = {
        metadata: {
            system: 'Doc Dental Care Clinical System',
            exportedAt: new Date().toISOString(),
            version: '2.0',
            counts: {
                users: (db.users || []).length,
                appointments: (db.appointments || []).length,
                medical_records: Object.keys(db.medical_records || {}).length,
                dental_charts: Object.keys(db.dental_charts || {}).length,
                consent_records: (db.consent_records || []).length,
                audit_logs: (db.audit_logs || db.auditLogs || []).length,
                pricelist: (db.pricelist || []).length
            }
        },
        users: (db.users || []).map(u => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            role: u.role,
            phone: u.phone,
            patientType: u.patientType,
            createdAt: u.createdAt,
            bannedUntil: u.bannedUntil
        })),
        appointments: db.appointments || [],
        medical_records: db.medical_records || {},
        dental_charts: db.dental_charts || {},
        intraoral_charts: db.intraoral_charts || {},
        patient_charts: db.patient_charts || {},
        consent_records: db.consent_records || [],
        audit_logs: db.audit_logs || db.auditLogs || [],
        pricelist: db.pricelist || [],
        xray_records: db.xray_records || {}
    };

    const fileName = customFileName || `DocDental_Complete_System_Backup_${getTimestampForFileName()}.json`;
    const jsonString = JSON.stringify(exportDb, null, 2);
    triggerDownload(jsonString, fileName, 'application/json;charset=utf-8;');
    return fileName;
};

// ============================================================================
// 9. DOWNLOAD ALL CSV DATASETS SEQUENTIALLY
// ============================================================================
export const exportAllDatasetsAsCsvBundle = async (db = {}, delayMs = 350) => {
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    const patients = (db.users || []).filter(u => (u.role || '').toLowerCase() === 'patient');
    const staffAndAdmins = (db.users || []).filter(u => (u.role || '').toLowerCase() !== 'patient');

    // 1. Appointments
    exportAppointmentsToCsv(db.appointments || [], db);
    await sleep(delayMs);

    // 2. Patients
    exportPatientsToCsv(patients, db.medical_records || {}, db.appointments || []);
    await sleep(delayMs);

    // 3. Medical Records
    exportMedicalRecordsToCsv(db.medical_records || {}, db.users || []);
    await sleep(delayMs);

    // 4. Dental Charts
    exportDentalChartsToCsv(db.dental_charts || {}, db.intraoral_charts || {}, db.users || []);
    await sleep(delayMs);

    // 5. Price List
    exportPriceListToCsv(db.pricelist || []);
    await sleep(delayMs);

    // 6. Audit Logs
    exportAuditLogsToCsv(db.audit_logs || db.auditLogs || []);
    await sleep(delayMs);

    // 7. Users / Staff
    exportUsersToCsv(staffAndAdmins);
};
