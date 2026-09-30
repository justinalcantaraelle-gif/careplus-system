import { readDatabase, writeDatabase, readSession } from '../../utils/storage';
import { addUserNotification } from '../../utils/notificationStore';
import { getPatientIntakeStatus } from '../../utils/patientIntake';
import { addAuditLog } from '../../services/auditLogger';
import { broadcastRealtimeEvent } from '../../utils/realtimeClient';
import React, { useState, useEffect } from 'react';
import {
    RiUserHeartLine, RiShieldUserLine, RiCheckDoubleLine, RiVirusLine, RiEdit2Line, RiInformationLine
} from 'react-icons/ri';
import Swal from 'sweetalert2';

const theme = {
    beige: '#f8fafc',
    gold: '#0284c7',
    goldDark: '#0369a1',
    cardBg: '#ffffff'
};

const RequiredMark = () => <span className="text-danger ms-1">*</span>;

const MedicalRecordForm = () => {
    const session = readSession() || {};

    // States
    const [hasRecord, setHasRecord] = useState(false);
    const [requestStatus, setRequestStatus] = useState('None'); // 'None', 'Pending', or 'Declined'

    const [formData, setFormData] = useState({
        name: session.name || session.fullName,
        email: session.email,
        address: '', birthday: '', sex: '', religion: '',
        age: '', contactNumber: '', occupation: '', nationality: '',
        referredBy: '', parentGuardian: '', guardianOccupation: '',
        q1_goodHealth: '', q2_underMedicalTreatment: '',
        q3_seriousIllness: '', q4_hospitalized: '', q4_hospitalizedDetail: '',
        q5_takingMedication: '', q6_tobaccoAlcohol: '',
        q7_allergicAnesthesia: '', q7_allergicLatex: '',
        q7_allergicPenicillin: '', q7_allergicAspirin: '',
        q7_allergicOthers: '', otherAllergies: '',
        q8_pregnant: '', q8_nursing: '', q8_birthControl: '',
        conditions: [], otherCondition: '',
        cv_fever: '', cv_aches: '', cv_cough: '', cv_throat: '',
        cv_breath: '', cv_chills: '', cv_taste: '',
        cv_travelHistory: '', cv_travelLocation: '',
        cv_agreement: false
    });

    const calculateAge = (birthDateString) => {
        if (!birthDateString) return '';
        const today = new Date();
        const birthDate = new Date(birthDateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
        return age > 0 ? age : 0;
    };

    useEffect(() => {
        const loadMedicalData = () => {
            const db = readDatabase() || { medical_records: {} };
            const userEmail = session?.email?.toLowerCase();
            if (!userEmail) return;

            const intake = getPatientIntakeStatus(db, session);
            if (!intake.hasSigned) {
                window.location.href = '/patient/consent';
                return;
            }

            const userRecord = db.medical_records?.[userEmail];

            if (userRecord && (userRecord.dateSubmitted || userRecord.recordedByClinic)) {
                const pendingChanges = userRecord.requestStatus === 'Pending' && userRecord.pendingChanges
                    ? userRecord.pendingChanges
                    : {};
                setHasRecord(true);
                setRequestStatus(userRecord.requestStatus || 'None');
                setFormData(prev => ({
                    ...prev,
                    ...userRecord,
                    ...pendingChanges,
                    name: session.name || session.fullName || userRecord.fullName || userRecord.name || prev.name,
                    email: session.email || userRecord.email || prev.email,
                    contactNumber: userRecord.contactNumber || userRecord.contactNo || userRecord.phone || prev.contactNumber,
                    age: calculateAge(pendingChanges.birthday || userRecord.birthday)
                }));
            } else if (userRecord) {
                setHasRecord(false);
                setRequestStatus(userRecord.requestStatus || 'None');
                setFormData(prev => ({
                    ...prev,
                    ...userRecord,
                    name: session.name || session.fullName || userRecord.fullName || userRecord.name || prev.name,
                    email: session.email || userRecord.email || prev.email,
                    contactNumber: userRecord.contactNumber || userRecord.contactNo || userRecord.phone || prev.contactNumber,
                    age: calculateAge(userRecord.birthday)
                }));
            }
        };

        loadMedicalData();

        window.addEventListener('storage', loadMedicalData);
        window.addEventListener('doc_dental_db_updated', loadMedicalData);
        return () => {
            window.removeEventListener('storage', loadMedicalData);
            window.removeEventListener('doc_dental_db_updated', loadMedicalData);
        };
    }, [session.email, session.name, session.fullName]);

    const isPendingApproval = hasRecord && requestStatus === 'Pending';
    const isReadOnly = isPendingApproval;
    const isMale = /^m(ale)?$/i.test(formData.sex?.trim() || '');
    const isAdult = Number(formData.age) >= 18;

    const handleInputChange = (e) => {
        if (isReadOnly) return;
        const { name, value, type, checked } = e.target;
        if (name === 'birthday') {
            const age = calculateAge(value);
            setFormData(prev => ({
                ...prev,
                birthday: value,
                age,
                ...(Number(age) >= 18 ? { parentGuardian: '', guardianOccupation: '' } : {})
            }));
        } else if (name === 'contactNumber') {
            setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 11) }));
        } else if (['religion', 'nationality', 'occupation', 'referredBy', 'parentGuardian', 'guardianOccupation'].includes(name)) {
            setFormData(prev => ({ ...prev, [name]: value.replace(/[^a-zA-Z\s]/g, '') }));
        } else if (name === 'sex') {
            setFormData(prev => ({ ...prev, [name]: value.replace(/[^a-zA-Z]/g, '') }));
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    const handleConditionToggle = (cond) => {
        if (isReadOnly) return;
        const hasNone = (formData.conditions || []).some(c => c && c.toLowerCase() === 'none');
        if (hasNone && cond.toLowerCase() !== 'none') return;

        setFormData(prev => {
            let updatedConditions;
            if (cond.toLowerCase() === 'none') {
                const prevHasNone = (prev.conditions || []).some(c => c && c.toLowerCase() === 'none');
                updatedConditions = prevHasNone ? [] : ['None'];
            } else {
                const alreadySelected = (prev.conditions || []).some(c => c && c.toLowerCase() === cond.toLowerCase());
                if (alreadySelected) {
                    updatedConditions = (prev.conditions || []).filter(c => c && c.toLowerCase() !== cond.toLowerCase());
                } else {
                    updatedConditions = [...(prev.conditions || []).filter(c => c && c.toLowerCase() !== 'none'), cond];
                }
            }
            return {
                ...prev,
                conditions: updatedConditions
            };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const db = readDatabase() || { medical_records: {} };
        const userEmail = session.email.toLowerCase();
        const finalFormData = { ...formData };

        if (isMale) {
            finalFormData.q8_pregnant = '';
            finalFormData.q8_nursing = '';
            finalFormData.q8_birthControl = '';
        }

        const existingRecord = db.medical_records?.[userEmail] || {};
        const cleanFormData = { ...finalFormData };
        delete cleanFormData.pendingChanges;
        delete cleanFormData.pendingSubmitted;
        delete cleanFormData.requestStatus;
        delete cleanFormData.editAllowed;

        if (hasRecord) {
            db.medical_records[userEmail] = {
                ...existingRecord,
                pendingChanges: {
                    ...cleanFormData,
                    dateSubmitted: existingRecord.dateSubmitted || new Date().toLocaleDateString(),
                    dateUpdated: new Date().toLocaleDateString()
                },
                pendingSubmitted: new Date().toLocaleDateString(),
                requestStatus: 'Pending'
            };
        } else {
            db.medical_records[userEmail] = {
                ...existingRecord,
                ...cleanFormData,
                dateSubmitted: new Date().toLocaleDateString(),
                requestStatus: 'None'
            };
        }

        // Trigger notifications for all Staff, Admin, and SuperAdmin users
        let updatedDb = db;
        const staffAdmins = (db.users || []).filter(u => ['staff', 'admin', 'superadmin'].includes((u.role || '').toLowerCase()));
        staffAdmins.forEach(sa => {
            updatedDb = addUserNotification(updatedDb, sa.email, {
                id: `medical-${hasRecord ? 'edit' : 'init'}-${Date.now()}-${sa.email}`,
                title: hasRecord ? 'Medical Edit Request Received' : 'Medical Record Submitted',
                message: hasRecord 
                    ? `Patient ${finalFormData.name || userEmail} has requested updates to their medical records.`
                    : `Patient ${finalFormData.name || userEmail} has submitted their initial medical record.`,
                date: new Date().toISOString(),
                read: false,
                type: hasRecord ? 'medical_edit_alert' : 'medical_submitted_alert'
            });
        });

        writeDatabase(updatedDb).then(() => {
            // Reflect in audit logs
            addAuditLog(
                hasRecord ? 'Requested Medical Record Edit' : 'Submitted Medical Record',
                `Patient ${finalFormData.name || userEmail} ${hasRecord ? 'requested updates to their medical records' : 'submitted their initial medical record'}.`
            );

            // Broadcast real-time event to Admin, Staff, and SuperAdmin
            broadcastRealtimeEvent('notification_new', {
                title: hasRecord ? 'Medical Edit Request Received' : 'Medical Record Submitted',
                message: hasRecord 
                    ? `Patient ${finalFormData.name || userEmail} has requested updates to their medical records.`
                    : `Patient ${finalFormData.name || userEmail} has submitted their initial medical record.`,
                patientEmail: userEmail,
                targetRoles: ['admin', 'staff', 'superadmin']
            }, null, ['admin', 'staff', 'superadmin']);

            setHasRecord(true);
            setRequestStatus(hasRecord ? 'Pending' : 'None');
            window.scrollTo(0, 0);

            Swal.fire({
                title: hasRecord ? 'Changes Submitted!' : 'Medical Records Saved!',
                text: hasRecord
                    ? 'Your updates were sent to the clinic staff for approval. Your official record will change after approval.'
                    : 'Step 2 complete! All modules and clinic services are now unlocked. Redirecting to your dashboard...',
                icon: 'success',
                confirmButtonColor: theme.gold,
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                window.location.href = '/patient';
            });
        });
    };

    const renderYesNoRow = (label, name, forceDisable = false) => {
        const disabled = isReadOnly || forceDisable;
        return (
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center py-2 border-bottom border-warning-subtle gap-2">
                <span className="small text-secondary pe-3">
                    {label}
                    {!disabled && <RequiredMark />}
                </span>
                <div className="d-flex gap-3">
                    {["Yes", "No"].map(opt => (
                        <label key={opt} className={`small d-flex align-items-center gap-1 ${disabled ? 'text-muted' : ''}`} style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
                            <input
                                type="radio"
                                name={name}
                                value={opt}
                                checked={formData[name] === opt}
                                onChange={handleInputChange}
                                disabled={disabled}
                                required={!disabled}
                            /> {opt}
                        </label>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="container-fluid py-5" style={{ backgroundColor: theme.beige, minHeight: '100vh' }}>
            <div className="row justify-content-center">
                <div className="col-lg-9">

                    {!hasRecord ? (
                        <div className="alert alert-info border-0 shadow-sm mb-4 d-flex align-items-center" style={{ borderRadius: '15px', backgroundColor: '#e0f7fa', color: '#006064' }}>
                            <RiInformationLine size={24} className="me-3" />
                            <div>
                                <strong>Welcome!</strong>
                                <p className="mb-0 small">Please fill out your initial medical record. Once saved, it will be locked for your security.</p>
                            </div>
                        </div>
                    ) : isPendingApproval && (
                        <div className="alert alert-warning border-0 shadow-sm mb-4 d-flex align-items-center justify-content-between" style={{ borderRadius: '15px' }}>
                            <div>
                                <strong style={{ color: theme.goldDark }}>Viewing Medical Record</strong>
                                <p className="mb-0 small text-muted">
                                    Your submitted changes are pending staff approval. Your official record will update after approval.
                                </p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="card border-0 shadow-lg mb-5" style={{ borderRadius: '30px', backgroundColor: theme.cardBg }}>
                        <div className="card-body p-4 p-md-5">

                            <div className="text-center mb-5">
                                <h2 className="fw-bold" style={{ color: theme.goldDark }}>Medical Record</h2>
                                <p className="text-muted small">
                                    {isReadOnly ? `Information on file for ${formData.name}` : 'Please fill out all fields accurately'}
                                </p>
                            </div>

                            <h6 className="fw-bold mb-4" style={{ color: theme.goldDark }}><RiShieldUserLine className="me-2" /> Patient Information Record</h6>
                            <div className="row g-3 mb-5">
                                <div className="col-md-6"><label className="small fw-bold text-muted">Full Name</label><input type="text" className="form-control bg-light" value={formData.name} readOnly /></div>
                                <div className="col-md-6"><label className="small fw-bold text-muted">Email Address</label><input type="text" className="form-control bg-light" value={formData.email} readOnly /></div>

                                <div className="col-md-4">
                                    <label className="small fw-bold text-muted">Sex<RequiredMark /></label>
                                    <select
                                        name="sex"
                                        className="form-select shadow-none"
                                        value={formData.sex}
                                        onChange={handleInputChange}
                                        required={!isReadOnly}
                                        disabled={isReadOnly}
                                    >
                                        <option value="">Select Sex</option>
                                        <option value="M">M</option>
                                        <option value="F">F</option>
                                    </select>
                                </div>
                                <div className="col-md-4"><label className="small fw-bold text-muted">Birthday<RequiredMark /></label><input type="date" name="birthday" className="form-control" value={formData.birthday} onChange={handleInputChange} required={!isReadOnly} disabled={isReadOnly} /></div>
                                <div className="col-md-4"><label className="small fw-bold text-muted">Age (Auto-calculated)</label><input type="text" className="form-control bg-light fw-bold" value={formData.age} readOnly /></div>
                                <div className="col-12"><label className="small fw-bold text-muted">Home Address<RequiredMark /></label><input type="text" name="address" className="form-control" value={formData.address} onChange={handleInputChange} required={!isReadOnly} disabled={isReadOnly} /></div>
                                <div className="col-md-4"><label className="small fw-bold text-muted">Contact No.<RequiredMark /></label><input type="tel" inputMode="numeric" pattern="[0-9]*" name="contactNumber" className="form-control" value={formData.contactNumber} onChange={handleInputChange} required={!isReadOnly} disabled={isReadOnly} maxLength={11} /></div>
                                <div className="col-md-4"><label className="small fw-bold text-muted">Religion</label><input type="text" name="religion" className="form-control" value={formData.religion} onChange={handleInputChange} disabled={isReadOnly} /></div>
                                <div className="col-md-4"><label className="small fw-bold text-muted">Nationality</label><input type="text" name="nationality" className="form-control" value={formData.nationality} onChange={handleInputChange} disabled={isReadOnly} /></div>
                                <div className="col-md-6">
                                    <label className="small fw-bold text-muted">Status</label>
                                    <select
                                        name="occupation"
                                        className="form-select"
                                        value={formData.occupation || ''}
                                        onChange={handleInputChange}
                                        disabled={isReadOnly}
                                    >
                                        <option value="">Select Status...</option>
                                        <option value="Student">Student</option>
                                        <option value="Employed">Employed</option>
                                        <option value="Unemployed">Unemployed</option>
                                        {formData.occupation && !['Student', 'Employed', 'Unemployed'].includes(formData.occupation) && (
                                            <option value={formData.occupation}>{formData.occupation}</option>
                                        )}
                                    </select>
                                </div>
                                <div className="col-md-6"><label className="small fw-bold text-muted">Referred By</label><input type="text" name="referredBy" className="form-control" value={formData.referredBy} onChange={handleInputChange} disabled={isReadOnly} /></div>

                                <div
                                    className="col-12 mt-3 p-3 rounded shadow-sm"
                                    style={{
                                        backgroundColor: isAdult ? '#e9ecef' : '#f8f9fa',
                                        opacity: isAdult ? 0.7 : 1
                                    }}
                                >
                                    <small className="fw-bold text-goldDark">
                                        For Minors:
                                        {isAdult && <span className="text-muted fw-normal ms-2">Not required for patients 18 and above</span>}
                                    </small>
                                    <div className="row mt-2">
                                        <div className="col-md-6"><label className="small text-muted">Parent/Guardian Name</label><input type="text" name="parentGuardian" className="form-control" value={formData.parentGuardian} onChange={handleInputChange} disabled={isReadOnly || isAdult} /></div>
                                        <div className="col-md-6"><label className="small text-muted">Status</label><input type="text" name="guardianOccupation" className="form-control" value={formData.guardianOccupation} onChange={handleInputChange} disabled={isReadOnly || isAdult} /></div>
                                    </div>
                                </div>
                            </div>

                            <h6 className="fw-bold mb-3" style={{ color: theme.goldDark }}><RiUserHeartLine className="me-2" /> Medical History</h6>
                            {renderYesNoRow("1. Are you in good health?", "q1_goodHealth")}
                            {renderYesNoRow("2. Are you under medical treatment now?", "q2_underMedicalTreatment")}
                            {renderYesNoRow("3. Have you ever had serious illness or surgical operation?", "q3_seriousIllness")}
                            {renderYesNoRow("4. Have you ever been hospitalized?", "q4_hospitalized")}
                            {formData.q4_hospitalized === 'Yes' && (
                                <div className="mt-2 mb-2">
                                    <label className="small fw-bold text-muted">Hospitalization Details<RequiredMark /></label>
                                    <input type="text" name="q4_hospitalizedDetail" placeholder="If yes, when & why?" className="form-control border-warning" value={formData.q4_hospitalizedDetail} onChange={handleInputChange} required={!isReadOnly} disabled={isReadOnly} />
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
                            {formData.q7_allergicOthers === 'Yes' && (
                                <div className="mt-1">
                                    <label className="small fw-bold text-muted">Other Allergies{!isReadOnly && <RequiredMark />}</label>
                                    <input type="text" name="otherAllergies" className="form-control border-warning" placeholder="Specify other allergies" value={formData.otherAllergies} onChange={handleInputChange} required={!isReadOnly} disabled={isReadOnly} />
                                </div>
                            )}

                            <div className={`mt-4 mb-2 small fw-bold ${isMale ? 'text-muted opacity-50' : 'text-muted'}`}>
                                8. For Women:
                            </div>
                            <div className={isMale ? 'opacity-50' : ''} style={{ pointerEvents: isMale ? 'none' : 'auto' }}>
                                {renderYesNoRow("Are you pregnant?", "q8_pregnant", isMale)}
                                {renderYesNoRow("Are you nursing?", "q8_nursing", isMale)}
                                {renderYesNoRow("Are you taking birth control pills?", "q8_birthControl", isMale)}
                            </div>

                            <h6 className="fw-bold mt-5 mb-3" style={{ color: theme.goldDark }}>9. Condition Checklist</h6>
                            <div className="row g-2">
                                {[
                                    "None", "High Blood Pressure", "Low Blood Pressure", "Epilepsy", "AIDS / HIV",
                                    "Heart Attack", "Asthma", "Thyroid Problem", "Stroke",
                                    "Pneumonia", "STD", "Heart Disease", "Emphysema",
                                    "Ulcer", "Hepatitis", "Tuberculosis", "Diabetes", "Anemia", "Others"
                                ].map(cond => {
                                    const isCondDisabled = isReadOnly || ((formData.conditions || []).some(c => c && c.toLowerCase() === 'none') && cond.toLowerCase() !== 'none');
                                    const isSelected = (formData.conditions || []).some(c => c && c.toLowerCase() === cond.toLowerCase());
                                    return (
                                        <div className="col-6 col-md-3" key={cond}>
                                            <div
                                                onClick={() => handleConditionToggle(cond)}
                                                className={`p-2 rounded border text-center small transition-all 
                                                    ${isSelected ? (cond === 'None' ? 'bg-success text-white border-success shadow-sm' : 'bg-danger text-white border-danger shadow-sm') : 'bg-white text-muted'}
                                                    ${isCondDisabled ? 'opacity-50' : ''}`}
                                                style={{ cursor: isCondDisabled ? 'not-allowed' : 'pointer', fontSize: '11px', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                {cond}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {(formData.conditions || []).some(c => c && c.toLowerCase() === 'others') && (
                                <div className="mt-3">
                                    <label className="small fw-bold text-muted">Other Medical Conditions{!isReadOnly && <RequiredMark />}</label>
                                    <textarea name="otherCondition" className="form-control border-danger" rows="2" placeholder="Specify other medical conditions..." value={formData.otherCondition} onChange={handleInputChange} required={!isReadOnly} disabled={isReadOnly} />
                                </div>
                            )}

                            <div className="mt-5 p-4 rounded-4" style={{ border: `1px solid ${theme.gold}`, backgroundColor: 'rgba(212, 175, 55, 0.05)' }}>
                                <h6 className="fw-bold mb-3 text-danger"><RiVirusLine className="me-2" /> Prevention for COVID-19 Spread</h6>
                                <p className="small text-muted mb-3">In the past 14 days, I have experienced:</p>
                                {renderYesNoRow("Fever (37°C or above)", "cv_fever")}
                                {renderYesNoRow("Unexplained body aches or pain", "cv_aches")}
                                {renderYesNoRow("Coughing", "cv_cough")}
                                {renderYesNoRow("Sore throat", "cv_throat")}
                                {renderYesNoRow("Shortness of breath", "cv_breath")}
                                {renderYesNoRow("Chills with or without body aches", "cv_chills")}
                                {renderYesNoRow("Recent loss of sense of smell/ taste", "cv_taste")}

                                <div className="mt-4 py-3 border-top border-warning-subtle">
                                    {renderYesNoRow("History of travelling within the last 14 days?", "cv_travelHistory")}
                                    {formData.cv_travelHistory === 'Yes' && (
                                        <div className="mt-2">
                                            <label className="small fw-bold text-muted">Travel Location{!isReadOnly && <RequiredMark />}</label>
                                            <input type="text" name="cv_travelLocation" className="form-control border-warning" placeholder="If yes, where?" value={formData.cv_travelLocation} onChange={handleInputChange} required={!isReadOnly} disabled={isReadOnly} />
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 d-flex align-items-center gap-2">
                                    <input type="checkbox" name="cv_agreement" checked={formData.cv_agreement} onChange={handleInputChange} required={!isReadOnly} disabled={isReadOnly} />
                                    <span className="small fw-bold text-secondary">I agree that I am providing accurate health information.{!isReadOnly && <RequiredMark />}</span>
                                </div>
                            </div>

                            <div className="mt-5">
                                {!isReadOnly ? (
                                    <button type="submit" className="btn w-100 text-white py-3 rounded-pill fw-bold shadow" style={{ backgroundColor: theme.gold }}>
                                        <RiCheckDoubleLine className="me-2" />
                                        {hasRecord ? 'Submit Changes for Approval' : 'Confirm and Save Record'}
                                    </button>
                                ) : (
                                    <button type="button" className="btn w-100 py-3 rounded-pill fw-bold shadow-sm text-muted" disabled style={{ backgroundColor: '#e9ecef', border: '1px solid #ced4da' }}>
                                        <RiEdit2Line className="me-2" /> Changes Pending Approval...
                                    </button>
                                )}
                            </div>

                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MedicalRecordForm;
