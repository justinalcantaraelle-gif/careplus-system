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
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 p-4 rounded-4 shadow-sm bg-white border no-print d-print-none">
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
            <ul className="nav nav-pills mb-4 bg-white p-2 rounded-4 shadow-sm border no-print d-print-none">
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
                    {/* Screen View: Interactive Cards */}
                    <div className="d-print-none">
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

                    {/* Print View: Structured Clinical Comparative Table */}
                    <div id="printable-branch-analytics" className="d-none d-print-block">
                        {/* Facility Letterhead Table */}
                        <table className="table table-bordered mb-3 cert-print-table" style={{ borderColor: '#cbd5e1' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '65%', verticalAlign: 'middle' }}>
                                        <div className="fw-bold fs-5 text-primary" style={{ letterSpacing: '0.5px' }}>
                                            CAREPLUS MULTI-BRANCH CLINICAL NETWORK
                                        </div>
                                        <div className="fw-semibold text-secondary small">
                                            Operational Comparative Analytics &amp; Clinical Enterprise Audit
                                        </div>
                                        <div className="text-muted small" style={{ fontSize: '11px' }}>
                                            Centralized EHR Interoperability • Metro Central Clinic &amp; Northside Specialty Center
                                        </div>
                                    </td>
                                    <td style={{ width: '35%', verticalAlign: 'middle', fontSize: '11px', background: '#f8fafc' }}>
                                        <div><strong>Report Ref:</strong> CP-AUDIT-{new Date().getFullYear()}-{Date.now().toString().slice(-4)}</div>
                                        <div><strong>Generated Date:</strong> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        <div><strong>Facility Scope:</strong> Metro Branch HQ vs. Northside Diagnostics</div>
                                        <div><strong>Classification:</strong> Official Administrative &amp; Clinical Audit</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="text-center py-2 mb-3 rounded-2" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff' }}>
                            <h5 className="fw-bold mb-0 text-uppercase" style={{ letterSpacing: '1px' }}>
                                Two-Branch Comparative Performance Audit
                            </h5>
                            <div className="small opacity-90">Cross-Facility Operational Metrics &amp; Diagnostic Capacity Matrix</div>
                        </div>

                        {/* Section 1: KPI Metrics Table */}
                        <div className="mb-3">
                            <div className="fw-bold text-dark small text-uppercase mb-1">
                                Section 1: Comparative Clinical Operations Ledger
                            </div>
                            <table className="table table-bordered table-sm mb-0 cert-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11.5px' }}>
                                <thead style={{ background: '#f1f5f9' }}>
                                    <tr>
                                        <th style={{ width: '32%' }}>Operational KPI / Metric</th>
                                        <th style={{ width: '22%', textAlign: 'center' }}>CarePlus Metro Branch (HQ)</th>
                                        <th style={{ width: '22%', textAlign: 'center' }}>CarePlus Northside Diagnostics</th>
                                        <th style={{ width: '24%', textAlign: 'center' }}>Consolidated Total / Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="fw-semibold">Registered Active Patients</td>
                                        <td className="text-center fw-bold">{metroStats.registered} patients</td>
                                        <td className="text-center fw-bold">{northsideStats.registered} patients</td>
                                        <td className="text-center fw-bold text-primary">{metroStats.registered + northsideStats.registered} Centralized</td>
                                    </tr>
                                    <tr>
                                        <td className="fw-semibold">Appointment Encounters Scheduled</td>
                                        <td className="text-center fw-bold">{metroStats.appts} appointments</td>
                                        <td className="text-center fw-bold">{northsideStats.appts} appointments</td>
                                        <td className="text-center fw-bold text-primary">{metroStats.appts + northsideStats.appts} Scheduled</td>
                                    </tr>
                                    <tr>
                                        <td className="fw-semibold">Consultations Completed &amp; Documented</td>
                                        <td className="text-center fw-bold">{metroStats.consults} consults</td>
                                        <td className="text-center fw-bold">{northsideStats.consults} consults</td>
                                        <td className="text-center fw-bold text-success">{metroStats.consults + northsideStats.consults} Completed</td>
                                    </tr>
                                    <tr>
                                        <td className="fw-semibold">Diagnostic Laboratory Orders Requisitioned</td>
                                        <td className="text-center fw-bold">{metroStats.labs} tests</td>
                                        <td className="text-center fw-bold">{northsideStats.labs} tests</td>
                                        <td className="text-center fw-bold text-info">{metroStats.labs + northsideStats.labs} Orders Processed</td>
                                    </tr>
                                    <tr style={{ background: '#f0fdf4' }}>
                                        <td className="fw-bold text-dark">Total Net Revenue Collections</td>
                                        <td className="text-center fw-bold text-success">₱{metroStats.revenue.toLocaleString()}</td>
                                        <td className="text-center fw-bold text-success">₱{northsideStats.revenue.toLocaleString()}</td>
                                        <td className="text-center fw-bold text-success" style={{ fontSize: '12px' }}>
                                            ₱{(metroStats.revenue + northsideStats.revenue).toLocaleString()}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Section 2: Enterprise Architectural Advantages Table */}
                        <div className="mb-3">
                            <div className="fw-bold text-dark small text-uppercase mb-1">
                                Section 2: Enterprise Multi-Branch Operational Continuity
                            </div>
                            <table className="table table-bordered table-sm mb-0 cert-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11px' }}>
                                <thead style={{ background: '#f1f5f9' }}>
                                    <tr>
                                        <th style={{ width: '30%' }}>System Dimension</th>
                                        <th style={{ width: '45%' }}>Operational Protocol &amp; Advantage</th>
                                        <th style={{ width: '25%', textAlign: 'center' }}>Integration Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="fw-bold">Unified Patient Identification</td>
                                        <td>Universal patient identifiers prevent duplicate patient charts and synchronize allergies, history, and dental records across facilities.</td>
                                        <td className="text-center text-success fw-bold">ACTIVE &bull; CENTRALIZED</td>
                                    </tr>
                                    <tr>
                                        <td className="fw-bold">Real-time Diagnostic Order Routing</td>
                                        <td>Laboratory orders entered at Metro Branch seamlessly route to Northside Diagnostic Center with automated result turnaround notification.</td>
                                        <td className="text-center text-success fw-bold">ACTIVE &bull; AUTOMATED</td>
                                    </tr>
                                    <tr>
                                        <td className="fw-bold">Centralized Billing &amp; Fiscal Ledger</td>
                                        <td>Inter-branch payment reconciliation with statutory senior/PWD discount enforcement and itemized billing audit trail.</td>
                                        <td className="text-center text-success fw-bold">RECONCILED</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Section 3: Dual Signatures Table */}
                        <div className="mt-4 pt-1">
                            <table className="table table-bordered mb-0 cert-print-table" style={{ borderColor: '#cbd5e1' }}>
                                <tbody>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ width: '50%', textAlign: 'center' }}>Clinic Operations Administrator</th>
                                        <th style={{ width: '50%', textAlign: 'center' }}>Chief Medical Director / Attending Authority</th>
                                    </tr>
                                    <tr>
                                        <td style={{ height: '80px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '8px' }}>
                                            <div className="border-top border-dark mx-auto" style={{ width: '75%' }}></div>
                                            <div className="fw-bold text-dark small mt-1">{session?.fullName || 'CarePlus Operations Administrator'}</div>
                                            <div className="text-muted small" style={{ fontSize: '10px' }}>Clinic Operations Administration • CarePlus Network</div>
                                        </td>
                                        <td style={{ height: '80px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '8px' }}>
                                            <div className="fw-bold text-primary mb-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '15px' }}>
                                                Dr. Robert Chen, MD, FPCP
                                            </div>
                                            <div className="border-top border-dark mx-auto" style={{ width: '75%' }}></div>
                                            <div className="fw-bold text-dark small mt-1">Dr. Robert Chen, MD, FPCP</div>
                                            <div className="text-muted small" style={{ fontSize: '10px' }}>
                                                Medical Director • PRC Lic. No. 0089281 • Health Informatics
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Patient Comprehensive Health Summary */}
            {activeTab === 'patientSummary' && (
                <div>
                    {/* Screen View: Select Patient and Cards */}
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4 no-print d-print-none">
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
                        <>
                            {/* Screen Card View */}
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white d-print-none">
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

                            {/* Print View: Structured Clinical Health Record Tables */}
                            <div id="printable-patient-summary" className="d-none d-print-block">
                                {/* Facility Letterhead & Meta Table */}
                                <table className="table table-bordered mb-3 cert-print-table" style={{ borderColor: '#cbd5e1' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '65%', verticalAlign: 'middle' }}>
                                                <div className="fw-bold fs-5 text-primary" style={{ letterSpacing: '0.5px' }}>
                                                    CAREPLUS CLINIC MANAGEMENT SYSTEM
                                                </div>
                                                <div className="fw-semibold text-secondary small">
                                                    {activePatient.branch || 'CarePlus Multi-Branch Clinical Network'}
                                                </div>
                                                <div className="text-muted small" style={{ fontSize: '11px' }}>
                                                    Electronic Health Record (EHR) • Comprehensive Patient Health Summary
                                                </div>
                                            </td>
                                            <td style={{ width: '35%', verticalAlign: 'middle', fontSize: '11px', background: '#f8fafc' }}>
                                                <div><strong>Record ID:</strong> EHR-2026-{String(activePatient.id || '101').slice(-5)}</div>
                                                <div><strong>Report Date:</strong> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                <div><strong>Registered Branch:</strong> {activePatient.branch || 'CarePlus Metro Branch'}</div>
                                                <div><strong>Classification:</strong> Official Confidential Medical Record</div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div className="text-center py-2 mb-3 rounded-2" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff' }}>
                                    <h5 className="fw-bold mb-0 text-uppercase" style={{ letterSpacing: '1px' }}>
                                        Comprehensive Patient Health Summary
                                    </h5>
                                    <div className="small opacity-90">Consolidated Clinical Encounters &amp; Diagnostic Laboratory History</div>
                                </div>

                                {/* Section 1: Demographics Table */}
                                <div className="mb-3">
                                    <div className="fw-bold text-dark small text-uppercase mb-1">
                                        Section 1: Patient Demographic &amp; Registration Ledger
                                    </div>
                                    <table className="table table-bordered table-sm mb-0 cert-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11.5px' }}>
                                        <tbody>
                                            <tr>
                                                <th style={{ width: '18%', background: '#f1f5f9' }}>Patient Full Name</th>
                                                <td style={{ width: '32%', fontWeight: 'bold' }}>{activePatient.fullName}</td>
                                                <th style={{ width: '18%', background: '#f1f5f9' }}>Patient ID (PID)</th>
                                                <td style={{ width: '32%' }}>PID-{String(activePatient.id).slice(-4)}</td>
                                            </tr>
                                            <tr>
                                                <th style={{ background: '#f1f5f9' }}>Gender / Sex</th>
                                                <td>{activePatient.gender || 'Not specified'}</td>
                                                <th style={{ background: '#f1f5f9' }}>Date of Birth</th>
                                                <td>{activePatient.birthdate || 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <th style={{ background: '#f1f5f9' }}>Blood Type</th>
                                                <td className="fw-bold text-primary">{activePatient.bloodType || 'O+'}</td>
                                                <th style={{ background: '#f1f5f9' }}>Email / Contact</th>
                                                <td>{activePatient.email} {activePatient.phone ? `• ${activePatient.phone}` : ''}</td>
                                            </tr>
                                            <tr>
                                                <th style={{ background: '#f1f5f9' }}>Registered Facility</th>
                                                <td>{activePatient.branch}</td>
                                                <th style={{ background: '#f1f5f9' }}>Patient Classification</th>
                                                <td>{activePatient.patient_type || 'Regular Patient'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section 2: Consultations Table */}
                                <div className="mb-3">
                                    <div className="fw-bold text-dark small text-uppercase mb-1">
                                        Section 2: Clinical Consultation Encounters &amp; Diagnoses ({patientConsultations.length})
                                    </div>
                                    <table className="table table-bordered table-sm mb-0 cert-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11px' }}>
                                        <thead style={{ background: '#f1f5f9' }}>
                                            <tr>
                                                <th style={{ width: '12%' }}>Encounter ID</th>
                                                <th style={{ width: '14%' }}>Date &amp; Facility</th>
                                                <th style={{ width: '18%' }}>Attending Clinician</th>
                                                <th style={{ width: '26%' }}>Chief Complaint &amp; Diagnosis</th>
                                                <th style={{ width: '30%' }}>Prescribed Medication / Treatment</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {patientConsultations.length > 0 ? (
                                                patientConsultations.map((c, i) => (
                                                    <tr key={c.id || i}>
                                                        <td className="fw-bold">{c.id}</td>
                                                        <td>
                                                            <div>{c.date}</div>
                                                            <div className="text-muted" style={{ fontSize: '10px' }}>{c.branch}</div>
                                                        </td>
                                                        <td className="fw-semibold">{c.doctorName}</td>
                                                        <td>
                                                            <div><strong>Diagnosis:</strong> {c.diagnosis}</div>
                                                            <div className="text-muted" style={{ fontSize: '10px' }}><strong>Complaint:</strong> {c.chiefComplaint}</div>
                                                        </td>
                                                        <td>
                                                            {c.prescription && c.prescription.length > 0 ? (
                                                                c.prescription.map((rx, idx) => (
                                                                    <div key={idx}>• {rx.medication} {rx.dosage} ({rx.frequency})</div>
                                                                ))
                                                            ) : (
                                                                <span className="text-muted">No medications prescribed</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-2 text-muted">No past clinical consultations on record.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section 3: Diagnostic Laboratory History Table */}
                                <div className="mb-3">
                                    <div className="fw-bold text-dark small text-uppercase mb-1">
                                        Section 3: Diagnostic Laboratory Investigations ({patientLabs.length})
                                    </div>
                                    <table className="table table-bordered table-sm mb-0 cert-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11px' }}>
                                        <thead style={{ background: '#f1f5f9' }}>
                                            <tr>
                                                <th style={{ width: '14%' }}>Requisition ID</th>
                                                <th style={{ width: '22%' }}>Procedure &amp; Category</th>
                                                <th style={{ width: '14%' }}>Dates &amp; Branch</th>
                                                <th style={{ width: '36%' }}>Analyte Parameter &amp; Measured Value</th>
                                                <th style={{ width: '14%', textAlign: 'center' }}>Status / Flag</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {patientLabs.length > 0 ? (
                                                patientLabs.map((l, i) => (
                                                    <tr key={l.id || i}>
                                                        <td className="fw-bold">{l.id}</td>
                                                        <td>
                                                            <div className="fw-semibold">{l.testName}</div>
                                                            <div className="text-muted" style={{ fontSize: '10px' }}>{l.testCategory}</div>
                                                        </td>
                                                        <td>
                                                            <div>Req: {l.requestDate}</div>
                                                            <div className="text-muted" style={{ fontSize: '10px' }}>{l.branch}</div>
                                                        </td>
                                                        <td>
                                                            {l.results && l.results.length > 0 ? (
                                                                l.results.map((r, idx) => (
                                                                    <div key={idx} style={{ fontSize: '10.5px' }}>
                                                                        <strong>{r.parameter}:</strong> {r.value} {r.unit} (Ref: {r.normalRange})
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <span className="text-muted">Awaiting parameter measurements</span>
                                                            )}
                                                        </td>
                                                        <td className="text-center fw-bold">
                                                            <span style={{ color: l.status === 'Completed' || l.status === 'Released' ? '#15803d' : '#0369a1' }}>
                                                                {l.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-2 text-muted">No laboratory orders recorded for this patient.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section 4: Dual Clinical Attestation & Signatures Table */}
                                <div className="mt-4 pt-1">
                                    <table className="table table-bordered mb-0 cert-print-table" style={{ borderColor: '#cbd5e1' }}>
                                        <tbody>
                                            <tr style={{ background: '#f8fafc' }}>
                                                <th style={{ width: '50%', textAlign: 'center' }}>Supervising Health Records Officer</th>
                                                <th style={{ width: '50%', textAlign: 'center' }}>Attending Physician Certification</th>
                                            </tr>
                                            <tr>
                                                <td style={{ height: '80px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '8px' }}>
                                                    <div className="border-top border-dark mx-auto" style={{ width: '75%' }}></div>
                                                    <div className="fw-bold text-dark small mt-1">{session?.fullName || 'Health Records Custodian'}</div>
                                                    <div className="text-muted small" style={{ fontSize: '10px' }}>Health Informatics &amp; Records Department</div>
                                                </td>
                                                <td style={{ height: '80px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '8px' }}>
                                                    <div className="fw-bold text-primary mb-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '15px' }}>
                                                        {patientConsultations[0]?.doctorName || 'Dr. Robert Chen, MD'}
                                                    </div>
                                                    <div className="border-top border-dark mx-auto" style={{ width: '75%' }}></div>
                                                    <div className="fw-bold text-dark small mt-1">{patientConsultations[0]?.doctorName || 'Dr. Robert Chen, MD'}</div>
                                                    <div className="text-muted small" style={{ fontSize: '10px' }}>
                                                        Attending Physician • PRC Lic. No. 0089281 • Verified EHR
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* TAB 3: Official Medical Certificate Generator */}
            {activeTab === 'medicalCert' && activePatient && (
                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white" style={{ maxWidth: '920px', margin: '0 auto' }}>
                    <div className="border p-4 rounded-3 bg-white" id="printable-medical-cert">
                        {/* Certificate Header Table */}
                        <table className="table table-bordered mb-3 cert-print-table" style={{ borderColor: '#cbd5e1' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '65%', verticalAlign: 'middle' }}>
                                        <div className="fw-bold fs-5 text-primary" style={{ letterSpacing: '0.5px' }}>
                                            CAREPLUS CLINIC MANAGEMENT SYSTEM
                                        </div>
                                        <div className="fw-semibold text-secondary small">
                                            {activePatient.branch || 'CarePlus Multi-Branch Clinical Network'}
                                        </div>
                                        <div className="text-muted small" style={{ fontSize: '11px' }}>
                                            Outpatient Healthcare Services • Clinical Diagnostics • Medical Certification
                                        </div>
                                    </td>
                                    <td style={{ width: '35%', verticalAlign: 'middle', fontSize: '11px', background: '#f8fafc' }}>
                                        <div><strong>Certificate No:</strong> MC-2026-{String(activePatient.id || '101').slice(-5)}</div>
                                        <div><strong>Date Issued:</strong> {new Date().toLocaleDateString()}</div>
                                        <div><strong>Attending Doctor:</strong> {patientConsultations[0]?.doctorName || 'Dr. Robert Chen, MD'}</div>
                                        <div><strong>Validity:</strong> 30 Days from Issuance</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="text-center py-2 mb-3 rounded-2" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff' }}>
                            <h5 className="fw-bold mb-0 text-uppercase" style={{ letterSpacing: '1px' }}>
                                Official Medical Certificate
                            </h5>
                            <div className="small opacity-90">Clinical Diagnostic Attestation &amp; Health Evaluation</div>
                        </div>

                        {/* Section 1: Patient Demographics Table */}
                        <div className="mb-3">
                            <div className="fw-bold text-dark small text-uppercase mb-1">
                                Section 1: Patient Demographic &amp; Encounter Verification
                            </div>
                            <table className="table table-bordered table-sm mb-0 cert-print-table" style={{ borderColor: '#cbd5e1', fontSize: '12px' }}>
                                <tbody>
                                    <tr>
                                        <th style={{ width: '20%', background: '#f1f5f9', color: '#334155' }}>Patient Full Name</th>
                                        <td style={{ width: '30%', fontWeight: 'bold' }}>{activePatient.fullName}</td>
                                        <th style={{ width: '20%', background: '#f1f5f9', color: '#334155' }}>Gender / Sex</th>
                                        <td style={{ width: '30%' }}>{activePatient.gender || 'Not specified'}</td>
                                    </tr>
                                    <tr>
                                        <th style={{ background: '#f1f5f9', color: '#334155' }}>Residential Address</th>
                                        <td style={{ fontWeight: '500' }}>{activePatient.address || 'Metro City'}</td>
                                        <th style={{ background: '#f1f5f9', color: '#334155' }}>Clinical Facility</th>
                                        <td>{activePatient.branch || 'CarePlus Metro Branch'}</td>
                                    </tr>
                                    <tr>
                                        <th style={{ background: '#f1f5f9', color: '#334155' }}>Date of Examination</th>
                                        <td>{patientConsultations[0]?.date || new Date().toLocaleDateString()}</td>
                                        <th style={{ background: '#f1f5f9', color: '#334155' }}>Contact Telephone</th>
                                        <td>{activePatient.phone || activePatient.contact || 'Registered on file'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Section 2: Clinical Assessment & Diagnosis Table */}
                        <div className="mb-3">
                            <div className="fw-bold text-dark small text-uppercase mb-1">
                                Section 2: Clinical Examination &amp; Official Diagnosis
                            </div>
                            <table className="table table-bordered table-sm mb-0 cert-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11.5px' }}>
                                <tbody>
                                    <tr>
                                        <th style={{ width: '24%', background: '#f1f5f9', color: '#334155' }}>Clinical Chief Complaint</th>
                                        <td style={{ width: '76%' }}>{patientConsultations[0]?.chiefComplaint || 'Consultation and clinical diagnostic assessment'}</td>
                                    </tr>
                                    <tr>
                                        <th style={{ background: '#f1f5f9', color: '#334155' }}>Clinical Examination Findings</th>
                                        <td>{patientConsultations[0]?.symptoms || 'Patient clinically evaluated with vital signs within acceptable ambulatory limits.'}</td>
                                    </tr>
                                    <tr>
                                        <th style={{ background: '#f1f5f9', color: '#334155' }}>Official Clinical Diagnosis</th>
                                        <td className="fw-bold text-primary" style={{ fontSize: '12.5px' }}>
                                            {patientConsultations[0]?.diagnosis || 'Acute Respiratory Infection / Clinically Evaluated and Managed'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Section 3: Recommendations & Medical Disposition Table */}
                        <div className="mb-3">
                            <div className="fw-bold text-dark small text-uppercase mb-1">
                                Section 3: Medical Disposition &amp; Physician Recommendations
                            </div>
                            <table className="table table-bordered table-sm mb-0 cert-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11.5px' }}>
                                <thead style={{ background: '#f1f5f9' }}>
                                    <tr>
                                        <th style={{ width: '30%' }}>Assessment Item</th>
                                        <th style={{ width: '70%' }}>Physician Instructions &amp; Clinical Direction</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="fw-semibold">Recommended Rest Period</td>
                                        <td className="fw-bold text-dark">
                                            {patientConsultations[0]?.clinicalAdvice ? 'Rest and Recuperation as indicated' : '2 to 3 Days Convalescence / Rest Advised'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="fw-semibold">Treatment &amp; Pharmacotherapy</td>
                                        <td>
                                            {patientConsultations[0]?.clinicalAdvice || 'Complete full prescribed course of oral antibiotics, anti-inflammatory medications, and maintain oral hydration.'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="fw-semibold">Physical Activity Fitness</td>
                                        <td>Excuse from strenuous physical exertion, contact sports, and prolonged hazardous activities until asymptomatic.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Section 4: Legal Undertaking & Attestation Table */}
                        <div className="mb-3">
                            <table className="table table-bordered table-sm mb-0 cert-print-table" style={{ borderColor: '#cbd5e1', fontSize: '10.5px' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ background: '#f8fafc', color: '#475569' }}>
                                            <strong>Certification Purpose:</strong> This medical certification is issued upon the request of the patient for employment, academic, or personal health documentation purposes and is valid without alteration.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Section 5: Physician Signature Table */}
                        <div className="mt-4 pt-1">
                            <table className="table table-bordered mb-0 cert-print-table" style={{ borderColor: '#cbd5e1' }}>
                                <tbody>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ width: '50%', textAlign: 'center' }}>Patient / Subject Acknowledgment</th>
                                        <th style={{ width: '50%', textAlign: 'center' }}>Attending Physician Certification &amp; Licensure</th>
                                    </tr>
                                    <tr>
                                        <td style={{ height: '80px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '8px' }}>
                                            <div className="border-top border-dark mx-auto" style={{ width: '75%' }}></div>
                                            <div className="fw-bold text-dark small mt-1">{activePatient.fullName}</div>
                                            <div className="text-muted small" style={{ fontSize: '10px' }}>Patient Signature • Acknowledged Receipt</div>
                                        </td>
                                        <td style={{ height: '80px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '8px' }}>
                                            <div className="fw-bold text-primary mb-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '16px' }}>
                                                {patientConsultations[0]?.doctorName || 'Dr. Robert Chen, MD'}
                                            </div>
                                            <div className="border-top border-dark mx-auto" style={{ width: '75%' }}></div>
                                            <div className="fw-bold text-dark small mt-1">{patientConsultations[0]?.doctorName || 'Dr. Robert Chen, MD'}</div>
                                            <div className="text-muted small" style={{ fontSize: '10px' }}>
                                                Attending Physician • PRC Lic. No. 0089281 • S2 Valid 2026
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="text-center mt-4 no-print">
                        <button
                            onClick={() => window.print()}
                            className="btn btn-primary rounded-pill px-5 py-2 fw-bold shadow-sm"
                        >
                            <RiPrinterLine className="me-2" /> Print Official Medical Certificate
                        </button>
                    </div>
                </div>
            )}

            <style>{`
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
                    .no-print, nav, .sidebar, .navbar, header, footer, .nav-pills, .btn {
                        display: none !important;
                    }
                    .card {
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        max-width: 100% !important;
                    }
                    #printable-medical-cert,
                    #printable-branch-analytics,
                    #printable-patient-summary {
                        width: 100% !important;
                        max-width: 100% !important;
                        border: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .cert-print-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        page-break-inside: avoid !important;
                        margin-bottom: 8px !important;
                    }
                    .cert-print-table th,
                    .cert-print-table td {
                        border: 1px solid #94a3b8 !important;
                        padding: 4px 8px !important;
                        color: #0f172a !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .cert-print-table th {
                        background-color: #f1f5f9 !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default MedicalReports;
