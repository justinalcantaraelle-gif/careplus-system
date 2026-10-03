import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    RiBuilding4Line, RiUserHeartLine, RiCalendarCheckLine,
    RiStethoscopeLine, RiFlaskLine, RiMoneyDollarCircleLine,
    RiArrowRightLine, RiTimeLine, RiSearchLine,
    RiCheckDoubleLine, RiShieldCheckLine, RiNodeTree, RiPrinterLine,
    RiUserAddLine, RiFileChartLine, RiHospitalLine, RiHeartPulseLine,
    RiSparklingLine, RiFilterLine
} from 'react-icons/ri';
import {
    readDatabase, writeDatabase, readSession,
    checkAndCompletePastAppointments
} from '../../utils/storage';
import { CLINIC_BRANCHES, CLINIC_DOCTORS } from '../../utils/careplusData';
import { addAuditLog } from '../../services/auditLogger';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const session = readSession() || {};
    const [selectedBranch, setSelectedBranch] = useState('All Branches');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [dbData, setDbData] = useState({
        users: [],
        appointments: [],
        consultations: [],
        laboratory_requests: [],
        billing_records: []
    });

    const loadData = useCallback(() => {
        let db = readDatabase() || {};
        const { db: updatedDb, updated } = checkAndCompletePastAppointments(db);
        if (updated) {
            db = updatedDb;
            writeDatabase(db);
        }
        setDbData({
            users: db.users || [],
            appointments: db.appointments || [],
            consultations: db.consultations || [],
            laboratory_requests: db.laboratory_requests || [],
            billing_records: db.billing_records || []
        });
    }, []);

    useEffect(() => {
        loadData();
        const handleUpdate = () => loadData();
        window.addEventListener('storage', handleUpdate);
        window.addEventListener('careplus_db_updated', handleUpdate);
        return () => {
            window.removeEventListener('storage', handleUpdate);
            window.removeEventListener('careplus_db_updated', handleUpdate);
        };
    }, [loadData]);

    // Multi-branch filtered datasets
    const filteredAppointments = useMemo(() => {
        return (dbData.appointments || []).filter(app => {
            if (!app || app.status === 'Deleted') return false;
            const matchesBranch = selectedBranch === 'All Branches' || 
                app.branch === selectedBranch || 
                (selectedBranch.includes('Metro') && (!app.branch || app.branch.includes('Metro'))) ||
                (selectedBranch.includes('Northside') && app.branch && app.branch.includes('Northside'));
            const matchesStatus = statusFilter === 'All' || app.status === statusFilter ||
                (statusFilter === 'Active' && app.status !== 'Completed' && app.status !== 'Cancelled');
            const matchesSearch = !searchQuery || 
                (app.patientName && app.patientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (app.service && app.service.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (app.doctor && app.doctor.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesBranch && matchesStatus && matchesSearch;
        });
    }, [dbData.appointments, selectedBranch, statusFilter, searchQuery]);

    const filteredLabs = useMemo(() => {
        return (dbData.laboratory_requests || []).filter(l => {
            if (selectedBranch === 'All Branches') return true;
            return l.branch === selectedBranch || 
                (selectedBranch.includes('Metro') && (!l.branch || l.branch.includes('Metro'))) ||
                (selectedBranch.includes('Northside') && l.branch && l.branch.includes('Northside'));
        });
    }, [dbData.laboratory_requests, selectedBranch]);

    const filteredBilling = useMemo(() => {
        return (dbData.billing_records || []).filter(b => {
            if (selectedBranch === 'All Branches') return true;
            return b.branch === selectedBranch || 
                (selectedBranch.includes('Metro') && (!b.branch || b.branch.includes('Metro'))) ||
                (selectedBranch.includes('Northside') && b.branch && b.branch.includes('Northside'));
        });
    }, [dbData.billing_records, selectedBranch]);

    const financialStats = useMemo(() => {
        let totalPaid = 0;
        let totalBilled = 0;
        filteredBilling.forEach(b => {
            totalPaid += Number(b.amountPaid || 0);
            totalBilled += Number(b.totalAmount || 0);
        });
        return { totalPaid, totalBilled };
    }, [filteredBilling]);

    const handleStatusUpdate = async (id, newStatus) => {
        const appt = (dbData.appointments || []).find(a => a.id === id);
        if (!appt) return;

        let db = readDatabase() || {};
        db.appointments = (db.appointments || []).map(a => {
            if (a.id === id) {
                return { ...a, status: newStatus };
            }
            return a;
        });

        writeDatabase(db);
        addAuditLog(`Appointment ${newStatus}`, `Patient ${appt.patientName} status marked as ${newStatus}`);
        loadData();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Marked as ${newStatus}`,
            showConfirmButton: false,
            timer: 1800
        });
    };

    const adminName = session.fullName || session.name || 'Executive Director';

    return (
        <div className="p-3 p-md-4 p-xl-5 w-100" style={{ maxWidth: '1600px', margin: '0 auto', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            {/* Tranquil Top Welcome & Status Banner */}
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white" style={{ border: '1px solid #e2e8f0' }}>
                <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="badge rounded-pill px-3 py-1 fw-medium" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
                                <RiShieldCheckLine className="me-1" /> All Systems Operating Serene &amp; Smooth
                            </span>
                            <span className="badge rounded-pill px-3 py-1 fw-medium" style={{ backgroundColor: '#f0f9ff', color: '#0369a1' }}>
                                Multi-Branch Centralized EHR
                            </span>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
                            Good day, {adminName}
                        </h2>
                        <p className="text-secondary small mb-0" style={{ maxWidth: '650px', lineHeight: '1.6' }}>
                            Welcome to your calm executive dashboard. Patient flow, laboratory findings, and financials are synchronized smoothly across both Metro and Northside facilities.
                        </p>
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2">
                        {/* Facility Selector */}
                        <div className="d-flex align-items-center gap-2 bg-light px-3 py-2 rounded-3 border" style={{ borderColor: '#e2e8f0' }}>
                            <RiBuilding4Line className="text-primary" />
                            <span className="small text-muted">Facility:</span>
                            <select
                                className="form-select form-select-sm border-0 bg-transparent fw-semibold text-dark py-0"
                                style={{ width: 'auto', cursor: 'pointer', outline: 'none', boxShadow: 'none' }}
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                            >
                                <option value="All Branches">CarePlus Network (All)</option>
                                {CLINIC_BRANCHES.map(b => (
                                    <option key={b.id} value={b.name}>{b.shortName}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => window.print()}
                            className="btn btn-outline-secondary btn-sm px-3 py-2 rounded-3 d-flex align-items-center gap-2"
                        >
                            <RiPrinterLine /> Print Brief
                        </button>

                        <button
                            onClick={() => navigate('/admin/ea-blueprint')}
                            className="btn btn-primary btn-sm px-3 py-2 rounded-3 d-flex align-items-center gap-2 shadow-sm"
                        >
                            <RiNodeTree /> EA Deliverables
                        </button>
                    </div>
                </div>
            </div>

            {/* Soft, Soothing KPI Metric Cards (No harsh borders) */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 transition-hover" style={{ border: '1px solid #edf2f7' }}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-secondary small fw-medium">Registered Patients</span>
                            <div className="p-2 rounded-circle" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                                <RiUserHeartLine size={20} />
                            </div>
                        </div>
                        <h3 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
                            {dbData.users.filter(u => (u.role || '').toLowerCase() === 'patient').length}
                        </h3>
                        <div className="d-flex align-items-center justify-content-between text-muted small mt-2">
                            <span>Unified records</span>
                            <span className="text-primary fw-medium cursor-pointer" onClick={() => navigate('/admin/registration')}>
                                Add &rarr;
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 transition-hover" style={{ border: '1px solid #edf2f7' }}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-secondary small fw-medium">Visits &amp; Appointments</span>
                            <div className="p-2 rounded-circle" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                                <RiCalendarCheckLine size={20} />
                            </div>
                        </div>
                        <h3 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
                            {filteredAppointments.length}
                        </h3>
                        <div className="d-flex align-items-center justify-content-between text-muted small mt-2">
                            <span>{filteredAppointments.filter(a => a.status === 'Completed').length} completed</span>
                            <span className="text-success fw-medium cursor-pointer" onClick={() => navigate('/admin/book')}>
                                View &rarr;
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 transition-hover" style={{ border: '1px solid #edf2f7' }}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-secondary small fw-medium">Diagnostic Lab Orders</span>
                            <div className="p-2 rounded-circle" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
                                <RiFlaskLine size={20} />
                            </div>
                        </div>
                        <h3 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
                            {filteredLabs.length}
                        </h3>
                        <div className="d-flex align-items-center justify-content-between text-muted small mt-2">
                            <span>{filteredLabs.filter(l => l.status === 'Completed').length} processed</span>
                            <span className="text-warning fw-medium cursor-pointer" onClick={() => navigate('/admin/laboratory')}>
                                Station &rarr;
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 transition-hover" style={{ border: '1px solid #edf2f7' }}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-secondary small fw-medium">Reconciled Collections</span>
                            <div className="p-2 rounded-circle" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                                <RiMoneyDollarCircleLine size={20} />
                            </div>
                        </div>
                        <h3 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
                            ₱{financialStats.totalPaid.toLocaleString()}
                        </h3>
                        <div className="d-flex align-items-center justify-content-between text-muted small mt-2">
                            <span>All payments settled</span>
                            <span className="text-primary fw-medium cursor-pointer" onClick={() => navigate('/admin/billing')}>
                                Cashier &rarr;
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Peaceful Shortcuts Bar */}
            <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white" style={{ border: '1px solid #edf2f7' }}>
                <div className="d-flex align-items-center justify-content-between mb-2 px-2">
                    <span className="text-muted small fw-semibold text-uppercase" style={{ letterSpacing: '0.5px' }}>
                        Quick Navigation
                    </span>
                    <span className="text-muted small">Group 2 Integrated System</span>
                </div>
                <div className="row g-2">
                    {[
                        { title: 'Patient Intake', path: '/admin/registration', icon: <RiUserAddLine />, bg: '#f0f9ff', color: '#0284c7' },
                        { title: 'Appointments', path: '/admin/book', icon: <RiCalendarCheckLine />, bg: '#f0fdf4', color: '#16a34a' },
                        { title: 'Doctor Consultations', path: '/admin/consultations', icon: <RiStethoscopeLine />, bg: '#faf5ff', color: '#9333ea' },
                        { title: 'Diagnostic Lab', path: '/admin/laboratory', icon: <RiFlaskLine />, bg: '#fffbeb', color: '#d97706' },
                        { title: 'Billing & POS', path: '/admin/billing', icon: <RiMoneyDollarCircleLine />, bg: '#fef2f2', color: '#dc2626' },
                        { title: 'Medical Reports', path: '/admin/medical-reports', icon: <RiFileChartLine />, bg: '#f8fafc', color: '#475569' }
                    ].map((item, idx) => (
                        <div key={idx} className="col-6 col-md-4 col-xl-2">
                            <div
                                onClick={() => navigate(item.path)}
                                className="p-2 px-3 rounded-3 border d-flex align-items-center gap-2 cursor-pointer transition-hover bg-white"
                                style={{ cursor: 'pointer', borderColor: '#f1f5f9' }}
                            >
                                <div className="p-2 rounded-2" style={{ backgroundColor: item.bg, color: item.color }}>
                                    {item.icon}
                                </div>
                                <span className="small fw-semibold text-dark text-truncate">{item.title}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content: Clean Patient Flow Queue + Team Panel */}
            <div className="row g-4">
                {/* Left Queue: Clear, Low-Stress Table */}
                <div className="col-12 col-xl-8">
                    <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden" style={{ border: '1px solid #edf2f7' }}>
                        <div className="p-3 px-4 border-bottom d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                            <div>
                                <h6 className="fw-bold text-dark mb-0">Clinic Flow &amp; Patient Queue</h6>
                                <span className="text-muted small">Viewing records for {selectedBranch}</span>
                            </div>

                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                {/* Soft Filter Pills */}
                                <div className="btn-group btn-group-sm bg-light p-1 rounded-pill border" style={{ borderColor: '#e2e8f0' }}>
                                    {['All', 'Pending', 'Completed'].map(st => (
                                        <button
                                            key={st}
                                            onClick={() => setStatusFilter(st)}
                                            className={`btn btn-sm rounded-pill px-3 py-1 border-0 ${statusFilter === st ? 'bg-white shadow-sm fw-bold text-dark' : 'text-muted'}`}
                                            style={{ fontSize: '12px' }}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>

                                <div className="input-group input-group-sm" style={{ width: '180px' }}>
                                    <span className="input-group-text bg-light border-0"><RiSearchLine className="text-muted" /></span>
                                    <input
                                        type="text"
                                        className="form-control bg-light border-0 shadow-none"
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="table-responsive" style={{ overflowX: 'hidden' }}>
                            <table className="table table-hover align-middle mb-0 w-100" style={{ tableLayout: 'fixed' }}>
                                <thead style={{ backgroundColor: '#f8fafc' }} className="small text-muted">
                                    <tr>
                                        <th className="ps-3 py-3 fw-medium" style={{ width: '15%' }}>Schedule</th>
                                        <th className="py-3 fw-medium" style={{ width: '23%' }}>Patient</th>
                                        <th className="py-3 fw-medium" style={{ width: '19%' }}>Doctor &amp; Clinic</th>
                                        <th className="py-3 fw-medium" style={{ width: '16%' }}>Service</th>
                                        <th className="py-3 fw-medium" style={{ width: '12%' }}>Status</th>
                                        <th className="pe-4 py-3 text-end fw-medium" style={{ width: '15%' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAppointments.length > 0 ? (
                                        filteredAppointments.slice(0, 8).map(app => (
                                            <tr key={app.id}>
                                                <td className="ps-3 py-3">
                                                    <div className="fw-semibold text-dark text-nowrap" style={{ fontSize: '13px' }}>{app.time || '09:00 AM'}</div>
                                                    <div className="text-muted text-nowrap" style={{ fontSize: '11px' }}>{app.date || 'Today'}</div>
                                                </td>
                                                <td className="py-3">
                                                    <div className="fw-bold text-dark text-truncate" style={{ fontSize: '13px' }} title={app.patientName}>{app.patientName || 'Patient'}</div>
                                                    <div className="text-muted text-truncate" style={{ fontSize: '11px' }} title={app.patientEmail || app.contactNumber}>
                                                        {app.patientEmail || app.contactNumber || 'Patient on record'}
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <div className="text-dark fw-medium text-truncate" style={{ fontSize: '12px' }} title={app.doctor}>{app.doctor || 'Dr. Robert Chen, MD'}</div>
                                                    <div className="text-muted text-truncate" style={{ fontSize: '11px' }} title={app.branch}>{app.branch || 'Metro Branch'}</div>
                                                </td>
                                                <td className="py-3">
                                                    <span
                                                        className="badge px-2 py-1 rounded-pill fw-normal text-truncate d-inline-block mw-100"
                                                        style={{
                                                            backgroundColor: '#f1f5f9',
                                                            color: '#475569',
                                                            fontSize: '11px',
                                                            verticalAlign: 'middle'
                                                        }}
                                                        title={app.service || app.treatment || 'Consultation'}
                                                    >
                                                        {app.service || app.treatment || 'Consultation'}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <span
                                                        className="badge rounded-pill px-2 py-1 fw-medium text-nowrap"
                                                        style={{
                                                            fontSize: '11px',
                                                            backgroundColor: app.status === 'Completed' ? '#ecfdf5' : app.status === 'Approved' ? '#f0f9ff' : app.status === 'Cancelled' ? '#fef2f2' : '#fffbeb',
                                                            color: app.status === 'Completed' ? '#047857' : app.status === 'Approved' ? '#0369a1' : app.status === 'Cancelled' ? '#b91c1c' : '#b45309'
                                                        }}
                                                    >
                                                        {app.status || 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="pe-4 py-3 text-end">
                                                    <div className="d-inline-flex align-items-center gap-1.5 justify-content-end">
                                                        <button
                                                            onClick={() => handleStatusUpdate(app.id, 'Completed')}
                                                            className="btn btn-sm btn-light border text-success rounded-2 d-inline-flex align-items-center justify-content-center shadow-none"
                                                            title="Mark Complete"
                                                            style={{ width: '28px', height: '28px', padding: 0 }}
                                                        >
                                                            <RiCheckDoubleLine size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => navigate('/admin/consultations')}
                                                            className="btn btn-sm btn-light border text-primary rounded-2 d-inline-flex align-items-center justify-content-center shadow-none"
                                                            title="Launch Consultation"
                                                            style={{ width: '28px', height: '28px', padding: 0 }}
                                                        >
                                                            <RiStethoscopeLine size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="text-center py-5 text-muted">
                                                <p className="mb-0 small">No patient records found matching your peaceful view.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Calm Overview Widgets */}
                <div className="col-12 col-xl-4 d-flex flex-column gap-4">
                    {/* Diagnostic Monitor */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4" style={{ border: '1px solid #edf2f7' }}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                <RiFlaskLine className="text-warning" /> Laboratory Monitor
                            </h6>
                            <span className="badge rounded-pill px-2 py-1" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}>
                                {filteredLabs.length} Orders
                            </span>
                        </div>
                        <div className="d-flex flex-column gap-2">
                            {filteredLabs.slice(0, 4).map(lab => (
                                <div key={lab.id} className="p-3 rounded-3 bg-light d-flex align-items-center justify-content-between border" style={{ borderColor: '#f1f5f9' }}>
                                    <div className="overflow-hidden me-2">
                                        <div className="fw-semibold text-dark text-truncate small">{lab.testName}</div>
                                        <div className="text-muted" style={{ fontSize: '11px' }}>
                                            {lab.patientName} &bull; {lab.branch}
                                        </div>
                                    </div>
                                    <span className="badge rounded-pill px-2 py-1" style={{
                                        backgroundColor: lab.status === 'Completed' ? '#ecfdf5' : '#fffbeb',
                                        color: lab.status === 'Completed' ? '#047857' : '#b45309',
                                        fontSize: '10px'
                                    }}>
                                        {lab.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => navigate('/admin/laboratory')}
                            className="btn btn-outline-warning btn-sm mt-3 w-100 rounded-3"
                        >
                            Open Laboratory Results
                        </button>
                    </div>

                    {/* Medical Staff On Duty */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4" style={{ border: '1px solid #edf2f7' }}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                <RiStethoscopeLine className="text-success" /> Clinicians on Duty
                            </h6>
                            <span className="badge rounded-pill px-2 py-1" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
                                {CLINIC_DOCTORS.length} Active
                            </span>
                        </div>
                        <div className="d-flex flex-column gap-2">
                            {CLINIC_DOCTORS.map(doc => (
                                <div key={doc.id} className="p-2 px-3 rounded-3 bg-light d-flex align-items-center gap-3 border" style={{ borderColor: '#f1f5f9' }}>
                                    <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '32px', height: '32px', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '11px' }}>
                                        MD
                                    </div>
                                    <div className="flex-grow-1 overflow-hidden">
                                        <div className="fw-semibold text-dark text-truncate small">{doc.name}</div>
                                        <div className="text-muted" style={{ fontSize: '11px' }}>{doc.specialty} &bull; {doc.branch}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden on screen, visible on print: Executive Briefing Report in Clean Table Format */}
            <div id="printable-admin-brief" className="d-none d-print-block" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
                {/* 1. Executive Header Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2.5px solid #1e293b', marginBottom: '20px' }}>
                    <tbody>
                        <tr>
                            <td style={{ verticalAlign: 'top', paddingBottom: '12px', width: '65%' }}>
                                <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    CAREPLUS MULTI-BRANCH CLINIC MANAGEMENT SYSTEM
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#0284c7', marginTop: '2px', letterSpacing: '0.5px' }}>
                                    EXECUTIVE CLINICAL OPERATIONS &amp; ADMINISTRATIVE BRIEF
                                </div>
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                                    Metro Main: 123 Healthcare Blvd, Suite 400 &bull; Northside Branch: 789 Medical Park Dr
                                </div>
                                <div style={{ fontSize: '10px', color: '#64748b' }}>
                                    Network EHR Helpline: (02) 8888-CARE &bull; regulatory-compliance@careplus.ph
                                </div>
                            </td>
                            <td style={{ verticalAlign: 'top', textAlign: 'right', paddingBottom: '12px', width: '35%' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #cbd5e1' }}>
                                    <tbody>
                                        <tr style={{ backgroundColor: '#f8fafc' }}>
                                            <td style={{ padding: '4px 8px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>Document Ref:</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1' }}>CP-EXEC-{Date.now().toString().slice(-6)}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '4px 8px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>Facility Scope:</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', color: '#0284c7' }}>{selectedBranch}</td>
                                        </tr>
                                        <tr style={{ backgroundColor: '#f8fafc' }}>
                                            <td style={{ padding: '4px 8px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>Generated On:</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #cbd5e1' }}>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '4px 8px', fontWeight: 'bold', color: '#475569' }}>Generated By:</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold' }}>{adminName}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 2. Executive Operational KPI Summary Table */}
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b', borderLeft: '4px solid #0284c7', paddingLeft: '8px', marginBottom: '6px' }}>
                        I. Enterprise Operational Volume &amp; Financial Performance
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #94a3b8' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>Operational Domain</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1', width: '22%' }}>Network Total</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1', width: '30%' }}>Operational Status Breakdown</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b', width: '18%' }}>System State</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#0f172a', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                    Unified Patient Registry
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#0369a1', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                    {dbData.users.filter(u => (u.role || '').toLowerCase() === 'patient').length} Active Patients
                                </td>
                                <td style={{ padding: '8px 10px', color: '#475569', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                    Centralized EHR across Metro &amp; Northside
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#15803d', borderBottom: '1px solid #e2e8f0' }}>
                                    Synchronized
                                </td>
                            </tr>
                            <tr style={{ backgroundColor: '#fafafa' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#0f172a', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                    Clinical Consultations &amp; Visits
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#15803d', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                    {filteredAppointments.length} Encounters
                                </td>
                                <td style={{ padding: '8px 10px', color: '#475569', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                    {filteredAppointments.filter(a => a.status === 'Completed').length} Completed &bull; {filteredAppointments.filter(a => a.status === 'Approved' || a.status === 'Pending').length} Pending/Active
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#15803d', borderBottom: '1px solid #e2e8f0' }}>
                                    On Schedule
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#0f172a', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                    Diagnostic Laboratory Workload
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#b45309', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                    {filteredLabs.length} Lab Orders
                                </td>
                                <td style={{ padding: '8px 10px', color: '#475569', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                    {filteredLabs.filter(l => l.status === 'Completed').length} Verified &bull; {filteredLabs.filter(l => l.status !== 'Completed').length} In-Process
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#0369a1', borderBottom: '1px solid #e2e8f0' }}>
                                    Calibrated
                                </td>
                            </tr>
                            <tr style={{ backgroundColor: '#fafafa' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>
                                    Reconciled Cashier Collections
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#7c3aed', borderRight: '1px solid #cbd5e1' }}>
                                    ₱{financialStats.totalPaid.toLocaleString()}
                                </td>
                                <td style={{ padding: '8px 10px', color: '#475569', borderRight: '1px solid #cbd5e1' }}>
                                    Gross Receivables: ₱{financialStats.totalBilled.toLocaleString()}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#15803d' }}>
                                    Reconciled
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 3. Facility Branch Breakdown Table */}
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b', borderLeft: '4px solid #0284c7', paddingLeft: '8px', marginBottom: '6px' }}>
                        II. Facility Branch Operational Status
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #94a3b8' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>Facility Name</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>Location &amp; Type</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>Medical Staff</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>Patient Visits</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>Diagnostic Orders</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b' }}>Operational Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {CLINIC_BRANCHES.map((branch, idx) => {
                                const bAppts = (dbData.appointments || []).filter(a => a.branch === branch.name || (branch.name.includes('Metro') && !a.branch));
                                const bLabs = (dbData.laboratory_requests || []).filter(l => l.branch === branch.name || (branch.name.includes('Metro') && !l.branch));
                                const bDocs = CLINIC_DOCTORS.filter(d => d.branch === branch.name || branch.name.includes(d.branch || ''));
                                return (
                                    <tr key={branch.id} style={{ backgroundColor: idx % 2 === 1 ? '#fafafa' : '#ffffff' }}>
                                        <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#0f172a', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                            {branch.name}
                                        </td>
                                        <td style={{ padding: '8px 10px', color: '#475569', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                            {branch.address} &bull; {branch.type}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                            {bDocs.length} Clinicians
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#0369a1', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                            {bAppts.length}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#b45309', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                            {bLabs.length}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#15803d', borderBottom: '1px solid #e2e8f0' }}>
                                            Normal Operations
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* 4. Active Patient Flow Queue Ledger Table */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b', borderLeft: '4px solid #0284c7', paddingLeft: '8px', marginBottom: '6px' }}>
                        III. Current Patient Consultation &amp; Service Ledger ({selectedBranch})
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '10.5px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #94a3b8' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1', width: '14%' }}>Schedule</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1', width: '24%' }}>Patient Name &amp; Contact</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1', width: '22%' }}>Attending Clinician</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1', width: '18%' }}>Service / Procedure</th>
                                <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b', width: '12%' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppointments.length > 0 ? (
                                filteredAppointments.slice(0, 12).map((app, idx) => (
                                    <tr key={app.id || idx} style={{ backgroundColor: idx % 2 === 1 ? '#fafafa' : '#ffffff' }}>
                                        <td style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                            <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{app.time || '09:00 AM'}</div>
                                            <div style={{ fontSize: '9.5px', color: '#64748b' }}>{app.date || 'Today'}</div>
                                        </td>
                                        <td style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                            <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{app.patientName || 'Patient'}</div>
                                            <div style={{ fontSize: '9.5px', color: '#64748b' }}>{app.patientEmail || app.contactNumber || 'Patient Record'}</div>
                                        </td>
                                        <td style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                            <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{app.doctor || 'Dr. Robert Chen, MD'}</div>
                                            <div style={{ fontSize: '9.5px', color: '#64748b' }}>{app.branch || 'Metro Branch'}</div>
                                        </td>
                                        <td style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0', color: '#334155' }}>
                                            {app.service || app.treatment || 'Consultation'}
                                        </td>
                                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', color: app.status === 'Completed' ? '#15803d' : '#b45309' }}>
                                            {app.status || 'Pending'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                                        No patient queue encounters recorded for this facility scope.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 5. Executive Governance & Dual Sign-off Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '24px', pageBreakInside: 'avoid' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '48%', verticalAlign: 'top', border: '1px solid #cbd5e1', padding: '12px 16px', backgroundColor: '#f8fafc' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                    Executive Operations Administration
                                </div>
                                <div style={{ marginTop: '28px', borderBottom: '1.5px solid #0f172a', width: '85%' }}></div>
                                <div style={{ marginTop: '6px', fontWeight: 'bold', fontSize: '12px', color: '#0f172a' }}>
                                    {adminName}
                                </div>
                                <div style={{ fontSize: '10px', color: '#475569' }}>
                                    Clinic Operations Administrator &bull; CarePlus Central
                                </div>
                                <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                                    Official Executive Operational Briefing Sign-off
                                </div>
                            </td>
                            <td style={{ width: '4%' }}></td>
                            <td style={{ width: '48%', verticalAlign: 'top', border: '1px solid #cbd5e1', padding: '12px 16px', backgroundColor: '#f8fafc' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                    Chief Medical Director Attestation
                                </div>
                                <div style={{ marginTop: '28px', borderBottom: '1.5px solid #0f172a', width: '85%' }}></div>
                                <div style={{ marginTop: '6px', fontWeight: 'bold', fontSize: '12px', color: '#0f172a' }}>
                                    Dr. Robert Chen, MD, FPCP
                                </div>
                                <div style={{ fontSize: '10px', color: '#475569' }}>
                                    Chief of Clinics &bull; Medical Director, PRC Lic. 0084920
                                </div>
                                <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                                    Clinical Governance &amp; Regulatory Concurrence
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Footer Notice */}
                <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '9px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                    CONFIDENTIAL CLINICAL BRIEFING &bull; ENTARC CAREPLUS MULTI-BRANCH ENTERPRISE HEALTH SYSTEM &bull; STRICTLY FOR ADMINISTRATIVE OVERSIGHT
                </div>
            </div>

            {/* Print Stylesheet for Admin Executive Brief */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-admin-brief, #printable-admin-brief * {
                        visibility: visible !important;
                    }
                    #printable-admin-brief {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        display: block !important;
                        margin: 0 !important;
                        padding: 10mm 15mm !important;
                        background: #ffffff !important;
                        color: #111827 !important;
                        box-sizing: border-box !important;
                    }
                    .navbar, .sidebar, .btn, .input-group, .btn-group, select, input {
                        display: none !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                }
            `}</style>
        </div>
    );
};

export default AdminDashboard;
