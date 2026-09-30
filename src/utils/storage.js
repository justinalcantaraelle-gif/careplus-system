import { connectRealtime, onRealtimeEvent, broadcastRealtimeEvent } from './realtimeClient';
import {
    INITIAL_CAREPLUS_USERS,
    INITIAL_CAREPLUS_APPOINTMENTS,
    INITIAL_CAREPLUS_CONSULTATIONS,
    INITIAL_CAREPLUS_LAB_REQUESTS,
    INITIAL_CAREPLUS_BILLING
} from './careplusData';

let dbCache = null;
let lastSyncedDb = null;
let pricelistCache = null;
const picCache = {};

export const getApiBaseUrl = () => {
    const rawUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL;
    if (rawUrl && !rawUrl.includes('localhost:5000')) {
        return rawUrl.replace(/\/+$/, '').replace(/\/api$/, '');
    }
    if (typeof window !== 'undefined' && window.location) {
        const protocol = window.location.protocol || 'http:';
        const hostname = window.location.hostname || 'localhost';
        const port = window.location.port;
        // If hosted on cloud production (e.g. Vercel domain without custom port)
        if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !port && !hostname.endsWith('.local') && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            return window.location.origin;
        }
        // Localhost and LAN IP development (Backend server always runs on port 5000)
        return `${protocol}//${hostname}:5000`;
    }
    return process.env.REACT_APP_API_URL || 'http://localhost:5000';
};

export const parseAppointmentDateTime = (dateStr, timeStr) => {
    if (!dateStr) return null;
    let timePart = timeStr || "12:00 AM";
    const parts = timePart.trim().split(/\s+/);
    const time = parts[0];
    const ampm = parts[1];
    let [hours, minutes] = time.split(':').map(Number);
    if (ampm && ampm.toUpperCase() === 'PM' && hours < 12) {
        hours += 12;
    }
    if (ampm && ampm.toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, hours, minutes || 0);
};

export const checkAndCompletePastAppointments = (db) => {
    if (!db || !db.appointments) return { db, updated: false };
    const now = new Date();
    let updated = false;

    // Ensure persistent notification registry is loaded
    if (!db.patient_charts) db.patient_charts = {};
    if (!db.patient_charts['notifications']) {
        db.patient_charts['notifications'] = { notifications: {}, appointment_notifications: [] };
    }
    const notifStore = db.patient_charts['notifications'];
    if (!Array.isArray(notifStore.appointment_notifications)) {
        notifStore.appointment_notifications = [];
    }

    const updatedAppointments = db.appointments.map(app => {
        // Clean up legacy unfinished properties
        if (app.unfinished !== undefined || app.unfinishedReason !== undefined) {
            updated = true;
            delete app.unfinished;
            delete app.unfinishedReason;
        }

        // All appointments with status of Approved go under Pending status
        if (app.status === 'Approved') {
            updated = true;
            return { 
                ...app, 
                status: 'Pending'
            };
        }
        return app;
    });

    if (updated) {
        db.appointments = updatedAppointments;
        db.patient_charts['notifications'] = notifStore;
    }
    return { db, updated };
};

// Auth Token Helpers for Stateful JWT
export const getAuthToken = () => {
    try {
        return sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token') || null;
    } catch (e) {
        return null;
    }
};

export const setAuthToken = (token) => {
    try {
        if (token) {
            sessionStorage.setItem('auth_token', token);
            localStorage.setItem('auth_token', token);
        } else {
            clearAuthToken();
        }
    } catch (e) {}
};

export const clearAuthToken = () => {
    try {
        sessionStorage.removeItem('auth_token');
        localStorage.removeItem('auth_token');
    } catch (e) {}
};

// Sync modifications directly to MySQL Backend API
const syncDocDentalDb = async (newDb, oldDb) => {
    try {
        const token = getAuthToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${getApiBaseUrl()}/api/sync`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ newDb, oldDb })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error('[MySQL Backend Sync Error]', err);
        } else {
            broadcastRealtimeEvent('db_updated', { timestamp: new Date().toISOString() });
        }
    } catch (e) {
        console.error('[MySQL Backend Sync Network Error]:', e);
    }
};

// Fetch entire database state directly from MySQL Backend API (Protected)
export const getDatabase = async (forceRefresh = false) => {
    if (dbCache && lastSyncedDb && !forceRefresh) return dbCache;

    // Check if session exists; if not logged in, return safe cache without requesting protected endpoint
    const session = readSession();
    const token = getAuthToken();

    if (!session && !token) {
        if (!dbCache) {
            dbCache = {
                users: [],
                appointments: [],
                medical_records: {},
                dental_charts: {},
                intraoral_charts: {},
                patient_charts: {},
                xray_records: {},
                auditLogs: [],
                consent_records: [],
                unavailableDates: []
            };
        }
        return dbCache;
    }

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${getApiBaseUrl()}/api/database`, {
            credentials: 'include',
            headers
        });

        if (response.status === 401 || response.status === 403) {
            console.warn('[Storage] Session expired or unauthorized when fetching database.');
            if (!dbCache) {
                dbCache = {
                    users: [],
                    appointments: [],
                    medical_records: {},
                    dental_charts: {},
                    intraoral_charts: {},
                    patient_charts: {},
                    xray_records: {},
                    auditLogs: [],
                    consent_records: [],
                    unavailableDates: []
                };
            }
            return dbCache;
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch database state`);

        const db = await response.json();

        // Safe defaults
        if (!db.users) db.users = [];
        if (!db.appointments) db.appointments = [];
        if (!db.medical_records) db.medical_records = {};
        if (!db.dental_charts) db.dental_charts = {};
        if (!db.intraoral_charts) db.intraoral_charts = {};
        if (!db.patient_charts) db.patient_charts = {};
        if (!db.xray_records) db.xray_records = {};
        if (!Array.isArray(db.consent_records)) {
            if (db.consent_records && typeof db.consent_records === 'object') {
                db.consent_records = Object.entries(db.consent_records).map(([email, val]) => ({
                    email,
                    signature: val.signature,
                    dateSigned: val.dateSigned || val.date_signed
                }));
            } else {
                db.consent_records = [];
            }
        }
        // Auto-migrate & sync consent records into medical_records and vice-versa
        if (Array.isArray(db.consent_records)) {
            db.consent_records.forEach(c => {
                if (c && c.email) {
                    const eNorm = c.email.toLowerCase().trim();
                    if (!db.medical_records[eNorm]) {
                        db.medical_records[eNorm] = { conditions: [] };
                    }
                    if (c.signature) {
                        db.medical_records[eNorm].signature = c.signature;
                        db.medical_records[eNorm].hasConsented = true;
                        db.medical_records[eNorm].consentTimestamp = c.dateSigned || c.date_signed || db.medical_records[eNorm].consentTimestamp || new Date().toLocaleDateString();
                    }
                }
            });
        }
        Object.keys(db.medical_records || {}).forEach(email => {
            const med = db.medical_records[email];
            if (med && (med.signature || med.hasConsented)) {
                const eNorm = email.toLowerCase().trim();
                const exists = db.consent_records.some(c => (c.email || '').toLowerCase().trim() === eNorm);
                if (!exists) {
                    db.consent_records.push({
                        email: eNorm,
                        signature: med.signature || '',
                        dateSigned: med.consentTimestamp || new Date().toLocaleDateString()
                    });
                }
            }
        });

        // Auto-migrate & sync data between dental_charts and intraoral_charts so both views are coherent
        Object.keys(db.dental_charts || {}).forEach(email => {
            if (db.dental_charts[email]) {
                db.intraoral_charts[email] = { ...(db.intraoral_charts[email] || {}), ...db.dental_charts[email] };
            }
        });
        Object.keys(db.intraoral_charts || {}).forEach(email => {
            if (db.intraoral_charts[email]) {
                db.dental_charts[email] = { ...(db.dental_charts[email] || {}), ...db.intraoral_charts[email] };
            }
        });
        
        // Sync unavailableDates from clinic_settings
        const clinicSettings = db.patient_charts['clinic_settings'] || {};
        db.unavailableDates = Array.isArray(clinicSettings.unavailableDates) ? clinicSettings.unavailableDates : [];

        // Ensure CarePlus multi-branch entities are present
        db = ensureCarePlusEntities(db);

        dbCache = db;
        lastSyncedDb = JSON.parse(JSON.stringify(db));

        try {
            localStorage.setItem('careplus_clinic_db', JSON.stringify(db));
            localStorage.removeItem('doc_dental_db');
        } catch (e) {}

        // Notify frontend components that fresh database is available
        try {
            window.dispatchEvent(new CustomEvent('doc_dental_db_updated', { detail: db }));
            window.dispatchEvent(new CustomEvent('careplus_db_updated', { detail: db }));
        } catch (e) {}

        return db;
    } catch (e) {
        console.error('Error loading database from MySQL Backend (using CarePlus local cache):', e);
        if (!dbCache) {
            try {
                const stored = localStorage.getItem('careplus_clinic_db');
                if (stored) {
                    dbCache = JSON.parse(stored);
                }
            } catch (err) {}
            if (!dbCache) {
                dbCache = ensureCarePlusEntities({});
            }
        }
        return dbCache;
    }
};

export const ensureCarePlusEntities = (db = {}) => {
    if (!db || typeof db !== 'object') db = {};

    if (!Array.isArray(db.users) || db.users.length === 0) {
        db.users = [...INITIAL_CAREPLUS_USERS];
    } else {
        INITIAL_CAREPLUS_USERS.forEach(cu => {
            if (!db.users.some(u => (u.email || '').toLowerCase() === cu.email.toLowerCase())) {
                db.users.push(cu);
            }
        });
    }

    if (!Array.isArray(db.appointments) || db.appointments.length === 0) {
        db.appointments = [...INITIAL_CAREPLUS_APPOINTMENTS];
    } else {
        // Ensure every appointment has a branch
        db.appointments = db.appointments.map(a => ({
            ...a,
            branch: a.branch || (a.id % 2 === 0 ? 'CarePlus Northside Branch' : 'CarePlus Metro Branch')
        }));
    }

    if (!Array.isArray(db.consultations) || db.consultations.length === 0) {
        db.consultations = [...INITIAL_CAREPLUS_CONSULTATIONS];
    }

    if (!Array.isArray(db.laboratory_requests) || db.laboratory_requests.length === 0) {
        db.laboratory_requests = [...INITIAL_CAREPLUS_LAB_REQUESTS];
    }

    if (!Array.isArray(db.billing_records) || db.billing_records.length === 0) {
        db.billing_records = [...INITIAL_CAREPLUS_BILLING];
    }

    if (!db.medical_records) db.medical_records = {};
    if (!db.dental_charts) db.dental_charts = {};
    if (!db.intraoral_charts) db.intraoral_charts = {};
    if (!db.patient_charts) db.patient_charts = {};
    if (!db.xray_records) db.xray_records = {};
    if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
    if (!Array.isArray(db.consent_records)) db.consent_records = [];
    if (!Array.isArray(db.unavailableDates)) db.unavailableDates = [];

    return db;
};

// Synchronous local state accessor
export const readDatabase = (fallback = null) => {
    if (dbCache) return ensureCarePlusEntities(dbCache);
    try {
        const stored = localStorage.getItem('careplus_clinic_db');
        if (stored) {
            dbCache = ensureCarePlusEntities(JSON.parse(stored));
            return dbCache;
        }
    } catch (e) {}

    dbCache = ensureCarePlusEntities(fallback || {});
    getDatabase().catch(() => {}); // Asynchronously load fresh state in background
    return dbCache;
};

// Write state into memory and queue immediate MySQL sync
export const writeDatabase = async (data) => {
    if (!data) return false;
    
    try {
        const oldState = lastSyncedDb ? JSON.parse(JSON.stringify(lastSyncedDb)) : (dbCache ? JSON.parse(JSON.stringify(dbCache)) : null);

        // Sanitize patient appointment references
        if (Array.isArray(data.appointments)) {
            data.appointments = data.appointments.map(app => {
                let pEmail = app.patientEmail || app.patient_email;
                let pName = app.patientName || app.patient_name;

                if (!pEmail && app.userId && Array.isArray(data.users)) {
                    const u = data.users.find(usr => usr.id === app.userId);
                    if (u) {
                        pEmail = u.email;
                        pName = u.fullName || u.full_name || pName;
                    }
                }

                return {
                    ...app,
                    patientEmail: pEmail,
                    patientName: pName
                };
            });
        }

        const checked = checkAndCompletePastAppointments(data);
        const finalData = ensureCarePlusEntities(checked.db);

        // Ensure unavailableDates is persisted into patient_charts clinic_settings
        if (!finalData.patient_charts) finalData.patient_charts = {};
        if (!finalData.patient_charts['clinic_settings']) finalData.patient_charts['clinic_settings'] = {};
        if (Array.isArray(finalData.unavailableDates)) {
            finalData.patient_charts['clinic_settings'].unavailableDates = finalData.unavailableDates;
        }

        dbCache = finalData;
        lastSyncedDb = JSON.parse(JSON.stringify(finalData));

        try {
            localStorage.setItem('careplus_clinic_db', JSON.stringify(finalData));
            localStorage.removeItem('doc_dental_db');
        } catch (e) {}

        try {
            window.dispatchEvent(new CustomEvent('doc_dental_db_updated', { detail: finalData }));
            window.dispatchEvent(new CustomEvent('careplus_db_updated', { detail: finalData }));
        } catch (e) {}

        // Broadcast to other tabs
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('careplus_sync_channel');
                bc.postMessage({ type: 'db_updated', db: finalData });
                bc.close();
            }
        } catch (e) {}

        // Non-blocking sync to backend
        syncDocDentalDb(finalData, oldState);
        return true;
    } catch (e) {
        console.error('Error writing to database:', e);
        return false;
    }
};

// Direct Emergency Database Restore & Recovery API
export const restoreDatabase = async (backupData, mode = 'merge', restoredBy = 'Staff/Superadmin') => {
    if (!backupData) return { success: false, error: 'No backup data provided' };

    try {
        // 1. Call Dedicated Backend /api/restore
        let result = {};
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backupDb: backupData, mode, restoredBy })
            });
            result = await response.json().catch(() => ({}));
            if (!response.ok) {
                console.warn('[Backend Restore API Notice]', result);
            }
        } catch (netErr) {
            console.warn('[Backend Restore API Network Notice]:', netErr);
        }

        // 2. Safely merge backup data with active cache to prevent losing existing records
        let mergedData = backupData;
        if (dbCache) {
            mergedData = {
                ...dbCache,
                ...backupData,
                users: [
                    ...(dbCache.users || []).filter(u => !(backupData.users || []).some(bu => String(bu.id) === String(u.id) || (bu.email && u.email && bu.email.toLowerCase() === u.email.toLowerCase()))),
                    ...(backupData.users || [])
                ],
                appointments: [
                    ...(dbCache.appointments || []).filter(a => !(backupData.appointments || []).some(ba => String(ba.id) === String(a.id))),
                    ...(backupData.appointments || [])
                ],
                medical_records: { ...(dbCache.medical_records || {}), ...(backupData.medical_records || {}) },
                dental_charts: { ...(dbCache.dental_charts || {}), ...(backupData.dental_charts || {}) },
                intraoral_charts: { ...(dbCache.intraoral_charts || {}), ...(backupData.intraoral_charts || {}) },
                patient_charts: { ...(dbCache.patient_charts || {}), ...(backupData.patient_charts || {}) },
                xray_records: { ...(dbCache.xray_records || {}), ...(backupData.xray_records || {}) },
                consent_records: [
                    ...(dbCache.consent_records || []).filter(c => !(backupData.consent_records || []).some(bc => (bc.email || '').toLowerCase() === (c.email || '').toLowerCase())),
                    ...(backupData.consent_records || [])
                ],
                pricelist: backupData.pricelist && backupData.pricelist.length > 0 ? backupData.pricelist : (dbCache.pricelist || [])
            };
        }

        const checked = checkAndCompletePastAppointments(mergedData);
        const finalData = checked.db;

        dbCache = finalData;
        lastSyncedDb = JSON.parse(JSON.stringify(finalData));

        // Purge legacy localStorage
        try {
            localStorage.removeItem('doc_dental_db');
        } catch (e) {}

        // Dispatch window event for immediate UI update
        try {
            window.dispatchEvent(new CustomEvent('doc_dental_db_updated', { detail: finalData }));
        } catch (e) {}

        // Dispatch cross-tab broadcast
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('doc_dental_sync_channel');
                bc.postMessage({ type: 'db_updated', db: finalData });
                bc.close();
            }
        } catch (e) {}

        // Broadcast realtime SSE event
        try {
            broadcastRealtimeEvent('db_updated', {
                type: 'database_restored',
                mode,
                restoredBy,
                timestamp: new Date().toISOString()
            });
        } catch (e) {}

        return {
            success: true,
            message: result.message || 'Database restored successfully.',
            counts: result.counts || {},
            data: finalData
        };
    } catch (err) {
        console.error('Error in restoreDatabase:', err);
        await writeDatabase(backupData);
        return {
            success: true,
            warning: 'Database state restored into active application session.',
            data: backupData
        };
    }
};

// Direct Atomic Patient Registration to MySQL Backend
export const registerPatientDirectly = async (patientPayload) => {
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/register-patient`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patientPayload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            console.error('[MySQL Backend Direct Patient Registration Error]', data);
            return { success: false, error: data.error || 'Server error' };
        }

        broadcastRealtimeEvent('db_updated', { type: 'patient_registered', timestamp: new Date().toISOString() });
        return { success: true, data };
    } catch (e) {
        console.error('[MySQL Backend Direct Patient Registration Network Error]:', e);
        return { success: false, error: e.message };
    }
};

// Direct Atomic User Deletion from MySQL Backend
export const deleteUserDirectly = async (id, email) => {
    try {
        const identifier = id || email;
        const response = await fetch(`${getApiBaseUrl()}/api/users/${encodeURIComponent(identifier)}`, {
            method: 'DELETE'
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            console.error('[MySQL Backend Direct User Deletion Error]', data);
            return { success: false, error: data.error || 'Delete failed' };
        }

        broadcastRealtimeEvent('db_updated', { type: 'user_deleted', id, email, timestamp: new Date().toISOString() });
        return { success: true, data };
    } catch (e) {
        console.error('[MySQL Backend Direct User Deletion Network Error]:', e);
        return { success: false, error: e.message };
    }
};

// Direct Atomic Appointment Deletion from MySQL Backend
export const deleteAppointmentDirectly = async (id) => {
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/appointments/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: data.error || 'Delete failed' };
        }

        broadcastRealtimeEvent('db_updated', { type: 'appointment_deleted', id, timestamp: new Date().toISOString() });
        return { success: true, data };
    } catch (e) {
        return { success: false, error: e.message };
    }
};

// Listen to multi-tab broadcast sync
let broadcastChannel = null;
try {
    if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('doc_dental_sync_channel');
        broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'db_updated' && event.data.db) {
                dbCache = event.data.db;
                lastSyncedDb = JSON.parse(JSON.stringify(event.data.db));
                window.dispatchEvent(new CustomEvent('doc_dental_db_updated', { detail: event.data.db }));
                window.dispatchEvent(new CustomEvent('notificationUpdated', { detail: event.data.db }));
            }
        };
    }
} catch (e) {}

export const defaultInitialPricelist = [];

// Pricelist wrapper (MySQL Backend)
export const getPricelist = async () => {
    if (pricelistCache && pricelistCache.length > 0) return pricelistCache;
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/pricelist`);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                pricelistCache = data;
                return data;
            }
        }
    } catch (e) {
        console.error('Error fetching pricelist from MySQL API:', e);
    }

    return pricelistCache || [];
};

export const savePricelist = async (newList) => {
    pricelistCache = newList;
    try {
        await fetch(`${getApiBaseUrl()}/api/pricelist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newList)
        });
    } catch (e) {
        console.error('Error saving pricelist to MySQL API:', e);
    }
};

export const readPricelist = (fallback = []) => pricelistCache || fallback;
export const writePricelist = (list) => { return savePricelist(list); };

// Profile pics wrapper (MySQL Backend)
export const getProfilePic = async (email) => {
    if (picCache[email]) return picCache[email];
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/profile-pic/${encodeURIComponent(email)}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.photo_data) {
                picCache[email] = data.photo_data;
                return data.photo_data;
            }
        }
        return null;
    } catch (e) {
        console.error('Error fetching profile pic from MySQL API:', e);
        return null;
    }
};

export const saveProfilePic = async (email, pic) => {
    picCache[email] = pic;
    try {
        await fetch(`${getApiBaseUrl()}/api/profile-pic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, pic })
        });
    } catch (e) {
        console.error('Error saving profile pic to MySQL API:', e);
    }
};

export const readProfilePic = (email) => picCache[email] || null;
export const writeProfilePic = (email, pic) => { return saveProfilePic(email, pic); };

// Load profile pictures bulk
export const loadAllProfilePics = async () => {
    try {
        const token = getAuthToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${getApiBaseUrl()}/api/profile-pics`, {
            headers,
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                data.forEach(p => {
                    picCache[p.email] = p.photo_data;
                });
            }
        }
    } catch (e) {
        console.error('Error loading bulk profile pics from MySQL API:', e);
    }
};

// 10-Minute Inactivity Session Management
export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

// Session activity timestamp updater
export const touchSession = () => {
    try {
        const now = Date.now();
        sessionStorage.setItem('doc_dental_last_active', String(now));
        localStorage.setItem('doc_dental_last_active', String(now));
    } catch (e) {}
};

export const getLastSessionActivity = () => {
    try {
        const ts = sessionStorage.getItem('doc_dental_last_active') || localStorage.getItem('doc_dental_last_active');
        return ts ? Number(ts) : null;
    } catch (e) {
        return null;
    }
};

// Session management with 10-min inactivity check
export const readSession = () => {
    try {
        const rawSession = sessionStorage.getItem('current_session');
        if (!rawSession) return null;

        const lastActive = getLastSessionActivity();
        const now = Date.now();

        // Expire if idle for 10+ minutes
        if (lastActive && (now - lastActive > INACTIVITY_TIMEOUT_MS)) {
            console.warn('[Session Inactivity] Auto-expired session after 10 minutes of inactivity.');
            clearSession();
            return null;
        }

        return JSON.parse(rawSession);
    } catch (e) {
        return null;
    }
};

export const writeSession = (user) => {
    try {
        if (!user) {
            clearSession();
        } else {
            const now = Date.now();
            sessionStorage.setItem('current_session', JSON.stringify(user));
            sessionStorage.setItem('doc_dental_last_active', String(now));
            localStorage.setItem('doc_dental_last_active', String(now));
        }
        return true;
    } catch (e) {
        return false;
    }
};

export const clearSession = () => {
    try {
        sessionStorage.removeItem('current_session');
        sessionStorage.removeItem('doc_dental_last_active');
        localStorage.removeItem('doc_dental_last_active');
        clearAuthToken();
    } catch (e) {}
};

// Reset system
export const clearDatabase = async () => {
    dbCache = null;
    lastSyncedDb = null;
    pricelistCache = null;
    clearSession();
};

let realtimeConnected = false;

export const subscribeToRealtimeDb = () => {
    if (realtimeConnected) return;
    realtimeConnected = true;

    try {
        connectRealtime();
        onRealtimeEvent('db_updated', async () => {
            console.log('[Realtime SSE] Live database change event received');
            const freshDb = await getDatabase(true);
            if (freshDb) {
                window.dispatchEvent(new CustomEvent('doc_dental_db_updated', { detail: freshDb }));
                window.dispatchEvent(new CustomEvent('notificationUpdated', { detail: freshDb }));
            }
        });
    } catch (e) {
        console.error('[Realtime SSE] Failed to initialize live stream listener:', e);
    }
};

export const forceSyncIntraoralCharts = async () => {
    try {
        const db = dbCache || readDatabase() || {};
        writeDatabase(db);
    } catch (e) {}
};
