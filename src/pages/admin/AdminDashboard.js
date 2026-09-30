import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    RiBuilding4Line, RiUserHeartLine, RiCalendarCheckLine,
    RiStethoscopeLine, RiFlaskLine, RiMoneyDollarCircleLine,
    RiArrowRightLine, RiTimeLine, RiFilterLine, RiSearchLine,
    RiCheckDoubleLine, RiCloseCircleLine, RiInformationLine,
    RiShieldCheckLine, RiNodeTree, RiPrinterLine, RiAddCircleLine,
    RiUserAddLine, RiFileChartLine, RiHospitalLine
} from 'react-icons/ri';
import {
    readDatabase, writeDatabase, readSession,
    checkAndCompletePastAppointments
} from '../../utils/storage';
import { CLINIC_BRANCHES, CLINIC_DOCTORS } from '../../utils/careplusData';
import { sortAppointmentsBySchedule } from '../../utils/appointmentSort';
import { addAuditLog } from '../../services/auditLogger';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const session = readSession() || {};
    const [selectedBranch, setSelectedBranch] = useState('All Branches');
    const [searchQuery, setSearchQuery] = useState('');
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
            const matchesSearch = !searchQuery || 
                (app.patientName && app.patientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (app.service && app.service.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (app.doctor && app.doctor.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesBranch && matchesSearch;
        });
    }, [dbData.appointments, selectedBranch, searchQuery]);

    const filteredConsultations = useMemo(() => {
        return (dbData.consultations || []).filter(c => {
            if (selectedBranch === 'All Branches') return true;
            return c.branch === selectedBranch || 
                (selectedBranch.includes('Metro') && (!c.branch || c.branch.includes('Metro'))) ||
                (selectedBranch.includes('Northside') && c.branch && c.branch.includes('Northside'));
        });
    }, [dbData.consultations, selectedBranch]);

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

    // Financial KPIs
    const financialStats = useMemo(() => {
        let totalBilled = 0;
        let totalPaid = 0;
        let totalDiscounts = 0;
        filteredBilling.forEach(b => {
            totalBilled += Number(b.totalAmount || 0);
            totalPaid += Number(b.amountPaid || 0);
            totalDiscounts += Number(b.discount || 0);
        });
        return { totalBilled, totalPaid, totalDiscounts };
    }, [filteredBilling]);

    // Appointment status action
    const handleStatusUpdate = async (id, newStatus) => {
        const appt = (dbData.appointments || []).find(a => a.id === id);
        if (!appt) return;

        const res = await Swal.fire({
            title: `Mark as ${newStatus}?`,
            text: `Update appointment status for ${appt.patientName || 'patient'} to ${newStatus}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, update',
            confirmButtonColor: '#0284c7'
        });

        if (!res.isConfirmed) return;

        let db = readDatabase() || {};
        db.appointments = (db.appointments || []).map(a => {
            if (a.id === id) {
                return { ...a, status: newStatus };
            }
            return a;
        });

        writeDatabase(db);
        addAuditLog(`Appointment ${newStatus}`, `Patient ${appt.patientName} status updated to ${newStatus} at ${appt.branch || 'Clinic'}`);
        loadData();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Status updated to ${newStatus}`,
            showConfirmButton: false,
            timer: 2000
        });
    };

    return (
        <div className="p-3 p-md-4 w-100" style={{ maxWidth: '1600px', margin: '0 auto' }}>
            {/* Top Operational Header */}
            <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4 bg-white p-3 p-md-4 rounded-4 border shadow-sm">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge bg-primary bg-opacity-10 text-primary fw-semibold px-2 py-1 rounded-pill">
                            CarePlus Healthcare Network
                        </span>
                        <span className="badge bg-success bg-opacity-10 text-success fw-semibold px-2 py-1 rounded-pill">
                            Live Multi-Branch Sync
                        </span>
                    </div>
                    <h3 className="fw-bold mb-1 text-dark">Executive Clinical Overview</h3>
                    <p className="text-muted small mb-0">
                        Central command & real-time governance across Metro & Northside clinic branches.
                    </p>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                    {/* Facility Switcher */}
                    <div className="d-flex align-items-center gap-2 bg-light border px-3 py-2 rounded-3">
                        <RiBuilding4Line className="text-primary fs-5" />
                        <span className="small text-muted fw-semibold">View Facility:</span>
                        <select
                            className="form-select form-select-sm border-0 bg-transparent fw-bold text-dark py-0"
                            style={{ width: 'auto', cursor: 'pointer' }}
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        >
                            <option value="All Branches">CarePlus Network (All Branches)</option>
                            {CLINIC_BRANCHES.map(b => (
                                <option key={b.id} value={b.name}>{b.shortName}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => window.print()}
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 px-3 py-2 rounded-3"
                    >
                        <RiPrinterLine /> Print Summary
                    </button>
                    <button
                        onClick={() => navigate('/admin/ea-blueprint')}
                        className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 py-2 rounded-3 shadow-sm"
                    >
                        <RiNodeTree /> EA Deliverables
                    </button>
                </div>
            </div>

            {/* 4 Core KPI Stat Cards */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 transition-hover border-start border-primary border-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Registered Patients</span>
                            <div className="p-2 rounded-3 bg-primary bg-opacity-10 text-primary">
                                <RiUserHeartLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark">{dbData.users.filter(u => (u.role || '').toLowerCase() === 'patient').length}</h2>
                        <div className="d-flex align-items-center justify-content-between text-muted small">
                            <span>Active in Central EHR</span>
                            <span className="text-primary fw-semibold cursor-pointer" onClick={() => navigate('/admin/registration')}>
                                Add Patient &rarr;
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 transition-hover border-start border-info border-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Appointments & Triage</span>
                            <div className="p-2 rounded-3 bg-info bg-opacity-10 text-info">
                                <RiCalendarCheckLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark">{filteredAppointments.length}</h2>
                        <div className="d-flex align-items-center justify-content-between text-muted small">
                            <span>Pending: <strong className="text-warning">{filteredAppointments.filter(a => a.status === 'Pending').length}</strong></span>
                            <span className="text-info fw-semibold cursor-pointer" onClick={() => navigate('/admin/book')}>
                                Schedule &rarr;
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 transition-hover border-start border-warning border-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Diagnostic Lab Orders</span>
                            <div className="p-2 rounded-3 bg-warning bg-opacity-10 text-warning">
                                <RiFlaskLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark">{filteredLabs.length}</h2>
                        <div className="d-flex align-items-center justify-content-between text-muted small">
                            <span>Completed: <strong className="text-success">{filteredLabs.filter(l => l.status === 'Completed').length}</strong></span>
                            <span className="text-warning fw-semibold cursor-pointer" onClick={() => navigate('/admin/laboratory')}>
                                Lab Station &rarr;
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 transition-hover border-start border-success border-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Billing Collections</span>
                            <div className="p-2 rounded-3 bg-success bg-opacity-10 text-success">
                                <RiMoneyDollarCircleLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-success">₱{financialStats.totalPaid.toLocaleString()}</h2>
                        <div className="d-flex align-items-center justify-content-between text-muted small">
                            <span>Total Billed: ₱{financialStats.totalBilled.toLocaleString()}</span>
                            <span className="text-success fw-semibold cursor-pointer" onClick={() => navigate('/admin/billing')}>
                                Cashier &rarr;
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Feature Launchpad */}
            <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
                <div className="d-flex align-items-center justify-content-between mb-3 px-1">
                    <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                        <RiHospitalLine className="text-primary" /> Integrated Clinic Command Center
                    </h6>
                    <span className="text-muted small">Group 2 Enterprise Architecture Modules</span>
                </div>
                <div className="row g-2">
                    {[
                        { title: 'Patient Registration', desc: 'Walk-in & Digital Intake', icon: <RiUserAddLine />, path: '/admin/registration', color: 'primary' },
                        { title: 'Appointment Scheduling', desc: '2-Branch Calendar & Slots', icon: <RiCalendarCheckLine />, path: '/admin/book', color: 'info' },
                        { title: 'Doctor Consultations', desc: 'Vitals, Diagnosis & Rx', icon: <RiStethoscopeLine />, path: '/admin/consultations', color: 'success' },
                        { title: 'Laboratory Diagnostics', desc: 'Specimen, Tests & Results', icon: <RiFlaskLine />, path: '/admin/laboratory', color: 'warning' },
                        { title: 'Billing & Cashier', desc: 'Invoices, Discounts & OR', icon: <RiMoneyDollarCircleLine />, path: '/admin/billing', color: 'danger' },
                        { title: 'Medical Reports', desc: 'Cross-Branch Health BI', icon: <RiFileChartLine />, path: '/admin/medical-reports', color: 'dark' }
                    ].map((mod, idx) => (
                        <div key={idx} className="col-12 col-sm-6 col-md-4 col-xl-2">
                            <div
                                onClick={() => navigate(mod.path)}
                                className="p-3 rounded-3 border bg-light h-100 cursor-pointer transition-hover d-flex flex-column justify-content-between"
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <div className={`p-2 rounded-2 bg-${mod.color} text-white`}>
                                        {mod.icon}
                                    </div>
                                    <span className="fw-bold text-dark small text-truncate">{mod.title}</span>
                                </div>
                                <div className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: '11px' }}>
                                    <span>{mod.desc}</span>
                                    <RiArrowRightLine />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Operational Feeds Row: Patient Queue + Diagnostics Feed */}
            <div className="row g-4">
                {/* Left: Active Appointments & Triage Table */}
                <div className="col-12 col-xl-8">
                    <div className="card border-0 shadow-sm rounded-4 bg-white h-100 overflow-hidden">
                        <div className="p-3 border-bottom d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
                            <div>
                                <h6 className="fw-bold text-dark mb-0">Active Appointment & Consultation Queue</h6>
                                <span className="text-muted small">Managing visits across {selectedBranch}</span>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <div className="input-group input-group-sm" style={{ width: '220px' }}>
                                    <span className="input-group-text bg-light border-0"><RiSearchLine /></span>
                                    <input
                                        type="text"
                                        className="form-control bg-light border-0"
                                        placeholder="Search patient/doc..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light small text-muted">
                                    <tr>
                                        <th className="ps-3 py-3">Schedule</th>
                                        <th className="py-3">Patient</th>
                                        <th className="py-3">Branch & Physician</th>
                                        <th className="py-3">Service</th>
                                        <th className="py-3">Status</th>
                                        <th className="pe-3 py-3 text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAppointments.length > 0 ? (
                                        filteredAppointments.slice(0, 8).map(app => (
                                            <tr key={app.id}>
                                                <td className="ps-3 py-3">
                                                    <div className="fw-semibold text-dark">{app.date || 'Today'}</div>
                                                    <div className="text-muted small d-flex align-items-center gap-1">
                                                        <RiTimeLine size={12} className="text-primary" /> {app.time || '09:00 AM'}
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <div className="fw-bold text-dark">{app.patientName || app.fullName || 'Patient'}</div>
                                                    <div className="text-muted small text-truncate" style={{ maxWidth: '160px' }}>
                                                        {app.patientEmail || app.contactNumber || 'No record'}
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <span className={`badge rounded-pill px-2 py-1 mb-1 ${
                                                        (app.branch || '').includes('Metro') ? 'bg-primary bg-opacity-10 text-primary' : 'bg-success bg-opacity-10 text-success'
                                                    }`}>
                                                        {app.branch || 'Metro Branch'}
                                                    </span>
                                                    <div className="text-dark small fw-medium">{app.doctor || 'Dr. Robert Chen, MD'}</div>
                                                </td>
                                                <td className="py-3">
                                                    <span className="badge bg-light text-secondary border">
                                                        {app.service || app.treatment || 'Consultation'}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <span className={`badge rounded-pill px-2 py-1 ${
                                                        app.status === 'Completed' ? 'bg-success text-white' :
                                                        app.status === 'Approved' ? 'bg-info text-white' :
                                                        app.status === 'Cancelled' ? 'bg-danger text-white' :
                                                        'bg-warning text-dark'
                                                    }`}>
                                                        {app.status || 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="pe-3 py-3 text-end">
                                                    <div className="btn-group btn-group-sm">
                                                        <button
                                                            onClick={() => handleStatusUpdate(app.id, 'Completed')}
                                                            className="btn btn-outline-success"
                                                            title="Mark as Completed"
                                                        >
                                                            <RiCheckDoubleLine /> Complete
                                                        </button>
                                                        <button
                                                            onClick={() => navigate('/admin/consultations')}
                                                            className="btn btn-outline-primary"
                                                            title="Launch Consultation Record"
                                                        >
                                                            <RiStethoscopeLine />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="text-center py-5 text-muted">
                                                <RiCalendarCheckLine size={40} className="opacity-25 mb-2" />
                                                <p className="mb-0">No active appointments found matching current filter.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-2 border-top bg-light text-center">
                            <button
                                onClick={() => navigate('/admin/book')}
                                className="btn btn-link btn-sm text-decoration-none text-primary fw-semibold"
                            >
                                View Complete Appointment Scheduling Master &rarr;
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Laboratory Feed & Clinical Doctors Roster */}
                <div className="col-12 col-xl-4 d-flex flex-column gap-4">
                    {/* Recent Lab Diagnostics */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-3">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                <RiFlaskLine className="text-warning" /> Diagnostic Lab Monitor
                            </h6>
                            <span className="badge bg-warning bg-opacity-10 text-warning rounded-pill">
                                {filteredLabs.length} Orders
                            </span>
                        </div>
                        <div className="d-flex flex-column gap-2">
                            {filteredLabs.slice(0, 4).map(lab => (
                                <div key={lab.id} className="p-2 border rounded-3 bg-light d-flex align-items-center justify-content-between">
                                    <div className="overflow-hidden me-2">
                                        <div className="fw-bold text-dark text-truncate small">{lab.testName}</div>
                                        <div className="text-muted" style={{ fontSize: '11px' }}>
                                            {lab.patientName} &bull; {lab.branch}
                                        </div>
                                    </div>
                                    <span className={`badge rounded-pill ${
                                        lab.status === 'Completed' ? 'bg-success bg-opacity-10 text-success' : 'bg-warning bg-opacity-10 text-warning'
                                    }`} style={{ fontSize: '10px' }}>
                                        {lab.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => navigate('/admin/laboratory')}
                            className="btn btn-outline-warning btn-sm mt-3 w-100 rounded-3"
                        >
                            Open Laboratory Results Portal
                        </button>
                    </div>

                    {/* Attending Physicians & Branches */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-3">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                <RiStethoscopeLine className="text-success" /> CarePlus Medical Staff
                            </h6>
                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill">
                                {CLINIC_DOCTORS.length} Doctors
                            </span>
                        </div>
                        <div className="d-flex flex-column gap-2">
                            {CLINIC_DOCTORS.map(doc => (
                                <div key={doc.id} className="p-2 rounded-3 border bg-light d-flex align-items-center gap-2">
                                    <div className="p-2 rounded-circle bg-primary bg-opacity-10 text-primary fw-bold" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        MD
                                    </div>
                                    <div className="flex-grow-1 overflow-hidden">
                                        <div className="fw-bold text-dark text-truncate small">{doc.name}</div>
                                        <div className="text-muted" style={{ fontSize: '11px' }}>
                                            {doc.specialty} &bull; {doc.branch}
                                        </div>
                                    </div>
                                    <span className="badge bg-light text-secondary border" style={{ fontSize: '10px' }}>
                                        {doc.schedule}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
