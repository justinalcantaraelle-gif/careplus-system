import { readDatabase } from '../../utils/storage';
import React, { useState, useEffect } from 'react';
import logo from '../../assets/images/final-logo.png';
import { 
    RiFileTextLine, RiSearchLine, 
    RiUserHeartLine, RiCheckboxCircleLine, RiCloseCircleLine
} from 'react-icons/ri';
import Swal from 'sweetalert2';
import { addAuditLog } from '../../services/auditLogger';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const ConsentForms = () => {
    const [patients, setPatients] = useState([]);
    const [consentRecords, setConsentRecords] = useState({});
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const theme = {
        beige: '#f8fafc',
        gold: '#0284c7',
        goldDark: '#0369a1',
        cardBg: '#ffffff',
        inputBg: '#f8f9fa' 
    };

    useEffect(() => {
        const loadConsentData = () => {
            const db = readDatabase() || {};
            if (db.users) {
                setPatients(db.users.filter(u => (u.role || '').toLowerCase() === 'patient'));
            }
            
            const merged = {};

            // 1. Read medical_records
            Object.keys(db.medical_records || {}).forEach(email => {
                const med = db.medical_records[email] || {};
                const eKey = email.toLowerCase().trim();
                merged[eKey] = {
                    ...med,
                    hasConsented: Boolean(med.hasConsented || med.signature)
                };
            });

            // 2. Read consent_records
            if (Array.isArray(db.consent_records)) {
                db.consent_records.forEach(c => {
                    if (c && c.email) {
                        const eKey = c.email.toLowerCase().trim();
                        merged[eKey] = {
                            ...(merged[eKey] || {}),
                            signature: c.signature || merged[eKey]?.signature,
                            consentTimestamp: c.dateSigned || c.date_signed || merged[eKey]?.consentTimestamp || new Date().toLocaleDateString(),
                            hasConsented: Boolean(c.signature || merged[eKey]?.hasConsented)
                        };
                    }
                });
            }

            setConsentRecords(merged);
        };

        loadConsentData();

        window.addEventListener('storage', loadConsentData);
        window.addEventListener('doc_dental_db_updated', loadConsentData);
        return () => {
            window.removeEventListener('storage', loadConsentData);
            window.removeEventListener('doc_dental_db_updated', loadConsentData);
        };
    }, []);

    const filteredPatients = patients.filter(patient => {
        const pEmail = (patient.email || '').toLowerCase().trim();
        const record = consentRecords[pEmail] || consentRecords[patient.email] || {};
        const query = searchTerm.toLowerCase();
        const matchesName = (val) => String(val || '').toLowerCase().startsWith(query);
        return matchesName(patient.fullName) ||
               matchesName(patient.name) ||
               matchesName(record.fullName) ||
               matchesName(record.fullname) ||
               matchesName(record.name) ||
               pEmail.includes(query);
    });

    const selectedPatientEmailKey = (selectedPatient?.email || '').toLowerCase().trim();
    const selectedConsentRecord = selectedPatient ? (consentRecords[selectedPatientEmailKey] || consentRecords[selectedPatient.email] || {}) : {};
    const selectedHasConsent = Boolean(selectedConsentRecord.hasConsented || selectedConsentRecord.signature);


    return (
        <div className="container-fluid py-4 animate__animated animate__fadeIn main-wrapper" style={{ backgroundColor: theme.beige, minHeight: '100vh' }}>
            
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3 no-print">
                <div>
                    <h3 className="fw-bold mb-0" style={{ color: theme.goldDark }}>Patient Consent Forms</h3>
                    <p className="text-muted small mb-0">Review official treatment consent documents</p>
                </div>

                <div className="input-group shadow-sm rounded-pill overflow-hidden" style={{ maxWidth: '350px' }}>
                    <span className="input-group-text bg-white border-0">
                        <RiSearchLine style={{ color: theme.gold }} />
                    </span>
                    <input 
                        type="text" 
                        className="form-control border-0" 
                        placeholder="Search patient name or email..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ fontSize: '14px' }}
                    />
                </div>
            </div>

            <div className="row g-4 print-row-reset">
                <div className="col-lg-4 no-print">
                    <div className="card border-0 shadow-sm" style={{ borderRadius: '20px', backgroundColor: theme.cardBg, maxHeight: '75vh', overflowY: 'auto' }}>
                        <div className="card-body p-0">
                            <ul className="list-group list-group-flush" style={{ borderRadius: '20px' }}>
                                {filteredPatients.length > 0 ? filteredPatients.map(patient => {
                                    const pEmail = (patient.email || '').toLowerCase().trim();
                                    const record = consentRecords[pEmail] || consentRecords[patient.email] || {};
                                    const hasConsent = Boolean(record.hasConsented || record.signature);
                                    const isSelected = selectedPatient?.email === patient.email;

                                    return (
                                        <li 
                                            key={patient.email}
                                            className="list-group-item p-3 border-bottom cursor-pointer transition-all"
                                            style={{ 
                                                backgroundColor: isSelected ? theme.beige : 'transparent',
                                                borderLeft: isSelected ? `4px solid ${theme.gold}` : '4px solid transparent'
                                            }}
                                            onClick={() => {
                                                setSelectedPatient(patient);
                                                addAuditLog('Viewed Consent Form', `Viewed consent form for ${patient.fullName || patient.email}.`);
                                            }}
                                        >
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="rounded-circle bg-white d-flex align-items-center justify-content-center shadow-sm" style={{ width: '40px', height: '40px' }}>
                                                        <RiUserHeartLine size={20} style={{ color: hasConsent ? theme.goldDark : '#ccc' }} />
                                                    </div>
                                                    <div>
                                                        <h6 className="fw-bold mb-0" style={{ fontSize: '14px', color: '#333' }}>
                                                            {patient.fullName || 'Unknown Patient'}
                                                        </h6>
                                                        <p className="text-muted mb-0" style={{ fontSize: '12px' }}>{patient.email}</p>
                                                    </div>
                                                </div>
                                                {hasConsent ? (
                                                    <RiCheckboxCircleLine className="text-success" size={20} title="Consent on file" />
                                                ) : (
                                                    <RiCloseCircleLine className="text-danger opacity-50" size={20} title="Missing consent" />
                                                )}
                                            </div>
                                        </li>
                                    );
                                }) : (
                                    <div className="text-center p-5 text-muted">
                                        <RiSearchLine size={30} className="mb-2 opacity-50" />
                                        <p className="small mb-0">No patients match your search.</p>
                                    </div>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="col-lg-8 print-col-reset">
                    {selectedPatient ? (
                        <div className="card border-0 shadow-sm h-100 print-card-reset" style={{ borderRadius: '20px', backgroundColor: '#e9ecef' }}>
                            
                            <div className="card-header border-0 bg-white p-3 d-flex align-items-center justify-content-between no-print" style={{ borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}>
                                <span className="fw-bold text-muted d-flex align-items-center">
                                    <RiFileTextLine className="me-2"/> Document Viewer
                                </span>
                            </div>

                            <div className="card-body p-4 d-flex justify-content-center align-items-start overflow-auto print-body-reset">
                                {(() => {
                                    const selEmail = (selectedPatient.email || '').toLowerCase().trim();
                                    const selRecord = consentRecords[selEmail] || consentRecords[selectedPatient.email] || {};
                                    const hasConsent = Boolean(selRecord.hasConsented || selRecord.signature);

                                    if (!hasConsent) {
                                        return (
                                            <div className="text-center text-muted mt-5 pt-5 no-print">
                                                <RiFileTextLine size={60} className="mb-3 opacity-25" />
                                                <h5>No Consent Form Found</h5>
                                                <p className="small">This patient has not yet signed or submitted their digital consent form.</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div id="printable-consent-form" className="bg-white shadow-lg print-shadow-none">
                                            <div className="print-header text-center text-white p-4" style={{ background: `linear-gradient(135deg, ${theme.gold} 0%, ${theme.goldDark} 100%)` }}>
                                                <div 
                                                    className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white shadow mb-3"
                                                    style={{ 
                                                        width: '78px', 
                                                        height: '78px', 
                                                        padding: '10px',
                                                        border: '3px solid rgba(255, 255, 255, 0.9)',
                                                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                                                        WebkitPrintColorAdjust: 'exact',
                                                        printColorAdjust: 'exact'
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

                                            <div className="print-body">
                                                {/* PATIENT INFO */}
                                                <div className="row bg-light rounded-3 mx-0 print-info-box">
                                                    <div className="col-sm-6 mb-2 mb-sm-0">
                                                        <p className="mb-1"><span className="text-muted small fw-bold">Patient Name:</span><br /><strong>{selectedPatient.fullName || selectedPatient.email}</strong></p>
                                                        <p className="mb-0"><span className="text-muted small fw-bold">Email:</span><br />{selectedPatient.email}</p>
                                                    </div>
                                                    <div className="col-sm-6 text-sm-end print-text-start">
                                                        <p className="mb-1"><span className="text-muted small fw-bold">Contact Number:</span><br /><strong>{selRecord.contact || selRecord.contactNumber || selRecord.phone || selectedPatient.phone || 'N/A'}</strong></p>
                                                        <p className="mb-0"><span className="text-muted small fw-bold">Date Signed:</span><br />{selRecord.consentTimestamp || selRecord.dateSigned || selRecord.date_signed || new Date().toLocaleDateString()}</p>
                                                    </div>
                                                </div>

                                                <div className="bg-light rounded-3 text-secondary shadow-sm print-border print-terms-box" style={{ borderLeft: `5px solid ${theme.gold}` }}>
                                                    <h6 className="fw-bold text-dark mb-2">Treatment to be Performed</h6>
                                                    <p>I understand and consent to have any treatment done by the dentist after the procedure, the risk and benefits and costs have been fully explained. These treatment include cleaning, periodontal treatment, fillings, crowns, bridges, and all type of restorations, root canal treatment, dentures, local anaesthetics, surgical cases, and orthodontic treatment.</p>
                                                    <p>I understand that dentistry is not science and no dentist can properly guarantee accurate results all the time.</p>
                                                    <p>I hereby authorised any of the doctors/dental auxiliaries to proceed with and perform the dental restorations and treatments as explained to me. I understand that these are subject to modification depending on the undiagnosable circumstances that may arise during the course of treatment.</p>
                                                    <p className="mb-0">All treatment are properly explained to me and any untold circumstances that arise during the procedure, the attending dentist will not be held liable since it is my free will, full trust and confidence in him/her.</p>
                                                </div>

                                                <div className="text-center print-signature-area">
                                                    <div className="d-inline-block">
                                                        <div className="border-bottom border-dark mb-1 d-flex align-items-end justify-content-center" style={{ width: '250px', height: '70px' }}>
                                                            {selRecord.signature ? (
                                                                (selRecord.signature.startsWith('data:') || selRecord.signature.startsWith('http')) ? (
                                                                    <img 
                                                                        src={selRecord.signature} 
                                                                        alt="Patient Signature" 
                                                                        style={{ maxHeight: '65px', maxWidth: '100%', objectFit: 'contain' }}
                                                                    />
                                                                ) : (
                                                                    <span style={{ fontFamily: '"Brush Script MT", "Dancing Script", cursive, sans-serif', fontSize: '28px', color: '#155724', fontStyle: 'italic', fontWeight: 'bold' }}>
                                                                        {selRecord.signature}
                                                                    </span>
                                                                )
                                                            ) : (
                                                                <span className="text-muted fst-italic small">No Digital Signature Recorded</span>
                                                            )}
                                                        </div>
                                                        <span className="fw-bold text-muted small text-uppercase">Signature of Patient</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    ) : (
                        <div className="d-flex align-items-center justify-content-center h-100 no-print text-muted" style={{ border: '2px dashed #ccc', borderRadius: '20px' }}>
                            <div className="text-center">
                                <RiFileTextLine size={50} className="mb-3 opacity-50" />
                                <h5>Select a Patient</h5>
                                <p>Click on a patient from the list to view their consent form.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .cursor-pointer { cursor: pointer; }
                .transition-all { transition: all 0.2s ease-in-out; }
                .list-group-item:hover { background-color: #f8f9fa !important; }

                /* Standard screen sizing */
                #printable-consent-form {
                    width: 100%;
                    max-width: 880px;
                    border-radius: 20px;
                    overflow: hidden;
                }
                .print-header { padding: 1.5rem; }
                .print-body { padding: 1.5rem 3rem; }
                .print-info-box { padding: 1rem; margin-bottom: 1.5rem; }
                .print-terms-box { padding: 1.5rem; margin-bottom: 1.5rem; }
                .print-signature-area { margin-top: 3rem; }

                @media print {
                    body, html {
                        background-color: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .no-print, nav, .sidebar, .navbar, header, footer {
                        display: none !important;
                    }
                    .main-wrapper {
                        background-color: #ffffff !important;
                        padding: 0 !important;
                        min-height: auto !important;
                    }
                    .print-row-reset, .print-col-reset {
                        display: block !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print-card-reset {
                        border: none !important;
                        box-shadow: none !important;
                        background: #ffffff !important;
                    }
                    .print-body-reset {
                        padding: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    #printable-consent-form {
                        max-width: 100% !important;
                        width: 100% !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                    }
                    .print-header {
                        padding: 1.5rem !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .print-body {
                        padding: 1.5rem !important;
                    }
                    .print-terms-box {
                        border-left: 5px solid #b8860b !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ConsentForms;
