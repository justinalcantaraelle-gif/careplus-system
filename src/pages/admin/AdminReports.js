import { readDatabase } from '../../utils/storage';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    RiArrowLeftLine,
    RiCalendarLine,
    RiCalendarCheckLine,
    RiCalendarEventLine,
    RiCalendar2Line,
    RiCheckboxCircleLine,
    RiTimeLine,
    RiCloseCircleLine,
    RiListCheck,
    RiSearchLine,
    RiCloseLine
} from 'react-icons/ri';
import Swal from 'sweetalert2';
import { sortAppointmentsBySchedule } from '../../utils/appointmentSort';

const AdminReports = () => {
    const navigate = useNavigate();
    const colors = { gold: '#D8B03B', goldDark: '#B48A18', beige: '#F8F7F2' };

    const [timeframe, setTimeframe] = useState('Daily');
    const [allAppointments, setAllAppointments] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Load Data
    useEffect(() => {
        const loadData = () => {
            const db = readDatabase() || { appointments: [], users: [] };
            const appts = sortAppointmentsBySchedule(db.appointments || []);
            setAllAppointments(appts);
        };

        loadData();

        window.addEventListener('storage', loadData);
        window.addEventListener('doc_dental_db_updated', loadData);
        return () => {
            window.removeEventListener('storage', loadData);
            window.removeEventListener('doc_dental_db_updated', loadData);
        };
    }, []);

    // Filter Logic based on Timeframe Tabs (Using clean immutable date math)
    const filteredAppointments = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Compute start and end of current week (Sunday 00:00:00 to Saturday 23:59:59)
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
        const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek), 23, 59, 59, 999);

        const isThisWeek = (dateString) => {
            if (!dateString) return false;
            const [y, m, d] = dateString.split('-').map(Number);
            if (!y || !m || !d) return false;
            const date = new Date(y, m - 1, d, 12, 0, 0);
            return date >= startOfWeek && date <= endOfWeek;
        };

        if (timeframe === 'Daily') {
            return allAppointments.filter(a => a.date === currentTodayStr);
        } else if (timeframe === 'Weekly') {
            return allAppointments.filter(a => isThisWeek(a.date));
        } else if (timeframe === 'Monthly') {
            return allAppointments.filter(a => {
                if (!a.date) return false;
                const [y, m] = a.date.split('-').map(Number);
                return (m - 1) === currentMonth && y === currentYear;
            });
        } else if (timeframe === 'Yearly') {
            return allAppointments.filter(a => {
                if (!a.date) return false;
                const [y] = a.date.split('-').map(Number);
                return y === currentYear;
            });
        }
        return allAppointments;
    }, [timeframe, allAppointments]);

    // Calculate Summary Stats from filtered set
    const stats = useMemo(() => {
        return {
            total: filteredAppointments.length,
            approved: filteredAppointments.filter(a => a.status === 'Approved').length,
            completed: filteredAppointments.filter(a => a.status === 'Done' || a.status === 'Completed').length,
            pending: filteredAppointments.filter(a => a.status === 'Pending').length,
            cancelled: filteredAppointments.filter(a => a.status === 'Cancelled' || a.status === 'Declined').length,
        };
    }, [filteredAppointments]);

    // Status Badge Styling
    const renderStatusBadge = (status) => {
        if (status === 'Cancelled' || status === 'Declined') {
            return <span className="badge px-3 py-2 rounded-pill badge-status-cancelled">{status || 'Cancelled'}</span>;
        }
        if (status === 'Done' || status === 'Completed') {
            return <span className="badge px-3 py-2 rounded-pill badge-status-completed">Completed</span>;
        }
        if (status === 'Approved') {
            return <span className="badge px-3 py-2 rounded-pill badge-status-approved">Approved</span>;
        }
        return <span className="badge px-3 py-2 rounded-pill badge-status-pending">Pending</span>;
    };

    const searchedAppointments = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return filteredAppointments;

        return filteredAppointments.filter((appt) => {
            const patientName = String(appt.patientName || appt.fullName || appt.name || '').toLowerCase();
            const serviceName = String(appt.treatment || appt.service || '').toLowerCase();
            const email = String(appt.patientEmail || '').toLowerCase();
            const date = String(appt.date || '').toLowerCase();
            const status = String(appt.status || '').toLowerCase();

            return patientName.includes(query) ||
                serviceName.includes(query) ||
                email.includes(query) ||
                date.includes(query) ||
                status.includes(query);
        });
    }, [filteredAppointments, searchTerm]);

    const handleViewDetails = (appt) => {
        Swal.fire({
            title: appt.patientName || appt.fullName || 'Appointment Details',
            html: `
                <div class="text-start" style="font-size: 14px;">
                    <p class="mb-2"><strong>Procedure:</strong> ${appt.treatment || appt.service || 'General Checkup'}</p>
                    <p class="mb-2"><strong>Schedule Date:</strong> ${appt.date || 'N/A'}</p>
                    <p class="mb-2"><strong>Time Slot:</strong> ${appt.time || 'TBA'}</p>
                    <p class="mb-2"><strong>Patient Email:</strong> ${appt.patientEmail || 'N/A'}</p>
                    <p class="mb-2"><strong>Contact Number:</strong> ${appt.contact || appt.contactNumber || appt.phone || 'N/A'}</p>
                    <p class="mb-2"><strong>Status:</strong> <span class="badge ${appt.status === 'Approved' ? 'bg-success' : appt.status === 'Cancelled' ? 'bg-danger' : 'bg-warning text-dark'}">${appt.status || 'N/A'}</span></p>
                    ${appt.notes ? `<p class="mb-2"><strong>Clinical Notes:</strong><br/>${appt.notes}</p>` : ''}
                    ${appt.declineReason ? `<p class="mb-2 text-danger"><strong>Decline / Cancellation Reason:</strong><br/>${appt.declineReason}</p>` : ''}
                </div>
            `,
            confirmButtonColor: colors.gold
        });
    };

    return (
        <div className="p-3 p-md-4 p-lg-5 w-100 animate__animated animate__fadeIn" style={{ backgroundColor: colors.beige, minHeight: '100vh' }}>

            {/* Header */}
            <div className="d-flex align-items-center mb-4">
                <button
                    className="doc-btn doc-btn-neutral shadow-sm me-3"
                    style={{ width: '40px', height: '40px', padding: 0 }}
                    onClick={() => navigate('/admin')}
                    title="Back to Admin Dashboard"
                >
                    <RiArrowLeftLine size={20} />
                </button>
                <div>
                    <h3 className="fw-bold mb-0" style={{ color: colors.goldDark }}>
                        <RiListCheck className="me-2" />
                        Analytics & Reports
                    </h3>
                    <p className="text-muted mb-0 small">Overview of clinic appointments and patient flow</p>
                </div>
            </div>

            {/* Timeframe Tabs */}
            <div className="card border-0 shadow-sm mb-4 rounded-4 bg-white p-2">
                <div className="doc-btn-toolbar w-100 flex-wrap">
                    {['Daily', 'Weekly', 'Monthly', 'Yearly'].map((tab) => (
                        <button
                            key={tab}
                            className={`doc-btn flex-grow-1 justify-content-center ${timeframe === tab ? 'doc-btn-warning' : 'doc-btn-neutral'}`}
                            style={{ minHeight: '40px' }}
                            onClick={() => setTimeframe(tab)}
                        >
                            {tab === 'Daily' && <RiCalendarEventLine size={18} />}
                            {tab === 'Weekly' && <RiCalendarCheckLine size={18} />}
                            {tab === 'Monthly' && <RiCalendarLine size={18} />}
                            {tab === 'Yearly' && <RiCalendar2Line size={18} />}
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards Row */}
            <div className="row g-3 mb-4 text-center">
                <div className="col-6 col-md">
                    <div className="card border-0 shadow-sm h-100 py-3 px-2 rounded-4 card-hover-lift">
                        <p className="text-muted mb-1 small fw-bold">Total Appointments</p>
                        <h3 className="fw-bold mb-0 text-primary">{stats.total}</h3>
                    </div>
                </div>
                <div className="col-6 col-md">
                    <div className="card border-0 shadow-sm h-100 py-3 px-2 rounded-4 card-hover-lift">
                        <p className="text-muted mb-1 small fw-bold d-flex align-items-center justify-content-center gap-1">
                            <RiCheckboxCircleLine className="text-success" /> Approved
                        </p>
                        <h3 className="fw-bold mb-0 text-success">{stats.approved}</h3>
                    </div>
                </div>
                <div className="col-6 col-md">
                    <div className="card border-0 shadow-sm h-100 py-3 px-2 rounded-4 card-hover-lift">
                        <p className="text-muted mb-1 small fw-bold d-flex align-items-center justify-content-center gap-1">
                            <RiCheckboxCircleLine className="text-info" /> Completed
                        </p>
                        <h3 className="fw-bold mb-0 text-info">{stats.completed}</h3>
                    </div>
                </div>
                <div className="col-6 col-md">
                    <div className="card border-0 shadow-sm h-100 py-3 px-2 rounded-4 card-hover-lift">
                        <p className="text-muted mb-1 small fw-bold d-flex align-items-center justify-content-center gap-1">
                            <RiTimeLine className="text-warning" /> Pending
                        </p>
                        <h3 className="fw-bold mb-0 text-warning">{stats.pending}</h3>
                    </div>
                </div>
                <div className="col-12 col-md">
                    <div className="card border-0 shadow-sm h-100 py-3 px-2 rounded-4 card-hover-lift">
                        <p className="text-muted mb-1 small fw-bold d-flex align-items-center justify-content-center gap-1">
                            <RiCloseCircleLine className="text-danger" /> Cancelled
                        </p>
                        <h3 className="fw-bold mb-0 text-danger">{stats.cancelled}</h3>
                    </div>
                </div>
            </div>

            {/* Detailed Appointment Log Table */}
            <div className="card border-0 shadow-sm bg-white overflow-hidden rounded-4">
                <div className="p-4 border-bottom d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
                    <div>
                        <h5 className="fw-bold mb-0 text-dark" style={{ color: colors.goldDark }}>Detailed Appointment Log</h5>
                    </div>
                    <div className="input-group" style={{ maxWidth: '360px' }}>
                        <span className="input-group-text bg-light border-0"><RiSearchLine className="text-muted" /></span>
                        <input
                            type="text"
                            className="form-control bg-light border-0 shadow-none"
                            placeholder="Search by patient, procedure, date..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                className="btn btn-light border-0"
                                type="button"
                                onClick={() => setSearchTerm('')}
                                title="Clear Search"
                            >
                                <RiCloseLine />
                            </button>
                        )}
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                        <thead className="bg-light">
                            <tr>
                                <th className="p-3 fw-bold border-0 text-dark small">Patient Name</th>
                                <th className="fw-bold border-0 text-dark small">Service</th>
                                <th className="fw-bold border-0 text-dark small">Contact Info</th>
                                <th className="fw-bold border-0 text-dark small">Date &amp; Time</th>
                                <th className="fw-bold border-0 text-dark small">Status</th>
                                <th className="fw-bold border-0 text-dark small text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {searchedAppointments.length > 0 ? (
                                searchedAppointments.map((appt, index) => (
                                    <tr key={index}>
                                        <td className="p-3 text-dark fw-bold" style={{ fontSize: '14px' }}>
                                            {appt.patientName || appt.fullName || appt.name || 'Unknown Patient'}
                                        </td>
                                        <td className="text-dark small fw-medium">{appt.treatment || appt.service || 'General Consultation'}</td>
                                        <td className="text-muted small">
                                            <div>{appt.patientEmail || 'No Email'}</div>
                                            <div style={{ fontSize: '12px' }}>{appt.contact || appt.contactNumber || appt.phone || 'No Contact'}</div>
                                        </td>
                                        <td className="text-dark fw-bold small">
                                            <div>{appt.date}</div>
                                            <div className="text-muted fw-normal" style={{ fontSize: '12px' }}>{appt.time}</div>
                                        </td>
                                        <td>{renderStatusBadge(appt.status)}</td>
                                        <td className="text-center">
                                            <button
                                                className="doc-btn doc-btn-info doc-btn-sm"
                                                onClick={() => handleViewDetails(appt)}
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="text-center p-5 text-muted small">
                                        {searchTerm ? (
                                            <div>
                                                <p className="mb-2 fw-medium">No appointments match "{searchTerm}".</p>
                                                <button className="doc-btn doc-btn-neutral doc-btn-sm" onClick={() => setSearchTerm('')}>Clear Search</button>
                                            </div>
                                        ) : (
                                            `No appointments recorded for the ${timeframe.toLowerCase()} view.`
                                        )}
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

export default AdminReports;
