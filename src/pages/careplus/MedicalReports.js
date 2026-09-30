import React, { useState, useEffect, useMemo } from 'react';
import {
    RiFileChartLine, RiBuilding4Line, RiPrinterLine, RiSearchLine,
    RiUserHeartLine, RiCalendarCheckLine, RiFlaskLine, RiMoneyDollarCircleLine,
    RiStethoscopeLine, RiMedicineBottleLine, RiShieldCheckLine
} from 'react-icons/ri';
import { readDatabase, readSession } from '../../utils/storage';
import { CLINIC_BRANCHES, CLINIC_DOCTORS } from '../../utils/careplusData';

const MedicalReports = () => {
    const session = readSession() || {};
    const [db, setDb] = useState(() => readDatabase({}));
    const [activeTab, setActiveTab] = useState('branchAnalytics'); // 'branchAnalytics' | 'patientSummary' | 'medicalCert'
    const [selectedPatientEmail, setSelectedPatientEmail] = useState('');
    const [selectedBranchFilter, setSelectedBranchFilter] = useState('All');

    useEffect(() => {
        const sync = () => setDb(readDatabase({}));
        window.addEventListener('careplus_db_updated', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('careplus_db_updated', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const patients = useMemo(() => {
        return (db.users || []).filter(u => (u.role || '').toLowerCase() === 'patient');
    }, [db.users]);

    // Branch 1 (Metro) Metrics
    const metroStats = useMemo(() => {
        const branchName = 'CarePlus Metro Branch';
        const registered = (db.users || []).filter(u => u.branch === branchName && (u.role || '').toLowerCase() === 'patient').length;
        const appts = (db.appointments || []).filter(a => a.branch === branchName).length;
        const consults = (db.consultations || []).filter(c => c.branch === branchName).length;
        const labs = (db.laboratory_requests || []).filter(l => l.branch === branchName).length;
        const revenue = (db.billing_records || [])
            .filter(b => b.branch === branchName && (b.status === 'Paid' || b.paymentStatus === 'Paid'))
            .reduce((sum, b) => sum + (Number(b.amountPaid) || 0), 0);

        return { registered, appts, consults, labs, revenue };
    }, [db]);

    // Branch 2 (Northside) Metrics
    const northsideStats = useMemo(() => {
        const branchName = 'CarePlus Northside Branch';
        const registered = (db.users || []).filter(u => u.branch === branchName && (u.role || '').toLowerCase() === 'patient').length;
        const appts = (db.appointments || []).filter(a => a.branch === branchName).length;
        const consults = (db.consultations || []).filter(c => c.branch === branchName).length;
        const labs = (db.laboratory_requests || []).filter(l => l.branch === branchName).length;
        const revenue = (db.billing_records || [])
            .filter(b => b.branch === branchName && (b.status === 'Paid' || b.paymentStatus === 'Paid'))
            .reduce((sum, b) => sum + (Number(b.amountPaid) || 0), 0);

        return { registered, appts, consults, labs, revenue };
    }, [db]);

    const activePatient = useMemo(() => {
        if (!selectedPatientEmail && patients.length > 0) {
            return patients[0];
        }
        return patients.find(p => p.email === selectedPatientEmail) || patients[0] || null;
    }, [patients, selectedPatientEmail]);

    const patientConsultations = useMemo(() => {
        if (!activePatient) return [];
        return (db.consultations || []).filter(c => (c.patientEmail || '').toLowerCase() === activePatient.email.toLowerCase());
    }, [db.consultations, activePatient]);

    const patientLabs = useMemo(() => {
        if (!activePatient) return [];
        return (db.laboratory_requests || []).filter(l => (l.patientEmail || '').toLowerCase() === activePatient.email.toLowerCase());
    }, [db.laboratory_requests, activePatient]);

    return (
        <div className="container-fluid p-3 p-md-4 animate__animated animate__fadeIn">
            {/* Header Banner */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 p-4 rounded-4 shadow-sm bg-white border">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3 py-1 fw-bold">
                            <RiFileChartLine className="me-1" /> Clinical Intelligence & Reports
                        </span>
                        <span className="badge rounded-pill bg-light text-secondary border px-3 py-1">
                            CarePlus Operational Analytics
                        </span>
                    </div>
                    <h2 className="fw-bold mb-1 text-dark">Medical Reports & Branch Analytics</h2>
                    <p className="text-muted small mb-0">
                        Operational comparative reports between Metro and Northside branches, unified Electronic Health Record (EHR) summaries, and printable Medical Certificates.
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <button
                        onClick={() => window.print()}
                        className="btn btn-outline-primary d-flex align-items-center gap-2 px-3 py-2 rounded-3 shadow-sm fw-semibold"
                    >
                        <RiPrinterLine size={18} /> Print Current Report
                    </button>
                </div>
            </div>

            {/* Nav Tabs */}
            <ul className="nav nav-pills mb-4 bg-white p-2 rounded-4 shadow-sm border">
                <li className="nav-item">
                    <button
                        className={`nav-link rounded-3 fw-semibold ${activeTab === 'branchAnalytics' ? 'active bg-primary' : 'text-secondary'}`}
                        onClick={() => setActiveTab('branchAnalytics')}
                    >
                        <RiBuilding4Line className="me-1" /> Two-Branch Comparative Analytics
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link rounded-3 fw-semibold ${activeTab === 'patientSummary' ? 'active bg-primary' : 'text-secondary'}`}
                        onClick={() => setActiveTab('patientSummary')}
                    >
                        <RiUserHeartLine className="me-1" /> Patient Comprehensive Health Summary
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link rounded-3 fw-semibold ${activeTab === 'medicalCert' ? 'active bg-primary' : 'text-secondary'}`}
                        onClick={() => setActiveTab('medicalCert')}
                    >
                        <RiShieldCheckLine className="me-1" /> Official Medical Certificate Generator
                    </button>
                </li>
            </ul>

            {/* TAB 1: Branch Comparative Analytics */}
            {activeTab === 'branchAnalytics' && (
                <div>
                    <div className="row g-4 mb-4">
                        {/* Metro Branch Card */}
                        <div className="col-12 col-lg-6">
                            <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden bg-white">
                                <div className="card-header bg-primary text-white p-4">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <span className="badge bg-white text-primary mb-1">Branch 1</span>
                                            <h4 className="fw-bold mb-0">CarePlus Metro Branch</h4>
                                            <div className="small opacity-75">Main Central Clinic • 102 Central Medical Blvd</div>
                                        </div>
                                        <RiBuilding4Line size={48} className="opacity-50" />
                                    </div>
                                </div>
                                <div className="card-body p-4">
                                    <div className="row g-3">
                                        <div className="col-6">
                                            <div className="p-3 bg-light rounded-3 border">
                                                <div className="text-muted small">Registered Patients</div>
                                                <h3 className="fw-bold text-dark mb-0">{metroStats.registered}</h3>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="p-3 bg-light rounded-3 border">
                                                <div className="text-muted small">Appointments Volume</div>
                                                <h3 className="fw-bold text-primary mb-0">{metroStats.appts}</h3>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="p-3 bg-light rounded-3 border">
                                                <div className="text-muted small">Consultations Done</div>
                                                <h3 className="fw-bold text-success mb-0">{metroStats.consults}</h3>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="p-3 bg-light rounded-3 border">
                                                <div className="text-muted small">Lab Tests Ordered</div>
                                                <h3 className="fw-bold text-warning text-dark mb-0">{metroStats.labs}</h3>
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <div className="p-3 bg-primary bg-opacity-10 rounded-3 border border-primary border-opacity-25 d-flex justify-content-between align-items-center">
                                                <div>
                                                    <span className="text-muted small">Total Collections</span>
                                                    <h4 className="fw-bold text-primary mb-0">₱{metroStats.revenue.toLocaleString()}</h4>
                                                </div>
                                                <span className="badge bg-primary px-3 py-2 rounded-pill">Metro HQ</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Northside Branch Card */}
                        <div className="col-12 col-lg-6">
                            <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden bg-white">
                                <div className="card-header bg-info text-dark p-4">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <span className="badge bg-dark text-white mb-1">Branch 2</span>
                                            <h4 className="fw-bold mb-0">CarePlus Northside Branch</h4>
                                            <div className="small text-secondary">Specialty & Diagnostic Center • 45 Northway Avenue</div>
                                        </div>
                                        <RiFlaskLine size={48} className="opacity-50" />
                                    </div>
                                </div>
                                <div className="card-body p-4">
                                    <div className="row g-3">
                                        <div className="col-6">
                                            <div className="p-3 bg-light rounded-3 border">
                                                <div className="text-muted small">Registered Patients</div>
                                                <h3 className="fw-bold text-dark mb-0">{northsideStats.registered}</h3>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="p-3 bg-light rounded-3 border">
                                                <div className="text-muted small">Appointments Volume</div>
                                                <h3 className="fw-bold text-primary mb-0">{northsideStats.appts}</h3>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="p-3 bg-light rounded-3 border">
                                                <div className="text-muted small">Consultations Done</div>
                                                <h3 className="fw-bold text-success mb-0">{northsideStats.consults}</h3>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="p-3 bg-light rounded-3 border">
                                                <div className="text-muted small">Lab Tests Ordered</div>
                                                <h3 className="fw-bold text-warning text-dark mb-0">{northsideStats.labs}</h3>
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <div className="p-3 bg-info bg-opacity-10 rounded-3 border border-info border-opacity-25 d-flex justify-content-between align-items-center">
                                                <div>
                                                    <span className="text-muted small">Total Collections</span>
                                                    <h4 className="fw-bold text-dark mb-0">₱{northsideStats.revenue.toLocaleString()}</h4>
                                                </div>
                                                <span className="badge bg-dark px-3 py-2 rounded-pill text-white">Diagnostics Hub</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Integrated System Benefits Summary */}
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                        <h5 className="fw-bold text-dark mb-3">Enterprise Architectural Advantage: Centralized Data vs Siloed Tools</h5>
                        <div className="row g-3">
                            <div className="col-md-4">
                                <div className="p-3 border rounded-3 bg-light">
                                    <div className="fw-bold text-primary mb-1">Cross-Branch Patient Identification</div>
                                    <p className="small text-muted mb-0">
                                        Patients registered at Metro Branch can effortlessly consult and have lab tests run at Northside Branch without duplicate charts or lost medical history.
                                    </p>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="p-3 border rounded-3 bg-light">
                                    <div className="fw-bold text-success mb-1">Instant Laboratory Diagnostic Flow</div>
                                    <p className="small text-muted mb-0">
                                        Physicians at any branch can view real-time diagnostic laboratory results released from the Northside diagnostic center immediately upon verification.
                                    </p>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="p-3 border rounded-3 bg-light">
                                    <div className="fw-bold text-info mb-1 text-dark">Unified Revenue Reconciliation</div>
                                    <p className="small text-muted mb-0">
                                        Cashiers and billing officers across both facilities reconcile statutory discounts, insurance guarantees, and official receipts under one central ledger.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Patient Comprehensive Health Summary */}
            {activeTab === 'patientSummary' && (
                <div>
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
                        <div className="row g-3 align-items-center">
                            <div className="col-md-6">
                                <label className="form-label small fw-semibold">Select Patient for Medical Record Summary</label>
                                <select
                                    className="form-select"
                                    value={activePatient?.email}
                                    onChange={(e) => setSelectedPatientEmail(e.target.value)}
                                >
                                    {patients.map(p => (
                                        <option key={p.email} value={p.email}>
                                            {p.fullName} ({p.email}) - {p.branch}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {activePatient && (
                        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                            {/* Patient Demographics */}
                            <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-4">
                                <div>
                                    <h4 className="fw-bold text-dark mb-1">{activePatient.fullName}</h4>
                                    <div className="text-muted small">
                                        PID-{String(activePatient.id).slice(-4)} • {activePatient.gender} • DOB: {activePatient.birthdate || 'N/A'} • Blood Type: <strong>{activePatient.bloodType || 'O+'}</strong>
                                    </div>
                                    <div className="small text-muted">Registered Branch: {activePatient.branch}</div>
                                </div>
                                <span className="badge bg-primary px-3 py-2 rounded-pill">
                                    {activePatient.patient_type || 'Regular Patient'}
                                </span>
                            </div>

                            {/* Consultations History */}
                            <div className="mb-4">
                                <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                                    <RiStethoscopeLine className="text-primary" /> Past Consultation Records ({patientConsultations.length})
                                </h5>
                                {patientConsultations.length === 0 ? (
                                    <p className="text-muted small">No past consultations recorded for this patient yet.</p>
                                ) : (
                                    patientConsultations.map((c) => (
                                        <div key={c.id} className="p-3 rounded-3 border bg-light mb-3">
                                            <div className="d-flex justify-content-between mb-2">
                                                <div>
                                                    <strong className="text-primary">{c.id}</strong> — <span>{c.date}</span> at <strong>{c.branch}</strong>
                                                    <div className="small text-muted">Attending: {c.doctorName}</div>
                                                </div>
                                                <span className="badge bg-white text-dark border">Consultation</span>
                                            </div>
                                            <div className="mb-2">
                                                <strong>Diagnosis:</strong> <span className="text-dark fw-semibold">{c.diagnosis}</span>
                                            </div>
                                            <div className="small text-muted mb-2">
                                                <strong>Chief Complaint:</strong> {c.chiefComplaint}
                                            </div>
                                            {c.prescription?.length > 0 && (
                                                <div className="small">
                                                    <strong>Prescribed Medications:</strong>
                                                    <ul className="mb-0 mt-1">
                                                        {c.prescription.map((rx, idx) => (
                                                            <li key={idx}>{rx.medication} {rx.dosage} - {rx.frequency} ({rx.duration})</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Laboratory History */}
                            <div>
                                <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                                    <RiFlaskLine className="text-info" /> Diagnostic Laboratory History ({patientLabs.length})
                                </h5>
                                {patientLabs.length === 0 ? (
                                    <p className="text-muted small">No laboratory orders recorded for this patient.</p>
                                ) : (
                                    patientLabs.map((l) => (
                                        <div key={l.id} className="p-3 rounded-3 border bg-light mb-3">
                                            <div className="d-flex justify-content-between mb-1">
                                                <strong className="text-dark">{l.testName} ({l.testCategory})</strong>
                                                <span className="badge bg-success bg-opacity-10 text-success">{l.status}</span>
                                            </div>
                                            <div className="small text-muted mb-2">Requisitioned on {l.requestDate} • Released on {l.completionDate || 'Pending'} • Branch: {l.branch}</div>
                                            {l.results?.length > 0 && (
                                                <div className="table-responsive">
                                                    <table className="table table-sm table-bordered bg-white mb-0">
                                                        <thead className="small table-light">
                                                            <tr>
                                                                <th>Analyte</th>
                                                                <th>Result</th>
                                                                <th>Unit</th>
                                                                <th>Reference Range</th>
                                                                <th>Flag</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="small">
                                                            {l.results.map((r, i) => (
                                                                <tr key={i}>
                                                                    <td>{r.parameter}</td>
                                                                    <td className="fw-bold">{r.value}</td>
                                                                    <td>{r.unit}</td>
                                                                    <td>{r.normalRange}</td>
                                                                    <td><span className={`badge ${r.flag === 'High' ? 'bg-danger' : 'bg-success'}`}>{r.flag}</span></td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: Official Medical Certificate Generator */}
            {activeTab === 'medicalCert' && activePatient && (
                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white" style={{ maxWidth: '850px', margin: '0 auto' }}>
                    <div className="border p-5 rounded-3 bg-white" id="printable-medical-cert">
                        {/* Clinic Header */}
                        <div className="text-center border-bottom pb-4 mb-4">
                            <h3 className="fw-bold text-primary mb-1">CarePlus Clinic Management System</h3>
                            <div className="fw-semibold text-secondary">{activePatient.branch || 'CarePlus Metro Branch'}</div>
                            <div className="text-muted small">Outpatient Medical Services, Diagnostic Laboratory & Preventive Health</div>
                        </div>

                        <div className="text-center mb-5">
                            <h4 className="fw-bold text-dark text-decoration-underline">MEDICAL CERTIFICATE</h4>
                            <div className="small text-muted">Date of Examination: {new Date().toLocaleDateString()}</div>
                        </div>

                        <div className="fs-6 text-dark lh-lg mb-5">
                            <p><strong>TO WHOM IT MAY CONCERN:</strong></p>
                            <p>
                                This is to certify that <strong>{activePatient.fullName}</strong>, 
                                {activePatient.gender || 'Female'}, residing at {activePatient.address || 'Metro City'}, 
                                was examined and treated at <strong>{activePatient.branch || 'CarePlus Metro Branch'}</strong>.
                            </p>
                            <p>
                                <strong>Clinical Diagnosis:</strong><br />
                                <span className="p-2 px-3 bg-light rounded border d-inline-block fw-bold text-primary">
                                    {patientConsultations[0]?.diagnosis || 'Acute Respiratory Infection / Clinically Evaluated and Treated'}
                                </span>
                            </p>
                            <p>
                                <strong>Physician's Remarks & Recommendation:</strong><br />
                                {patientConsultations[0]?.clinicalAdvice || 'Patient advised rest for 2 to 3 days, regular hydration, and completion of prescribed oral antibiotic course.'}
                            </p>
                            <p className="mt-4">
                                This certification is issued upon the request of the patient for whatever legal or medical purpose it may serve.
                            </p>
                        </div>

                        <div className="d-flex justify-content-end text-center mt-5 pt-4">
                            <div style={{ width: '280px' }}>
                                <div className="border-bottom pb-1 fw-bold text-dark">
                                    {patientConsultations[0]?.doctorName || 'Dr. Robert Chen, MD'}
                                </div>
                                <div className="small text-muted">Attending Physician</div>
                                <div className="small text-muted">PRC Lic. No. 0089281 • S2 Valid 2026</div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mt-4">
                        <button
                            onClick={() => window.print()}
                            className="btn btn-primary rounded-pill px-5 py-2 fw-bold shadow-sm"
                        >
                            <RiPrinterLine className="me-2" /> Print Official Medical Certificate
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MedicalReports;
