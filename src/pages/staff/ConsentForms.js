import { readDatabase } from '../../utils/storage';
import React, { useState, useEffect } from 'react';
import logo from '../../assets/images/final-logo.png';
import { 
    RiFileTextLine, RiSearchLine, 
    RiUserHeartLine, RiCheckboxCircleLine, RiCloseCircleLine, RiPrinterLine
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
                                {selectedHasConsent && (
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm rounded-pill px-3 fw-bold shadow-sm d-flex align-items-center gap-2"
                                        onClick={() => window.print()}
                                    >
                                        <RiPrinterLine size={16} /> Print Official Form
                                    </button>
                                )}
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
                                        <div id="printable-consent-form" className="bg-white shadow-lg print-shadow-none p-4 rounded-4">
                                            {/* Clinical Letterhead & Form Meta Table */}
                                            <table className="table table-bordered mb-3 clinical-print-table" style={{ borderColor: '#cbd5e1' }}>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ width: '18%', textAlign: 'center', verticalAlign: 'middle', background: '#f8fafc' }}>
                                                            <img 
                                                                src={logo} 
                                                                alt="CarePlus Logo" 
                                                                style={{ width: '64px', height: '64px', objectFit: 'contain' }} 
                                                            />
                                                        </td>
                                                        <td style={{ width: '54%', verticalAlign: 'middle' }}>
                                                            <div className="fw-bold fs-5 text-primary" style={{ letterSpacing: '0.5px' }}>
                                                                CAREPLUS CLINIC MANAGEMENT SYSTEM
                                                            </div>
                                                            <div className="small text-muted fw-semibold">
                                                                Department of Dental Medicine &amp; Clinical Healthcare
                                                            </div>
                                                            <div className="small text-secondary" style={{ fontSize: '11px' }}>
                                                                Metro &amp; Northside Medical-Dental Network • Quality Clinical Governance
                                                            </div>
                                                        </td>
                                                        <td style={{ width: '28%', verticalAlign: 'middle', fontSize: '11px', background: '#f8fafc' }}>
                                                            <div><strong>Document ID:</strong> CP-CNS-{String(selectedPatient.id || '001').slice(-6)}</div>
                                                            <div><strong>Form Revision:</strong> 2026.1-EA</div>
                                                            <div><strong>Date Released:</strong> {new Date().toLocaleDateString()}</div>
                                                            <div><strong>Confidentiality:</strong> Classified Medical</div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>

                                            <div className="text-center py-2 mb-3 rounded-2" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff' }}>
                                                <h5 className="fw-bold mb-0 text-uppercase" style={{ letterSpacing: '1px' }}>
                                                    Patient Informed Consent &amp; Treatment Authorization
                                                </h5>
                                                <div className="small opacity-90">Official Legal &amp; Clinical Authorization Record</div>
                                            </div>

                                            {/* Table 1: Patient Demographics & Consent File Info */}
                                            <div className="mb-3">
                                                <div className="fw-bold text-dark small text-uppercase mb-1 d-flex align-items-center gap-1">
                                                    <RiUserHeartLine className="text-primary" /> Section 1: Patient Demographics &amp; Consent Profile
                                                </div>
                                                <table className="table table-bordered table-sm mb-0 clinical-print-table" style={{ borderColor: '#cbd5e1', fontSize: '12px' }}>
                                                    <tbody>
                                                        <tr>
                                                            <th style={{ width: '20%', background: '#f1f5f9', color: '#334155' }}>Patient Full Name</th>
                                                            <td style={{ width: '30%', fontWeight: '600' }}>{selectedPatient.fullName || selectedPatient.name || selectedPatient.email}</td>
                                                            <th style={{ width: '20%', background: '#f1f5f9', color: '#334155' }}>Email Address</th>
                                                            <td style={{ width: '30%' }}>{selectedPatient.email}</td>
                                                        </tr>
                                                        <tr>
                                                            <th style={{ background: '#f1f5f9', color: '#334155' }}>Contact Telephone</th>
                                                            <td style={{ fontWeight: '500' }}>{selRecord.contact || selRecord.contactNumber || selRecord.phone || selectedPatient.phone || 'N/A'}</td>
                                                            <th style={{ background: '#f1f5f9', color: '#334155' }}>Healthcare Branch</th>
                                                            <td>{selectedPatient.branch || 'CarePlus Metro Branch'}</td>
                                                        </tr>
                                                        <tr>
                                                            <th style={{ background: '#f1f5f9', color: '#334155' }}>Date &amp; Time Signed</th>
                                                            <td>{selRecord.consentTimestamp || selRecord.dateSigned || selRecord.date_signed || new Date().toLocaleDateString()}</td>
                                                            <th style={{ background: '#f1f5f9', color: '#334155' }}>Consent Status</th>
                                                            <td>
                                                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 fw-bold">
                                                                    <RiCheckboxCircleLine className="me-1" /> VALID &amp; LEGALLY BINDING
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Table 2: Treatment Scope & Informed Consent Provisions */}
                                            <div className="mb-3">
                                                <div className="fw-bold text-dark small text-uppercase mb-1 d-flex align-items-center gap-1">
                                                    <RiFileTextLine className="text-primary" /> Section 2: Clinical Scope of Treatment Authorized
                                                </div>
                                                <table className="table table-bordered table-sm mb-0 clinical-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11.5px' }}>
                                                    <thead style={{ background: '#f1f5f9' }}>
                                                        <tr>
                                                            <th style={{ width: '8%', textAlign: 'center' }}>No.</th>
                                                            <th style={{ width: '28%' }}>Procedure Category</th>
                                                            <th style={{ width: '48%' }}>Scope &amp; Clinical Description</th>
                                                            <th style={{ width: '16%', textAlign: 'center' }}>Acknowledgment</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            <td className="text-center fw-bold">01</td>
                                                            <td className="fw-semibold">Preventive &amp; Periodontal Care</td>
                                                            <td>Oral prophylaxis, scaling, periodontal debridement, and fluoridation therapy.</td>
                                                            <td className="text-center text-success fw-bold">CONSENTED</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="text-center fw-bold">02</td>
                                                            <td className="fw-semibold">Restorative &amp; Endodontics</td>
                                                            <td>Direct composite restorations, pulpotomy, root canal obturation, inlays, and onlays.</td>
                                                            <td className="text-center text-success fw-bold">CONSENTED</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="text-center fw-bold">03</td>
                                                            <td className="fw-semibold">Prosthodontics &amp; Crowns</td>
                                                            <td>Fixed crown and bridge fabrications, complete/removable dentures, and bite adjustments.</td>
                                                            <td className="text-center text-success fw-bold">CONSENTED</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="text-center fw-bold">04</td>
                                                            <td className="fw-semibold">Oral Surgery &amp; Orthodontics</td>
                                                            <td>Simple and surgical tooth extractions, orthodontic bracket bonding, and corrective mechanics.</td>
                                                            <td className="text-center text-success fw-bold">CONSENTED</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="text-center fw-bold">05</td>
                                                            <td className="fw-semibold">Local Anesthesia &amp; Sedation</td>
                                                            <td>Infiltration, nerve block analgesia, and topical anesthetics required for pain management.</td>
                                                            <td className="text-center text-success fw-bold">CONSENTED</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Table 3: Clinical Disclosures & Legal Undertaking */}
                                            <div className="mb-3">
                                                <div className="fw-bold text-dark small text-uppercase mb-1 d-flex align-items-center gap-1">
                                                    <RiCheckboxCircleLine className="text-primary" /> Section 3: Legal Terms &amp; Medical Disclosures
                                                </div>
                                                <table className="table table-bordered table-sm mb-0 clinical-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11px' }}>
                                                    <thead style={{ background: '#f1f5f9' }}>
                                                        <tr>
                                                            <th style={{ width: '22%' }}>Clause</th>
                                                            <th style={{ width: '64%' }}>Legal Terms &amp; Clinical Disclosures</th>
                                                            <th style={{ width: '14%', textAlign: 'center' }}>Patient Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            <td className="fw-bold">Biological Variables</td>
                                                            <td>I recognize that dental and medical surgery involves physiological variables and tissue responses. No dental practitioner can guarantee uniform therapeutic or cosmetic outcomes at all times.</td>
                                                            <td className="text-center fw-bold text-primary">AGREED</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="fw-bold">Treatment Modification</td>
                                                            <td>I authorize attending clinicians and dental auxiliaries to modify treatment plans if unpredicted diagnostic conditions or anatomical anomalies arise during active therapy.</td>
                                                            <td className="text-center fw-bold text-primary">AGREED</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="fw-bold">Voluntary Execution</td>
                                                            <td>All procedures, risks, alternative options, and financial estimates have been satisfactorily explained. This consent is executed willingly with complete confidence in the healthcare team.</td>
                                                            <td className="text-center fw-bold text-primary">AGREED</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Table 4: Official Signatures & Attestation */}
                                            <div className="mb-2">
                                                <table className="table table-bordered mb-0 clinical-print-table" style={{ borderColor: '#cbd5e1' }}>
                                                    <tbody>
                                                        <tr style={{ background: '#f8fafc' }}>
                                                            <th style={{ width: '50%', textAlign: 'center' }}>
                                                                Patient / Legal Representative Acknowledgment
                                                            </th>
                                                            <th style={{ width: '50%', textAlign: 'center' }}>
                                                                Attending Healthcare Provider / Clinical Witness
                                                            </th>
                                                        </tr>
                                                        <tr>
                                                            <td style={{ height: '95px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '10px' }}>
                                                                <div className="d-flex flex-column align-items-center justify-content-center mb-1" style={{ minHeight: '60px' }}>
                                                                    {selRecord.signature ? (
                                                                        (selRecord.signature.startsWith('data:') || selRecord.signature.startsWith('http')) ? (
                                                                            <img 
                                                                                src={selRecord.signature} 
                                                                                alt="Patient Signature" 
                                                                                style={{ maxHeight: '55px', maxWidth: '85%', objectFit: 'contain' }}
                                                                            />
                                                                        ) : (
                                                                            <span style={{ fontFamily: '"Brush Script MT", "Dancing Script", cursive, sans-serif', fontSize: '26px', color: '#155724', fontStyle: 'italic', fontWeight: 'bold' }}>
                                                                                {selRecord.signature}
                                                                            </span>
                                                                        )
                                                                    ) : (
                                                                        <span className="text-muted fst-italic small">No Digital Signature Recorded</span>
                                                                    )}
                                                                </div>
                                                                <div className="border-top border-dark mx-auto" style={{ width: '80%' }}></div>
                                                                <div className="fw-bold text-dark small mt-1">
                                                                    {selectedPatient.fullName || selectedPatient.name || selectedPatient.email}
                                                                </div>
                                                                <div className="text-muted small" style={{ fontSize: '10px' }}>
                                                                    Signature of Patient • Verified On: {selRecord.consentTimestamp || new Date().toLocaleDateString()}
                                                                </div>
                                                            </td>
                                                            <td style={{ height: '95px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '10px' }}>
                                                                <div className="d-flex flex-column align-items-center justify-content-center mb-1" style={{ minHeight: '60px' }}>
                                                                    <div style={{ fontFamily: '"Brush Script MT", "Dancing Script", cursive, sans-serif', fontSize: '24px', color: '#0369a1', fontStyle: 'italic', fontWeight: 'bold' }}>
                                                                        Dr. Elena Cruz, DMD
                                                                    </div>
                                                                </div>
                                                                <div className="border-top border-dark mx-auto" style={{ width: '80%' }}></div>
                                                                <div className="fw-bold text-dark small mt-1">
                                                                    Dr. Elena Cruz, DMD / Attending Dental Clinician
                                                                </div>
                                                                <div className="text-muted small" style={{ fontSize: '10px' }}>
                                                                    PRC Lic. No. 0089281 • CarePlus Multi-Branch Clinical Registry
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
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
                    max-width: 920px;
                    border: 1px solid #e2e8f0;
                }

                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm 12mm;
                    }
                    body, html {
                        background-color: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print, nav, .sidebar, .app-sidebar, .navbar, .app-navbar, header, footer, .btn, .doc-btn {
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
                        border: none !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .clinical-print-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        page-break-inside: avoid !important;
                        margin-bottom: 10px !important;
                    }
                    .clinical-print-table th,
                    .clinical-print-table td {
                        border: 1px solid #94a3b8 !important;
                        padding: 4px 8px !important;
                        color: #0f172a !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .clinical-print-table th {
                        background-color: #f1f5f9 !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ConsentForms;
