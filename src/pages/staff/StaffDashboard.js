import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    RiBuilding4Line, RiUserHeartLine, RiCalendarCheckLine,
    RiStethoscopeLine, RiFlaskLine, RiMoneyDollarCircleLine,
    RiSearchLine, RiCheckDoubleLine, RiTimeLine, RiUserAddLine,
    RiArrowRightLine, RiFileList3Line, RiHospitalLine, RiNurseLine
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
            const matchesSearch = !searchQuery ||
                (app.patientName && app.patientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (app.service && app.service.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (app.doctor && app.doctor.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesBranch && matchesSearch;
        });
    }, [dbData.appointments, selectedBranch, searchQuery]);

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
        addAuditLog(`Triage ${newStatus}`, `Staff updated appointment #${id} for ${appt.patientName} to ${newStatus}`);
        loadData();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Appointment marked as ${newStatus}`,
            showConfirmButton: false,
            timer: 2000
        });
    };

    return (
        <div className="p-3 p-md-4 w-100" style={{ maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header */}
            <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4 bg-white p-3 p-md-4 rounded-4 border shadow-sm">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge bg-primary bg-opacity-10 text-primary fw-semibold px-2 py-1 rounded-pill">
                            CarePlus Nurse & Triage Station
                        </span>
                        <span className="badge bg-info bg-opacity-10 text-info fw-semibold px-2 py-1 rounded-pill">
                            Active Shift
                        </span>
                    </div>
                    <h3 className="fw-bold mb-1 text-dark">Clinic Operations Dashboard</h3>
                    <p className="text-muted small mb-0">
                        Operational triage, patient flow management, and multi-department coordination.
                    </p>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                    <div className="d-flex align-items-center gap-2 bg-light border px-3 py-2 rounded-3">
                        <RiBuilding4Line className="text-primary fs-5" />
                        <span className="small text-muted fw-semibold">Branch Station:</span>
                        <select
                            className="form-select form-select-sm border-0 bg-transparent fw-bold text-dark py-0"
                            style={{ width: 'auto', cursor: 'pointer' }}
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
                        className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 py-2 rounded-3 shadow-sm"
                    >
                        <RiUserAddLine /> Intake Walk-In Patient
                    </button>
                </div>
            </div>

            {/* Shift KPIs */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-primary border-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Appointments Today</span>
                            <div className="p-2 rounded-3 bg-primary bg-opacity-10 text-primary">
                                <RiCalendarCheckLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark">{filteredAppointments.length}</h2>
                        <div className="text-muted small">
                            Pending Intake: <strong className="text-warning">{filteredAppointments.filter(a => a.status === 'Pending').length}</strong>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-success border-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Consultations</span>
                            <div className="p-2 rounded-3 bg-success bg-opacity-10 text-success">
                                <RiStethoscopeLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark">{activeConsultations.length}</h2>
                        <div className="text-muted small">
                            Completed Visits: <strong className="text-success">{activeConsultations.length}</strong>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-warning border-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Laboratory Requisitions</span>
                            <div className="p-2 rounded-3 bg-warning bg-opacity-10 text-warning">
                                <RiFlaskLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark">{activeLabs.length}</h2>
                        <div className="text-muted small">
                            Pending Tests: <strong className="text-warning">{activeLabs.filter(l => l.status === 'Processing').length}</strong>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-info border-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Billing Records</span>
                            <div className="p-2 rounded-3 bg-info bg-opacity-10 text-info">
                                <RiMoneyDollarCircleLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark">{dbData.billing_records.length}</h2>
                        <div className="text-muted small">
                            Settled Invoices: <strong className="text-info">{dbData.billing_records.filter(b => b.status === 'Paid').length}</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Clinic Action Shortcuts */}
            <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
                <h6 className="fw-bold text-dark mb-3 px-1 d-flex align-items-center gap-2">
                    <RiNurseLine className="text-primary" /> Daily Clinic Operations Station
                </h6>
                <div className="row g-2">
                    {[
                        { label: 'Register Patient', desc: 'Add new patient record', path: '/staff/registration', icon: <RiUserAddLine />, color: 'primary' },
                        { label: 'Appointment Scheduling', desc: 'Book or adjust timeslots', path: '/staff/book', icon: <RiCalendarCheckLine />, color: 'info' },
                        { label: 'Doctor Consultations', desc: 'Vitals & clinical notes', path: '/staff/consultations', icon: <RiStethoscopeLine />, color: 'success' },
                        { label: 'Diagnostic Laboratory', desc: 'Track lab tests & slips', path: '/staff/laboratory', icon: <RiFlaskLine />, color: 'warning' },
                        { label: 'Billing & Cashier', desc: 'Process payment & OR', path: '/staff/billing', icon: <RiMoneyDollarCircleLine />, color: 'danger' },
                        { label: 'Medical Reports', desc: 'View EHR & certificates', path: '/staff/medical-reports', icon: <RiFileList3Line />, color: 'dark' }
                    ].map((item, idx) => (
                        <div key={idx} className="col-12 col-sm-6 col-md-4 col-xl-2">
                            <div
                                onClick={() => navigate(item.path)}
                                className="p-3 border rounded-3 bg-light cursor-pointer transition-hover h-100 d-flex flex-column justify-content-between"
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <div className={`p-2 rounded-2 bg-${item.color} text-white`}>
                                        {item.icon}
                                    </div>
                                    <span className="fw-bold text-dark small text-truncate">{item.label}</span>
                                </div>
                                <div className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: '11px' }}>
                                    <span>{item.desc}</span>
                                    <RiArrowRightLine />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Patient Appointments & Triage Feed */}
            <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
                <div className="p-3 border-bottom d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
                    <div>
                        <h6 className="fw-bold text-dark mb-0">Clinic Inflow & Triage Queue</h6>
                        <span className="text-muted small">Managing patient arrivals at {selectedBranch}</span>
                    </div>
                    <div className="input-group input-group-sm" style={{ width: '240px' }}>
                        <span className="input-group-text bg-light border-0"><RiSearchLine /></span>
                        <input
                            type="text"
                            className="form-control bg-light border-0"
                            placeholder="Search patient / doctor..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light small text-muted">
                            <tr>
                                <th className="ps-3 py-3">Schedule</th>
                                <th className="py-3">Patient Name</th>
                                <th className="py-3">Branch & Physician</th>
                                <th className="py-3">Service / Request</th>
                                <th className="py-3">Status</th>
                                <th className="pe-3 py-3 text-end">Triage Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppointments.length > 0 ? (
                                filteredAppointments.map(app => (
                                    <tr key={app.id}>
                                        <td className="ps-3 py-3">
                                            <div className="fw-semibold text-dark">{app.date || 'Today'}</div>
                                            <div className="text-muted small d-flex align-items-center gap-1">
                                                <RiTimeLine size={12} className="text-primary" /> {app.time || '09:00 AM'}
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <div className="fw-bold text-dark">{app.patientName || app.fullName || 'Patient'}</div>
                                            <div className="text-muted small">{app.contactNumber || app.patientEmail || '-'}</div>
                                        </td>
                                        <td className="py-3">
                                            <span className={`badge rounded-pill px-2 py-1 mb-1 ${
                                                (app.branch || '').includes('Metro') ? 'bg-primary bg-opacity-10 text-primary' : 'bg-success bg-opacity-10 text-success'
                                            }`}>
                                                {app.branch || 'Metro Branch'}
                                            </span>
                                            <div className="text-dark small">{app.doctor || 'Dr. Robert Chen, MD'}</div>
                                        </td>
                                        <td className="py-3">
                                            <span className="badge bg-light text-secondary border">
                                                {app.service || app.treatment || 'General Checkup'}
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
                                                    onClick={() => handleTriageAction(app.id, 'Completed')}
                                                    className="btn btn-outline-success"
                                                    title="Mark Completed"
                                                >
                                                    <RiCheckDoubleLine /> Complete
                                                </button>
                                                <button
                                                    onClick={() => navigate('/staff/consultations')}
                                                    className="btn btn-outline-primary"
                                                    title="To Consultation"
                                                >
                                                    <RiStethoscopeLine />
                                                </button>
                                                <button
                                                    onClick={() => navigate('/staff/laboratory')}
                                                    className="btn btn-outline-warning"
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
                                        <RiCalendarCheckLine size={40} className="opacity-25 mb-2" />
                                        <p className="mb-0">No appointment records found for this branch.</p>
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