import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    RiUserHeartLine, 
    RiHistoryLine, 
    RiFlashlightLine, 
    RiCheckboxCircleLine,
    RiCalendarCheckLine,
    RiInformationLine,
    RiTimeLine
} from 'react-icons/ri';
import { 
    readDatabase, 
    writeDatabase, 
    readSession, 
    checkAndCompletePastAppointments 
} from '../../utils/storage';
import { sortAppointmentsBySchedule } from '../../utils/appointmentSort';
import { addAppointmentNotification } from '../../utils/notificationStore';
import { addAuditLog } from '../../services/auditLogger';
import { sendAppointmentStatusEmail } from '../../utils/emailService';
import { bracesColorHex } from '../patient/BookAppointment';

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

const AdminDashboard = () => {
    const navigate = useNavigate();
    
    // Exact colors from your UI
    const colors = { gold: '#D8B03B', goldDark: '#B48A18', beige: '#F8F7F2', textDark: '#333' };
    
    const [userName, setUserName] = useState("justin");
    const [stats, setStats] = useState({ totalPatients: 0, appointmentsToday: 0 });
    const [pendingAppointments, setPendingAppointments] = useState([]);
    const [currentSession, setCurrentSession] = useState({});

    // Role verification: admin and superadmin only
    const sessionRole = (currentSession.role || '').toLowerCase().replace(/\s+/g, '');
    const isSuperAdmin = (currentSession.email || '').toLowerCase().includes('superadmin') || sessionRole === 'superadmin' || sessionRole === 'super_admin';
    const isAdmin = sessionRole === 'admin';
    const isAdminOrSuperAdmin = isSuperAdmin || isAdmin || (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'));

    const loadData = useCallback(() => {
        let db = readDatabase() || { users: [], appointments: [] };
        
        // Auto-complete past appointments and normalize Approved to Pending
        const { db: updatedDb, updated } = checkAndCompletePastAppointments(db);
        if (updated) {
            db = updatedDb;
            writeDatabase(db);
        }

        // Calculate Stats
        const patientCount = (db.users || []).filter(u => u.role === 'Patient' || u.role === 'patient').length;
        setStats(prev => ({ ...prev, totalPatients: patientCount }));

        // Load all Pending appointments (including Approved which fall under Pending)
        const rawPending = (db.appointments || [])
            .filter(app => app && app.status !== 'Deleted' && (app.status === 'Pending' || app.status === 'Approved'))
            .map(app => ({
                ...app,
                status: 'Pending',
                contactNumber: getPatientContact(app, db)
            }));

        const sorted = sortAppointmentsBySchedule(rawPending);
        setPendingAppointments(sorted);
    }, []);

    useEffect(() => {
        const session = readSession() || {};
        setCurrentSession(session);
        setUserName(session.fullName || session.email?.split('@')[0] || "Admin");
        loadData();

        const handleUpdate = () => loadData();
        window.addEventListener('storage', handleUpdate);
        window.addEventListener('doc_dental_db_updated', handleUpdate);
        window.addEventListener('notificationUpdated', handleUpdate);

        // Fallback interval for background sync
        const interval = setInterval(loadData, 30000);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleUpdate);
            window.removeEventListener('doc_dental_db_updated', handleUpdate);
            window.removeEventListener('notificationUpdated', handleUpdate);
        };
    }, [navigate, loadData]);

    const filteredPending = pendingAppointments;

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
        <>
            {/* PRINT CSS */}
            <style>
                {`
                    @media print {
                        body * { visibility: hidden; }
                        #printable-dashboard, #printable-dashboard * { visibility: visible; }
                        #printable-dashboard {
                            position: absolute; left: 0; top: 0; width: 100%;
                            background-color: white !important; padding: 0 !important;
                        }
                        .no-print { display: none !important; }
                        .print-only { display: block !important; }
                        .card { box-shadow: none !important; border: 1px solid #ddd !important; }
                    }
                `}
            </style>

            <div id="printable-dashboard" className="p-4 p-md-5 w-100" style={{ backgroundColor: colors.beige, minHeight: '100vh' }}>
                
                {/* PRINT-ONLY HEADER */}
                <div className="print-only d-none mb-4 text-center pb-3 border-bottom border-dark">
                    <h2 className="fw-bold mb-0" style={{ color: colors.goldDark }}>Doc Dental Clinic</h2>
                    <p className="text-muted mb-1">Official Administrative Report</p>
                    <p className="text-muted small mb-0">Generated on: {new Date().toLocaleDateString()} | By: {userName}</p>
                </div>

                {/* Page Header */}
                <div className="mb-4">
                    <h2 className="fw-bold mb-1" style={{ color: colors.goldDark }}>Dashboard</h2>
                    <p className="text-muted no-print">Welcome back, {userName}.</p>
                </div>

                {/* Top Summary Cards Row */}
                <div className="row g-4 mb-4">
                    
                    {/* 1. Total Patients Card */}
                    <div className="col-md-4">
                        <div className="card border-0 shadow-sm p-4 h-100 d-flex flex-row align-items-center gap-3" style={{ borderRadius: '16px' }}>
                            <div className="rounded-3 p-3 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#FDF7E7', color: colors.gold, width: '65px', height: '65px' }}>
                                <RiUserHeartLine className="fs-2" />
                            </div>
                            <div>
                                <h6 className="mb-1 text-muted small fw-medium">Total Patients</h6>
                                <h3 className="fw-bold mb-0 text-dark">{stats.totalPatients}</h3>
                            </div>
                        </div>
                    </div>

                    {/* 2. Generate Report Card - NAVIGATES TO REPORTS PAGE */}
                    <div className="col-md-4 no-print">
                        <div 
                            className="card border-0 shadow-sm p-4 h-100 d-flex flex-row align-items-center gap-3 transition-all" 
                            style={{ borderRadius: '16px', cursor: 'pointer' }}
                            onClick={() => navigate('/admin/reports')}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div className="rounded-3 p-3 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#EBF4FF', color: '#2563EB', width: '65px', height: '65px' }}>
                                <RiHistoryLine className="fs-2" />
                            </div>
                            <div>
                                <h6 className="mb-0 text-muted small fw-medium">Analytics</h6>
                                <h5 className="fw-bold mb-0 text-primary">Generate Report</h5>
                                <span className="text-muted" style={{ fontSize: '12px' }}>Daily, Weekly, Monthly, Yearly</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Quick Action Card */}
                    <div className="col-md-4 no-print">
                        <div 
                            className="card border-0 shadow-sm p-4 h-100 text-white d-flex flex-row align-items-center justify-content-between" 
                            style={{ borderRadius: '16px', backgroundColor: colors.gold, cursor: 'pointer' }}
                            onClick={() => navigate('/admin/book')} 
                        >
                            <div className="d-flex align-items-center gap-3">
                                <div className="rounded-3 p-3 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)', width: '65px', height: '65px' }}>
                                    <RiFlashlightLine className="fs-2" />
                                </div>
                                <div>
                                    <h6 className="mb-0 text-white-50 small fw-medium">Quick Action</h6>
                                    <h4 className="fw-bold mb-0 text-white">Appointment Approval</h4>
                                </div>
                            </div>
                            <RiCheckboxCircleLine className="fs-3 text-white" />
                        </div>
                    </div>

                </div>

                {/* Pending Appointments Section - Visible in Admin and Superadmin Only */}
                {isAdminOrSuperAdmin && (
                    <div className="card border-0 shadow-sm overflow-hidden mb-4 no-print animate__animated animate__fadeIn" style={{ borderRadius: '18px', backgroundColor: '#fffdf8', border: '1px solid #e2d8c8' }}>
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
                                                        className="doc-btn doc-btn-warning doc-btn-sm"
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
                                                    <div className="d-flex justify-content-end gap-2 flex-wrap align-items-center">
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
                                                    No pending appointments found.
                                                </h5>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
};

export default AdminDashboard;

