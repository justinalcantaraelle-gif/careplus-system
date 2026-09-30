import { readDatabase, readSession, writeDatabase } from '../utils/storage';
import { addUserNotification } from '../utils/notificationStore';
import { broadcastRealtimeEvent } from '../utils/realtimeClient';

export const addAuditLog = (action, target) => {
    const db = readDatabase({ users: [], auditLogs: [] });
    const session = readSession();

    const userName = session?.fullName || session?.name || session?.email || 'Staff';
    const userRole = session?.role || 'Staff';
    const userEmail = session?.email || 'system';

    const newLog = {
        id: Date.now(),
        user: userEmail,
        userName,
        role: userRole,
        adminName: userName,
        action,
        target,
        details: target,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    };

    const nextLogs = [newLog, ...(db.audit_logs || db.auditLogs || [])];
    let updatedDb = {
        ...db,
        audit_logs: nextLogs,
        auditLogs: nextLogs
    };

    // Handle Real-Time Role Notification Routing
    const act = (action || '').toLowerCase();
    const isNavOrAuth = act.includes('navigation') || act.includes('login') || act.includes('logout') || act.includes('sign in') || act.includes('sign out') || act.includes('signed in') || act.includes('signed out');
    const roleLower = (userRole || '').toLowerCase().replace(/[\s_]+/g, '');
    const isSuperAdminActor = roleLower === 'superadmin' || (userEmail || '').toLowerCase().includes('superadmin');
    const isAdminOrStaffActor = !isSuperAdminActor && (roleLower === 'admin' || roleLower === 'staff');
    const isPatientActor = roleLower === 'patient';

    // 1. If an Admin or Staff performs an operational/clinical action, NOTIFY SUPERADMIN
    if (isAdminOrStaffActor && !isNavOrAuth) {
        const adminActionNotif = {
            id: `admin-act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            title: `Admin Action: ${action}`,
            message: `${userName} (${userRole}): ${target}`,
            actionBy: userName,
            actorRole: userRole,
            actorEmail: userEmail,
            actionName: action,
            type: 'admin_action_alert',
            date: new Date().toISOString(),
            read: false
        };

        // Notify all SuperAdmin accounts dynamically + default superadmin
        const superMailboxes = new Set(['superadmin@docdental.com', 'superadmin']);
        (updatedDb.users || []).forEach(u => {
            const r = (u.role || '').toLowerCase().replace(/[\s_]+/g, '');
            if (r === 'superadmin') {
                superMailboxes.add((u.email || '').toLowerCase().trim());
            }
        });

        superMailboxes.forEach(boxEmail => {
            updatedDb = addUserNotification(updatedDb, boxEmail, adminActionNotif);
        });

        // Broadcast real-time event specifically targeted to SuperAdmin
        broadcastRealtimeEvent('notification_new', {
            title: `Admin Action: ${action}`,
            message: `${userName} (${userRole}): ${target}`,
            actorRole: userRole,
            action,
            recipient: 'superadmin',
            targetRoles: ['superadmin']
        }, null, ['superadmin']);
    }

    // 2. If a Patient performs an action (e.g. Cancelled Appointment), NOTIFY BOTH Admin and SuperAdmin
    if (isPatientActor && !isNavOrAuth) {
        const patientActionNotif = {
            id: `patient-act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            title: action,
            message: `${userName}: ${target}`,
            patientEmail: userEmail,
            type: 'booking_alert',
            date: new Date().toISOString(),
            read: false
        };

        const staffAdminMailboxes = new Set(['admin', 'staff', 'superadmin', 'superadmin@docdental.com']);
        (updatedDb.users || []).forEach(u => {
            const r = (u.role || '').toLowerCase().replace(/[\s_]+/g, '');
            if (['admin', 'staff', 'superadmin'].includes(r)) {
                staffAdminMailboxes.add((u.email || '').toLowerCase().trim());
            }
        });

        staffAdminMailboxes.forEach(box => {
            updatedDb = addUserNotification(updatedDb, box, patientActionNotif);
        });

        // Broadcast real-time event to Admin, Staff, and SuperAdmin
        broadcastRealtimeEvent('notification_new', {
            title: action,
            message: `${userName}: ${target}`,
            actorRole: 'Patient',
            action,
            targetRoles: ['admin', 'staff', 'superadmin']
        }, null, ['admin', 'staff', 'superadmin']);
    }

    writeDatabase(updatedDb);
    window.dispatchEvent(new CustomEvent('auditLogsUpdated', { detail: newLog }));
    window.dispatchEvent(new CustomEvent('notificationUpdated', { detail: updatedDb }));
};
