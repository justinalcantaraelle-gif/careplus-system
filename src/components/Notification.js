import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    RiNotification3Line, RiCalendarCheckLine, 
    RiEdit2Line, RiStethoscopeLine, RiPaletteLine, RiInformationLine,
    RiInboxLine, RiCheckDoubleLine, RiUserAddLine, RiMoneyDollarCircleLine,
    RiPrinterLine, RiLockPasswordLine, RiDownloadLine, RiShieldUserLine, RiShieldKeyholeLine
} from 'react-icons/ri';
import {
    getAppointmentNotifications,
    getUserNotifications,
    markAppointmentNotificationsReadForPatient,
    markUserNotificationsRead,
    normalizeEmail,
    normalizeNotificationStore,
    normalizeRole
} from '../utils/notificationStore';
import { readDatabase, readSession, writeDatabase, getDatabase } from '../utils/storage';
import { connectRealtime, onRealtimeEvent } from '../utils/realtimeClient';

// Built-in Web Audio chime synthesizer for real-time notification audio alerts
const playNotificationChime = () => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const now = ctx.currentTime;
        // Tone 1: 587.33 Hz (D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.08, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.22);

        // Tone 2: 880 Hz (A5)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.12);
        gain2.gain.setValueAtTime(0.12, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.42);
    } catch (e) {}
};

// Helper to read/write persistent read notification IDs from localStorage
const DISMISSED_KEY = 'doc_dental_read_notifications';
const getDismissedIds = () => {
    try {
        return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'));
    } catch { return new Set(); }
};
const addDismissedIds = (ids) => {
    const current = getDismissedIds();
    (ids || []).forEach(id => { if (id) current.add(String(id)); });
    try {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify([...current]));
    } catch (e) {
        console.error('Error saving read notifications to localStorage:', e);
    }
};

const Notifications = () => {
    const session = readSession() || {};
    const [notifications, setNotifications] = useState([]);
    const [filterTab, setFilterTab] = useState('all'); // 'all' or 'unread'
    const [isOpen, setIsOpen] = useState(false);
    const [isRinging, setIsRinging] = useState(false);
    const prevUnreadRef = useRef(null);
    const navigate = useNavigate();

    const sessionRoleClean = (session.role || '').toLowerCase().replace(/\s+/g, '');
    const sessionEmailClean = (session.email || '').toLowerCase().trim();
    const isSuperAdmin = sessionRoleClean === 'superadmin' || sessionRoleClean === 'super_admin' || sessionEmailClean.includes('superadmin');
    const isStaffOrAdmin = !isSuperAdmin && (sessionRoleClean === 'admin' || sessionRoleClean === 'staff');

    const colors = {
        gold: '#D4AF37',
        goldDark: '#B8860B',
        beige: '#F5F5DC'
    };

    const checkUpdates = useCallback(() => {
        const db = normalizeNotificationStore(readDatabase({}));
        const sessionRole = normalizeRole(session.role);
        const sessionEmail = normalizeEmail(session.email);
        const sessionName = (session.username || session.name || '').trim().toLowerCase();

        if (!sessionRole) {
            setNotifications([]);
            return;
        }

        const medical_records = db.medical_records || {};
        const savedNotifications = getAppointmentNotifications(db);

        let logsMap = new Map();
        const dismissed = getDismissedIds();

        // -------------------------------------------------------------
        // A. PATIENT ROLE NOTIFICATIONS (Only their own transactions/status)
        // -------------------------------------------------------------
        if (sessionRoleClean === 'patient') {
            // 1. Transactional appointment notifications for patient
            savedNotifications.forEach(n => {
                const notifEmail = normalizeEmail(n.patientEmail || n.email);
                const notifName = (n.patientName || n.name || '').trim().toLowerCase();
                if ((sessionEmail && notifEmail === sessionEmail) || (sessionName && notifName === sessionName)) {
                    let typeColor = 'info';
                    if (n.type === 'Approved' || n.type === 'Completed') typeColor = 'success';
                    else if (n.type === 'Cancelled') typeColor = 'danger';
                    else if (n.type === 'Rescheduled') typeColor = 'warning';

                    const rawDate = n.timestamp ? new Date(n.timestamp).getTime() : (n.id && !isNaN(Number(n.id)) ? Number(n.id) : Date.now());
                    const key = `app-notif-${n.id}`;
                    const isReadState = dismissed.has(key) || dismissed.has(String(n.id)) || (n.appointmentId && dismissed.has(String(n.appointmentId))) || !!n.isRead;

                    logsMap.set(key, {
                        id: n.id,
                        mapKey: key,
                        title: n.title || `Appointment ${n.type}`,
                        message: n.message,
                        type: typeColor,
                        icon: <RiCalendarCheckLine />,
                        time: n.timestamp ? new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
                        rawDate,
                        read: isReadState
                    });
                }
            });

            // 2. Direct transactional user notifications sent to patient
            getUserNotifications(db, sessionEmail).forEach(n => {
                let icon = <RiStethoscopeLine />;
                let typeColor = 'info';
                if (n.type === 'medical_update') {
                    icon = <RiEdit2Line />;
                    typeColor = n.title?.includes('Approved') ? 'success' : 'danger';
                } else if (n.type === 'system_welcome') {
                    icon = <RiInformationLine />;
                    typeColor = 'success';
                } else if (n.type === 'clearance_update' || n.type === 'braces_update') {
                    icon = <RiPaletteLine />;
                    typeColor = n.title?.includes('Approved') ? 'success' : 'info';
                } else if (n.type === 'clinical_update') {
                    icon = <RiStethoscopeLine />;
                    typeColor = 'info';
                }
                const rawDate = n.date ? new Date(n.date).getTime() : (n.id && !isNaN(Number(n.id)) ? Number(n.id) : Date.now());
                const key = `user-notif-${n.id}`;
                const isReadState = dismissed.has(key) || dismissed.has(String(n.id)) || !!n.read;

                logsMap.set(key, {
                    id: n.id,
                    mapKey: key,
                    title: n.title || 'Update Received',
                    message: n.message,
                    type: typeColor,
                    icon: icon,
                    time: n.date ? new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
                    rawDate,
                    read: isReadState
                });
            });

        // -------------------------------------------------------------
        // B. SUPERADMIN (Sees ALL transactions across ALL roles)
        // -------------------------------------------------------------
        // C. ADMIN & STAFF (ONLY sees PATIENT transactions & patient requests)
        // -------------------------------------------------------------
        } else if (isSuperAdmin || isStaffOrAdmin) {
            const allAuditLogs = Array.isArray(db.audit_logs) ? db.audit_logs : (Array.isArray(db.auditLogs) ? db.auditLogs : []);
            
            // Helper to strictly identify patient-initiated transactions
            const isPatientTx = (log) => {
                if (!log) return false;
                const logRole = (log.role || '').toLowerCase().replace(/[\s_]+/g, '');

                // Actions executed by admin, staff, or superadmin are ADMIN actions, NOT patient transactions
                if (logRole === 'admin' || logRole === 'staff' || logRole === 'superadmin') {
                    return false;
                }

                // If role is explicitly patient
                if (logRole === 'patient') return true;

                // Check user in database
                const userEmail = (log.user || log.email || log.patientEmail || '').toLowerCase().trim();
                if (userEmail && Array.isArray(db.users)) {
                    const u = db.users.find(usr => (usr.email || '').toLowerCase().trim() === userEmail);
                    if (u) {
                        const uRole = (u.role || '').toLowerCase().replace(/[\s_]+/g, '');
                        if (uRole === 'patient') return true;
                        if (uRole === 'admin' || uRole === 'staff' || uRole === 'superadmin') return false;
                    }
                }

                const act = (log.action || '').toLowerCase();
                // Positive matching for patient actions
                if (
                    act.includes('booked') ||
                    act.includes('cancelled appointment') ||
                    act.includes('consent form signed') ||
                    act.includes('submitted medical') ||
                    act.includes('requested braces color') ||
                    act.includes('braces color selected') ||
                    act.includes('braces color change requested') ||
                    act.includes('patient registered')
                ) {
                    return true;
                }

                return false;
            };

            // 1. Transactional System Actions & Audit Logs
            allAuditLogs.forEach(log => {
                if (!log || !log.action) return;
                
                const act = (log.action || '').toLowerCase();

                // Exclude pure navigation logs and routine sign in/out logs from notification bell
                if (
                    log.action === 'Staff Navigation' ||
                    act.includes('login') ||
                    act.includes('logout') ||
                    act.includes('sign in') ||
                    act.includes('sign out') ||
                    act.includes('signed in') ||
                    act.includes('signed out')
                ) {
                    return;
                }

                const isPatientAction = isPatientTx(log);

                // For Admin/Staff: ONLY show notifications from Patients (hide actions done by Admin/Staff)
                if (isStaffOrAdmin && !isPatientAction) {
                    return;
                }

                const logRoleClean = (log.role || '').toLowerCase().replace(/[\s_]+/g, '');
                const isActionByAdmin = logRoleClean === 'admin' || logRoleClean === 'staff';

                const key = `audit-tx-${log.id || log.timestamp || log.action + log.details}`;
                const isReadState = dismissed.has(key) || (log.id && dismissed.has(String(log.id)));
                const rawDate = log.timestamp ? new Date(log.timestamp).getTime() : (log.id && !isNaN(Number(log.id)) ? Number(log.id) : Date.now());

                let icon = <RiInformationLine />;
                let typeColor = 'info';

                if (isActionByAdmin) {
                    icon = <RiShieldUserLine />;
                    typeColor = 'warning';
                } else if (act.includes('appointment') || act.includes('book')) {
                    icon = <RiCalendarCheckLine />;
                    typeColor = act.includes('cancel') ? 'danger' : act.includes('approved') || act.includes('completed') ? 'success' : 'warning';
                } else if (act.includes('account') || act.includes('patient') || act.includes('staff')) {
                    icon = <RiUserAddLine />;
                    typeColor = act.includes('deleted') || act.includes('banned') ? 'danger' : 'info';
                } else if (act.includes('braces') || act.includes('color') || act.includes('clearance')) {
                    icon = <RiPaletteLine />;
                    typeColor = act.includes('approved') ? 'success' : 'info';
                } else if (act.includes('intraoral') || act.includes('dental') || act.includes('exam')) {
                    icon = <RiStethoscopeLine />;
                    typeColor = 'success';
                } else if (act.includes('consent')) {
                    icon = <RiEdit2Line />;
                    typeColor = 'success';
                } else if (act.includes('medical') || act.includes('x-ray') || act.includes('xray')) {
                    icon = <RiEdit2Line />;
                    typeColor = 'info';
                } else if (act.includes('price')) {
                    icon = <RiMoneyDollarCircleLine />;
                    typeColor = 'warning';
                }

                // Superadmin sees clear [Admin Action] indicator for actions executed by staff or admins
                const displayTitle = (isSuperAdmin && isActionByAdmin) 
                    ? `[Admin Action] ${log.action}` 
                    : log.action;

                const displayMessage = log.details || `${log.action} executed by ${log.userName || log.user || 'Admin'}.`;

                logsMap.set(key, {
                    id: log.id || key,
                    mapKey: key,
                    title: displayTitle,
                    message: displayMessage,
                    type: typeColor,
                    icon: icon,
                    time: log.timestamp ? (typeof log.timestamp === 'string' && log.timestamp.length > 25 ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.timestamp) : 'Recently',
                    rawDate,
                    read: isReadState
                });
            });

            // 2. Active Pending Patient Transactions (Requiring Action/Approval)
            // 2a. Pending appointment booking requests (Patient-initiated)
            (db.appointments || []).forEach(app => {
                if (app && app.status === 'Pending') {
                    const key = `staff-pending-app-${app.id}`;
                    const isReadState = dismissed.has(key) || dismissed.has(String(app.id)) || !!app.staffRead;
                    logsMap.set(key, {
                        id: `staff-pending-app-${app.id}`,
                        mapKey: key,
                        title: 'New Booking Request',
                        message: `${app.patientName || app.patientEmail || 'Patient'} requested ${app.service || 'dental service'} on ${app.date} at ${app.time}.`,
                        type: 'warning',
                        icon: <RiCalendarCheckLine />,
                        time: app.time || app.date || 'Pending',
                        rawDate: app.id && !isNaN(Number(app.id)) ? Number(app.id) : Date.now(),
                        read: isReadState
                    });
                }
            });

            // 2b. Pending medical record edit requests (Patient-initiated)
            Object.keys(medical_records).forEach(email => {
                const rec = medical_records[email];
                if (rec && rec.requestStatus === 'Pending') {
                    const key = `staff-pending-med-${email}`;
                    const isReadState = dismissed.has(key) || dismissed.has(email);
                    logsMap.set(key, {
                        id: `staff-pending-med-${email}`,
                        mapKey: key,
                        title: 'Medical Record Edit Request',
                        message: `Patient ${rec.patientName || email} requested changes to medical history.`,
                        type: 'warning',
                        icon: <RiEdit2Line />,
                        time: 'Pending Review',
                        rawDate: Date.now(),
                        read: isReadState
                    });
                }
            });

            // 2c. Pending braces color requests (Patient-initiated)
            (db.bracesSelections || []).forEach(sel => {
                if (sel && sel.requiresApproval) {
                    const key = `staff-pending-braces-${sel.id}`;
                    const isReadState = dismissed.has(key) || dismissed.has(String(sel.id));
                    logsMap.set(key, {
                        id: `staff-pending-braces-${sel.id}`,
                        mapKey: key,
                        title: 'Braces Color Change Request',
                        message: `${sel.patientName || sel.patientEmail} requested ${sel.color} braces color.`,
                        type: 'warning',
                        icon: <RiPaletteLine />,
                        time: sel.date || 'Pending',
                        rawDate: sel.id && !isNaN(Number(sel.id)) ? Number(sel.id) : Date.now(),
                        read: isReadState
                    });
                }
            });

            const targetMailboxes = isSuperAdmin ? [
                sessionEmailClean, 'superadmin', 'superadmin@docdental.com', 'admin', 'staff'
            ] : [
                sessionEmailClean, 'admin', 'staff'
            ];

            const uniqueNotifsMap = new Map();
            targetMailboxes.forEach(box => {
                getUserNotifications(db, box).forEach(n => {
                    if (n && n.id) {
                        // For Admin/Staff: Only patient-driven alerts (never show actions taken by other admins)
                        if (isSuperAdmin || ['booking_alert', 'consent_alert', 'medical_submitted_alert', 'medical_edit_alert', 'braces_update'].includes(n.type)) {
                            uniqueNotifsMap.set(String(n.id), n);
                        }
                    }
                });
            });

            Array.from(uniqueNotifsMap.values()).forEach(n => {
                let icon = <RiStethoscopeLine />;
                let typeColor = 'info';
                if (n.type === 'admin_action_alert') {
                    icon = <RiShieldUserLine />;
                    typeColor = 'warning';
                } else if (n.type === 'booking_alert') {
                    icon = <RiCalendarCheckLine />;
                    typeColor = 'warning';
                } else if (n.type === 'account_created') {
                    icon = <RiUserAddLine />;
                    typeColor = 'info';
                } else if (n.type === 'medical_submitted_alert' || n.type === 'medical_edit_alert') {
                    icon = <RiEdit2Line />;
                    typeColor = 'warning';
                } else if (n.type === 'consent_alert') {
                    icon = <RiEdit2Line />;
                    typeColor = 'success';
                } else if (n.type === 'system_welcome') {
                    icon = <RiInformationLine />;
                    typeColor = 'success';
                } else if (n.type === 'braces_update' || n.title?.includes('Braces')) {
                    icon = <RiPaletteLine />;
                    typeColor = 'info';
                }
                const rawDate = n.date ? new Date(n.date).getTime() : (n.id && !isNaN(Number(n.id)) ? Number(n.id) : Date.now());
                const key = `user-notif-${n.id}`;
                const isReadState = dismissed.has(key) || dismissed.has(String(n.id)) || !!n.read;

                logsMap.set(key, {
                    id: n.id,
                    mapKey: key,
                    title: n.title || 'Clinical Update',
                    message: n.message,
                    type: typeColor,
                    icon: icon,
                    time: n.date ? new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
                    rawDate,
                    read: isReadState
                });
            });
        }

        // Sort by newest first (most recent transaction on top)
        const sortedLogs = Array.from(logsMap.values()).sort((a, b) => (b.rawDate || 0) - (a.rawDate || 0));
        const currentUnread = sortedLogs.filter(n => !n.read).length;

        // Trigger real-time chime and bell ringing animation on new unread notifications
        if (prevUnreadRef.current !== null && currentUnread > prevUnreadRef.current) {
            playNotificationChime();
            setIsRinging(true);
            setTimeout(() => setIsRinging(false), 1200);
        }
        prevUnreadRef.current = currentUnread;

        setNotifications(sortedLogs.slice(0, 100));
    }, [isSuperAdmin, isStaffOrAdmin, session.email, session.name, session.role, session.username]);

    useEffect(() => {
        checkUpdates();
        
        // Connect to real-time events stream with user role
        if (session.email) {
            connectRealtime(session.email, session.role);
        }

        const unsubscribeRealtime = onRealtimeEvent((event) => {
            checkUpdates();
            if (event === 'notification_new' || event === 'appointment_created' || event === 'emergency_closure' || event === 'consent_signed' || event === 'appointment_updated') {
                playNotificationChime();
                setIsRinging(true);
                setTimeout(() => setIsRinging(false), 1200);
            }
        });

        // Periodic in-memory check (instant updates handled by window events & realtime triggers)
        const localInterval = setInterval(checkUpdates, 5000);

        // Periodic background remote database sync
        const remoteInterval = setInterval(() => {
            getDatabase(false).then(() => {
                checkUpdates();
            }).catch(err => {
                console.error('Failed to sync notification database remotely:', err);
            });
        }, 60000);

        const handleStorageChange = (e) => {
            if (!e || !e.key || e.key === 'doc_dental_db') {
                checkUpdates();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('doc_dental_db_updated', checkUpdates);
        window.addEventListener('notificationUpdated', checkUpdates);
        window.addEventListener('auditLogsUpdated', checkUpdates);

        return () => {
            unsubscribeRealtime();
            clearInterval(localInterval);
            clearInterval(remoteInterval);
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('doc_dental_db_updated', checkUpdates);
            window.removeEventListener('notificationUpdated', checkUpdates);
            window.removeEventListener('auditLogsUpdated', checkUpdates);
        };
    }, [checkUpdates, session.email]);

    const handleMarkAllAsRead = (e) => {
        if (e) e.stopPropagation();
        const role = normalizeRole(session.role);
        let db = readDatabase({});

        // Add all current notification keys & IDs to persistent read storage
        const dismissKeys = notifications.map(n => n.mapKey);
        const dismissIds = notifications.map(n => String(n.id));
        addDismissedIds([...dismissKeys, ...dismissIds]);

        // Keep view on 'all' so notifications remain visible in the list with Read badge
        setFilterTab('all');
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));

        if (role === 'patient') {
            const sessionName = session.username || session.name;
            db = markAppointmentNotificationsReadForPatient(db, session.email, sessionName);
            db = markUserNotificationsRead(db, session.email);
        } else {
            db = markUserNotificationsRead(db, session.email);
            if (db.appointments) {
                db.appointments = db.appointments.map(app => {
                    if (app.status === 'Pending') {
                        return { ...app, staffRead: true };
                    }
                    return app;
                });
            }
        }
        writeDatabase(db);
        setTimeout(checkUpdates, 50);
    };

    const handleNotificationClick = (notif, e) => {
        if (e) e.stopPropagation();
        const role = normalizeRole(session.role);
        let db = readDatabase({});
        
        // 1. Mark as read in persistent storage (DO NOT disappear the message from the list)
        addDismissedIds([notif.mapKey, String(notif.id)]);

        if (role === 'patient') {
            const sessionName = session.username || session.name;
            if (notif.id.toString().includes('appointment') || notif.title?.toLowerCase().includes('appointment') || notif.type === 'booking_alert') {
                db = markAppointmentNotificationsReadForPatient(db, session.email, sessionName);
            } else {
                db = markUserNotificationsRead(db, session.email, [notif.id]);
            }
        } else {
            if (!notif.id.toString().startsWith('staff-')) {
                db = markUserNotificationsRead(db, session.email, [notif.id]);
            }
        }
        
        writeDatabase(db);
        setTimeout(checkUpdates, 50);
        
        // 2. Determine target path based on role and notification context
        let path = `/${role}`;
        const idStr = notif.id ? notif.id.toString().toLowerCase() : '';
        const titleStr = notif.title ? notif.title.toLowerCase() : '';
        const msgStr = notif.message ? notif.message.toLowerCase() : '';

        if (role === 'patient') {
            if (idStr.includes('appointment') || idStr.includes('app') || titleStr.includes('appointment') || titleStr.includes('booking') || msgStr.includes('appointment') || msgStr.includes('booking')) {
                sessionStorage.setItem('show_my_appointments_on_load', 'true');
                path = '/patient/book';
            } else if (titleStr.includes('medical') || titleStr.includes('record') || msgStr.includes('medical')) {
                path = '/patient/medical';
            } else if (titleStr.includes('clearance') || titleStr.includes('braces') || titleStr.includes('exam') || titleStr.includes('chart') || titleStr.includes('dental')) {
                path = '/patient/dental-chart';
            } else if (titleStr.includes('consent') || msgStr.includes('consent')) {
                path = '/patient/consent';
            } else if (titleStr.includes('price') || titleStr.includes('fee') || msgStr.includes('price')) {
                path = '/patient/price-list';
            } else {
                path = '/patient';
            }
        } else if (role === 'staff' || role === 'admin' || role === 'superadmin' || role === 'super_admin') {
            const isSuper = role === 'admin' || role === 'superadmin' || role === 'super_admin';
            if (titleStr.includes('appointment') || titleStr.includes('book') || msgStr.includes('appointment') || msgStr.includes('booking')) {
                path = isSuper ? '/admin/book' : '/staff/book';
            } else if (titleStr.includes('medical') || titleStr.includes('x-ray') || titleStr.includes('xray') || msgStr.includes('medical')) {
                path = isSuper ? '/admin/medical' : '/staff/medical';
            } else if (titleStr.includes('consent') || msgStr.includes('consent')) {
                path = isSuper ? '/admin/consent-forms' : '/staff/consent-forms';
            } else if (titleStr.includes('chart') || titleStr.includes('clearance') || titleStr.includes('braces') || titleStr.includes('dental') || titleStr.includes('intraoral')) {
                path = isSuper ? '/admin/dental-chart' : '/staff/dental-chart';
            } else if (titleStr.includes('staff') || titleStr.includes('account') || titleStr.includes('user')) {
                path = isSuper ? '/admin/users' : '/staff/patients';
            } else if (titleStr.includes('patient')) {
                path = isSuper ? '/admin/patients' : '/staff/patients';
            } else if (titleStr.includes('price') || titleStr.includes('service')) {
                path = isSuper ? '/admin/price-list' : '/staff/price-list';
            } else if (titleStr.includes('print') || titleStr.includes('report') || titleStr.includes('audit') || titleStr.includes('log') || titleStr.includes('activity')) {
                path = isSuper ? '/admin/audit-logs' : '/staff/reports';
            } else {
                path = isSuper ? '/admin' : '/staff';
            }
        }
        
        navigate(path);
        setIsOpen(false);
    };

    const unreadCount = notifications.filter(n => !n.read).length;
    // Always keep notifications visible — never clear the list when marked as read
    const displayedNotifications = (filterTab === 'unread' && unreadCount > 0) ? notifications.filter(n => !n.read) : notifications;

    return (
        <div className="position-relative">
            {/* Bell Button */}
            <button 
                className={`btn border-0 p-2 position-relative shadow-none notification-bell-btn ${isRinging ? 'bell-ring-active' : ''}`} 
                onClick={() => setIsOpen(!isOpen)}
                style={{ color: colors.goldDark }}
                aria-label="Notifications"
            >
                <RiNotification3Line size={24} />
                {unreadCount > 0 && (
                    <span
                        className="position-absolute translate-middle badge rounded-pill bg-danger border border-white badge-pulse d-inline-flex align-items-center justify-content-center"
                        style={{
                            top: '5px',
                            right: '-3px',
                            fontSize: '8.5px',
                            minWidth: '15px',
                            height: '15px',
                            padding: '0 3.5px',
                            lineHeight: '1',
                            borderWidth: '1.5px'
                        }}
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Card */}
            {isOpen && (
                <>
                    <div 
                        className="position-fixed top-0 start-0 w-100 h-100" 
                        style={{ zIndex: 998 }} 
                        onClick={() => setIsOpen(false)}
                    ></div>
                    <div 
                        className="position-absolute end-0 mt-2 notification-dropdown" 
                        style={{ 
                            width: '390px', 
                            maxWidth: 'calc(100vw - 20px)',
                            backgroundColor: '#ffffff', 
                            borderRadius: '16px', 
                            zIndex: 999, 
                            border: '1px solid #e8e2d5',
                            boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.04)',
                            overflow: 'hidden',
                            animation: 'notifSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        {/* Clean Single-Row Header */}
                        <div 
                            className="border-bottom d-flex align-items-center justify-content-between" 
                            style={{ 
                                padding: '14px 18px', 
                                backgroundColor: '#fffdf7', 
                                borderColor: '#f0ece1' 
                            }}
                        >
                            <div className="d-flex align-items-center gap-2">
                                <h6 className="mb-0 fw-bold" style={{ color: colors.goldDark, fontSize: '15px', letterSpacing: '-0.2px' }}>
                                    Notifications
                                </h6>
                                {unreadCount > 0 && (
                                    <span 
                                        className="badge rounded-pill fw-semibold" 
                                        style={{ 
                                            backgroundColor: 'rgba(212, 175, 55, 0.18)', 
                                            color: colors.goldDark, 
                                            fontSize: '11px',
                                            padding: '3px 8px'
                                        }}
                                    >
                                        {unreadCount} unread
                                    </span>
                                )}
                            </div>
                            
                            {/* Sleek Inline Filter Pills */}
                            <div 
                                className="d-inline-flex p-0.5 rounded-pill border" 
                                style={{ 
                                    backgroundColor: '#f5f2eb', 
                                    borderColor: '#e8e2d5',
                                    flexShrink: 0
                                }}
                            >
                                <button 
                                    type="button" 
                                    className="btn btn-sm border-0 rounded-pill px-2.5 py-0.5 fw-semibold"
                                    style={{ 
                                        fontSize: '11.5px',
                                        whiteSpace: 'nowrap',
                                        backgroundColor: filterTab === 'all' ? '#ffffff' : 'transparent',
                                        color: filterTab === 'all' ? colors.goldDark : '#78716c',
                                        boxShadow: filterTab === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onClick={(e) => { e.stopPropagation(); setFilterTab('all'); }}
                                >
                                    All
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-sm border-0 rounded-pill px-2.5 py-0.5 fw-semibold"
                                    style={{ 
                                        fontSize: '11.5px',
                                        whiteSpace: 'nowrap',
                                        backgroundColor: filterTab === 'unread' ? '#ffffff' : 'transparent',
                                        color: filterTab === 'unread' ? colors.goldDark : '#78716c',
                                        boxShadow: filterTab === 'unread' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onClick={(e) => { e.stopPropagation(); setFilterTab('unread'); }}
                                >
                                    Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
                                </button>
                            </div>
                        </div>
                        
                        {/* Notifications List */}
                        <div className="notification-scroll-area" style={{ maxHeight: '390px', overflowY: 'auto' }}>
                            {displayedNotifications.length > 0 ? displayedNotifications.map(notif => {
                                const typeStyles = {
                                    danger: {
                                        bg: 'rgba(239, 68, 68, 0.1)',
                                        color: '#dc2626'
                                    },
                                    success: {
                                        bg: 'rgba(16, 185, 129, 0.1)',
                                        color: '#059669'
                                    },
                                    warning: {
                                        bg: 'rgba(212, 175, 55, 0.15)',
                                        color: colors.goldDark
                                    },
                                    info: {
                                        bg: 'rgba(59, 130, 246, 0.1)',
                                        color: '#2563eb'
                                    }
                                };
                                const currentStyle = typeStyles[notif.type] || typeStyles.info;

                                return (
                                    <div 
                                        key={notif.mapKey} 
                                        className={`notification-item position-relative ${notif.read ? 'read-item' : 'unread-item'}`}
                                        style={{
                                            padding: '13px 18px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #f3efe6',
                                            backgroundColor: notif.read ? '#ffffff' : '#fffdf7',
                                            transition: 'background-color 0.15s ease'
                                        }}
                                        onClick={(e) => handleNotificationClick(notif, e)}
                                        title="Click to view details and navigate"
                                    >
                                        <div className="d-flex align-items-start gap-3">
                                            {/* Circular Soft Icon Avatar */}
                                            <div
                                                className="d-flex align-items-center justify-content-center flex-shrink-0 mt-0.5"
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '50%',
                                                    backgroundColor: currentStyle.bg,
                                                    color: currentStyle.color,
                                                    fontSize: '17px'
                                                }}
                                            >
                                                {notif.icon}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                                                    <span 
                                                        className={notif.read ? 'fw-semibold text-secondary' : 'fw-bold text-dark'} 
                                                        style={{ fontSize: '13px', lineHeight: '1.35' }}
                                                    >
                                                        {notif.title}
                                                    </span>
                                                    <div className="d-flex align-items-center gap-1.5 flex-shrink-0 pt-0.5">
                                                        {!notif.read && (
                                                            <span 
                                                                style={{ 
                                                                    width: '6px', 
                                                                    height: '6px', 
                                                                    borderRadius: '50%', 
                                                                    backgroundColor: colors.goldDark, 
                                                                    display: 'inline-block'
                                                                }}
                                                                title="Unread"
                                                            />
                                                        )}
                                                        <span className="text-muted" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                                                            {notif.time}
                                                        </span>
                                                    </div>
                                                </div>

                                                <p 
                                                    className="mb-0"
                                                    style={{ 
                                                        fontSize: '12px', 
                                                        lineHeight: '1.45', 
                                                        color: notif.read ? '#78716c' : '#44403c',
                                                        wordBreak: 'break-word'
                                                    }}
                                                >
                                                    {notif.message}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="py-5 text-center">
                                    <RiInboxLine size={36} className="text-muted mb-2" style={{ opacity: 0.4 }} />
                                    <div className="text-muted small">
                                        {filterTab === 'unread' ? 'No unread activity' : 'No transactions recorded yet'}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Footer: Mark all as read */}
                        {unreadCount > 0 && (
                            <div 
                                className="px-3 py-2.5 border-top text-center notification-read-btn"
                                style={{ 
                                    backgroundColor: '#fffdf7', 
                                    cursor: 'pointer',
                                    borderColor: '#f0ece1'
                                }}
                                onClick={handleMarkAllAsRead}
                            >
                                <button
                                    type="button"
                                    className="btn btn-sm w-100 border-0 p-0 fw-semibold d-flex align-items-center justify-content-center gap-1.5"
                                    style={{ 
                                        color: colors.goldDark, 
                                        fontSize: '12px',
                                        backgroundColor: 'transparent'
                                    }}
                                >
                                    <RiCheckDoubleLine size={16} style={{ color: colors.goldDark }} />
                                    <span>Mark all as read</span>
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            <style>{`
                @keyframes notifSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes bellRing {
                    0% { transform: rotate(0); }
                    15% { transform: rotate(14deg); }
                    30% { transform: rotate(-14deg); }
                    45% { transform: rotate(10deg); }
                    60% { transform: rotate(-10deg); }
                    75% { transform: rotate(4deg); }
                    100% { transform: rotate(0); }
                }
                .bell-ring-active {
                    animation: bellRing 0.8s ease-in-out;
                }
                @keyframes badgePulse {
                    0% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
                    70% { transform: translate(-50%, -50%) scale(1.1); box-shadow: 0 0 0 6px rgba(220, 53, 69, 0); }
                    100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
                }
                .badge-pulse {
                    animation: badgePulse 2s infinite ease-in-out;
                }
                .notification-bell-btn {
                    transition: transform 0.2s ease;
                }
                .notification-bell-btn:hover {
                    transform: scale(1.1);
                }
                .notification-item {
                    transition: background-color 0.15s ease;
                }
                .unread-item {
                    background-color: #fffdf7;
                }
                .read-item {
                    background-color: #ffffff;
                }
                .notification-item:hover {
                    background-color: #f7f3e8 !important;
                }
                .notification-read-btn {
                    transition: background-color 0.15s ease;
                }
                .notification-read-btn:hover {
                    background-color: rgba(212, 175, 55, 0.12) !important;
                }
                .notification-scroll-area::-webkit-scrollbar {
                    width: 5px;
                }
                .notification-scroll-area::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                .notification-scroll-area::-webkit-scrollbar-thumb {
                    background: #d4af3788;
                    border-radius: 4px;
                }
                .notification-scroll-area::-webkit-scrollbar-thumb:hover {
                    background: #d4af37;
                }
            `}</style>
        </div>
    );
};

export default Notifications;
