import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import Swal from 'sweetalert2';
import logo from '../assets/images/final-logo.png';
import {
    RiFileShield2Line,
    RiEraserLine,
    RiCheckboxCircleLine,
    RiArrowRightLine,
    RiShieldUserLine,
    RiUserHeartLine,
    RiVirusLine,
    RiCheckDoubleLine,
    RiLockLine,
    RiLogoutBoxRLine,
    RiInformationLine
} from 'react-icons/ri';
import { readDatabase, writeDatabase, readSession, clearSession, writeSession } from '../utils/storage';
import { addUserNotification } from '../utils/notificationStore';
import { getPatientIntakeStatus } from '../utils/patientIntake';

const theme = {
    gold: '#D4AF37',
    goldDark: '#B8860B',
    beige: '#F5F5DC',
    cardBg: '#FFFDF6'
};

const RequiredMark = () => <span className="text-danger ms-1">*</span>;

const PatientIntakeModal = ({ onComplete }) => {
    const session = readSession() || {};
    const sigPad = useRef(null);

    const [dbState, setDbState] = useState(() => readDatabase({}));
    const [activeStep, setActiveStep] = useState('consent'); // 'consent' or 'medical'
    const [submitting, setSubmitting] = useState(false);

    // Step 1: Consent state
    const [agreedConsent, setAgreedConsent] = useState(false);

    // Step 2: Medical record state
    const [formData, setFormData] = useState({
        name: session.fullName || session.name || '',
        email: session.email || '',
        address: '', birthday: '', sex: '', religion: '',
        age: '', contactNumber: session.phone || session.contactNumber || '',
        occupation: '', nationality: '', referredBy: '',
        parentGuardian: '', guardianOccupation: '',
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

    // Keep state in sync with database updates
    useEffect(() => {
        const syncStatus = () => {
            const currentDb = readDatabase({});
            setDbState(currentDb);
            const status = getPatientIntakeStatus(currentDb, session);
            if (status.isComplete) {
                if (onComplete) onComplete();
                return;
            }
            if (!status.hasSigned) {
                setActiveStep('consent');
            } else if (!status.hasMedicalRecord) {
                setActiveStep('medical');
            }
            if (status.userRecord) {
                setFormData(prev => ({
                    ...prev,
                    ...status.userRecord,
                    name: session.fullName || session.name || status.userRecord.fullName || status.userRecord.name || prev.name,
                    email: session.email || status.userRecord.email || prev.email,
                    contactNumber: status.userRecord.contactNumber || status.userRecord.contactNo || session.phone || prev.contactNumber,
                    age: calculateAge(status.userRecord.birthday || prev.birthday)
                }));
            }
        };

        syncStatus();
        window.addEventListener('storage', syncStatus);
        window.addEventListener('doc_dental_db_updated', syncStatus);
        return () => {
            window.removeEventListener('storage', syncStatus);
            window.removeEventListener('doc_dental_db_updated', syncStatus);
        };
    }, [session.email, session.fullName, session.name, session.phone, onComplete]);

    const intakeStatus = getPatientIntakeStatus(dbState, session);

    // If already complete, do not show modal
    if (intakeStatus.isComplete) {
        return null;
    }

    const clearSignature = () => {
        if (sigPad.current) {
            sigPad.current.clear();
        }
    };

    // Step 1 Submit
    const handleConsentSubmit = async (e) => {
        e.preventDefault();

        if (!agreedConsent) {
            return Swal.fire({
                title: 'Agreement Required',
                text: 'Please check the box confirming that you have read and agreed to the treatment terms.',
                icon: 'warning',
                confirmButtonColor: theme.goldDark
            });
        }

        if (!sigPad.current || sigPad.current.isEmpty()) {
            return Swal.fire({
                title: 'Signature Required',
                text: 'Please provide your digital signature on the pad before proceeding.',
                icon: 'warning',
                confirmButtonColor: theme.goldDark
            });
        }

        setSubmitting(true);
        try {
            const signatureData = sigPad.current.getCanvas().toDataURL('image/png');
            const db = readDatabase() || {};
            const userEmail = (session.email || '').toLowerCase().trim();

            if (!db.medical_records) db.medical_records = {};
            if (!db.medical_records[userEmail]) {
                db.medical_records[userEmail] = { conditions: [] };
            }

            const dateString = new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            db.medical_records[userEmail].signature = signatureData;
            db.medical_records[userEmail].hasConsented = true;
            db.medical_records[userEmail].consentTimestamp = dateString;

            // Sync with consent_records array
            if (!Array.isArray(db.consent_records)) db.consent_records = [];
            const existingIdx = db.consent_records.findIndex(c => (c.email || '').toLowerCase().trim() === userEmail);
            const consentData = {
                email: userEmail,
                signature: signatureData,
                dateSigned: dateString,
                date_signed: dateString
            };
            if (existingIdx > -1) {
                db.consent_records[existingIdx] = consentData;
            } else {
                db.consent_records.push(consentData);
            }

            // Trigger notifications for Staff and Admins
            let updatedDb = db;
            const staffAdmins = (db.users || []).filter(u => {
                const r = (u.role || '').toLowerCase();
                return r === 'staff' || r === 'admin' || r === 'superadmin' || r === 'super_admin';
            });

            staffAdmins.forEach(sa => {
                updatedDb = addUserNotification(updatedDb, sa.email, {
                    id: `consent-signed-${Date.now()}-${sa.email}`,
                    title: 'Consent Form Signed',
                    message: `Patient ${session?.fullName || session?.name || userEmail} has signed the informed consent form.`,
                    date: new Date().toISOString(),
                    read: false,
                    type: 'consent_alert'
                });
            });

            await writeDatabase(updatedDb);

            Swal.fire({
                title: 'Step 1 Complete!',
                text: 'Informed consent has been securely recorded. Now proceeding to Step 2: Medical History Record.',
                icon: 'success',
                confirmButtonColor: theme.goldDark,
                timer: 2000,
                showConfirmButton: false
            });

            setActiveStep('medical');
        } catch (err) {
            console.error('Error submitting consent:', err);
            Swal.fire('Error', 'Unable to record consent signature. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Step 2 Form handlers
    const isAdult = Number(formData.age) >= 18;
    const isMale = /^m(ale)?$/i.test(formData.sex?.trim() || '');

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'birthday') {
            const calculatedAge = calculateAge(value);
            setFormData(prev => ({
                ...prev,
                birthday: value,
                age: calculatedAge,
                ...(Number(calculatedAge) >= 18 ? { parentGuardian: '', guardianOccupation: '' } : {})
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

    const handleMedicalSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.sex) {
            return Swal.fire('Missing Field', 'Please specify your sex (M / F).', 'warning');
        }
        if (!formData.birthday) {
            return Swal.fire('Missing Field', 'Please provide your date of birth.', 'warning');
        }
        if (!formData.address) {
            return Swal.fire('Missing Field', 'Please enter your home address.', 'warning');
        }
        if (!formData.contactNumber || formData.contactNumber.length < 7) {
            return Swal.fire('Missing Field', 'Please enter a valid contact phone number.', 'warning');
        }
        if (!formData.cv_agreement) {
            return Swal.fire('Confirmation Required', 'Please check the box agreeing that the health information provided is accurate.', 'warning');
        }

        setSubmitting(true);
        try {
            const db = readDatabase() || { medical_records: {} };
            const userEmail = (session.email || '').toLowerCase().trim();
            const existingRecord = db.medical_records?.[userEmail] || {};

            const finalFormData = { ...formData };
            if (isMale) {
                finalFormData.q8_pregnant = '';
                finalFormData.q8_nursing = '';
                finalFormData.q8_birthControl = '';
            }

            const cleanFormData = { ...finalFormData };
            delete cleanFormData.pendingChanges;
            delete cleanFormData.pendingSubmitted;
            delete cleanFormData.requestStatus;
            delete cleanFormData.editAllowed;

            db.medical_records[userEmail] = {
                ...existingRecord,
                ...cleanFormData,
                fullName: formData.name || existingRecord.fullName,
                name: formData.name || existingRecord.name,
                email: userEmail,
                dateSubmitted: new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                }),
                requestStatus: 'None'
            };

            // Trigger notification for Staff and Admins
            let updatedDb = db;
            const staffAdmins = (db.users || []).filter(u => {
                const r = (u.role || '').toLowerCase();
                return r === 'staff' || r === 'admin' || r === 'superadmin';
            });

            staffAdmins.forEach(sa => {
                updatedDb = addUserNotification(updatedDb, sa.email, {
                    id: `medical-init-${Date.now()}-${sa.email}`,
                    title: 'New Medical Record Submitted',
                    message: `Patient ${finalFormData.name || userEmail} has completed and submitted their initial medical record.`,
                    date: new Date().toISOString(),
                    read: false,
                    type: 'medical_submitted_alert'
                });
            });

            await writeDatabase(updatedDb);

            await Swal.fire({
                title: 'Registration Complete! 🎉',
                text: 'Your Consent Form and Medical History have been verified and saved. Full portal access is now unlocked!',
                icon: 'success',
                confirmButtonColor: theme.goldDark,
                confirmButtonText: 'Enter Patient Portal'
            });

            if (onComplete) {
                onComplete();
            } else {
                window.location.href = '/patient';
            }
        } catch (err) {
            console.error('Error submitting medical records:', err);
            Swal.fire('Error', 'Failed to save medical records. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSignOut = () => {
        Swal.fire({
            title: 'Sign Out?',
            text: 'You have not yet completed the required intake steps. You can sign out and complete it when you return.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: theme.goldDark,
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, sign out'
        }).then((result) => {
            if (result.isConfirmed) {
                clearSession();
                writeSession(null);
                window.location.href = '/login';
            }
        });
    };

    const renderYesNoRow = (label, name, forceDisable = false) => {
        return (
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center py-2 border-bottom border-warning-subtle gap-2">
                <span className="small text-secondary pe-3">
                    {label}
                    {!forceDisable && <RequiredMark />}
                </span>
                <div className="d-flex gap-3">
                    {["Yes", "No"].map(opt => (
                        <label key={opt} className={`small d-flex align-items-center gap-1 ${forceDisable ? 'text-muted' : ''}`} style={{ cursor: forceDisable ? 'not-allowed' : 'pointer' }}>
                            <input
                                type="radio"
                                name={name}
                                value={opt}
                                checked={formData[name] === opt}
                                onChange={handleInputChange}
                                disabled={forceDisable}
                                required={!forceDisable}
                            /> {opt}
                        </label>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 animate__animated animate__fadeIn"
            style={{
                zIndex: 10500,
                backgroundColor: 'rgba(20, 18, 14, 0.82)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
            }}
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
        >
            <div
                className="card border-0 shadow-24 rounded-4 overflow-hidden animate__animated animate__zoomIn animate__faster d-flex flex-column"
                style={{
                    width: '100%',
                    maxWidth: activeStep === 'consent' ? '880px' : '960px',
                    maxHeight: '94vh',
                    backgroundColor: '#FFFFFF',
                    border: `1.5px solid rgba(212, 175, 55, 0.45)`,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(212, 175, 55, 0.15)'
                }}
            >
                {/* MODAL HEADER */}
                <div
                    className="p-4 text-white position-relative"
                    style={{
                        background: `linear-gradient(135deg, ${theme.gold} 0%, ${theme.goldDark} 100%)`,
                        flexShrink: 0
                    }}
                >
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                        <div className="d-flex align-items-center gap-3">
                            <img
                                src={logo}
                                alt="Doc Dental Logo"
                                style={{ height: '48px', width: '48px', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
                            />
                            <div>
                                <h5 className="fw-bold mb-0 text-white">DOC DENTAL CARE</h5>
                                <span className="small text-white-50 text-uppercase fw-semibold" style={{ letterSpacing: '1.5px', fontSize: '11px' }}>
                                    Patient Clinical Registration
                                </span>
                            </div>
                        </div>

                        {/* STEP BADGE */}
                        <div
                            className="d-flex align-items-center gap-2 bg-white px-3 py-1 rounded-pill shadow-sm"
                            style={{ color: '#000000' }}
                        >
                            <RiLockLine size={16} style={{ color: '#000000' }} />
                            <span className="small fw-bold text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.5px', color: '#000000' }}>
                                System Locked • {activeStep === 'consent' ? 'Step 1 of 2' : 'Step 2 of 2'}
                            </span>
                        </div>
                    </div>

                    {/* STEP PROGRESS BAR */}
                    <div className="mt-3 pt-3 border-top border-white border-opacity-25">
                        <div className="row g-2 text-center small fw-bold">
                            <div className="col-6">
                                <div
                                    className={`p-2 rounded-3 transition-all d-flex align-items-center justify-content-center gap-2 ${intakeStatus.hasSigned
                                            ? 'bg-success text-white shadow-sm'
                                            : 'bg-white shadow-sm'
                                        }`}
                                    style={{
                                        color: intakeStatus.hasSigned ? '#ffffff' : '#000000'
                                    }}
                                >
                                    <RiFileShield2Line size={16} style={{ color: intakeStatus.hasSigned ? '#ffffff' : '#000000' }} />
                                    <span style={{ color: intakeStatus.hasSigned ? '#ffffff' : '#000000' }}>
                                        1. Consent Form {intakeStatus.hasSigned ? '✓' : '(Required)'}
                                    </span>
                                </div>
                            </div>
                            <div className="col-6">
                                <div
                                    className={`p-2 rounded-3 transition-all d-flex align-items-center justify-content-center gap-2 ${intakeStatus.hasMedicalRecord
                                            ? 'bg-success text-white shadow-sm'
                                            : 'bg-white shadow-sm'
                                        }`}
                                    style={{
                                        color: intakeStatus.hasMedicalRecord ? '#ffffff' : '#000000'
                                    }}
                                >
                                    <RiUserHeartLine size={16} style={{ color: intakeStatus.hasMedicalRecord ? '#ffffff' : '#000000' }} />
                                    <span style={{ color: intakeStatus.hasMedicalRecord ? '#ffffff' : '#000000' }}>
                                        2. Medical Record {intakeStatus.hasMedicalRecord ? '✓' : '(Required)'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MODAL BODY (SCROLLABLE) */}
                <div className="p-4 p-md-5 overflow-auto flex-grow-1" style={{ backgroundColor: '#FAF9F5' }}>
                    {activeStep === 'consent' ? (
                        /* STEP 1: CONSENT FORM */
                        <form onSubmit={handleConsentSubmit}>
                            <div className="text-center mb-4">
                                <div
                                    className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                                    style={{ width: '56px', height: '56px', backgroundColor: 'rgba(212, 175, 55, 0.15)', color: theme.goldDark }}
                                >
                                    <RiFileShield2Line size={32} />
                                </div>
                                <h4 className="fw-bold mb-1" style={{ color: '#2B261F' }}>Patient Informed Consent</h4>
                                <p className="text-muted small mb-0">
                                    Welcome, <strong>{session.fullName || session.name || 'Patient'}</strong>. To begin clinical care, please review the treatment terms and sign below.
                                </p>
                            </div>

                            <div
                                className="p-4 bg-white rounded-3 mb-4 shadow-sm text-secondary"
                                style={{
                                    fontSize: '0.98rem',
                                    lineHeight: '1.6',
                                    borderLeft: `5px solid ${theme.gold}`,
                                    borderTop: '1px solid #ECE6D8',
                                    borderRight: '1px solid #ECE6D8',
                                    borderBottom: '1px solid #ECE6D8'
                                }}
                            >
                                <h6 className="fw-bold text-dark mb-2">Treatment Authorization &amp; Acknowledgement</h6>
                                <p className="mb-2">
                                    I understand and consent to have any necessary dental treatment performed by the attending dentist after the procedure, risks, benefits, and associated fees have been fully explained to me. These treatments may include prophylactic cleaning, periodontal scaling, composite or amalgam restorations, crowns, bridges, root canal therapy, prosthodontics, local anaesthetics, surgical extractions, and orthodontic alignment.
                                </p>
                                <p className="mb-2">
                                    I understand that clinical dentistry involves biological responses and that no dental practitioner can guarantee exact surgical or therapeutic outcomes at all times.
                                </p>
                                <p className="mb-2">
                                    I hereby authorize the clinical team and dental auxiliaries of Doc Dental Care to proceed with and perform dental treatments as discussed. I understand that these procedures are subject to clinical modification depending on diagnoses that may arise during the course of treatment.
                                </p>
                                <p className="mb-0">
                                    All treatments are explained to me and any unexpected circumstances that arise during clinical care will be managed with my informed consent and best dental practice standards.
                                </p>
                            </div>

                            <div className="form-check mb-4 p-3 rounded-3 border" style={{ backgroundColor: '#FFFDF5', borderColor: '#EADBBE' }}>
                                <input
                                    className="form-check-input ms-0 me-3"
                                    type="checkbox"
                                    id="modalConsentCheck"
                                    checked={agreedConsent}
                                    onChange={(e) => setAgreedConsent(e.target.checked)}
                                />
                                <label className="form-check-label fw-bold small text-dark" htmlFor="modalConsentCheck" style={{ cursor: 'pointer' }}>
                                    I confirm that I have read the consent terms above and hereby authorize clinical dental treatment.
                                </label>
                            </div>

                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <label className="form-label small fw-bold text-muted mb-0">Digital Signature Pad</label>
                                <button type="button" className="btn btn-sm text-danger fw-bold border-0 p-0" onClick={clearSignature}>
                                    <RiEraserLine className="me-1" /> Clear Pad
                                </button>
                            </div>
                            <div className="border rounded-3 bg-white mb-4 shadow-sm" style={{ height: '160px' }}>
                                <SignatureCanvas
                                    ref={sigPad}
                                    penColor="#111827"
                                    canvasProps={{ className: 'w-100 h-100 rounded-3', style: { width: '100%', height: '100%' } }}
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn w-100 py-3 fw-bold text-white shadow-sm d-flex align-items-center justify-content-center gap-2"
                                style={{ backgroundColor: theme.goldDark, borderRadius: '12px', fontSize: '1rem' }}
                                disabled={submitting || !agreedConsent}
                            >
                                <span>{submitting ? 'Recording Signature...' : 'Submit Signature & Proceed to Step 2'}</span>
                                {!submitting && <RiArrowRightLine size={18} />}
                            </button>
                        </form>
                    ) : (
                        /* STEP 2: MEDICAL RECORDS FORM */
                        <form onSubmit={handleMedicalSubmit}>
                            <div className="text-center mb-4">
                                <div
                                    className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                                    style={{ width: '56px', height: '56px', backgroundColor: 'rgba(212, 175, 55, 0.15)', color: theme.goldDark }}
                                >
                                    <RiUserHeartLine size={32} />
                                </div>
                                <h4 className="fw-bold mb-1" style={{ color: '#2B261F' }}>Patient Medical Record</h4>
                                <p className="text-muted small mb-0">
                                    Step 2 of 2: Please provide your complete medical background. Once submitted, your portal access will be unlocked.
                                </p>
                            </div>

                            {/* SECTION 1: PERSONAL INFORMATION */}
                            <div className="card border-0 shadow-sm rounded-3 p-3 p-md-4 mb-4" style={{ backgroundColor: '#FFFFFF' }}>
                                <h6 className="fw-bold mb-3" style={{ color: theme.goldDark }}>
                                    <RiShieldUserLine className="me-2" /> 1. Patient Information
                                </h6>
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="small fw-bold text-muted">Full Name</label>
                                        <input type="text" className="form-control bg-light" value={formData.name} readOnly />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="small fw-bold text-muted">Email Address</label>
                                        <input type="text" className="form-control bg-light" value={formData.email} readOnly />
                                    </div>

                                    <div className="col-md-4">
                                        <label className="small fw-bold text-muted">Sex<RequiredMark /></label>
                                        <select
                                            name="sex"
                                            className="form-select shadow-none"
                                            value={formData.sex}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="">Select Sex</option>
                                            <option value="M">Male (M)</option>
                                            <option value="F">Female (F)</option>
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="small fw-bold text-muted">Birthday<RequiredMark /></label>
                                        <input
                                            type="date"
                                            name="birthday"
                                            className="form-control"
                                            value={formData.birthday}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="small fw-bold text-muted">Age (Auto-calculated)</label>
                                        <input type="text" className="form-control bg-light fw-bold" value={formData.age} readOnly placeholder="--" />
                                    </div>

                                    <div className="col-12">
                                        <label className="small fw-bold text-muted">Home Address<RequiredMark /></label>
                                        <input
                                            type="text"
                                            name="address"
                                            className="form-control"
                                            placeholder="Street address, City, Province"
                                            value={formData.address}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="small fw-bold text-muted">Contact No.<RequiredMark /></label>
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            name="contactNumber"
                                            className="form-control"
                                            placeholder="09XXXXXXXXX"
                                            value={formData.contactNumber}
                                            onChange={handleInputChange}
                                            required
                                            maxLength={11}
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="small fw-bold text-muted">Religion</label>
                                        <input type="text" name="religion" className="form-control" value={formData.religion} onChange={handleInputChange} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="small fw-bold text-muted">Nationality</label>
                                        <input type="text" name="nationality" className="form-control" value={formData.nationality} onChange={handleInputChange} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="small fw-bold text-muted">Status</label>
                                        <select
                                            name="occupation"
                                            className="form-select"
                                            value={formData.occupation || ''}
                                            onChange={handleInputChange}
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
                                    <div className="col-md-6">
                                        <label className="small fw-bold text-muted">Referred By</label>
                                        <input type="text" name="referredBy" className="form-control" value={formData.referredBy} onChange={handleInputChange} />
                                    </div>

                                    {/* GUARDIAN FOR MINORS */}
                                    {!isAdult && (
                                        <div className="col-12 mt-3 p-3 rounded" style={{ backgroundColor: '#F8F7F2', border: '1px dashed #D4AF37' }}>
                                            <span className="small fw-bold" style={{ color: theme.goldDark }}>For Minors (Under 18):</span>
                                            <div className="row g-2 mt-1">
                                                <div className="col-md-6">
                                                    <label className="small text-muted">Parent / Guardian Name</label>
                                                    <input type="text" name="parentGuardian" className="form-control" value={formData.parentGuardian} onChange={handleInputChange} />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="small text-muted">Guardian Status</label>
                                                    <input type="text" name="guardianOccupation" className="form-control" value={formData.guardianOccupation} onChange={handleInputChange} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECTION 2: MEDICAL HISTORY */}
                            <div className="card border-0 shadow-sm rounded-3 p-3 p-md-4 mb-4" style={{ backgroundColor: '#FFFFFF' }}>
                                <h6 className="fw-bold mb-3" style={{ color: theme.goldDark }}>
                                    <RiUserHeartLine className="me-2" /> 2. Medical History Questions
                                </h6>
                                {renderYesNoRow("1. Are you in good health?", "q1_goodHealth")}
                                {renderYesNoRow("2. Are you under medical treatment now?", "q2_underMedicalTreatment")}
                                {renderYesNoRow("3. Have you ever had serious illness or surgical operation?", "q3_seriousIllness")}
                                {renderYesNoRow("4. Have you ever been hospitalized?", "q4_hospitalized")}
                                {formData.q4_hospitalized === 'Yes' && (
                                    <div className="mt-2 mb-2 p-2 bg-light rounded">
                                        <label className="small fw-bold text-muted">Hospitalization Details<RequiredMark /></label>
                                        <input
                                            type="text"
                                            name="q4_hospitalizedDetail"
                                            placeholder="If yes, when & why?"
                                            className="form-control border-warning"
                                            value={formData.q4_hospitalizedDetail}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                )}
                                {renderYesNoRow("5. Are you taking any prescription/non-prescription medication?", "q5_takingMedication")}
                                {renderYesNoRow("6. Do you use tobacco products, alcohol, or other drugs?", "q6_tobaccoAlcohol")}

                                <div className="mt-3 mb-2 small fw-bold text-muted">7. Are you allergic to any of the following:</div>
                                <div className="ps-2">
                                    {renderYesNoRow("a. Local Anesthetics", "q7_allergicAnesthesia")}
                                    {renderYesNoRow("b. Latex", "q7_allergicLatex")}
                                    {renderYesNoRow("c. Penicillin, Antibiotic", "q7_allergicPenicillin")}
                                    {renderYesNoRow("d. Aspirin", "q7_allergicAspirin")}
                                    {renderYesNoRow("e. Others", "q7_allergicOthers")}
                                    {formData.q7_allergicOthers === 'Yes' && (
                                        <div className="mt-2 mb-2 p-2 bg-light rounded">
                                            <label className="small fw-bold text-muted">Other Allergies<RequiredMark /></label>
                                            <input
                                                type="text"
                                                name="otherAllergies"
                                                className="form-control border-warning"
                                                placeholder="Specify other allergies..."
                                                value={formData.otherAllergies}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                {!isMale && (
                                    <div className="mt-3 pt-2 border-top">
                                        <div className="small fw-bold text-muted mb-2">8. For Women:</div>
                                        {renderYesNoRow("Are you pregnant?", "q8_pregnant")}
                                        {renderYesNoRow("Are you nursing?", "q8_nursing")}
                                        {renderYesNoRow("Are you taking birth control pills?", "q8_birthControl")}
                                    </div>
                                )}
                            </div>

                            {/* SECTION 3: CONDITIONS CHECKLIST */}
                            <div className="card border-0 shadow-sm rounded-3 p-3 p-md-4 mb-4" style={{ backgroundColor: '#FFFFFF' }}>
                                <h6 className="fw-bold mb-3" style={{ color: theme.goldDark }}>
                                    3. Medical Condition Checklist
                                </h6>
                                <p className="small text-muted mb-3">Select any condition that applies to you, or choose "None".</p>
                                <div className="row g-2">
                                    {[
                                        "None", "High Blood Pressure", "Low Blood Pressure", "Epilepsy", "AIDS / HIV",
                                        "Heart Attack", "Asthma", "Thyroid Problem", "Stroke",
                                        "Pneumonia", "STD", "Heart Disease", "Emphysema",
                                        "Ulcer", "Hepatitis", "Tuberculosis", "Diabetes", "Anemia", "Others"
                                    ].map(cond => {
                                        const isCondDisabled = (formData.conditions || []).some(c => c && c.toLowerCase() === 'none') && cond.toLowerCase() !== 'none';
                                        const isSelected = (formData.conditions || []).some(c => c && c.toLowerCase() === cond.toLowerCase());
                                        return (
                                            <div className="col-6 col-md-4 col-lg-3" key={cond}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleConditionToggle(cond)}
                                                    className={`btn w-100 p-2 small transition-all border text-truncate ${isSelected
                                                            ? (cond === 'None' ? 'btn-success text-white border-success' : 'btn-danger text-white border-danger')
                                                            : 'btn-outline-secondary'
                                                        }`}
                                                    style={{
                                                        fontSize: '11px',
                                                        borderRadius: '8px',
                                                        opacity: isCondDisabled ? 0.4 : 1,
                                                        cursor: isCondDisabled ? 'not-allowed' : 'pointer'
                                                    }}
                                                    disabled={isCondDisabled}
                                                >
                                                    {cond}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                                {(formData.conditions || []).some(c => c && c.toLowerCase() === 'others') && (
                                    <div className="mt-3">
                                        <label className="small fw-bold text-muted">Specify Other Medical Conditions<RequiredMark /></label>
                                        <textarea
                                            name="otherCondition"
                                            className="form-control border-danger"
                                            rows="2"
                                            placeholder="Specify other medical conditions..."
                                            value={formData.otherCondition}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            {/* SECTION 4: COVID-19 & DECLARATION */}
                            <div className="card border-0 shadow-sm rounded-3 p-3 p-md-4 mb-4" style={{ backgroundColor: '#FFFFFF', borderLeft: `5px solid #E53E3E` }}>
                                <h6 className="fw-bold mb-3 text-danger">
                                    <RiVirusLine className="me-2" /> 4. Infection Control &amp; COVID-19 Declaration
                                </h6>
                                <p className="small text-muted mb-2">In the past 14 days, have you experienced any of the following:</p>
                                {renderYesNoRow("Fever (37.5 C or above)", "cv_fever")}
                                {renderYesNoRow("Unexplained body aches or muscle pain", "cv_aches")}
                                {renderYesNoRow("Coughing or sore throat", "cv_cough")}
                                {renderYesNoRow("Shortness of breath or difficulty breathing", "cv_breath")}
                                {renderYesNoRow("Recent loss of taste or smell", "cv_taste")}
                                {renderYesNoRow("History of international or high-risk travel in last 14 days?", "cv_travelHistory")}
                                {formData.cv_travelHistory === 'Yes' && (
                                    <div className="mt-2 mb-2 p-2 bg-light rounded">
                                        <label className="small fw-bold text-muted">Travel Location<RequiredMark /></label>
                                        <input
                                            type="text"
                                            name="cv_travelLocation"
                                            className="form-control border-warning"
                                            placeholder="Where did you travel?"
                                            value={formData.cv_travelLocation}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                )}

                                <div className="mt-3 p-3 rounded border" style={{ backgroundColor: '#FAF9F5', borderColor: '#E8E3D8' }}>
                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            id="modalCvAgreement"
                                            name="cv_agreement"
                                            checked={formData.cv_agreement}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label className="form-check-label small fw-bold text-dark" htmlFor="modalCvAgreement" style={{ cursor: 'pointer' }}>
                                            I declare that the health information and medical history provided above are accurate, true, and complete to the best of my knowledge.<RequiredMark />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn w-100 py-3 fw-bold text-white shadow-sm d-flex align-items-center justify-content-center gap-2"
                                style={{ backgroundColor: theme.goldDark, borderRadius: '12px', fontSize: '1rem' }}
                                disabled={submitting}
                            >
                                <RiCheckDoubleLine size={20} />
                                <span>{submitting ? 'Saving Medical Record...' : 'Submit Medical Record & Unlock Portal'}</span>
                            </button>
                        </form>
                    )}
                </div>

                {/* MODAL FOOTER WITH SAFE SIGN OUT */}
                <div
                    className="p-3 bg-white border-top d-flex align-items-center justify-content-between flex-wrap gap-2"
                    style={{ flexShrink: 0, borderColor: '#ECE6D8' }}
                >
                    <div className="d-flex align-items-center gap-2 text-muted small">
                        <RiInformationLine size={16} className="text-warning" />
                        <span>All clinic modules remain locked until intake forms are completed.</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="btn btn-outline-danger btn-sm rounded-pill px-3 py-1 d-flex align-items-center gap-1"
                        title="Sign out and finish intake later"
                    >
                        <RiLogoutBoxRLine size={14} />
                        <span>Finish Later / Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PatientIntakeModal;
