/**
 * auth.js
 * Express authentication & authorization middleware functions.
 * Supports Stateful (DB-Integrated Token) Verification.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'careplus_clinic_management_secure_jwt_secret_2026';

const verifyAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    const cookieToken = req.cookies ? req.cookies.token : null;
    
    // Accept token from HttpOnly cookie (most secure) OR Bearer header
    const token = cookieToken || headerToken;

    if (!token) {
        return res.status(401).json({ 
            error: 'Access Denied: Missing authorization token.',
            code: 'UNAUTHORIZED'
        });
    }


    try {
        // 1. Cryptographic Verification of JWT
        const decoded = jwt.verify(token, JWT_SECRET);

        // 2. Stateful Check: Check Database Pool to ensure token exists and has not been revoked/expired
        const pool = req.app ? req.app.get('dbPool') : null;
        if (pool) {
            const queryRes = await pool.query(
                'SELECT * FROM user_tokens WHERE token = ? AND expires_at > NOW()',
                [token]
            );
            const rows = Array.isArray(queryRes[0]) ? queryRes[0] : (queryRes.rows || []);

            if (rows.length === 0) {
                return res.status(401).json({
                    error: 'Access Denied: Token is invalid, expired, or has been logged out.',
                    code: 'TOKEN_REVOKED'
                });
            }
        }

        // 3. Attach user payload and raw token to request
        req.user = decoded;
        req.token = token;
        next();
    } catch (err) {
        return res.status(403).json({ 
            error: 'Access Denied: Invalid or expired authorization token.',
            code: 'FORBIDDEN',
            details: err.message
        });
    }
};

const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: User authentication required.' });
        }

        const userRole = (req.user.role || '').toLowerCase();
        const hasRole = allowedRoles.some(r => r.toLowerCase() === userRole);

        if (!hasRole) {
            return res.status(403).json({ 
                error: `Forbidden: Requires one of [${allowedRoles.join(', ')}] permissions.` 
            });
        }

        next();
    };
};

module.exports = { verifyAuth, requireRole, JWT_SECRET };

