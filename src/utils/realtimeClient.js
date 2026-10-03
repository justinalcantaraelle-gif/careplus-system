/**
 * Real-Time Client Service using Server-Sent Events (SSE)
 * Connects frontend React components to backend live database events.
 */

let eventSource = null;
const listeners = new Map();

let currentEmail = null;
let currentRole = null;

/**
 * Connect to the backend real-time stream
 * @param {string} userEmail - Current user email
 * @param {string} role - Current user role
 */
export const connectRealtime = (userEmail = '', role = '') => {
    let email = (userEmail || '').trim().toLowerCase();
    let userRole = (role || '').trim().toLowerCase();

    // Auto-detect from active session if not provided
    if (!email && typeof window !== 'undefined') {
        try {
            const raw = sessionStorage.getItem('current_session');
            if (raw) {
                const parsed = JSON.parse(raw);
                email = (parsed.email || '').trim().toLowerCase();
                userRole = (parsed.role || '').trim().toLowerCase();
            }
        } catch (e) {}
    }

    if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
        if (currentEmail === email && currentRole === userRole) {
            return eventSource;
        }
        // Credentials changed (e.g. login or switch account) - close existing stream and re-open
        try {
            eventSource.close();
        } catch (e) {}
        eventSource = null;
    }

    currentEmail = email;
    currentRole = userRole;

    const backendUrl = (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
        ? window.location.origin
        : (process.env.REACT_APP_API_URL || 'http://localhost:5000');
    const streamUrl = `${backendUrl}/api/realtime/stream?email=${encodeURIComponent(email)}&role=${encodeURIComponent(userRole)}`;

    eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('connected', (e) => {
        console.log('[Realtime SSE] Connected to server stream:', e.data);
    });

    eventSource.onerror = (err) => {
        console.warn('[Realtime SSE] Stream connection warning (will retry automatically):', err);
    };

    // Forward received events to registered listeners
    const handleEvent = (eventName, eventObj) => {
        try {
            const data = JSON.parse(eventObj.data);
            const specificListeners = listeners.get(eventName) || [];
            specificListeners.forEach(callback => callback(data));
            const wildcardListeners = listeners.get('*') || [];
            wildcardListeners.forEach(callback => callback(eventName, data));
        } catch (err) {
            console.error(`[Realtime SSE] Error processing event "${eventName}":`, err);
        }
    };

    const commonEvents = [
        'appointment_created',
        'appointment_updated',
        'emergency_closure',
        'brace_color_approved',
        'notification_new',
        'consent_signed',
        'db_updated'
    ];

    commonEvents.forEach(evt => {
        eventSource.addEventListener(evt, (e) => handleEvent(evt, e));
    });

    return eventSource;
};

/**
 * Subscribe to real-time events.
 * Can be called with (eventName, callback) or simply (callback) to listen to all events.
 * @param {string|Function} eventNameOrCallback - Event name or handler for all events
 * @param {Function} [callback] - Function called with payload data
 * @returns {Function} Unsubscribe function
 */
export const onRealtimeEvent = (eventNameOrCallback, callback) => {
    let eventName = eventNameOrCallback;
    let actualCallback = callback;

    if (typeof eventNameOrCallback === 'function') {
        eventName = '*';
        actualCallback = eventNameOrCallback;
    }

    if (!listeners.has(eventName)) {
        listeners.set(eventName, []);
    }
    listeners.get(eventName).push(actualCallback);

    return () => {
        const list = listeners.get(eventName) || [];
        listeners.set(eventName, list.filter(cb => cb !== actualCallback));
    };
};

/**
 * Broadcast an event to all connected users, target roles, or specific user via Backend API
 * @param {string} event - Event name
 * @param {object} payload - Event data
 * @param {string|null} targetEmail - Optional target email
 * @param {string[]|string|null} targetRoles - Optional target roles (e.g. ['superadmin'], ['admin', 'staff'])
 */
export const broadcastRealtimeEvent = async (event, payload = {}, targetEmail = null, targetRoles = null) => {
    const backendUrl = (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
        ? window.location.origin
        : (process.env.REACT_APP_API_URL || 'http://localhost:5000');
    try {
        const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch(`${backendUrl}/api/realtime/broadcast`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ event, payload, targetEmail, targetRoles })
        });
    } catch (err) {
        console.error('[Realtime Broadcast Error]', err);
    }
};

export const disconnectRealtime = () => {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
        console.log('[Realtime SSE] Disconnected from server stream.');
    }
};
