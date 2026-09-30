/**
 * Helper utility for determining and enforcing patient onboarding intake status.
 * Single source of truth across ProtectedRoute, Layout, and Patient Portal views.
 */

export const getPatientIntakeStatus = (db = {}, session = null) => {
    if (!session) {
        return {
            isPatient: false,
            hasSigned: true,
            hasMedicalRecord: true,
            isComplete: true,
            currentStep: null,
            userRecord: null
        };
    }

    const normRole = (session.role || '').toLowerCase().replace(/\s+/g, '');
    const isPatient = normRole === 'patient';

    if (!isPatient) {
        return {
            isPatient: false,
            hasSigned: true,
            hasMedicalRecord: true,
            isComplete: true,
            currentStep: null,
            userRecord: null
        };
    }

    const userEmail = (session.email || '').toLowerCase().trim();
    const records = db.medical_records || {};
    const recordKey = Object.keys(records).find(k => k.toLowerCase().trim() === userEmail);
    const userRecord = recordKey ? records[recordKey] : null;

    // Check Informed Consent Signature
    const consentRecords = Array.isArray(db.consent_records) ? db.consent_records : [];
    const hasSignedLegacy = consentRecords.some(
        (record) => (record?.email || '').toLowerCase().trim() === userEmail && Boolean(record?.signature)
    );
    const hasSignedMedical = Boolean(userRecord?.signature || userRecord?.hasConsented);
    const hasSigned = hasSignedLegacy || hasSignedMedical;

    // Check Medical Record Submission
    // IMPORTANT: A medical record is only complete if it has an official submission date (dateSubmitted)
    // or was recorded in-clinic by clinical staff (recordedByClinic for Old Patients).
    // Note that 'accountCreatedByClinic' merely indicates staff created the login account and DOES NOT
    // satisfy the intake questionnaire requirement for new patients.
    const hasMedicalRecord = Boolean(
        userRecord && (Boolean(userRecord.dateSubmitted) || Boolean(userRecord.recordedByClinic))
    );

    let currentStep = null;
    if (!hasSigned) {
        currentStep = 'consent';
    } else if (!hasMedicalRecord) {
        currentStep = 'medical';
    } else {
        currentStep = 'complete';
    }

    return {
        isPatient: true,
        hasSigned,
        hasMedicalRecord,
        isComplete: hasSigned && hasMedicalRecord,
        currentStep,
        userRecord
    };
};
