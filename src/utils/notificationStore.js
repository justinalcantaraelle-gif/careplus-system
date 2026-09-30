import { readSession } from './storage';

export const normalizeEmail = (email) => (email || '').trim().toLowerCase();

export const normalizeRole = (role) => (role || '').trim().toLowerCase();

export const getSession = () => readSession() || {};

export const normalizeNotificationStore = (db = {}) => {
    if (!db || typeof db !== 'object') return {};
    const normalized = { ...db };

    if (!normalized.patient_charts) {
        normalized.patient_charts = {};
    }

    if (!normalized.notifications || typeof normalized.notifications !== 'object' || Array.isArray(normalized.notifications)) {
        normalized.notifications = {};
    }

    // Deduplicate appointment_notifications by unique ID to prevent exponential memory doubling loops
    const notifMap = new Map();
    
    if (normalized.patient_charts['notifications'] && Array.isArray(normalized.patient_charts['notifications'].appointment_notifications)) {
        normalized.patient_charts['notifications'].appointment_notifications.forEach(item => {
            if (item) {
                const key = String(item.id || item.timestamp || item.mapKey || JSON.stringify(item));
                notifMap.set(key, item);
            }
        });
    }

    if (Array.isArray(normalized.appointment_notifications)) {
        normalized.appointment_notifications.forEach(item => {
            if (item) {
                const key = String(item.id || item.timestamp || item.mapKey || JSON.stringify(item));
                if (!notifMap.has(key)) {
                    notifMap.set(key, item);
                }
            }
        });
    }

    normalized.appointment_notifications = Array.from(notifMap.values());
    
    // Sync back to persistent store structure without duplicating
    normalized.patient_charts['notifications'] = {
        notifications: normalized.notifications || {},
        appointment_notifications: normalized.appointment_notifications || []
    };

    return normalized;
};

const saveToPersistentStore = (db) => {
    if (!db.patient_charts) db.patient_charts = {};
    db.patient_charts['notifications'] = {
        notifications: db.notifications || {},
        appointment_notifications: db.appointment_notifications || []
    };
    return db;
};

export const getUserNotifications = (db, email) => {
    const normalizedDb = normalizeNotificationStore(db);
    const emailKey = normalizeEmail(email);
    const direct = normalizedDb.notifications[emailKey] || normalizedDb.notifications[email] || [];

    return Array.isArray(direct) ? direct : [];
};

export const addUserNotification = (db, email, notification) => {
    const normalizedDb = normalizeNotificationStore(db);
    const emailKey = normalizeEmail(email);

    if (!normalizedDb.notifications[emailKey]) {
        normalizedDb.notifications[emailKey] = [];
    }

    normalizedDb.notifications[emailKey].unshift(notification);
    return saveToPersistentStore(normalizedDb);
};

export const getAppointmentNotifications = (db) => {
    const normalizedDb = normalizeNotificationStore(db);
    return normalizedDb.appointment_notifications;
};

export const addAppointmentNotification = (db, notification) => {
    const normalizedDb = normalizeNotificationStore(db);
    normalizedDb.appointment_notifications.push(notification);
    return saveToPersistentStore(normalizedDb);
};

export const markUserNotificationsRead = (db, email, ids = null) => {
    const normalizedDb = normalizeNotificationStore(db);
    const emailKey = normalizeEmail(email);
    const idSet = ids ? new Set(ids) : null;

    normalizedDb.notifications[emailKey] = getUserNotifications(normalizedDb, emailKey).map((notification) => {
        if (!idSet || idSet.has(notification.id)) {
            return { ...notification, read: true };
        }

        return notification;
    });

    return saveToPersistentStore(normalizedDb);
};

export const markAppointmentNotificationsReadForPatient = (db, email, name) => {
    const normalizedDb = normalizeNotificationStore(db);
    const sessionEmail = normalizeEmail(email);
    const sessionName = (name || '').trim().toLowerCase();

    normalizedDb.appointment_notifications = getAppointmentNotifications(normalizedDb).map((notification) => {
        const notificationEmail = normalizeEmail(notification.patientEmail || notification.email);
        const notificationName = (notification.patientName || notification.name || '').trim().toLowerCase();

        if ((sessionEmail && notificationEmail === sessionEmail) || (sessionName && notificationName === sessionName)) {
            return { ...notification, isRead: true };
        }

        return notification;
    });

    return saveToPersistentStore(normalizedDb);
};
