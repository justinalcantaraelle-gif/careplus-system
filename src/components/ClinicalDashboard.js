import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { 
    RiUserHeartLine, RiFlashlightLine, RiTimeLine, 
    RiCheckboxCircleLine, RiHistoryLine, RiSearchLine, RiCloseLine,
    RiCalendarCheckLine, RiInformationLine
} from 'react-icons/ri';
import { 
    readDatabase, 
    writeDatabase, 
    readSession, 
    checkAndCompletePastAppointments 
} from '../utils/storage';
import { sortAppointmentsBySchedule } from '../utils/appointmentSort';
import { addAppointmentNotification } from '../utils/notificationStore';
import { addAuditLog } from '../services/auditLogger';
import { sendAppointmentStatusEmail } from '../utils/emailService';
import { bracesColorHex } from '../pages/patient/BookAppointment';

const getPatientContact = (appointment = {}, db = {}) => {
    const email = String(appointment.patientEmail || '').toLowerCase();
    const matchingUser = (db.users || []).find(user => String(user.email || '').toLowerCase() === email) || {};
    const matchingRecord = db.medical_records?.[email] || db.medical_records?.[appointment.patientEmail] || {};

    return appointment.contactNumber ||
        appointment.contactNo ||
        appointment.phone ||
        appointment.contact ||
        matchingRecord.contactNumber ||
        matchingRecord.contactNo ||
        matchingRecord.phone ||
        matchingRecord.contact ||
        matchingUser.contactNumber ||
        matchingUser.contactNo ||
        matchingUser.phone ||
        matchingUser.contact ||
        '';
};

const ClinicalDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ totalPatients: 0, appointmentsToday: 0 });
    const [activities, setActivities] = useState([]);
    const [pendingAppointments, setPendingAppointments] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const session = readSession() || {};
    const isStaff = session?.role === 'Staff' || session?.role === 'staff';
    const colors = { gold: '#D4AF37', goldDark: '#B8860B', beige: '#F5F5DC' };

    const loadDashboard = useCallback(() => {
        let db = readDatabase() || { users: [], appointments: [] };
        
        // Auto-complete past appointments and normalize Approved to Pending
        const { db: updatedDb, updated } = checkAndCompletePastAppointments(db);
        if (updated) {
            db = updatedDb;
            writeDatabase(db);
        }

        const today = new Date().toISOString().split('T')[0];
        const patientCount = (db.users || []).filter(u => u.role === 'Patient' || u.role === 'patient').length;

        let todaysAppts = 0;
        if (isStaff) {
            todaysAppts = (db.appointments || []).filter(a => a.date === today && a.status !== 'Cancelled').length;

            // Load pending appointments for staff side
            const rawPending = (db.appointments || [])
                .filter(app => app && app.status !== 'Deleted' && (app.status === 'Pending' || app.status === 'Approved'))
                .map(app => ({
                    ...app,
                    status: 'Pending',
                    contactNumber: getPatientContact(app, db)
                }));
            setPendingAppointments(sortAppointmentsBySchedule(rawPending));
        } else {
            todaysAppts = (db.appointments || []).filter(a =>
                a.date === today &&
                (a.patientEmail || '').toLowerCase() === (session.email || '').toLowerCase() &&
                a.status !== 'Cancelled'
            ).length;
        }

        setStats({ totalPatients: patientCount, appointmentsToday: todaysAppts });

        const allAppts = sortAppointmentsBySchedule(db.appointments || []);
        if (isStaff) {
            setActivities(allAppts);
        } else {
            setActivities(allAppts.filter(a => (a.patientEmail || '').toLowerCase() === (session.email || '').toLowerCase()));
        }
    }, [isStaff, session.email]);

    useEffect(() => {
        if (!session.email) {
            navigate('/login');
            return;
        }

        loadDashboard();

        const handleUpdate = () => loadDashboard();
        window.addEventListener('storage', handleUpdate);
        window.addEventListener('doc_dental_db_updated', handleUpdate);
        window.addEventListener('notificationUpdated', handleUpdate);

        const interval = setInterval(loadDashboard, 30000);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleUpdate);
            window.removeEventListener('doc_dental_db_updated', handleUpdate);
            window.removeEventListener('notificationUpdated', handleUpdate);
        };
    }, [loadDashboard, session.email, navigate]);

    const filteredActivities = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return activities.filter((item) => {
            if (!query) return true;

            const name = String(item.patientName || item.fullName || item.name || '').toLowerCase();
            const service = String(item.treatment || item.service || '').toLowerCase();
            const date = String(item.date || '').toLowerCase();
            const status = String(item.status || '').toLowerCase();

            return name.includes(query) ||
                service.includes(query) ||
                date.includes(query) ||
                status.includes(query);
        });
    }, [activities, searchTerm]);

    const filteredPending = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return pendingAppointments;

        return pendingAppointments.filter(app => {
            const patient = String(app.patientName || app.fullName || '').toLowerCase();
            const service = String(app.service || app.treatment || '').toLowerCase();
            const date = String(app.date || '').toLowerCase();
            const time = String(app.time || '').toLowerCase();
            const contact = String(app.contactNumber || app.phone || app.patientEmail || '').toLowerCase();
            const notes = String(app.notes || app.reason || '').toLowerCase();

            return patient.includes(query) ||
                service.includes(query) ||
                date.includes(query) ||
                time.includes(query) ||
                contact.includes(query) ||
                notes.includes(query);
        });
    }, [pendingAppointments, searchTerm]);

    const handleViewDetails = (app) => {
        Swal.fire({
            title: 'Appointment Details',
            html: `
                <div class="text-start" style="font-size: 13.5px; line-height: 1.6;">
                    <div class="p-3 mb-3 rounded-3" style="background-color: #fffdf8; border: 1px solid #e2d8c8;">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge rounded-pill" style="background-color: #f5f5dc; color: #1f1b18; font-size: 12px; padding: 5px 12px;">
                                ${app.status || 'Pending'}
                            </span>
                            <span class="text-muted small">${app.date || 'No Date'} at ${app.time || 'TBA'}</span>
                        </div>
                        <h6 class="fw-bold mb-1" style="color: ${colors.goldDark};">${app.service || app.treatment || 'General Consultation'}</h6>
                        ${app.category ? `<div class="small text-muted mb-1">Category: ${app.category}</div>` : ''}
                        ${(app.braceColor || app.color || app.bracesColor) ? `<div class="small mt-1"><span class="badge bg-light text-dark border">Braces Color: <strong>${app.braceColor || app.color || app.bracesColor}</strong></span></div>` : ''}
                    </div>

                    <div class="mb-3">
                        <strong class="d-block text-dark small mb-1">Patient Contact Info:</strong>
                        <div class="p-2 px-3 rounded-2 bg-light border small text-secondary">
                            <div><strong>Name:</strong> ${app.patientName || app.fullName || 'N/A'}</div>
                            <div><strong>Email:</strong> ${app.patientEmail || app.email || 'N/A'}</div>
                            <div><strong>Phone:</strong> ${app.contactNumber || app.phone || 'N/A'}</div>
                        </div>
                    </div>

                    ${app.notes ? `
                    <div class="mb-3">
                        <strong class="d-block text-dark small mb-1">Patient Booking Remarks:</strong>
                        <div class="p-2 px-3 rounded-2 bg-light border small text-muted fst-italic">
                            "${app.notes}"
                        </div>
                    </div>
                    ` : ''}
                </div>
            `,
            confirmButtonColor: colors.goldDark,
            confirmButtonText: 'Close'
        });
    };

    const handleStatusUpdate = async (id, newStatus) => {
        let db = readDatabase() || { appointments: [], users: [] };
        const allAppts = db.appointments || [];
        const currentAppt = allAppts.find(a => a.id === id);
        if (!currentAppt) return;

        const patientName = currentAppt.patientName || currentAppt.fullName || 'Patient';
        const formattedDate = currentAppt.date ? new Date(currentAppt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'requested date';

        if (newStatus === 'Completed') {
            const confirmRes = await Swal.fire({
                title: 'Mark as Completed?',
                text: `Are you sure you want to mark the appointment for ${patientName} on ${formattedDate} as Completed?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: colors.goldDark,
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, Mark Completed'
            });
            if (!confirmRes.isConfirmed) return;
        }

        let banApplied = false;
        let banDaysVal = null;
        let bannedUntilDateStr = null;

        if (newStatus === "Didn't Come") {
            const confirmRes = await Swal.fire({
                title: "Mark as Didn't Come?",
                text: `Mark appointment for ${patientName} on ${formattedDate} as missed (Didn't Come)?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc3545',
                cancelButtonColor: '#6c757d',
                confirmButtonText: "Yes, Mark Didn't Come"
            });
            if (!confirmRes.isConfirmed) return;

            const patientEmail = (currentAppt.patientEmail || currentAppt.email || '').trim().toLowerCase();
            if (patientEmail) {
                const missedCount = allAppts
                    .map(a => a.id === id ? { ...a, status: "Didn't Come" } : a)
                    .filter(a => (a.patientEmail?.trim().toLowerCase() === patientEmail || a.email?.trim().toLowerCase() === patientEmail) && a.status === "Didn't Come").length;

                if (missedCount >= 3) {
                    const { value: banDays } = await Swal.fire({
                        title: `Restrict Booking for ${patientName}`,
                        text: 'This patient has 3 consecutive missed visits. Enter the number of days to temporarily ban this patient from booking:',
                        input: 'number',
                        inputAttributes: { min: 1, step: 1 },
                        inputValue: 7,
                        showCancelButton: true,
                        confirmButtonColor: colors.goldDark,
                        cancelButtonColor: '#6c757d',
                        confirmButtonText: 'Restrict Patient',
                        cancelButtonText: 'Skip Restriction',
                        preConfirm: (value) => {
                            if (!value || parseInt(value, 10) <= 0) {
                                Swal.showValidationMessage('Please enter a valid number of days.');
                            }
                            return value;
                        }
                    });

                    if (banDays) {
                        banApplied = true;
                        banDaysVal = banDays;
                        const dateLimit = new Date();
                        dateLimit.setDate(dateLimit.getDate() + parseInt(banDays, 10));
                        bannedUntilDateStr = dateLimit.toISOString();

                        db.users = (db.users || []).map(u => {
                            if (u.email?.trim().toLowerCase() === patientEmail.trim().toLowerCase()) {
                                return { ...u, bannedUntil: bannedUntilDateStr };
                            }
                            return u;
                        });
                    }
                }
            }
        }

        let currentApptUpdated = null;
        db.appointments = allAppts.map(app => {
            if (app.id === id) {
                const updated = { ...app, status: newStatus };
                delete updated.unfinished;
                delete updated.unfinishedReason;
                currentApptUpdated = updated;
                return updated;
            }
            return app;
        });

        if (currentApptUpdated) {
            let message = '';
            if (newStatus === 'Completed') {
                message = `Your appointment for ${currentApptUpdated.service || 'General Checkup'} on ${formattedDate} is marked as Completed. Thank you!`;
            } else if (newStatus === "Didn't Come") {
                message = `Your appointment on ${formattedDate} was marked as missed (Didn't Come).`;
            }

            if (message) {
                db = addAppointmentNotification(db, {
                    id: Date.now().toString(),
                    patientEmail: currentApptUpdated.patientEmail,
                    message: message,
                    type: newStatus,
                    isRead: false,
                    timestamp: new Date().toISOString()
                });
            }

            const patientEmail = currentApptUpdated.patientEmail || currentApptUpdated.email;
            if (patientEmail && patientEmail.includes('@')) {
                sendAppointmentStatusEmail(patientEmail, patientName, {
                    status: newStatus,
                    date: formattedDate,
                    time: currentApptUpdated.time,
                    service: currentApptUpdated.service || currentApptUpdated.category,
                }).catch(err => console.error('Appointment status email error:', err));
            }

            const service = currentApptUpdated.service || currentApptUpdated.category || 'appointment';
            addAuditLog(`Appointment ${newStatus}`, `${patientName} - ${service} on ${currentApptUpdated.date || 'unspecified date'}.`);
            if (banApplied) {
                addAuditLog('Patient Banned', `${patientName} was restricted from booking for ${banDaysVal} days due to 3 consecutive missed appointments.`);
            }
        }

        writeDatabase(db);
        loadDashboard();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Appointment marked as ${newStatus}`,
            showConfirmButton: false,
            timer: 2000
        });
    };

    const renderBadge = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'approved') return <span className="badge rounded-pill px-3 py-2 badge-status-approved">Approved</span>;
        if (s === 'completed' || s === 'done') return <span className="badge rounded-pill px-3 py-2 badge-status-completed">Completed</span>;
        if (s === 'cancelled' || s === 'declined') return <span className="badge rounded-pill px-3 py-2 badge-status-cancelled">Cancelled</span>;
        return <span className="badge rounded-pill px-3 py-2 badge-status-pending">Pending</span>;
    };

    return (
        <div className="animate__animated animate__fadeIn p-2 p-md-3">
            <header className="mb-4">
                <h3 className="fw-bold mb-1" style={{ color: colors.goldDark }}>Dashboard</h3>
                <p className="text-muted">Welcome back, <strong>{session?.fullName || session?.name || 'User'}</strong>.</p>
            </header>

            <div className="row g-3 g-md-4 mb-4">

                {isStaff && (
                    <div className="col-12 col-sm-6 col-md-4">
                        <div className="card border-0 shadow-sm h-100 p-3 card-hover-lift" style={{ borderRadius: '16px' }}>
                            <div className="d-flex align-items-center">
                                <div className="p-3 rounded-3 me-3" style={{ backgroundColor: colors.beige, color: colors.goldDark }}>
                                    <RiUserHeartLine size={28} />
                                </div>
                                <div>
                                    <h6 className="text-muted mb-0 small text-uppercase fw-bold">Total Patients</h6>
                                    <h3 className="fw-bold mb-0 text-dark">{stats.totalPatients}</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isStaff && (
                    <div className="col-12 col-sm-6 col-md-4">
                        <div
                            className="card border-0 shadow-sm h-100 p-3 card-hover-lift"
                            style={{ borderRadius: '16px', cursor: 'pointer' }}
                            onClick={() => navigate('/staff/reports')}
                        >
                            <div className="d-flex align-items-center">
                                <div className="p-3 rounded-3 me-3" style={{ backgroundColor: '#EBF4FF', color: '#2563EB' }}>
                                    <RiHistoryLine size={28} />
                                </div>
                                <div>
                                    <h6 className="text-muted mb-0 small text-uppercase fw-bold">Analytics</h6>
                                    <h5 className="fw-bold mb-0 text-primary">Generate Report</h5>
                                    <div className="text-muted small" style={{ fontSize: '11px' }}>
                                        Daily, Weekly, Monthly, Yearly
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="col-12 col-sm-6 col-md-4">
                    <div className="card border-0 shadow-sm h-100 p-3 text-white card-hover-lift"
                        style={{ borderRadius: '16px', background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`, cursor: 'pointer' }}
                        onClick={() => navigate(`/${(session?.role || 'patient').toLowerCase()}/book`)}>
                        <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center">
                                <div className="p-3 rounded-3 me-3 bg-white bg-opacity-25">
                                    <RiFlashlightLine size={28} />
                                </div>
                                <div>
                                    <h6 className="mb-0 small text-white-50 text-uppercase fw-bold">Quick Action</h6>
                                    <h5 className="fw-bold mb-0">{isStaff ? 'Appointment Approval' : 'Book Appointment'}</h5>
                                </div>
                            </div>
                            <RiCheckboxCircleLine size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Pending Appointments Section (Staff view) */}
            {isStaff && (
                <div className="card border-0 shadow-sm overflow-hidden mb-4 animate__animated animate__fadeIn" style={{ borderRadius: '18px', backgroundColor: '#fffdf8', border: '1px solid #e2d8c8' }}>
                    {/* Header Bar */}
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 p-4 border-bottom" style={{ borderColor: '#f0eae0' }}>
                        <div>
                            <div className="d-flex align-items-center gap-2">
                                <h5 className="fw-bold mb-0" style={{ color: '#1f1b18' }}>
                                    Pending appointments
                                </h5>
                                <span className="badge rounded-pill text-white shadow-sm" style={{ backgroundColor: colors.goldDark, fontSize: '11px', padding: '4px 10px' }}>
                                    {filteredPending.length}
                                </span>
                            </div>
                            <p className="text-muted small mb-0 mt-1">Schedule and manage upcoming patient visits awaiting clinical consultation or action.</p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0" style={{ backgroundColor: 'transparent' }}>
                            <thead style={{ backgroundColor: '#faf7ef' }}>
                                <tr>
                                    <th scope="col" className="py-3 px-4 text-muted small fw-bold">Date</th>
                                    <th scope="col" className="py-3 text-muted small fw-bold">Patient</th>
                                    <th scope="col" className="py-3 text-muted small fw-bold">Service</th>
                                    <th scope="col" className="py-3 text-muted small fw-bold">Contact</th>
                                    <th scope="col" className="py-3 text-muted small fw-bold">Status</th>
                                    <th scope="col" className="py-3 text-muted small fw-bold">Reason</th>
                                    <th scope="col" className="py-3 pe-4 text-muted small fw-bold text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPending.length > 0 ? (
                                    filteredPending.map(app => (
                                        <tr key={app.id}>
                                            <td className="py-3 px-4">
                                                <div className="fw-bold text-dark">{app.date || 'N/A'}</div>
                                                <div className="small text-muted d-flex align-items-center gap-1">
                                                    <RiTimeLine size={12} className="text-warning" />
                                                    {app.time || 'TBA'}
                                                </div>
                                            </td>
                                            <td className="py-3 fw-semibold text-dark">
                                                {app.patientName || app.fullName || 'Unknown Patient'}
                                            </td>
                                            <td className="py-3 small text-dark">
                                                <div className="fw-semibold">{app.service || app.treatment || 'General Checkup'}</div>
                                                {(app.braceColor || app.color || app.bracesColor) && (
                                                    <span className="badge rounded-pill border text-dark d-inline-flex align-items-center gap-1 mt-1 shadow-sm px-2 py-1" style={{ backgroundColor: '#fffdf5', fontSize: '10.5px' }}>
                                                        <span className="rounded-circle border" style={{ width: '10px', height: '10px', display: 'inline-block', backgroundColor: bracesColorHex[app.braceColor || app.color || app.bracesColor] || '#d4af37' }}></span>
                                                        <span>Color: <strong>{app.braceColor || app.color || app.bracesColor}</strong></span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 small">
                                                <div className="fw-semibold text-dark">{app.contactNumber || 'N/A'}</div>
                                                <div className="text-muted">{app.patientEmail || app.email || 'No Email'}</div>
                                            </td>
                                            <td className="py-3">
                                                <button 
                                                    className="doc-btn doc-btn-neutral doc-btn-sm"
                                                    onClick={() => handleViewDetails(app)}
                                                    title="Click to view full details"
                                                >
                                                    Pending <RiInformationLine className="ms-1"/>
                                                </button>
                                            </td>
                                            <td className="py-3 small" style={{ maxWidth: '200px' }}>
                                                <span className="text-muted text-truncate d-inline-block w-100" title={app.notes || app.reason || '-'}>
                                                    {app.notes || app.reason || '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 pe-4 text-end">
                                                <div className="doc-btn-toolbar justify-content-end">
                                                    <button 
                                                        className="doc-btn doc-btn-warning doc-btn-sm"
                                                        onClick={() => handleStatusUpdate(app.id, 'Completed')}
                                                    >
                                                        Mark Completed
                                                    </button>
                                                    <button 
                                                        className="doc-btn doc-btn-danger doc-btn-sm"
                                                        onClick={() => handleStatusUpdate(app.id, "Didn't Come")}
                                                    >
                                                        Didn't Come
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5">
                                            <div className="text-muted opacity-50 mb-3">
                                                <RiCalendarCheckLine size={50} />
                                            </div>
                                            <h5 className="text-muted fw-normal">
                                                {searchTerm ? `No pending appointments match your search.` : 'No pending appointments found.'}
                                            </h5>
                                            {searchTerm && (
                                                <button className="doc-btn doc-btn-neutral doc-btn-sm mt-2" onClick={() => setSearchTerm('')}>
                                                    Clear Search
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Main Activities Table (Patient view only) */}
            {!isStaff && (
                <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                    <div className="card-header bg-white py-3 border-0 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
                        <div>
                            <h5 className="fw-bold mb-0" style={{ color: colors.goldDark }}>
                                <RiHistoryLine className="me-2" />
                                My Recent Schedules
                            </h5>
                        </div>

                        {/* Search Input */}
                        <div className="input-group input-group-sm" style={{ minWidth: '220px', maxWidth: '300px' }}>
                            <span className="input-group-text bg-light border-0"><RiSearchLine className="text-muted" /></span>
                            <input
                                type="text"
                                className="form-control bg-light border-0 shadow-none"
                                placeholder="Search schedules..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button className="btn btn-light border-0" onClick={() => setSearchTerm('')} title="Clear Search">
                                    <RiCloseLine />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light text-muted small">
                                    <tr>
                                        <th className="px-4 py-3">Date &amp; Time</th>
                                        <th className="py-3">Procedure</th>
                                        <th className="py-3">Status</th>
                                        <th className="py-3">Notes / Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredActivities.length > 0 ? filteredActivities.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-3 fw-bold small text-nowrap">
                                                <RiTimeLine className="me-2 text-warning" />
                                                {item.date} <span className="text-muted fw-normal">|</span> {item.time}
                                            </td>
                                            <td className="text-muted small" style={{ minWidth: '150px' }}>{item.treatment || item.service || 'General Checkup'}</td>
                                            <td className="text-nowrap">
                                                {renderBadge(item.status)}
                                            </td>
                                            <td className="text-muted small" style={{ minWidth: '160px', maxWidth: '260px', whiteSpace: 'normal' }}>
                                                {item.status === 'Cancelled' ? (
                                                    <span className="text-danger">{item.declineReason || item.reason || item.cancellationReason || 'No reason provided'}</span>
                                                ) : (
                                                    item.notes || '-'
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="4" className="text-center py-5 text-muted small">
                                                <RiCalendarCheckLine size={38} className="text-muted opacity-50 mb-2" />
                                                <p className="mb-1 fw-medium">
                                                    {searchTerm ? `No schedules match "${searchTerm}".` : 'No recent schedule activity found.'}
                                                </p>
                                                {searchTerm && (
                                                    <button className="doc-btn doc-btn-neutral doc-btn-sm mt-1" onClick={() => setSearchTerm('')}>
                                                        Clear Search
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClinicalDashboard;

