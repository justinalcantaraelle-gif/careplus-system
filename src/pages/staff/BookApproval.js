import { readDatabase, writeDatabase, getDatabase, checkAndCompletePastAppointments, readSession } from '../../utils/storage';
import { declareEmergencyClosure, sendEmergencyEmail, sendAppointmentStatusEmail } from '../../utils/emailService';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    RiRefreshLine,
    RiArrowLeftSLine,
    RiArrowRightSLine,
    RiCalendarCheckLine,
    RiCheckLine,
    RiCloseLine,
    RiInformationLine,
    RiLockLine,
    RiSearchLine,
    RiAlertLine
} from 'react-icons/ri';
import Swal from 'sweetalert2';
import { addAppointmentNotification, addUserNotification, normalizeNotificationStore } from '../../utils/notificationStore';
import { addAuditLog } from '../../services/auditLogger';
import { sortAppointmentsBySchedule } from '../../utils/appointmentSort';

const bracesColorHex = {
    Blue: '#1f4ed8', 'Sky Blue': '#4dabf7', Torquoise: '#40c3ff', Black: '#000000',
    'Light Green': '#90ee90', 'Mint Green': '#3eb489', Teal: '#008080', Green: '#008000',
    'Light Orange': '#ffb347', Orange: '#ff7750', White: '#ffffff', Transparent: '#eeeeee',
    Silver: '#c0c0c0', Brown: '#8b4513', Gold: '#d4af37', Yellow: '#ffff00',
    'Dark Violet': '#9400d3', 'Light Purple': '#d8bfd8', Violet: '#8a2be2', 'Light Pink': '#ffb6c1',
    Pink: '#ff69b4', Red: '#ff0000', 'Dark Red': '#8b0000', 'Pearl Blue': '#6a5acd',
    Gray: '#808080', Pearl: '#f5f5f5', Cream: '#fffdd0', Ruby: '#9b111e',
    'Dark Blue': '#00008b', 'Metallic Blue': '#4682b4', 'Dark Green': '#006400', 'Neon Orange': '#ff5f1f',
    'Red Orange': '#ff4500', 'Neon Pink': '#ff1493', Purple: '#800080', 'Neon Yellow': '#ffff33',
    'Metallic Green': '#3cb371', 'Baby Blue': '#89cff0', Nacarat: '#ff4f00', 'Pale Blue': '#a2cffe', Maroon: '#800000'
};

const toDateInputValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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

const BookApproval = () => {
    const [appointments, setAppointments] = useState([]);
    const [unavailableDates, setUnavailableDates] = useState([]);
    const [filter, setFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [showAvailabilityCalendar, setShowAvailabilityCalendar] = useState(false);
    const [availabilityMonth, setAvailabilityMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [weekStart, setWeekStart] = useState(() => {
        const today = new Date();
        const day = today.getDay() || 7;
        const monday = new Date(today);
        monday.setHours(0, 0, 0, 0);
        monday.setDate(today.getDate() - day + 1);
        return monday;
    });

    const theme = {
        beige: '#f8fafc',
        gold: '#0284c7',
        goldDark: '#0369a1',
        cardBg: '#ffffff'
    };

    const session = useMemo(() => readSession() || {}, []);
    const sessionRole = (session.role || '').toLowerCase().replace(/\s+/g, '');
    const isSuperAdmin = (session.email || '').toLowerCase().includes('superadmin') || sessionRole === 'superadmin' || sessionRole === 'super_admin';
    const isAdminOrSuperAdmin = isSuperAdmin || sessionRole === 'admin' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'));

    const hasPendingAction = useCallback((app) => {
        if (!app || !app.status) return false;
        const s = String(app.status).toLowerCase();
        // Finished appointments have no action
        if (s === 'completed' || s === 'cancelled' || s === 'declined' || s === "didn't come" || s === 'missed') {
            return false;
        }
        // Pending, Approved, or any active appointment still has pending actions
        return true;
    }, []);

    const loadAppointments = useCallback(() => {
        let db = readDatabase() || { appointments: [] };
        
        const { db: updatedDb, updated } = checkAndCompletePastAppointments(db);
        if (updated) {
            db = updatedDb;
            writeDatabase(db);
        }

        const allAppts = (db.appointments || [])
            .filter(app => app && app.status !== 'Deleted')
            .map(app => (app.status === 'Approved' ? { ...app, status: 'Pending' } : app));
        setUnavailableDates(Array.isArray(db.unavailableDates) ? db.unavailableDates : []);
        
        const sorted = sortAppointmentsBySchedule(allAppts).map(app => ({
            ...app,
            contactNumber: getPatientContact(app, db)
        }));
        setAppointments(sorted);
    }, []);

    const handleRefreshAppointments = () => {
        loadAppointments();
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Appointments refreshed',
            showConfirmButton: false,
            timer: 1400
        });
    };

    useEffect(() => {
        loadAppointments();

        const handleUpdate = () => loadAppointments();
        window.addEventListener('storage', handleUpdate);
        window.addEventListener('doc_dental_db_updated', handleUpdate);
        window.addEventListener('notificationUpdated', handleUpdate);

        // Fallback sync (real-time updates handled by events and broadcast channel)
        const interval = setInterval(loadAppointments, 30000);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleUpdate);
            window.removeEventListener('doc_dental_db_updated', handleUpdate);
            window.removeEventListener('notificationUpdated', handleUpdate);
        };
    }, [loadAppointments]);

    const formatDate = (dateValue, options = { month: 'short', day: 'numeric', year: 'numeric' }) => {
        if (!dateValue) return 'N/A';
        return new Date(dateValue).toLocaleDateString('en-US', options);
    };

    const moveWeek = (offset) => {
        setWeekStart(prev => {
            const next = new Date(prev);
            next.setDate(prev.getDate() + offset);
            return next;
        });
        setSelectedDate('');
    };

    const goToCurrentWeek = () => {
        const today = new Date();
        const day = today.getDay() || 7;
        const monday = new Date(today);
        monday.setHours(0, 0, 0, 0);
        monday.setDate(today.getDate() - day + 1);
        setWeekStart(monday);
        setSelectedDate(toDateInputValue(today));
    };

    const moveAvailabilityMonth = (offset) => {
        setAvailabilityMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const statusStyles = {
        Confirmed: { backgroundColor: '#dfeee2', color: '#1f7a3a' },
        Approved: { backgroundColor: '#dfeee2', color: '#1f1b18' },
        Completed: { backgroundColor: '#e6edf8', color: '#1f1b18' },
        Pending: { backgroundColor: theme.beige, color: '#1f1b18' },
        Cancelled: { backgroundColor: '#fde2e2', color: '#a52727' },
        "Didn't Come": { backgroundColor: '#fff3cd', color: '#856404' }
    };

    const unavailableDateMap = useMemo(() => {
        return unavailableDates.reduce((map, item) => {
            if (item?.date) map[item.date] = item.reason || 'Unavailable';
            return map;
        }, {});
    }, [unavailableDates]);

    const availabilityCalendarDays = useMemo(() => {
        const firstDay = new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth(), 1);
        const startDate = new Date(firstDay);
        startDate.setDate(firstDay.getDate() - firstDay.getDay());

        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + index);
            return {
                date,
                iso: toDateInputValue(date),
                isCurrentMonth: date.getMonth() === availabilityMonth.getMonth()
            };
        });
    }, [availabilityMonth]);

    const saveUnavailableDates = (nextUnavailableDates) => {
        const db = readDatabase() || {};
        db.unavailableDates = nextUnavailableDates;
        writeDatabase(db);
        setUnavailableDates(nextUnavailableDates);
    };

    const handleUnavailableDateToggle = (dateIso) => {
        const currentReason = unavailableDateMap[dateIso];

        if (currentReason && currentReason.startsWith('Emergency:')) {
            Swal.fire({
                title: 'Emergency Closure Locked',
                text: `This date (${formatDate(dateIso)}) was closed due to a clinic emergency: "${currentReason}". You cannot modify or re-open this date from here.`,
                icon: 'error',
                confirmButtonColor: theme.goldDark
            });
            return;
        }

        if (currentReason) {
            Swal.fire({
                title: 'Make Date Available?',
                text: `${formatDate(dateIso)} is currently unavailable: ${currentReason}`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Make Available',
                confirmButtonColor: theme.goldDark,
                cancelButtonColor: '#6c757d'
            }).then((result) => {
                if (result.isConfirmed) {
                    saveUnavailableDates(unavailableDates.filter(item => item.date !== dateIso));
                    addAuditLog('Made Date Available', `${formatDate(dateIso)} is available for appointments again.`);
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Date is available again',
                        showConfirmButton: false,
                        timer: 1400
                    });
                }
            });
            return;
        }

        Swal.fire({
            title: 'Disable This Date',
            input: 'textarea',
            inputLabel: `Reason for disabling ${formatDate(dateIso)}`,
            inputPlaceholder: 'e.g., Clinic closed, doctor unavailable, holiday...',
            inputAttributes: {
                'aria-label': 'Reason for disabling this date'
            },
            showCancelButton: true,
            confirmButtonText: 'Disable Date',
            confirmButtonColor: '#6c757d',
            cancelButtonColor: theme.goldDark,
            preConfirm: (reason) => {
                if (!reason?.trim()) {
                    Swal.showValidationMessage('Please provide a reason for disabling this date.');
                }
                return reason?.trim();
            }
        }).then((result) => {
            if (result.isConfirmed) {
                saveUnavailableDates([
                    ...unavailableDates.filter(item => item.date !== dateIso),
                    { date: dateIso, reason: result.value }
                ]);
                addAuditLog('Disabled Appointment Date', `${formatDate(dateIso)} was disabled. Reason: ${result.value}`);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Date disabled',
                    showConfirmButton: false,
                    timer: 1400
                });
            }
        });
    };

    const handleStatusUpdate = async (id, newStatus, reason = null) => {
        let db = normalizeNotificationStore(readDatabase() || { appointments: [], unavailableDates: [] });
        const allAppts = db.appointments || [];

        // Validate approval against emergency closures or unavailable dates
        if (newStatus === 'Approved') {
            const app = allAppts.find(a => a.id === id);
            if (app && app.date) {
                const isBlocked = (db.unavailableDates || []).some(item => item.date === app.date);
                if (isBlocked) {
                    const blockItem = db.unavailableDates.find(item => item.date === app.date);
                    Swal.fire({
                        title: 'Date Unavailable',
                        text: `Cannot approve appointment. This date (${app.date}) is currently closed: ${blockItem.reason || 'Unavailable'}`,
                        icon: 'error',
                        confirmButtonColor: theme.goldDark
                    });
                    return;
                }
            }
        }

        const currentAppt = allAppts.find(a => a.id === id);
        if (!currentAppt) return;

        let banApplied = false;
        let banDaysVal = null;
        let bannedUntilDateStr = null;

        if (newStatus === "Didn't Come") {
            const patientEmail = (currentAppt.patientEmail || currentAppt.email || '').trim().toLowerCase();
            const patientName = currentAppt.patientName || currentAppt.fullName || 'Patient';
            
            if (patientEmail) {
                // Count total "Didn't Come" appointments for this patient
                const didntComeCount = allAppts
                    .map(a => a.id === id ? { ...a, status: "Didn't Come" } : a)
                    .filter(a => (a.patientEmail?.trim().toLowerCase() === patientEmail || a.email?.trim().toLowerCase() === patientEmail) && a.status === "Didn't Come").length;

                if (didntComeCount >= 3) {
                    const { value: banDays } = await Swal.fire({
                        title: `Restrict Booking for ${patientName}`,
                        text: 'Enter the number of days to temporarily ban this patient from booking:',
                        input: 'number',
                        inputAttributes: {
                            min: 1,
                            step: 1
                        },
                        inputValue: 7,
                        showCancelButton: true,
                        confirmButtonColor: theme.goldDark,
                        cancelButtonColor: '#6c757d',
                        confirmButtonText: 'Restrict Patient',
                        cancelButtonText: 'Cancel',
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
                        
                        // Find patient and update in db.users
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

        const updatedAppts = allAppts.map(app => {
            if (app.id === id) {
                const updatedApp = { ...app, status: newStatus };
                delete updatedApp.unfinished;
                delete updatedApp.unfinishedReason;
                if (reason && newStatus !== 'Pending') updatedApp.declineReason = reason;
                currentApptUpdated = updatedApp; 
                return updatedApp;
            }
            return app;
        });
        
        db.appointments = updatedAppts;

        // --- NOTIFICATION CREATION LOGIC ---
        if (currentApptUpdated) {
            const formattedDate = currentApptUpdated.date ? new Date(currentApptUpdated.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'your requested date';
            
            let message = '';
            if (newStatus === 'Approved') {
                message = `Your appointment for ${currentApptUpdated.service || 'General Checkup'} on ${formattedDate} has been Approved.`;
            } else if (newStatus === 'Cancelled') {
                message = `Your appointment on ${formattedDate} was Cancelled. Reason: ${reason || 'N/A'}`;
            } else if (newStatus === 'Completed') {
                message = `Your appointment on ${formattedDate} is marked as Completed. Thank you!`;
            } else if (newStatus === "Didn't Come") {
                message = `Your appointment on ${formattedDate} was marked as missed (Didn't Come).`;
            } else if (newStatus === 'Pending') {
                message = `Your appointment on ${formattedDate} is in Pending status.`;
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

            // Dispatch status email to patient
            const patientEmail = currentApptUpdated.patientEmail || currentApptUpdated.email;
            const patientName = currentApptUpdated.patientName || currentApptUpdated.fullName || 'Patient';
            if (patientEmail && patientEmail.includes('@')) {
                sendAppointmentStatusEmail(patientEmail, patientName, {
                    status: newStatus,
                    date: formattedDate,
                    time: currentApptUpdated.time,
                    service: currentApptUpdated.service || currentApptUpdated.category,
                    reason: reason
                }).catch(err => console.error('Appointment status email error:', err));
            }
        }

        writeDatabase(db);
        if (currentApptUpdated) {
            const patient = currentApptUpdated.patientName || currentApptUpdated.fullName || currentApptUpdated.patientEmail || 'Unknown patient';
            const service = currentApptUpdated.service || currentApptUpdated.category || 'appointment';
            const reasonText = reason ? ` Reason: ${reason}` : '';
            addAuditLog(`Appointment ${newStatus}`, `${patient} - ${service} on ${currentApptUpdated.date || 'unspecified date'}.${reasonText}`);
            if (banApplied) {
                addAuditLog('Patient Banned', `${patient} was restricted from booking for ${banDaysVal} days (until ${new Date(bannedUntilDateStr).toLocaleDateString()}) due to 3 consecutive missed appointments.`);
            }
        }
        
        loadAppointments();

        const icon = newStatus === 'Approved' ? 'success' : (newStatus === 'Cancelled' ? 'error' : 'info');
        Swal.fire({
            title: `Appointment ${newStatus}`,
            text: banApplied 
                ? `Appointment status updated. Patient has been restricted from booking for ${banDaysVal} days.`
                : `Appointment status updated to ${newStatus}.`,
            icon: icon,
            confirmButtonColor: theme.goldDark
        });
    };

    const handleViewDetails = (app) => {
        if (!app) return;
        
        addAuditLog('Viewed Appointment Details', `${app.patientName || app.fullName || app.patientEmail || 'Unknown patient'} - ${app.service || app.category || 'Appointment'}`);

        const isEmergency = Boolean(app.cancelledDueToEmergency) || 
            Boolean(app.emergencyReason) || 
            String(app.declineReason || '').toLowerCase().includes('emergency');
            
        const isPatientCancelled = app.cancelledBy === 'Patient' || 
            (!isEmergency && Boolean(app.cancelReason));

        let cancelBadgeTitle = 'Declined by Clinic Staff';
        if (isEmergency) {
            cancelBadgeTitle = 'Cancelled Due to Clinic Emergency Closure';
        } else if (isPatientCancelled) {
            cancelBadgeTitle = 'Cancelled by Patient';
        }

        const effectiveReason = app.emergencyReason || app.cancelReason || app.declineReason || 'No specific reason recorded';

        const escapeHtml = (unsafe) => {
            if (!unsafe) return '';
            return String(unsafe)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        Swal.fire({
            title: 'Appointment Details',
            html: `
                <div class="text-start" style="font-size: 13.5px; line-height: 1.6;">
                    <div class="p-3 mb-3 rounded-3" style="background-color: #fffdf8; border: 1px solid #e2d8c8;">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge rounded-pill" style="background-color: ${(statusStyles[app.status] || statusStyles.Pending).backgroundColor}; color: ${(statusStyles[app.status] || statusStyles.Pending).color}; font-size: 12px; padding: 5px 12px;">
                                ${escapeHtml(app.status)}
                            </span>
                            <span class="text-muted small">${escapeHtml(app.date || 'No Date')} at ${escapeHtml(app.time || 'TBA')}</span>
                        </div>
                        <h6 class="fw-bold mb-1" style="color: ${theme.goldDark};">${escapeHtml(app.service || app.treatment || 'General Consultation')}</h6>
                        ${app.category ? `<div class="small text-muted mb-1">Category: ${escapeHtml(app.category)}</div>` : ''}
                        ${(app.braceColor || app.color || app.bracesColor) ? `<div class="small mt-1"><span class="badge bg-light text-dark border">Braces Color: <strong>${escapeHtml(app.braceColor || app.color || app.bracesColor)}</strong></span></div>` : ''}
                    </div>

                    <div class="mb-3">
                        <strong class="d-block text-dark small mb-1">Patient Contact Info:</strong>
                        <div class="p-2 px-3 rounded-2 bg-light border small text-secondary">
                            <div><strong>Name:</strong> ${escapeHtml(app.patientName || app.fullName || 'N/A')}</div>
                            <div><strong>Email:</strong> ${escapeHtml(app.patientEmail || app.email || 'N/A')}</div>
                            <div><strong>Phone:</strong> ${escapeHtml(app.contactNumber || app.phone || app.contactNo || 'N/A')}</div>
                        </div>
                    </div>

                    ${app.notes ? `
                    <div class="mb-3">
                        <strong class="d-block text-dark small mb-1">Patient Booking Remarks:</strong>
                        <div class="p-2 px-3 rounded-2 bg-light border small text-muted fst-italic">
                            "${escapeHtml(app.notes)}"
                        </div>
                    </div>
                    ` : ''}

                    ${(app.status === 'Cancelled' || app.status === 'Declined') ? `
                    <div class="p-3 rounded-3" style="background-color: #fff5f5; border: 1.5px solid #fca5a5;">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <strong class="${isEmergency ? 'text-danger' : isPatientCancelled ? 'text-warning-emphasis' : 'text-danger'}">
                                ${isEmergency ? '🚨 Clinic Emergency Closure' : isPatientCancelled ? '👤 Cancelled by Patient' : '🏢 Declined by Clinic'}
                            </strong>
                        </div>
                        <div class="small text-dark mt-1">
                            <strong>Reason:</strong> <span class="fw-bold text-danger">${escapeHtml(effectiveReason)}</span>
                        </div>
                        ${app.cancelledAt ? `<div class="small text-muted mt-1" style="font-size: 11px;">Cancelled on: ${new Date(app.cancelledAt).toLocaleString()}</div>` : ''}
                    </div>
                    ` : ''}
                </div>
            `,
            confirmButtonColor: theme.goldDark,
            confirmButtonText: 'Close'
        });
    };

    const handleDecline = (id) => {
        Swal.fire({
            title: 'Decline Appointment',
            input: 'textarea',
            inputLabel: 'Reason for declining',
            inputPlaceholder: 'e.g., Doctor is unavailable, conflicting schedule...',
            inputAttributes: {
                'aria-label': 'Reason for declining'
            },
            showCancelButton: true,
            confirmButtonText: 'Decline Request',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            preConfirm: (reason) => {
                if (!reason) {
                    Swal.showValidationMessage('Please provide a reason for declining.');
                }
                return reason;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                handleStatusUpdate(id, 'Cancelled', result.value);
            }
        });
    };



    const declareClosure = async (dateIso, reason) => {
        Swal.fire({
            title: 'Declaring Emergency Closure...',
            text: 'Cancelling appointments and delivering notification emails to affected patients...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const targetDateStr = String(dateIso).trim();
        const formattedDate = new Date(targetDateStr.includes('T') ? targetDateStr : `${targetDateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        // 1. Attempt direct atomic server-side emergency closure & pooled email dispatch
        try {
            const serverRes = await declareEmergencyClosure(targetDateStr, reason);
            if (serverRes && serverRes.success) {
                // Refresh full database state from MySQL backend
                await getDatabase(true);
                loadAppointments();

                const isSuccess = (serverRes.emailsSent > 0) || (serverRes.totalAffected === 0);
                const hasFailed = serverRes.failedEmails && serverRes.failedEmails.length > 0;

                Swal.fire({
                    title: isSuccess ? 'Emergency Closure Declared' : 'Closure Declared (Email Warning)',
                    html: `
                        <div class="text-start">
                            <p class="mb-2"><strong>Clinic marked closed on:</strong> ${serverRes.formattedDate || formattedDate}</p>
                            <p class="mb-2"><strong>Emergency Reason:</strong> ${reason}</p>
                            <p class="mb-2"><strong>Appointments Cancelled:</strong> ${serverRes.cancelledCount}</p>
                            <p class="mb-0 ${serverRes.emailsSent > 0 ? 'text-success' : 'text-danger'} fw-bold">
                                <strong>Emergency Emails Delivered:</strong> ${serverRes.emailsSent} of ${serverRes.totalAffected || serverRes.cancelledCount}
                            </p>
                            ${hasFailed ? `
                                <div class="alert alert-warning mt-3 mb-0 p-2 small">
                                    <strong>Delivery Notice:</strong> ${serverRes.failedEmails.length} email(s) could not be reached. Affected: ${serverRes.failedEmails.map(f => f.email).join(', ')}
                                </div>
                            ` : ''}
                        </div>
                    `,
                    icon: isSuccess ? 'success' : 'warning',
                    confirmButtonColor: theme.goldDark
                });
                return;
            }
        } catch (serverErr) {
            console.warn('[Emergency Closure] Server route error, activating client fallback:', serverErr);
        }

        // 2. Fallback: Client-side execution if server endpoint is unreachable
        let db = normalizeNotificationStore(await getDatabase(true) || readDatabase() || { appointments: [], unavailableDates: [], users: [] });
        const allAppts = db.appointments || [];
        const currentUnavailable = Array.isArray(db.unavailableDates) ? db.unavailableDates : [];

        // 1. Add date to unavailable dates
        const updatedUnavailable = [
            ...currentUnavailable.filter(item => item.date !== targetDateStr),
            { date: targetDateStr, reason: `Emergency: ${reason}` }
        ];
        db.unavailableDates = updatedUnavailable;

        const emailPromises = [];
        let cancelledCount = 0;

        const updatedAppts = allAppts.map(app => {
            if (String(app.date || '').trim() === targetDateStr && app.status !== 'Cancelled') {
                cancelledCount++;
                
                // Resolve patient email
                let targetEmail = (app.patientEmail || app.patient_email || app.email || '').trim();
                if ((!targetEmail || !targetEmail.includes('@')) && db.users) {
                    const patientNameLower = (app.patientName || app.fullName || app.name || '').trim().toLowerCase();
                    const foundUser = db.users.find(u => {
                        const uName = (u.fullName || u.name || '').trim().toLowerCase();
                        return uName && uName === patientNameLower && u.email;
                    });
                    if (foundUser) targetEmail = foundUser.email.trim();
                }

                const patientName = app.patientName || app.fullName || 'Patient';
                const appTime = app.time || '';
                const appService = app.service || app.category || '';

                // Add in-app notification for patient
                const msg = `Clinic Emergency Closure on ${formattedDate}: ${reason}. Your appointment for ${appService || 'Dental Care'} was cancelled.`;
                db = addAppointmentNotification(db, {
                    id: (Date.now() + cancelledCount).toString(),
                    patientEmail: targetEmail || app.patientEmail, 
                    title: 'Appointment Cancelled Due to Emergency Closure',
                    message: msg,
                    type: 'Cancelled',
                    isRead: false,
                    timestamp: new Date().toISOString()
                });

                if (targetEmail) {
                    db = addUserNotification(db, targetEmail, {
                        id: (Date.now() + cancelledCount + 500).toString(),
                        title: 'Appointment Cancelled - Clinic Emergency Closure',
                        message: msg,
                        type: 'Cancelled',
                        read: false,
                        date: new Date().toISOString()
                    });
                }

                // Dispatch emergency email notification if email exists
                if (targetEmail && targetEmail.includes('@')) {
                    emailPromises.push(
                        sendEmergencyEmail(targetEmail, patientName, formattedDate, reason, appTime, appService)
                    );
                }

                return {
                    ...app,
                    status: 'Cancelled',
                    declineReason: `Emergency closure: ${reason}`,
                    cancelledDueToEmergency: true,
                    emergencyReason: reason,
                    emergencyClosureDate: targetDateStr,
                    needsReschedule: true
                };
            }
            return app;
        });

        db.appointments = updatedAppts;

        // Await all emergency email dispatches
        const emailResults = await Promise.all(emailPromises);
        const sentCount = emailResults.filter(r => r && r.success).length;

        // 3. Write db, log audit, refresh UI
        writeDatabase(db);
        addAuditLog(
            'Emergency Closure Declared', 
            `Clinic closed on ${formattedDate} due to: ${reason}. ${cancelledCount} appointments cancelled (${sentCount} emergency emails sent).`
        );
        loadAppointments();

        const isSuccess = emailPromises.length === 0 || sentCount > 0;

        Swal.fire({
            title: isSuccess ? 'Closure Declared Successfully' : 'Closure Declared (Email Warning)',
            html: `
                <div class="text-start">
                    <p class="mb-2"><strong>Clinic marked closed on:</strong> ${formattedDate}</p>
                    <p class="mb-2"><strong>Reason:</strong> ${reason}</p>
                    <p class="mb-2"><strong>Appointments Cancelled:</strong> ${cancelledCount}</p>
                    <p class="mb-0 ${sentCount > 0 ? 'text-success' : 'text-danger'} fw-bold">
                        <strong>Emergency Notification Emails Sent:</strong> ${sentCount} of ${emailPromises.length}
                    </p>
                    ${emailPromises.length > 0 && sentCount === 0 ? `
                        <div class="alert alert-warning mt-3 mb-0 p-2 small">
                            <strong>Note:</strong> Could not deliver email notifications over SMTPS. Please ensure the local backend API server (port 5000) is running and SMTP credentials in .env are valid.
                        </div>
                    ` : ''}
                </div>
            `,
            icon: isSuccess ? 'success' : 'warning',
            confirmButtonColor: theme.goldDark
        });
    };

    const handleEmergencyClosure = () => {
        const todayObj = new Date();
        const todayStr = toDateInputValue(todayObj);
        const formattedToday = todayObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

        Swal.fire({
            title: 'Declare Emergency Closure',
            html: `
                <div class="text-start">
                    <div class="alert alert-danger border border-danger-subtle p-3 mb-3" style="border-radius: 12px; background-color: #fdf2f2;">
                        <span class="badge bg-danger text-white mb-1">Closing Clinic For:</span>
                        <div class="fw-bold text-danger fs-6">${formattedToday}</div>
                    </div>
                    <p class="small text-muted mb-3">
                        This action will immediately disable bookings for today, cancel all today's appointments, and automatically dispatch emergency cancellation notifications & emails to affected patients.
                    </p>
                    <div class="mb-2">
                        <label for="closure-reason" class="form-label fw-bold small text-muted">Emergency Reason:</label>
                        <textarea id="closure-reason" class="form-control" rows="3" placeholder="e.g., Unforeseen electricity outage, clinic flooding, typhoon warning, staff medical emergency..." style="border-radius: 8px;"></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Declare Emergency Closure',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            focusConfirm: false,
            preConfirm: () => {
                const reason = document.getElementById('closure-reason')?.value?.trim();
                if (!reason) {
                    Swal.showValidationMessage('Please enter the emergency reason.');
                    return false;
                }
                return { date: todayStr, reason };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const { date, reason } = result.value;
                declareClosure(date, reason);
            }
        });
    };

    const filteredAppointments = useMemo(() => {
        return (appointments || []).filter(app => {
            const matchesStatus = filter === 'All' 
                ? true 
                : (filter === 'Pending' || filter === 'Approved' 
                    ? (app.status === 'Pending' || app.status === 'Approved') 
                    : app.status === filter);
            const matchesDate = !selectedDate || app.date === selectedDate;
            const query = searchTerm.toLowerCase().trim();
            if (!query) return matchesStatus && matchesDate;

            const fieldsToSearch = [
                app.patientName, app.fullName, app.name,
                app.patientEmail, app.email, app.service,
                app.category, app.contactNumber, app.phone, app.date, app.status
            ];
            const matchesSearch = fieldsToSearch.some(val => String(val || '').toLowerCase().includes(query));
            return matchesStatus && matchesDate && matchesSearch;
        });
    }, [appointments, filter, searchTerm, selectedDate]);
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, index) => {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + index);
            return {
                date,
                iso: toDateInputValue(date),
                dayName: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
                dayNumber: date.getDate()
            };
        });
    }, [weekStart]);
    const weekTitle = `Week of ${formatDate(weekDays[0]?.date, { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return (
        <div className="container-fluid py-4 animate__animated animate__fadeIn" style={{ minHeight: '100vh' }}>
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start mb-4 gap-3">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: '#1f1b18', fontSize: '2.5rem' }}>Appointments</h2>
                    <p className="text-muted mb-0">Schedule and manage upcoming patient visits.</p>
                </div>
                
                <div className="doc-btn-toolbar">
                    <button
                        type="button"
                        className="doc-btn doc-btn-danger"
                        onClick={handleEmergencyClosure}
                    >
                        <RiAlertLine /> Emergency Closure
                    </button>
                    <button
                        type="button"
                        className="doc-btn doc-btn-warning"
                        onClick={() => setShowAvailabilityCalendar(true)}
                    >
                        <RiLockLine /> Unavailable Dates
                    </button>
                    <button
                        type="button"
                        className="doc-btn doc-btn-refresh"
                        onClick={handleRefreshAppointments}
                        title="Refresh appointments"
                    >
                        <RiRefreshLine /> Refresh
                    </button>
                </div>
            </div>

            {showAvailabilityCalendar && (
                <div className="availability-modal-backdrop">
                    <section className="availability-modal bg-white shadow-lg border">
                        <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
                            <div>
                                <h4 className="fw-bold mb-1" style={{ color: '#1f1b18' }}>Unavailable Dates</h4>
                                <p className="text-muted mb-0">Select a date to disable booking and enter the reason.</p>
                            </div>
                            <button
                                type="button"
                                className="doc-btn doc-btn-neutral doc-btn-sm align-self-start"
                                onClick={() => setShowAvailabilityCalendar(false)}
                            >
                                Close
                            </button>
                        </div>

                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <button
                                className="doc-btn doc-btn-neutral p-0 d-flex align-items-center justify-content-center"
                                type="button"
                                style={{ width: '36px', height: '36px', borderRadius: '10px' }}
                                onClick={() => moveAvailabilityMonth(-1)}
                                title="Previous month"
                            >
                                <RiArrowLeftSLine size={18} />
                            </button>
                            <h5 className="fw-bold mb-0" style={{ color: '#1f1b18' }}>
                                {availabilityMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h5>
                            <button
                                className="doc-btn doc-btn-neutral p-0 d-flex align-items-center justify-content-center"
                                type="button"
                                style={{ width: '36px', height: '36px', borderRadius: '10px' }}
                                onClick={() => moveAvailabilityMonth(1)}
                                title="Next month"
                            >
                                <RiArrowRightSLine size={18} />
                            </button>
                        </div>

                        <div className="availability-calendar-grid mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="text-center text-muted small fw-bold">{day}</div>
                            ))}
                        </div>

                        <div className="availability-calendar-grid">
                            {availabilityCalendarDays.map(day => {
                                const reason = unavailableDateMap[day.iso];
                                const isUnavailable = Boolean(reason);
                                const today = new Date();
                                today.setHours(0,0,0,0);
                                const isPast = day.date < today;

                                return (
                                    <button
                                        key={day.iso}
                                        type="button"
                                        className="btn btn-sm text-start p-2"
                                        style={{
                                            minHeight: '78px',
                                            borderRadius: '10px',
                                            border: isUnavailable ? '1px solid #adb5bd' : '1px solid #e2d8c8',
                                            backgroundColor: isUnavailable ? '#e9ecef' : '#fffdf8',
                                            color: day.isCurrentMonth ? '#1f1b18' : '#9aa0a6',
                                            opacity: day.isCurrentMonth ? 1 : 0.45,
                                            ...(isPast && { backgroundColor: '#f0f0f0', cursor: 'not-allowed' })
                                        }}
                                        onClick={!isPast ? () => handleUnavailableDateToggle(day.iso) : undefined}
                                        title={reason || day.iso}
                                    >
                                        <div className="d-flex justify-content-between align-items-center">
                                            <span className="fw-bold">{day.date.getDate()}</span>
                                            {isUnavailable && <RiLockLine className="text-secondary" />}
                                        </div>
                                        {isUnavailable && (
                                            <div className="small text-muted text-truncate mt-2">
                                                {reason}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </div>
            )}

            <section className="card border shadow-sm mb-4" style={{ borderRadius: '18px', backgroundColor: theme.cardBg, borderColor: '#e2d8c8' }}>
                <div className="card-body p-4">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                        <h5 className="fw-bold mb-0" style={{ color: '#1f1b18' }}>{weekTitle}</h5>
                        <div className="d-flex align-items-center gap-2">
                            <button
                                className="doc-btn doc-btn-neutral p-0 d-flex align-items-center justify-content-center"
                                type="button"
                                style={{ width: '36px', height: '36px', borderRadius: '10px' }}
                                onClick={() => moveWeek(-7)}
                                title="Previous week"
                            >
                                <RiArrowLeftSLine size={18} />
                            </button>
                            <button
                                className="doc-btn doc-btn-neutral doc-btn-sm px-3"
                                type="button"
                                onClick={goToCurrentWeek}
                            >
                                Today
                            </button>
                            <button
                                className="doc-btn doc-btn-neutral p-0 d-flex align-items-center justify-content-center"
                                type="button"
                                style={{ width: '36px', height: '36px', borderRadius: '10px' }}
                                onClick={() => moveWeek(7)}
                                title="Next week"
                            >
                                <RiArrowRightSLine size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="weekly-calendar-grid">
                        {weekDays.map(day => {
                            const dayAppointments = appointments.filter(app => {
                                const matchesDate = app.date === day.iso;
                                const matchesStatus = filter === 'All' 
                                    ? true 
                                    : (filter === 'Pending' || filter === 'Approved' 
                                        ? (app.status === 'Pending' || app.status === 'Approved') 
                                        : app.status === filter);
                                return matchesDate && matchesStatus;
                            });
                            const isSelected = selectedDate === day.iso;
                            const todayIso = toDateInputValue(new Date());
                            const isToday = day.iso === todayIso;
                            const unavailableReason = unavailableDateMap[day.iso];
                            const isEmergency = unavailableReason && String(unavailableReason).toLowerCase().includes('emergency');

                            return (
                                <div
                                    key={day.iso}
                                    role="button"
                                    tabIndex="0"
                                    className={`calendar-day-card h-100 p-3 text-start d-flex flex-column position-relative ${
                                        isSelected ? 'selected' : ''
                                    } ${unavailableReason ? 'unavailable' : ''}`}
                                    style={{
                                        minHeight: '160px',
                                        borderRadius: '14px',
                                        backgroundColor: unavailableReason 
                                            ? (isEmergency ? '#fff5f5' : '#f8f9fa') 
                                            : isSelected 
                                                ? theme.beige 
                                                : '#fffdf8',
                                        border: isSelected 
                                            ? `2px solid ${theme.goldDark}` 
                                            : unavailableReason 
                                                ? (isEmergency ? '1px solid #fecaca' : '1px solid #e2e8f0') 
                                                : '1px solid #e2d8c8',
                                        boxShadow: isSelected 
                                            ? `0 4px 14px ${theme.goldDark}33` 
                                            : '0 2px 6px rgba(0,0,0,0.02)',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => setSelectedDate(prev => prev === day.iso ? '' : day.iso)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            setSelectedDate(prev => prev === day.iso ? '' : day.iso);
                                        }
                                    }}
                                >
                                    {/* Header: Day Name & Badges */}
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className={`small fw-bold text-uppercase ${isToday ? 'text-primary' : 'text-secondary'}`} style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                            {day.dayName}
                                            {isToday && <span className="ms-1 badge bg-primary-subtle text-primary rounded-pill px-1" style={{ fontSize: '8.5px' }}>TODAY</span>}
                                        </span>
                                        
                                        {unavailableReason ? (
                                            <span className={`badge rounded-pill ${isEmergency ? 'bg-danger text-white' : 'bg-secondary text-white'}`} style={{ fontSize: '10px' }}>
                                                <RiLockLine className="me-1" /> Closed
                                            </span>
                                        ) : dayAppointments.length > 0 ? (
                                            <span className="badge rounded-pill text-white shadow-sm" style={{ backgroundColor: theme.goldDark, fontSize: '10px' }}>
                                                {dayAppointments.length}
                                            </span>
                                        ) : null}
                                    </div>

                                    {/* Day Number */}
                                    <div className="fw-bold fs-4 mb-2 text-dark" style={{ lineHeight: 1 }}>
                                        {day.dayNumber}
                                    </div>

                                    {/* Appointments List */}
                                    <div className="d-flex flex-column gap-1 flex-grow-1">
                                        {dayAppointments.slice(0, 3).map(app => {
                                            const isAppCancelled = app.status === 'Cancelled';
                                            return (
                                                <div
                                                    key={app.id}
                                                    className="text-truncate px-2 py-1 d-flex align-items-center justify-content-between gap-1"
                                                    style={{
                                                        borderRadius: '6px',
                                                        backgroundColor: unavailableReason ? '#e2e8f0' : (isAppCancelled ? '#fde2e2' : theme.beige),
                                                        color: isAppCancelled ? '#a52727' : '#222',
                                                        fontSize: '11px',
                                                        textDecoration: isAppCancelled ? 'line-through' : 'none'
                                                    }}
                                                >
                                                    <span className="fw-bold text-truncate">{app.time || 'TBA'}</span>
                                                    <span className="text-truncate flex-grow-1">{app.patientName || app.fullName || 'Patient'}</span>
                                                </div>
                                            );
                                        })}
                                        {dayAppointments.length > 3 && (
                                            <div className="small text-muted fw-semibold" style={{ fontSize: '11px' }}>
                                                +{dayAppointments.length - 3} more
                                            </div>
                                        )}
                                    </div>

                                    {/* Emergency / Closure Reason Note */}
                                    {unavailableReason && (
                                        <div className="mt-2 pt-2 border-top border-secondary-subtle">
                                            <div 
                                                className={`small fw-semibold text-truncate d-flex align-items-center gap-1 ${isEmergency ? 'text-danger' : 'text-muted'}`} 
                                                style={{ fontSize: '11px' }}
                                                title={unavailableReason}
                                            >
                                                <RiAlertLine className="flex-shrink-0" />
                                                <span className="text-truncate">{unavailableReason}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="card border shadow-sm overflow-hidden animate__animated animate__fadeIn" style={{ borderRadius: '18px', backgroundColor: theme.cardBg, borderColor: '#e2d8c8' }}>
                <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 p-4 border-bottom">
                    <div>
                        <h5 className="fw-bold mb-1" style={{ color: '#1f1b18' }}>
                            {selectedDate ? `${formatDate(selectedDate)} appointments` : (filter === 'All' ? 'All appointments' : `${filter} appointments`)}
                        </h5>
                        {selectedDate && (
                            <button
                                type="button"
                                className="btn btn-link p-0 text-decoration-none small"
                                style={{ color: theme.goldDark }}
                                onClick={() => setSelectedDate('')}
                            >
                                Show all dates
                            </button>
                        )}
                    </div>
                    <div className="d-flex flex-column flex-md-row gap-2 align-items-md-center" style={{ minWidth: 0 }}>
                        <div className="input-group flex-grow-1" style={{ minWidth: '240px', maxWidth: '420px' }}>
                            <span className="input-group-text bg-light border-0"><RiSearchLine /></span>
                            <input
                                type="text"
                                className="form-control bg-light border-0 shadow-none"
                                placeholder="Search appointments..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                            <label htmlFor="statusFilterSelect" className="small fw-semibold text-muted mb-0 d-none d-sm-inline">
                                Status:
                            </label>
                            <select
                                id="statusFilterSelect"
                                className="form-select form-select-sm shadow-none fw-semibold border"
                                style={{
                                    minWidth: '170px',
                                    borderRadius: '10px',
                                    borderColor: '#e2d8c8',
                                    backgroundColor: '#ffffff',
                                    color: '#1f1b18',
                                    padding: '7px 32px 7px 14px',
                                    cursor: 'pointer'
                                }}
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="All">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Completed">Completed</option>
                                <option value="Didn't Come">Didn't Come</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                </div>
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
                            {filteredAppointments.length > 0 ? (
                                filteredAppointments.map(app => (
                                    <tr key={app.id}>
                                        <td className="py-3 px-4">
                                            <div className="fw-bold text-dark">{app.date || 'N/A'}</div>
                                            <div className="small text-muted">{app.time || 'TBA'}</div>
                                        </td>
                                        <td className="py-3 fw-semibold text-dark">
                                            {app.patientName || 'Unknown Patient'}
                                        </td>
                                        <td className="py-3 small text-dark">
                                            <div className="fw-semibold">{app.service || 'General Checkup'}</div>
                                            {(app.braceColor || app.color || app.bracesColor) && (
                                                <span className="badge rounded-pill border text-dark d-inline-flex align-items-center gap-1 mt-1 shadow-sm px-2 py-1" style={{ backgroundColor: '#fffdf5', fontSize: '10.5px' }}>
                                                    <span className="rounded-circle border" style={{ width: '10px', height: '10px', display: 'inline-block', backgroundColor: bracesColorHex[app.braceColor || app.color || app.bracesColor] || '#d4af37' }}></span>
                                                    <span>Color: <strong>{app.braceColor || app.color || app.bracesColor}</strong></span>
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 small">
                                            <div className="fw-semibold text-dark">{app.contactNumber || app.phone || app.contactNo || 'N/A'}</div>
                                            <div className="text-muted">{app.patientEmail || 'No Email'}</div>
                                        </td>
                                        
                                        <td className="py-3">
                                            <div className="d-flex align-items-center gap-1 flex-wrap">
                                                <button 
                                                    className="btn btn-sm rounded-pill fw-bold border-0"
                                                    style={{ 
                                                        backgroundColor: 
                                                            (statusStyles[app.status] || statusStyles.Pending).backgroundColor,
                                                        color: (statusStyles[app.status] || statusStyles.Pending).color,
                                                        fontSize: '11px',
                                                        padding: '4px 12px'
                                                    }}
                                                    onClick={() => handleViewDetails(app)}
                                                    title="Click to view full details"
                                                >
                                                    {app.status} <RiInformationLine className="ms-1 mb-1"/>
                                                </button>
                                            </div>
                                        </td>

                                        {/* Dedicated Reason Column */}
                                        <td className="py-3 small" style={{ maxWidth: '220px' }}>
                                            {app.status === 'Cancelled' || app.status === 'Declined' ? (
                                                app.cancelledDueToEmergency || app.emergencyReason || String(app.declineReason || '').toLowerCase().includes('emergency') ? (
                                                    <span className="text-danger fw-semibold d-inline-flex align-items-center gap-1 text-truncate w-100" title={app.emergencyReason || app.declineReason || 'Clinic Emergency'}>
                                                        <RiAlertLine size={13} className="flex-shrink-0" />
                                                        <span className="text-truncate">{app.emergencyReason || app.declineReason || 'Clinic Emergency'}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-dark fw-medium text-truncate d-inline-block w-100" title={app.cancelReason || app.declineReason || 'No reason provided'}>
                                                        {app.cancelReason || app.declineReason || 'No reason provided'}
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-muted">-</span>
                                            )}
                                        </td>

                                        <td className="py-3 pe-4 text-end">
                                            {app.status === 'Cancelled' ? (
                                                <span className="text-muted small" style={{ fontSize: '12px' }}>-</span>
                                            ) : (
                                                <div className="d-flex justify-content-end gap-2 flex-wrap align-items-center">
                                                    {(app.status === 'Pending' || app.status === 'Approved') && (
                                                        <div className="d-flex gap-2 flex-wrap">
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
                                                    )}
                                                    {(app.status === 'Completed' || app.status === "Didn't Come") && (
                                                        <span className="text-muted small" style={{ fontSize: '12px' }}>-</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="text-center py-5">
                                        <div className="text-muted opacity-50 mb-3">
                                            <RiCalendarCheckLine size={50} />
                                        </div>
                                        <h5 className="text-muted">
                                            {selectedDate
                                                ? (searchTerm ? `No appointments match your search for ${formatDate(selectedDate)}.` : `No appointments found for ${formatDate(selectedDate)}.`)
                                                : filter === 'All'
                                                    ? (searchTerm ? 'No appointments match your search.' : 'No appointments found.')
                                                    : (searchTerm ? `No ${filter.toLowerCase()} appointments match your search.` : `No ${filter.toLowerCase()} appointments found.`)}
                                        </h5>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <style>{`
                .weekly-calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, minmax(0, 1fr));
                    gap: 12px;
                }
                .calendar-day-card {
                    transition: all 0.2s ease;
                }
                .calendar-day-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(0,0,0,0.06) !important;
                }
                .availability-modal-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 1050;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    background: rgba(31, 27, 24, 0.42);
                }
                .availability-modal {
                    width: min(760px, 100%);
                    max-height: calc(100vh - 48px);
                    overflow: auto;
                    border-radius: 18px;
                    padding: 24px;
                }
                .availability-calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, minmax(0, 1fr));
                    gap: 8px;
                }
                .x-small { font-size: 11px; }
                .table-hover tbody tr:hover {
                    background-color: #faf7eb !important;
                }
                @media (max-width: 992px) {
                    .weekly-calendar-grid {
                        grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
                    }
                }
                @media (max-width: 576px) {
                    .weekly-calendar-grid {
                        grid-template-columns: repeat(2, 1fr);
                        gap: 8px;
                    }
                    .availability-calendar-grid {
                        gap: 5px;
                    }
                    .availability-calendar-grid .btn {
                        min-height: 54px !important;
                        padding: 6px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default BookApproval;
