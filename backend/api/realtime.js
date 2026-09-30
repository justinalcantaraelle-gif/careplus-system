

const express = require('express');
const { verifyAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// Set of active client response streams
const clients = new Set();

/**
 * Helper to broadcast an event to all connected clients, a specific email, or specific roles
 * @param {string} event - Event name (e.g. 'appointment_updated', 'emergency_closure', 'brace_color_approved')
 * @param {object} data - Payload data
 * @param {string|null} targetEmail - Optional target user email
 * @param {string[]|string|null} targetRoles - Optional target roles (e.g. ['superadmin'], ['admin', 'staff'])
 */
function broadcast(event, data, targetEmail = null, targetRoles = null) {
    const payload = JSON.stringify(data);
    const message = `event: ${event}\ndata: ${payload}\n\n`;

    let rolesFilter = null;
    if (targetRoles) {
        rolesFilter = (Array.isArray(targetRoles) ? targetRoles : [targetRoles])
            .map(r => String(r).toLowerCase().replace(/[\s_]+/g, ''));
    }

    clients.forEach(client => {
        const clientEmail = (client.userEmail || '').toLowerCase().trim();
        const clientRole = (client.role || '').toLowerCase().replace(/[\s_]+/g, '');

        // 1. Email check
        if (targetEmail && clientEmail !== targetEmail.toLowerCase().trim()) {
            return;
        }

        // 2. Role check
        if (rolesFilter && rolesFilter.length > 0) {
            if (!rolesFilter.includes(clientRole)) {
                return;
            }
        }

        try {
            client.res.write(message);
        } catch (err) {
            console.error('[Realtime Broadcast Error]', err.message);
        }
    });
}

// 1. GET /api/realtime/stream -> Connect to real-time event stream
router.get('/realtime/stream', (req, res) => {
    const userEmail = (req.query.email || '').toLowerCase().trim();
    const role = (req.query.role || '').toLowerCase().trim();

    // Set SSE Headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    res.flushHeaders?.();

    const clientRecord = { res, userEmail, role, connectedAt: new Date() };
    clients.add(clientRecord);

    console.log(`[Realtime Stream] Client connected: ${userEmail || 'Anonymous'} (Role: ${role || 'guest'}). Total active: ${clients.size}`);

    // Send initial connection greeting
    res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to Doc Dental Real-time Stream', timestamp: new Date().toISOString() })}\n\n`);

    // Keep connection alive with heartbeat ping every 25 seconds
    const pingInterval = setInterval(() => {
        try {
            res.write(': keepalive\n\n');
        } catch (e) {
            clearInterval(pingInterval);
        }
    }, 25000);

    // Clean up when client disconnects
    req.on('close', () => {
        clearInterval(pingInterval);
        clients.delete(clientRecord);
        console.log(`[Realtime Stream] Client disconnected: ${userEmail || 'Anonymous'}. Total active: ${clients.size}`);
    });
});

// 2. POST /api/realtime/broadcast -> Broadcast an event to all, roles, or specific users
router.post('/realtime/broadcast', (req, res) => {
    const { event, payload, targetEmail, targetRoles } = req.body;

    if (!event) {
        return res.status(400).json({ error: 'Parameter "event" is required.' });
    }

    const resolvedRoles = targetRoles || payload?.targetRoles || (payload?.recipient === 'superadmin' ? ['superadmin'] : null);
    broadcast(event, payload || {}, targetEmail || null, resolvedRoles);

    res.json({
        success: true,
        message: `Event "${event}" broadcasted successfully.`,
        recipientCount: clients.size
    });
});

// 3. GET /api/realtime/status -> Inspect connection status (Superadmin & Admin Only)
router.get('/realtime/status', verifyAuth, requireRole('superadmin', 'admin'), (req, res) => {
    res.json({
        status: 'Online',
        activeClientsCount: clients.size,
        activeStreams: Array.from(clients).map(c => ({
            email: c.userEmail || 'Anonymous',
            role: c.role || 'guest',
            connectedAt: c.connectedAt
        }))
    });
});

module.exports = {
    router,
    broadcast
};
