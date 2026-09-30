import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    RiBuilding4Line, RiUserHeartLine, RiCalendarCheckLine,
    RiStethoscopeLine, RiFlaskLine, RiMoneyDollarCircleLine,
    RiSearchLine, RiCheckDoubleLine, RiTimeLine, RiUserAddLine,
    RiArrowRightLine, RiFileList3Line, RiHospitalLine, RiNurseLine,
    RiShieldCheckLine, RiCheckboxCircleLine
} from 'react-icons/ri';
import {
    readDatabase, writeDatabase, readSession,
    checkAndCompletePastAppointments
} from '../../utils/storage';
import { CLINIC_BRANCHES } from '../../utils/careplusData';
import { addAuditLog } from '../../services/auditLogger';

const StaffDashboard = () => {
    const navigate = useNavigate();
    const session = readSession() || {};
    const [selectedBranch, setSelectedBranch] = useState(session.branch || 'All Branches');
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

    const activeConsultations = useMemo(() => {
        return (dbData.consultations || []).filter(c => {
            if (selectedBranch === 'All Branches') return true;
            return c.branch === selectedBranch;
        });
    }, [dbData.consultations, selectedBranch]);

    const activeLabs = useMemo(() => {
        return (dbData.laboratory_requests || []).filter(l => {
            if (selectedBranch === 'All Branches') return true;
            return l.branch === selectedBranch;
        });
    }, [dbData.laboratory_requests, selectedBranch]);

    const handleTriageAction = async (id, newStatus) => {
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
        addAuditLog(`Triage ${newStatus}`, `Staff updated appointment for ${appt.patientName} to ${newStatus}`);
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

    const staffName = session.fullName || session.name || 'Healthcare Specialist';

    return (
        <div className="p-3 p-md-4 p-xl-5 w-100" style={{ maxWidth: '1600px', margin: '0 auto', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            {/* Tranquil Top Welcome Card */}
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white" style={{ border: '1px solid #e2e8f0' }}>
                <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="badge rounded-pill px-3 py-1 fw-medium" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
                                <RiShieldCheckLine className="me-1" /> Shift In Progress &bull; Flow Steady
                            </span>
                            <span className="badge rounded-pill px-3 py-1 fw-medium" style={{ backgroundColor: '#f0f9ff', color: '#0369a1' }}>
                                CarePlus Station
                            </span>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
                            Welcome, {staffName}
                        </h2>
                        <p className="text-secondary small mb-0" style={{ maxWidth: '650px', lineHeight: '1.6' }}>
                            Here is your calm clinical operations view. Triage queues, doctor visits, and laboratory requisitions are synchronized in real-time.
                        </p>
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <div className="d-flex align-items-center gap-2 bg-light px-3 py-2 rounded-3 border" style={{ borderColor: '#e2e8f0' }}>
                            <RiBuilding4Line className="text-primary" />
                            <span className="small text-muted">Station:</span>
                            <select
                                className="form-select form-select-sm border-0 bg-transparent fw-semibold text-dark py-0"
                                style={{ width: 'auto', cursor: 'pointer', outline: 'none', boxShadow: 'none' }}
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                            >
                                <option value="All Branches">CarePlus (All Facilities)</option>
                                {CLINIC_BRANCHES.map(b => (
                                    <option key={b.id} value={b.name}>{b.shortName}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => navigate('/staff/registration')}
                            className="btn btn-primary btn-sm px-3 py-2 rounded-3 d-flex align-items-center gap-2 shadow-sm"
                        >
                            <RiUserAddLine /> New Intake
                        </button>
                    </div>
                </div>
            </div>

            {/* Peaceful KPI Metric Cards */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 transition-hover" style={{ border: '1px solid #edf2f7' }}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-secondary small fw-medium">Scheduled Today</span>
                            <div className="p-2 rounded-circle" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                                <RiCalendarCheckLine size={20} />
                            </div>
                        </div>
                        <h3 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
                            {filteredAppointments.length}
                        </h3>
                        <div className="d-flex align-items-center justify-content-between text-muted small mt-2">
                            <span>Waiting: {filteredAppointments.filter(a => a.status === 'Pending').length}</span>
                            <span className="text-primary fw-medium cursor-pointer" onClick={() => navigate('/staff/book')}>
                                Queue &rarr;
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 transition-hover" style={{ border: '1px solid #edf2f7' }}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-secondary small fw-medium">Doctor Consultations</span>
                            <div className="p-2 rounded-circle" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                                <RiStethoscopeLine size={20} />
                            </div>
                        </div>
                        <h3 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
                            {activeConsultations.length}
                        </h3>
                        <div className="d-flex align-items-center justify-content-between text-muted small mt-2">
                            <span>All notes on record</span>
                            <span className="text-success fw-medium cursor-pointer" onClick={() => navigate('/staff/consultations')}>
                                Consult &rarr;
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 transition-hover" style={{ border: '1px solid #edf2f7' }}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-secondary small fw-medium">Laboratory Orders</span>
                            <div className="p-2 rounded-circle" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
                                <RiFlaskLine size={20} />
                            </div>
                        </div>
                        <h3 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
                            {activeLabs.length}
                        </h3>
                        <div className="d-flex align-items-center justify-content-between text-muted small mt-2">
                            <span>Processing smoothly</span>
                            <span className="text-warning fw-medium cursor-pointer" onClick={() => navigate('/staff/laboratory')}>
                                Lab &rarr;
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 transition-hover" style={{ border: '1px solid #edf2f7' }}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="text-secondary small fw-medium">Settled Receipts</span>
                            <div className="p-2 rounded-circle" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                                <RiMoneyDollarCircleLine size={20} />
                            </div>
                        </div>
                        <h3 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
                            {dbData.billing_records.filter(b => b.status === 'Paid').length}
                        </h3>
                        <div className="d-flex align-items-center justify-content-between text-muted small mt-2">
                            <span>Invoices up to date</span>
                            <span className="text-primary fw-medium cursor-pointer" onClick={() => navigate('/staff/billing')}>
                                Cashier &rarr;
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Action Navigation */}
            <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white" style={{ border: '1px solid #edf2f7' }}>
                <div className="d-flex align-items-center justify-content-between mb-2 px-2">
                    <span className="text-muted small fw-semibold text-uppercase" style={{ letterSpacing: '0.5px' }}>
                        Station Quick Links
                    </span>
                    <span className="text-muted small">CarePlus Clinical Hub</span>
                </div>
                <div className="row g-2">
                    {[
                        { label: 'Register Patient', path: '/staff/registration', icon: <RiUserAddLine />, bg: '#f0f9ff', color: '#0284c7' },
                        { label: 'Scheduling', path: '/staff/book', icon: <RiCalendarCheckLine />, bg: '#f0fdf4', color: '#16a34a' },
                        { label: 'Consultations', path: '/staff/consultations', icon: <RiStethoscopeLine />, bg: '#faf5ff', color: '#9333ea' },
                        { label: 'Diagnostic Lab', path: '/staff/laboratory', icon: <RiFlaskLine />, bg: '#fffbeb', color: '#d97706' },
                        { label: 'Cashier & OR', path: '/staff/billing', icon: <RiMoneyDollarCircleLine />, bg: '#fef2f2', color: '#dc2626' },
                        { label: 'Medical Reports', path: '/staff/medical-reports', icon: <RiFileList3Line />, bg: '#f8fafc', color: '#475569' }
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
                                <span className="small fw-semibold text-dark text-truncate">{item.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Inflow & Triage Queue */}
            <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden" style={{ border: '1px solid #edf2f7' }}>
                <div className="p-3 px-4 border-bottom d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                    <div>
                        <h6 className="fw-bold text-dark mb-0">Patient Inflow &amp; Triage Roster</h6>
                        <span className="text-muted small">Managing visits at {selectedBranch}</span>
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        {/* Filter Tabs */}
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

                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0" style={{ minWidth: '820px' }}>
                        <thead style={{ backgroundColor: '#f8fafc' }} className="small text-muted">
                            <tr>
                                <th className="ps-4 py-3 fw-medium" style={{ width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>Time &amp; Date</th>
                                <th className="py-3 fw-medium" style={{ minWidth: '160px' }}>Patient Name</th>
                                <th className="py-3 fw-medium" style={{ minWidth: '160px' }}>Facility &amp; Physician</th>
                                <th className="py-3 fw-medium" style={{ minWidth: '160px' }}>Service</th>
                                <th className="py-3 fw-medium" style={{ width: '120px', minWidth: '120px', whiteSpace: 'nowrap' }}>Status</th>
                                <th className="pe-4 py-3 text-end fw-medium" style={{ width: '170px', minWidth: '170px', whiteSpace: 'nowrap' }}>Triage Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppointments.length > 0 ? (
                                filteredAppointments.map(app => (
                                    <tr key={app.id}>
                                        <td className="ps-4 py-3" style={{ whiteSpace: 'nowrap' }}>
                                            <div className="fw-semibold text-dark">{app.time || '09:00 AM'}</div>
                                            <div className="text-muted small">{app.date || 'Today'}</div>
                                        </td>
                                        <td className="py-3">
                                            <div className="fw-bold text-dark text-truncate" style={{ maxWidth: '170px' }}>{app.patientName || 'Patient'}</div>
                                            <div className="text-muted small text-truncate" style={{ maxWidth: '170px' }}>{app.contactNumber || app.patientEmail || '-'}</div>
                                        </td>
                                        <td className="py-3" style={{ whiteSpace: 'nowrap' }}>
                                            <div className="text-dark small fw-medium">{app.branch || 'Metro Branch'}</div>
                                            <div className="text-muted small">{app.doctor || 'Dr. Robert Chen, MD'}</div>
                                        </td>
                                        <td className="py-3">
                                            <span
                                                className="badge px-2.5 py-1 rounded-pill fw-normal text-truncate d-inline-block"
                                                style={{
                                                    maxWidth: '180px',
                                                    backgroundColor: '#f1f5f9',
                                                    color: '#475569',
                                                    verticalAlign: 'middle'
                                                }}
                                                title={app.service || app.treatment || 'General Checkup'}
                                            >
                                                {app.service || app.treatment || 'General Checkup'}
                                            </span>
                                        </td>
                                        <td className="py-3" style={{ whiteSpace: 'nowrap' }}>
                                            <span
                                                className="badge rounded-pill px-3 py-1 fw-medium"
                                                style={{
                                                    backgroundColor: app.status === 'Completed' ? '#ecfdf5' : app.status === 'Approved' ? '#f0f9ff' : app.status === 'Cancelled' ? '#fef2f2' : '#fffbeb',
                                                    color: app.status === 'Completed' ? '#047857' : app.status === 'Approved' ? '#0369a1' : app.status === 'Cancelled' ? '#b91c1c' : '#b45309'
                                                }}
                                            >
                                                {app.status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="pe-4 py-3 text-end" style={{ whiteSpace: 'nowrap' }}>
                                            <div className="btn-group btn-group-sm">
                                                <button
                                                    onClick={() => handleTriageAction(app.id, 'Completed')}
                                                    className="btn btn-light border btn-sm text-success"
                                                    title="Mark Complete"
                                                >
                                                    <RiCheckDoubleLine /> Complete
                                                </button>
                                                <button
                                                    onClick={() => navigate('/staff/consultations')}
                                                    className="btn btn-light border btn-sm text-primary"
                                                    title="To Consultation"
                                                >
                                                    <RiStethoscopeLine />
                                                </button>
                                                <button
                                                    onClick={() => navigate('/staff/laboratory')}
                                                    className="btn btn-light border btn-sm text-warning"
                                                    title="To Laboratory"
                                                >
                                                    <RiFlaskLine />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="text-center py-5 text-muted">
                                        <p className="mb-0 small">No patient records found in current view.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StaffDashboard;