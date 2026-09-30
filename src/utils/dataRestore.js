/**
 * Doc Dental Care - Data Recovery & Restoration Engine
 * Supports recovering clinical system data from:
 * 1. Complete System Backup JSON (.json)
 * 2. Individual or bundled Dataset CSVs (.csv) (Appointments, Patients, Medical Records, Dental Charts, Price List, Users, Audit Logs)
 * 3. Multi-file uploads (aggregating multiple CSVs into a single restore payload)
 */

// ============================================================================
// 1. RFC 4180 COMPLIANT CSV PARSER
// ============================================================================
export const parseCsvText = (csvText = '') => {
    if (!csvText || typeof csvText !== 'string') return [];

    // Strip Byte Order Mark (BOM) if present
    let cleanText = csvText.charCodeAt(0) === 0xFEFF ? csvText.slice(1) : csvText;

    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;
    let i = 0;
    const len = cleanText.length;

    while (i < len) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped double quote inside quotes ("")
                currentCell += '"';
                i += 2;
                continue;
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
                i++;
                continue;
            }
        }

        if (char === ',' && !inQuotes) {
            // End of field
            currentRow.push(currentCell.trim());
            currentCell = '';
            i++;
            continue;
        }

        if ((char === '\r' || char === '\n') && !inQuotes) {
            // End of row
            if (char === '\r' && nextChar === '\n') {
                i++; // Skip paired CRLF
            }
            currentRow.push(currentCell.trim());
            // Avoid pushing empty trailing rows
            if (currentRow.some(cell => cell.length > 0)) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
            i++;
            continue;
        }

        currentCell += char;
        i++;
    }

    // Push final remaining cell & row
    if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell.length > 0)) {
            rows.push(currentRow);
        }
    }

    return rows;
};

// Convert CSV rows into array of objects using header row
export const csvRowsToObjects = (rows = []) => {
    if (!Array.isArray(rows) || rows.length < 2) return [];

    const headers = rows[0].map(h => String(h || '').trim());
    const dataRows = rows.slice(1);

    return dataRows.map(row => {
        const obj = {};
        headers.forEach((header, idx) => {
            if (header) {
                obj[header] = row[idx] !== undefined ? row[idx] : '';
            }
        });
        return obj;
    });
};

// ============================================================================
// 2. DATASET IDENTIFICATION FROM CSV HEADERS / FILENAMES
// ============================================================================
export const detectCsvDatasetType = (headers = [], fileName = '') => {
    const fLower = (fileName || '').toLowerCase();
    const joinedHeaders = headers.map(h => h.toLowerCase()).join(' | ');

    if (fLower.includes('appointment') || joinedHeaders.includes('appointment id') || joinedHeaders.includes('braces color') || joinedHeaders.includes('booking remarks')) {
        return 'appointments';
    }
    if (fLower.includes('patient') || (joinedHeaders.includes('patient id') && joinedHeaders.includes('patient type'))) {
        return 'patients';
    }
    if (fLower.includes('medical_record') || fLower.includes('medical record') || joinedHeaders.includes('in good health') || joinedHeaders.includes('physician name') || joinedHeaders.includes('reported medical conditions')) {
        return 'medical_records';
    }
    if (fLower.includes('dental_chart') || fLower.includes('dental chart') || joinedHeaders.includes('tooth number') || joinedHeaders.includes('tooth condition') || joinedHeaders.includes('cleared for braces')) {
        return 'dental_charts';
    }
    if (fLower.includes('price_list') || fLower.includes('pricelist') || joinedHeaders.includes('price (php)') || (joinedHeaders.includes('category') && joinedHeaders.includes('procedure / service name'))) {
        return 'pricelist';
    }
    if (fLower.includes('audit_log') || fLower.includes('audit log') || joinedHeaders.includes('log id') || (joinedHeaders.includes('action taken') && joinedHeaders.includes('record target'))) {
        return 'audit_logs';
    }
    if (fLower.includes('user') || (joinedHeaders.includes('user id') && joinedHeaders.includes('role'))) {
        return 'users';
    }

    return 'unknown';
};

// ============================================================================
// 3. TRANSFORM DATASET ROWS INTO CANONICAL DB OBJECTS
// ============================================================================
export const parseAppointmentsFromCsv = (items = []) => {
    return items.map((item, idx) => {
        const rawId = item['Appointment ID'] || item['id'] || (Date.now() + idx);
        return {
            id: Number(rawId) || Date.now() + idx,
            date: item['Date'] || item['date'] || '',
            time: item['Time'] || item['time'] || '',
            patientName: item['Patient Name'] || item['patientName'] || item['fullName'] || 'Patient',
            patientEmail: (item['Patient Email'] || item['patientEmail'] || item['email'] || '').trim().toLowerCase(),
            contactNumber: item['Contact Number'] || item['contactNumber'] || item['phone'] || '',
            service: item['Service / Treatment'] || item['service'] || item['treatment'] || 'General Consultation',
            category: item['Category'] || item['category'] || 'General Dentistry',
            braceColor: item['Braces Color'] !== 'N/A' ? (item['Braces Color'] || '') : '',
            status: item['Status'] || item['status'] || 'Pending',
            emergencyReason: item['Reason / Decline Reason'] || item['emergencyReason'] || item['cancelReason'] || '',
            notes: item['Patient Booking Remarks'] || item['notes'] || '',
            createdAt: item['Created At'] || item['createdAt'] || new Date().toISOString()
        };
    });
};

export const parsePatientsFromCsv = (items = []) => {
    return items.map((item, idx) => {
        const rawId = item['Patient ID'] || item['id'] || (Date.now() + idx);
        const email = (item['Email Address'] || item['email'] || '').trim().toLowerCase();
        const fullName = item['Full Name'] || item['fullName'] || item['name'] || 'Patient';

        return {
            id: Number(rawId) || Date.now() + idx,
            email,
            fullName,
            name: fullName,
            phone: item['Contact Number'] || item['phone'] || '',
            contactNumber: item['Contact Number'] || item['phone'] || '',
            contactNo: item['Contact Number'] || item['phone'] || '',
            patientType: item['Patient Type'] || 'New Patient',
            role: 'Patient',
            createdAt: item['Account Created'] || item['createdAt'] || new Date().toISOString()
        };
    });
};

export const parseUsersFromCsv = (items = []) => {
    return items.map((item, idx) => {
        const rawId = item['User ID'] || item['id'] || (Date.now() + idx);
        const email = (item['Email Address'] || item['email'] || '').trim().toLowerCase();
        const fullName = item['Full Name'] || item['fullName'] || item['name'] || 'User';
        const role = item['Role'] || item['role'] || 'Patient';
        const bannedStatus = item['Account Status'] || '';
        let bannedUntil = null;
        if (bannedStatus.includes('Restricted until')) {
            bannedUntil = bannedStatus.replace('Restricted until', '').trim();
        }

        return {
            id: Number(rawId) || Date.now() + idx,
            email,
            fullName,
            name: fullName,
            role,
            phone: item['Contact Phone'] || item['phone'] || '',
            contactNumber: item['Contact Phone'] || item['phone'] || '',
            patientType: item['Patient Type'] || (role === 'Patient' ? 'New Patient' : null),
            bannedUntil,
            createdAt: item['Created Date'] || item['createdAt'] || new Date().toISOString()
        };
    });
};

export const parseMedicalRecordsFromCsv = (items = []) => {
    const medicalRecordsMap = {};

    items.forEach(item => {
        const email = (item['Email Address'] || item['email'] || '').trim().toLowerCase();
        if (!email) return;

        let conditions = [];
        const rawConds = item['Reported Medical Conditions'] || item['Medical Conditions / Allergies'] || item['conditions'];
        if (rawConds && typeof rawConds === 'string') {
            conditions = rawConds.split(';').map(c => c.trim()).filter(Boolean);
        } else if (Array.isArray(rawConds)) {
            conditions = rawConds;
        }

        medicalRecordsMap[email] = {
            fullName: item['Patient Name'] || item['fullName'] || '',
            email,
            phone: item['Contact Number'] || item['phone'] || '',
            age: item['Age'] || '',
            sex: item['Sex'] || item['Sex / Gender'] || '',
            birthday: item['Birthday'] || '',
            address: item['Home Address'] || '',
            occupation: item['Occupation'] || '',
            emergencyContact: item['Emergency Contact Person'] || '',
            emergencyContactNumber: item['Emergency Contact No'] || '',
            physician: item['Physician Name'] || '',
            physicianSpecialty: item['Physician Office / Specialty'] || '',
            physicianAddress: item['Physician Office Address'] || '',
            physicianPhone: item['Physician Phone'] || '',
            q1_goodHealth: item['In Good Health?'] || '',
            q2_underCondition: item['Under Medical Condition / Treatment?'] || '',
            q3_illnessOperation: item['Major Illness / Surgery?'] || '',
            q4_hospitalized: item['Hospitalized?'] || '',
            q5_takingMeds: item['Taking Prescription Medicines?'] || '',
            q6_usesTobacco: item['Uses Tobacco / Smokes?'] || '',
            q7_usesAlcoholDrugs: item['Drinks Alcohol / Uses Drugs?'] || '',
            q8_pregnant: item['Pregnant (Women)?'] || '',
            q8_nursing: item['Nursing (Women)?'] || '',
            q8_birthControl: item['Taking Birth Control (Women)?'] || '',
            conditions,
            allergies: item['Allergies Details'] || '',
            bloodType: item['Blood Type'] || '',
            bloodPressure: item['Blood Pressure'] || '',
            dateSubmitted: item['Date Submitted'] || new Date().toISOString(),
            lastUpdated: item['Last Updated'] || new Date().toISOString()
        };
    });

    return medicalRecordsMap;
};

export const parseDentalChartsFromCsv = (items = []) => {
    const dentalChartsMap = {};

    items.forEach(item => {
        const email = (item['Patient Email'] || item['email'] || '').trim().toLowerCase();
        if (!email) return;

        if (!dentalChartsMap[email]) {
            dentalChartsMap[email] = {
                teeth: {},
                bracesColor: item['Braces Color Selected'] !== 'None' ? item['Braces Color Selected'] : '',
                clearedForBraces: item['Cleared For Braces?'] === 'Yes',
                remarks: item['Clinical Remarks'] || '',
                lastUpdated: item['Last Charted Date'] || new Date().toISOString()
            };
        }

        const toothNum = item['Tooth Number'] || '';
        if (toothNum && toothNum !== 'All Teeth') {
            dentalChartsMap[email].teeth[toothNum] = {
                condition: item['Tooth Condition / Status'] || 'Sound',
                treatment: item['Treatment / Procedure'] || '',
                remarks: item['Clinical Remarks'] || ''
            };
        }
    });

    return dentalChartsMap;
};

export const parsePricelistFromCsv = (items = []) => {
    return items.map((item, idx) => ({
        id: Number(item['Item ID'] || item['id'] || (idx + 1)),
        category: item['Category'] || 'General Services',
        service: item['Procedure / Service Name'] || item['service'] || item['name'] || 'Dental Procedure',
        price: item['Price (PHP)'] || item['price'] || '0'
    }));
};

export const parseAuditLogsFromCsv = (items = []) => {
    return items.map((item, idx) => ({
        id: Number(item['Log ID'] || item['id'] || (Date.now() + idx)),
        timestamp: item['Timestamp'] || item['timestamp'] || new Date().toISOString(),
        action: item['Action Taken'] || item['action'] || 'System Event',
        details: item['Details / Record Target'] || item['details'] || ''
    }));
};

// ============================================================================
// 4. MULTI-FILE & JSON UNIVERSAL PARSER
// ============================================================================

/**
 * Parses uploaded File objects (either a single .json or one/multiple .csv files)
 * @param {File[]} fileList Array of File objects selected by user
 * @returns {Promise<{ success: boolean, data: object, summary: object, errors: string[] }>}
 */
export const parseUploadedBackupFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) {
        return { success: false, error: 'No files provided for restoration.' };
    }

    const aggregatedDb = {
        users: [],
        appointments: [],
        medical_records: {},
        dental_charts: {},
        intraoral_charts: {},
        patient_charts: {},
        xray_records: {},
        consent_records: [],
        audit_logs: [],
        auditLogs: [],
        pricelist: []
    };

    const summary = {
        fileCount: files.length,
        fileNames: files.map(f => f.name),
        detectedTypes: [],
        isJsonSnapshot: false,
        counts: {
            users: 0,
            appointments: 0,
            medicalRecords: 0,
            dentalCharts: 0,
            pricelist: 0,
            auditLogs: 0,
            consentRecords: 0
        }
    };

    const errors = [];

    for (const file of files) {
        const fName = file.name || '';
        const fLower = fName.toLowerCase();

        try {
            const fileContent = await file.text();

            // Case A: JSON Backup File
            if (fLower.endsWith('.json')) {
                let parsedJson;
                try {
                    parsedJson = JSON.parse(fileContent);
                } catch (e) {
                    errors.push(`Failed to parse JSON file "${fName}": Invalid JSON format.`);
                    continue;
                }

                summary.isJsonSnapshot = true;
                summary.detectedTypes.push('Full System JSON Backup');

                // Extract Users
                if (Array.isArray(parsedJson.users)) {
                    aggregatedDb.users = [...aggregatedDb.users, ...parsedJson.users];
                }

                // Extract Appointments
                if (Array.isArray(parsedJson.appointments)) {
                    aggregatedDb.appointments = [...aggregatedDb.appointments, ...parsedJson.appointments];
                }

                // Extract Medical Records
                if (parsedJson.medical_records && typeof parsedJson.medical_records === 'object') {
                    aggregatedDb.medical_records = { ...aggregatedDb.medical_records, ...parsedJson.medical_records };
                }

                // Extract Dental & Intraoral Charts
                if (parsedJson.dental_charts && typeof parsedJson.dental_charts === 'object') {
                    aggregatedDb.dental_charts = { ...aggregatedDb.dental_charts, ...parsedJson.dental_charts };
                }
                if (parsedJson.intraoral_charts && typeof parsedJson.intraoral_charts === 'object') {
                    aggregatedDb.intraoral_charts = { ...aggregatedDb.intraoral_charts, ...parsedJson.intraoral_charts };
                }
                if (parsedJson.patient_charts && typeof parsedJson.patient_charts === 'object') {
                    aggregatedDb.patient_charts = { ...aggregatedDb.patient_charts, ...parsedJson.patient_charts };
                }

                // Extract Pricelist
                if (Array.isArray(parsedJson.pricelist)) {
                    aggregatedDb.pricelist = [...aggregatedDb.pricelist, ...parsedJson.pricelist];
                }

                // Extract Audit Logs
                const jsonLogs = parsedJson.audit_logs || parsedJson.auditLogs || [];
                if (Array.isArray(jsonLogs)) {
                    aggregatedDb.audit_logs = [...aggregatedDb.audit_logs, ...jsonLogs];
                    aggregatedDb.auditLogs = [...aggregatedDb.auditLogs, ...jsonLogs];
                }

                // Extract Consent Records
                if (Array.isArray(parsedJson.consent_records)) {
                    aggregatedDb.consent_records = [...aggregatedDb.consent_records, ...parsedJson.consent_records];
                }

                // Extract X-rays
                if (parsedJson.xray_records && typeof parsedJson.xray_records === 'object') {
                    aggregatedDb.xray_records = { ...aggregatedDb.xray_records, ...parsedJson.xray_records };
                }

                continue;
            }

            // Case B: CSV File
            if (fLower.endsWith('.csv') || fLower.endsWith('.txt')) {
                const rows = parseCsvText(fileContent);
                if (rows.length < 2) {
                    errors.push(`File "${fName}" has no data rows.`);
                    continue;
                }

                const headers = rows[0];
                const type = detectCsvDatasetType(headers, fName);
                const objects = csvRowsToObjects(rows);

                switch (type) {
                    case 'appointments':
                        summary.detectedTypes.push(`Appointments (${objects.length})`);
                        aggregatedDb.appointments = [...aggregatedDb.appointments, ...parseAppointmentsFromCsv(objects)];
                        break;

                    case 'patients':
                        summary.detectedTypes.push(`Patients (${objects.length})`);
                        aggregatedDb.users = [...aggregatedDb.users, ...parsePatientsFromCsv(objects)];
                        break;

                    case 'users':
                        summary.detectedTypes.push(`Users (${objects.length})`);
                        aggregatedDb.users = [...aggregatedDb.users, ...parseUsersFromCsv(objects)];
                        break;

                    case 'medical_records':
                        summary.detectedTypes.push(`Medical Records (${objects.length})`);
                        aggregatedDb.medical_records = { ...aggregatedDb.medical_records, ...parseMedicalRecordsFromCsv(objects) };
                        break;

                    case 'dental_charts':
                        summary.detectedTypes.push(`Dental Charts (${objects.length})`);
                        const charts = parseDentalChartsFromCsv(objects);
                        aggregatedDb.dental_charts = { ...aggregatedDb.dental_charts, ...charts };
                        aggregatedDb.intraoral_charts = { ...aggregatedDb.intraoral_charts, ...charts };
                        break;

                    case 'pricelist':
                        summary.detectedTypes.push(`Price List (${objects.length})`);
                        aggregatedDb.pricelist = [...aggregatedDb.pricelist, ...parsePricelistFromCsv(objects)];
                        break;

                    case 'audit_logs':
                        summary.detectedTypes.push(`Audit Logs (${objects.length})`);
                        const logs = parseAuditLogsFromCsv(objects);
                        aggregatedDb.audit_logs = [...aggregatedDb.audit_logs, ...logs];
                        aggregatedDb.auditLogs = [...aggregatedDb.auditLogs, ...logs];
                        break;

                    default:
                        errors.push(`Could not identify dataset schema for file "${fName}".`);
                        break;
                }
                continue;
            }

            errors.push(`Unsupported file extension for "${fName}". Please provide .json or .csv files.`);
        } catch (fileErr) {
            errors.push(`Error reading "${fName}": ${fileErr.message}`);
        }
    }

    // Deduplicate Users by Email or ID
    const uniqueUsersMap = new Map();
    aggregatedDb.users.forEach(u => {
        const key = (u.email || '').trim().toLowerCase() || String(u.id);
        if (key) {
            const existing = uniqueUsersMap.get(key);
            uniqueUsersMap.set(key, { ...(existing || {}), ...u });
        }
    });
    aggregatedDb.users = Array.from(uniqueUsersMap.values());

    // Deduplicate Appointments by ID
    const uniqueApptsMap = new Map();
    aggregatedDb.appointments.forEach(a => {
        if (a && a.id) {
            uniqueApptsMap.set(String(a.id), a);
        }
    });
    aggregatedDb.appointments = Array.from(uniqueApptsMap.values());

    // Compute final counts
    summary.counts = {
        users: aggregatedDb.users.length,
        appointments: aggregatedDb.appointments.length,
        medicalRecords: Object.keys(aggregatedDb.medical_records).length,
        dentalCharts: Object.keys(aggregatedDb.dental_charts).length,
        pricelist: aggregatedDb.pricelist.length,
        auditLogs: (aggregatedDb.audit_logs || []).length,
        consentRecords: (aggregatedDb.consent_records || []).length
    };

    const totalRecordsFound = Object.values(summary.counts).reduce((a, b) => a + b, 0);

    if (totalRecordsFound === 0 && errors.length > 0) {
        return {
            success: false,
            error: errors.join('; '),
            errors
        };
    }

    return {
        success: true,
        data: aggregatedDb,
        summary,
        errors
    };
};
