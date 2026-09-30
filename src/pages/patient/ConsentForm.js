import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import Swal from 'sweetalert2';
import logo from '../../assets/images/final-logo.png';
import { 
    RiEraserLine, 
    RiCheckboxCircleLine,
    RiArrowRightLine
} from 'react-icons/ri';
import { readDatabase, writeDatabase, readSession } from '../../utils/storage';
import { addUserNotification } from '../../utils/notificationStore';
import { getPatientIntakeStatus } from '../../utils/patientIntake';
import { addAuditLog } from '../../services/auditLogger';
import { broadcastRealtimeEvent } from '../../utils/realtimeClient';

const ConsentForm = () => {
    const navigate = useNavigate();
    const session = readSession() || {};
    const sigPad = useRef(null);
    
    const [agreed, setAgreed] = useState(false);
    const [isAlreadySigned, setIsAlreadySigned] = useState(false);
    const [savedSignature, setSavedSignature] = useState(null); 
    const [savedDate, setSavedDate] = useState(null);
    const [hasMedicalRecord, setHasMedicalRecord] = useState(false);
    const [loading, setLoading] = useState(true);

    const colors = { gold: '#D4AF37', goldDark: '#B8860B', beige: '#F5F5DC' };

    useEffect(() => {
        const loadConsentData = () => {
            const db = readDatabase() || {};
            const userEmail = (session?.email || '').toLowerCase().trim();
            const userRecord = db.medical_records?.[userEmail] || db.medical_records?.[session?.email];
            
            if (userRecord && userRecord.signature) {
                setIsAlreadySigned(true);
                setSavedSignature(userRecord.signature);
                setSavedDate(userRecord.consentTimestamp || userRecord.dateSigned || userRecord.date_signed || 'Confirmed');
            } else {
                const consentList = Array.isArray(db.consent_records) ? db.consent_records : [];
                const matchedConsent = consentList.find(c => (c.email || '').toLowerCase().trim() === userEmail);
                if (matchedConsent && matchedConsent.signature) {
                    setIsAlreadySigned(true);
                    setSavedSignature(matchedConsent.signature);
                    setSavedDate(matchedConsent.dateSigned || matchedConsent.date_signed || 'Confirmed');
                } else {
                    setIsAlreadySigned(false);
                    setSavedSignature(null);
                    setSavedDate(null);
                }
            }

            const intake = getPatientIntakeStatus(db, session);
            setHasMedicalRecord(intake.hasMedicalRecord);

            setLoading(false);
        };

        loadConsentData();

        window.addEventListener('storage', loadConsentData);
        window.addEventListener('doc_dental_db_updated', loadConsentData);
        return () => {
            window.removeEventListener('storage', loadConsentData);
            window.removeEventListener('doc_dental_db_updated', loadConsentData);
        };
    }, [session?.email]);

    const clearSignature = () => {
        if (sigPad.current) {
            sigPad.current.clear();
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!sigPad.current || sigPad.current.isEmpty()) {
            return Swal.fire({
                title: 'Signature Required',
                text: 'Please provide your digital signature on the pad to proceed.',
                icon: 'warning',
                confirmButtonColor: colors.goldDark
            });
        }

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

        // Save to dedicated consent_records array for sync
        if (!Array.isArray(db.consent_records)) db.consent_records = [];
        const existingIndex = db.consent_records.findIndex(c => (c.email || '').toLowerCase().trim() === userEmail);
        const consentData = {
            email: userEmail,
            signature: signatureData,
            dateSigned: dateString,
            date_signed: dateString
        };
        if (existingIndex > -1) {
            db.consent_records[existingIndex] = consentData;
        } else {
            db.consent_records.push(consentData);
        }

        // Trigger notifications for Superadmin, Admin and Staff users
        let updatedDb = db;
        const staffAdmins = (db.users || []).filter(u => {
            const role = (u.role || '').toLowerCase();
            return role === 'staff' || role === 'admin' || role === 'superadmin' || role === 'super_admin';
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

        writeDatabase(updatedDb).then(() => {
            // Log to audit logs so it is reflected in Admin and SuperAdmin audit views
            addAuditLog('Consent Form Signed', `Patient ${session?.fullName || session?.name || userEmail} has signed the informed consent form.`);

            // Broadcast real-time event to Admin, Staff, and SuperAdmin
            broadcastRealtimeEvent('consent_signed', {
                title: 'Consent Form Signed',
                message: `Patient ${session?.fullName || session?.name || userEmail} has signed the informed consent form.`,
                patientEmail: userEmail,
                targetRoles: ['admin', 'staff', 'superadmin']
            }, null, ['admin', 'staff', 'superadmin']);

            Swal.fire({
                title: 'Consent Form Signed!',
                text: 'Informed consent has been securely recorded. Please proceed to complete your Medical History.',
                icon: 'success',
                confirmButtonColor: colors.goldDark,
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                navigate('/patient/medical');
            });
        });
    };

    if (loading) return null;

    return (
        <div className="container-fluid animate__animated animate__fadeIn pb-5 mt-4">
            <div className="row justify-content-center">
                <div className="col-md-11 col-lg-10 col-xl-9">
                    
                    <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
                        <div className="card-header border-0 p-4 text-center text-white" style={{ background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldDark} 100%)` }}>
                            <div 
                                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white shadow mb-3"
                                style={{ 
                                    width: '78px', 
                                    height: '78px', 
                                    padding: '10px',
                                    border: '3px solid rgba(255, 255, 255, 0.9)',
                                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                                }}
                            >
                                <img 
                                    src={logo} 
                                    alt="Doc Dental Logo" 
                                    style={{ 
                                        width: '100%', 
                                        height: '100%', 
                                        objectFit: 'contain'
                                    }} 
                                />
                            </div>
                            <h4 className="fw-bold mb-1">Patient Informed Consent</h4>
                            <p className="mb-0 text-white fw-medium" style={{ fontSize: '0.95rem', opacity: 0.95, textShadow: '0 1px 2px rgba(0, 0, 0, 0.15)' }}>
                                Please review and provide your authorization below
                            </p>
                        </div>

                        <div className="card-body p-4 p-md-5">
                            <div className="p-4 bg-light rounded-3 mb-4 text-secondary shadow-sm" style={{ fontSize: '1.08rem', lineHeight: '1.65', borderLeft: `5px solid ${colors.gold}` }}>
                                <h6 className="fw-bold text-dark mb-3">Treatment Authorization &amp; Acknowledgement</h6>
                                <p>I understand and consent to have any necessary treatment performed by the attending dentist after the procedure, risks, benefits, and associated fees have been fully explained to me. These treatments may include prophylactic cleaning, periodontal scaling, composite or amalgam restorations, crowns, bridges, root canal therapy, prosthodontics, local anaesthetics, surgical extractions, and orthodontic alignment.</p>
                                <p>I understand that clinical dentistry involves biological responses and that no dental practitioner can guarantee exact surgical or therapeutic outcomes at all times.</p>
                                <p>I hereby authorize the clinical team and dental auxiliaries of Doc Dental Care to proceed with and perform dental treatments as discussed. I understand that these procedures are subject to clinical modification depending on diagnoses that may arise during the course of treatment.</p>
                                <p className="mb-0">All treatments are explained to me and any unexpected circumstances that arise during clinical care will be managed with my informed consent and best dental practice standards.</p>
                            </div>

                            {isAlreadySigned ? (
                                <div className="text-center mt-4 animate__animated animate__fadeIn">
                                    <div className="alert alert-success d-flex align-items-center justify-content-center mb-4 rounded-3">
                                        <RiCheckboxCircleLine size={24} className="me-2 text-success" />
                                        <span>Informed Consent signed and recorded on <strong>{savedDate}</strong></span>
                                    </div>
                                    
                                    <label className="form-label small fw-bold text-muted d-block text-start">Digital Signature on File</label>
                                    <div className="border rounded-3 bg-white p-3 mb-4 shadow-sm d-flex justify-content-center align-items-center" style={{ minHeight: '150px' }}>
                                        {savedSignature && (savedSignature.startsWith('data:') || savedSignature.startsWith('http')) ? (
                                            <img src={savedSignature} alt="Patient Signature" style={{ maxWidth: '100%', maxHeight: '120px' }} />
                                        ) : (
                                            <span style={{ 
                                                fontFamily: '"Brush Script MT", "Dancing Script", cursive, sans-serif', 
                                                fontSize: '36px', 
                                                color: '#155724', 
                                                fontStyle: 'italic',
                                                fontWeight: 'bold'
                                            }}>
                                                {savedSignature || 'Signed'}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {!hasMedicalRecord && (
                                        <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
                                            <button className="btn btn-gold px-4 py-3 fw-bold d-flex align-items-center justify-content-center gap-2" onClick={() => navigate('/patient/medical')}>
                                                <span>Proceed to Step 2: Medical Records</span> <RiArrowRightLine size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit}>
                                    <div className="form-check mb-4 p-3 rounded-3 border" style={{ backgroundColor: '#FAF8F0', borderColor: '#EADBBE' }}>
                                        <input 
                                            className="form-check-input ms-0 me-3" 
                                            type="checkbox" 
                                            id="agreeCheck" 
                                            checked={agreed}
                                            onChange={(e) => setAgreed(e.target.checked)}
                                        />
                                        <label className="form-check-label fw-bold small text-dark" htmlFor="agreeCheck">
                                            I confirm that I have read the consent terms above and hereby authorize clinical treatment.
                                        </label>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <label className="form-label small fw-bold text-muted mb-0">Digital Signature</label>
                                        <button type="button" className="btn btn-sm text-danger fw-bold border-0 p-0" onClick={clearSignature}>
                                            <RiEraserLine className="me-1" /> Clear Pad
                                        </button>
                                    </div>
                                    <div className="border rounded-3 bg-white mb-3 shadow-sm" style={{ height: '180px' }}>
                                        <SignatureCanvas 
                                            ref={sigPad}
                                            penColor='#111827'
                                            canvasProps={{ className: 'w-100 h-100 rounded-3', style: { width: '100%', height: '100%' } }}
                                        />
                                    </div>

                                    <button 
                                        type="submit" 
                                        className="btn btn-gold w-100 py-3 fw-bold"
                                        disabled={!agreed}
                                    >
                                        Submit &amp; Access Clinical Records
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConsentForm;
