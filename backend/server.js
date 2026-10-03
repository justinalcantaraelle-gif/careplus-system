const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from parent folder
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || (process.env.VERCEL ? process.env.PORT : 5000) || 5000;

const cookieParser = require('cookie-parser');

// Import Custom Middlewares
const requestLogger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const { verifyAuth, requireRole, JWT_SECRET } = require('./middleware/auth');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { router: realtimeRouter, broadcast } = require('./api/realtime');

// Helper for Bcrypt Password Hashing
const hashPassword = async (plainText) => {
    if (!plainText) return plainText;
    if (typeof plainText === 'string' && (plainText.startsWith('$2a$') || plainText.startsWith('$2b$'))) {
        return plainText; // Already a bcrypt hash
    }
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plainText, salt);
};

// Import MySQL Database Connection Pool
const mysqlPool = require('./mysql_db');
app.set('dbPool', mysqlPool);

// Schema auto-creation and migration helper
const ensureDatabaseSchema = async (pool) => {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NULL,
                temp_otp VARCHAR(255) NULL,
                reset_token VARCHAR(255) NULL,
                reset_token_expires BIGINT NULL,
                otp_status VARCHAR(50) NULL,
                banned_until VARCHAR(100) NULL,
                patient_type VARCHAR(50) NULL DEFAULT 'New Patient',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_email (email),
                INDEX idx_user_role (role)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Graceful column migrations for existing users table
        try {
            await pool.query('ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL');
        } catch (e) {}
        try {
            await pool.query('ALTER TABLE users ADD COLUMN reset_token_expires BIGINT NULL');
        } catch (e) {}
        try {
            await pool.query('ALTER TABLE users MODIFY COLUMN temp_otp VARCHAR(255) NULL');
        } catch (e) {}

        await pool.query(`
            CREATE TABLE IF NOT EXISTS appointments (
                id BIGINT PRIMARY KEY,
                patient_email VARCHAR(255) NOT NULL,
                patient_name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NULL,
                service VARCHAR(255) NULL,
                duration VARCHAR(50) NULL,
                date VARCHAR(50) NULL,
                time VARCHAR(50) NULL,
                notes TEXT NULL,
                status VARCHAR(50) DEFAULT 'Pending',
                cancelled_due_to_emergency BOOLEAN DEFAULT FALSE,
                emergency_reason TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_app_patient_email (patient_email),
                INDEX idx_app_date (date),
                INDEX idx_app_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS medical_records (
                email VARCHAR(255) PRIMARY KEY,
                record_data JSON NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_med_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS dental_charts (
                email VARCHAR(255) PRIMARY KEY,
                chart_data JSON NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_dental_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS intraoral_charts (
                email VARCHAR(255) PRIMARY KEY,
                chart_data JSON NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_intra_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS patient_charts (
                email VARCHAR(255) PRIMARY KEY,
                chart_data JSON NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_patient_chart_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id BIGINT PRIMARY KEY,
                action VARCHAR(255) NOT NULL,
                details TEXT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_timestamp (timestamp)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS clinic_pricelist (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category VARCHAR(255) NOT NULL,
                service VARCHAR(255) NOT NULL,
                price VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_price_category (category)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS profile_pics (
                email VARCHAR(255) PRIMARY KEY,
                photo_data LONGTEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_pic_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS consent_records (
                email VARCHAR(255) PRIMARY KEY,
                signature LONGTEXT NOT NULL,
                date_signed VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_consent_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                email VARCHAR(255) NOT NULL,
                token TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                INDEX idx_token_email (email),
                INDEX idx_token_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS xray_records (
                email VARCHAR(255) PRIMARY KEY,
                record_data JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_xray_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // CarePlus Multi-Branch Tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS clinic_branches (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                short_name VARCHAR(100) NOT NULL,
                tag VARCHAR(100) NULL,
                address TEXT NOT NULL,
                phone VARCHAR(50) NULL,
                hours VARCHAR(100) NULL,
                email VARCHAR(255) NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS consultations (
                id BIGINT PRIMARY KEY,
                patient_name VARCHAR(255) NOT NULL,
                patient_email VARCHAR(255) NOT NULL,
                doctor_name VARCHAR(255) NOT NULL,
                branch VARCHAR(100) NOT NULL,
                date VARCHAR(50) NOT NULL,
                chief_complaint TEXT NULL,
                vital_signs JSON NULL,
                diagnosis TEXT NULL,
                clinical_notes TEXT NULL,
                prescriptions JSON NULL,
                lab_orders JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cons_email (patient_email),
                INDEX idx_cons_branch (branch)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS laboratory_requests (
                id BIGINT PRIMARY KEY,
                patient_name VARCHAR(255) NOT NULL,
                patient_email VARCHAR(255) NOT NULL,
                test_code VARCHAR(50) NOT NULL,
                test_name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                branch VARCHAR(100) NOT NULL,
                doctor VARCHAR(255) NOT NULL,
                date VARCHAR(50) NOT NULL,
                specimen VARCHAR(100) NULL,
                status VARCHAR(50) DEFAULT 'Processing',
                results JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_lab_email (patient_email),
                INDEX idx_lab_branch (branch)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS billing_records (
                id BIGINT PRIMARY KEY,
                patient_name VARCHAR(255) NOT NULL,
                patient_email VARCHAR(255) NOT NULL,
                branch VARCHAR(100) NOT NULL,
                date VARCHAR(50) NOT NULL,
                items JSON NOT NULL,
                total_amount DECIMAL(10, 2) NOT NULL,
                discount DECIMAL(10, 2) DEFAULT 0,
                amount_paid DECIMAL(10, 2) NOT NULL,
                payment_method VARCHAR(50) NOT NULL,
                status VARCHAR(50) DEFAULT 'Paid',
                receipt_number VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_bill_email (patient_email),
                INDEX idx_bill_branch (branch)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        try {
            await pool.query('ALTER TABLE appointments ADD COLUMN branch VARCHAR(100) NULL');
        } catch (e) {}
        try {
            await pool.query('ALTER TABLE appointments ADD COLUMN doctor VARCHAR(255) NULL');
        } catch (e) {}

        // Automated Bcrypt Migration: Upgrade any legacy plaintext passwords to Bcrypt hashes
        try {
            const [plainUsers] = await pool.query("SELECT id, email, password FROM users WHERE password NOT LIKE '$2%'");
            for (const u of (plainUsers || [])) {
                if (u.password && !u.password.startsWith('$2')) {
                    const hashed = await hashPassword(u.password);
                    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, u.id]);
                    console.log(`[Bcrypt Migration] Upgraded password for ${u.email} to secure hash.`);
                }
            }
        } catch (migErr) {
            console.warn('[Bcrypt Migration Note]:', migErr.message);
        }
    } catch (e) {
        console.warn('[MySQL DB Auto-Schema Note]:', e.message);
    }
};

// Run schema initialization asynchronously
ensureDatabaseSchema(mysqlPool);

// Enable Hardened CORS & Core Parsers
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'https://doc-dental-care-clinic.vercel.app'
];
if (process.env.APP_BASE_URL) {
    allowedOrigins.push(process.env.APP_BASE_URL.replace(/\/+$/, ''));
}

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isAllowed = allowedOrigins.some(ao => origin === ao || origin.startsWith(ao));
        if (isAllowed || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Blocked by CORS policy'));
        }
    },
    credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // support base64 image strings safely
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(requestLogger); // Global HTTP Request Logger

// Cloudflare-grade Security Response Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// Rate Limiter Middleware for Auth & Email OTP endpoints
const rateLimitMap = new Map();
const sensitiveApiLimiter = (maxRequests = 10, windowMs = 60000) => (req, res, next) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip').split(',')[0].trim();
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    } else {
        const record = rateLimitMap.get(key);
        if (now > record.resetAt) {
            record.count = 1;
            record.resetAt = now + windowMs;
        } else {
            record.count += 1;
            if (record.count > maxRequests) {
                return res.status(429).json({
                    error: 'Too Many Requests',
                    details: 'Rate limit exceeded. Please wait 60 seconds before trying again.'
                });
            }
        }
    }
    next();
};

// Apply rate limiting to sensitive routes
app.use(['/api/send-otp', '/api/send-verification-otp', '/api/send-reset-link', '/api/send-password-reset', '/api/auth/login'], sensitiveApiLimiter(10, 60000));

// 0. API Index & Root Welcome Routes
app.get(['/', '/api'], (req, res) => {
    res.json({
        name: 'Doc Dental Care API Server (MySQL Edition)',
        status: 'Online',
        version: '2.0.0',
        databaseEngine: 'MySQL',
        availableEndpoints: {
            health: '/api/health',
            dbStatus: '/api/db-status',
            database: '/api/database',
            databaseSync: 'POST /api/sync',
            pricelist: '/api/pricelist',
            profilePics: '/api/profile-pics',
            authLogin: 'POST /api/auth/login',
            authLogout: 'POST /api/auth/logout',
            authMe: 'GET /api/auth/me',
            realtimeStream: 'GET /api/realtime/stream',
            realtimeBroadcast: 'POST /api/realtime/broadcast'
        }
    });
});

// 1. General Health Check API
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        database: 'MySQL',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// 2. Database Status Check API
app.get('/api/db-status', async (req, res) => {
    try {
        const [result] = await mysqlPool.query('SELECT NOW() as db_time');
        const [usersCount] = await mysqlPool.query('SELECT COUNT(*) as count FROM users').catch(() => [[{ count: 0 }]]);
        const [appCount] = await mysqlPool.query('SELECT COUNT(*) as count FROM appointments').catch(() => [[{ count: 0 }]]);
        const [medCount] = await mysqlPool.query('SELECT COUNT(*) as count FROM medical_records').catch(() => [[{ count: 0 }]]);

        res.json({
            status: 'CONNECTED',
            database: 'MySQL',
            databaseTime: result[0]?.db_time,
            host: process.env.MYSQL_HOST || 'localhost',
            databaseName: process.env.MYSQL_DATABASE || 'doc_dental_db',
            stats: {
                users: usersCount[0]?.count ?? 0,
                appointments: appCount[0]?.count ?? 0,
                medicalRecords: medCount[0]?.count ?? 0
            }
        });
    } catch (err) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Failed to connect to MySQL database.',
            error: err.message,
            code: err.code || 'UNKNOWN_ERROR',
            host: process.env.MYSQL_HOST || 'localhost',
            databaseName: process.env.MYSQL_DATABASE || 'doc_dental_db',
            hint: (process.env.MYSQL_HOST === 'localhost' || !process.env.MYSQL_HOST) && process.env.VERCEL
                ? 'On Vercel, "localhost" points to the cloud serverless container rather than your local PC XAMPP MySQL. Set MYSQL_HOST to your remote cloud database in Vercel Environment Variables.'
                : undefined
        });
    }
});

// 2. Cloudflare Turnstile Server-Side Siteverify Endpoint
app.post('/api/verify-turnstile', async (req, res) => {
    const secretKey = process.env.TURNSTILE_SECRET_KEY || '0x4AAAAAAEGRwO3jOEN2k3Q1wYG-DVJmE4A';
    const token = req.body?.turnstileToken || req.body?.token;

    if (!token) {
        return res.status(400).json({ success: false, error: 'Turnstile token missing' });
    }

    // Only allow bypass for official Cloudflare test keys in non-production environments
    const isTestKey = secretKey.startsWith('1x0000') || secretKey.startsWith('2x0000');
    if (isTestKey && process.env.NODE_ENV !== 'production' && (token === 'bypass' || token.startsWith('XXXX'))) {
        return res.json({ success: true, bypassed: true });
    }

    try {
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
        const formData = new URLSearchParams();
        formData.append('secret', secretKey);
        formData.append('response', token);
        if (ip) formData.append('remoteip', ip);

        const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        const outcome = await cfRes.json();
        console.log('[Turnstile Siteverify Outcome]:', outcome);
        return res.json(outcome);
    } catch (err) {
        console.error('[Turnstile Siteverify Catch]:', err.message);
        return res.status(502).json({ success: false, error: 'Turnstile verification service unreachable' });
    }
});

// 3. GET Entire Database State API (Protected with Role-Based Scoping & Sensitive Field Stripping)
app.get(['/api/database', '/database'], verifyAuth, async (req, res) => {
    const userRole = (req.user?.role || '').toLowerCase();
    const userEmail = (req.user?.email || '').trim().toLowerCase();

    const fetchDb = async () => {
        const [
            [usersRes],
            [appointmentsRes],
            [medRecordsRes],
            [dentalChartsRes],
            [intraoralChartsRes],
            [patientChartsRes],
            [auditLogsRes],
            [consentRes],
            [xrayRes],
            [consultationsRes],
            [labRes],
            [billingRes],
            [branchesRes]
        ] = await Promise.all([
            mysqlPool.query('SELECT id, email, role, full_name, phone, patient_type, otp_status, banned_until, created_at FROM users'),
            mysqlPool.query('SELECT * FROM appointments'),
            mysqlPool.query('SELECT * FROM medical_records'),
            mysqlPool.query('SELECT * FROM dental_charts'),
            mysqlPool.query('SELECT * FROM intraoral_charts'),
            mysqlPool.query('SELECT * FROM patient_charts'),
            mysqlPool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 300'),
            mysqlPool.query('SELECT * FROM consent_records'),
            mysqlPool.query('SELECT * FROM xray_records'),
            mysqlPool.query('SELECT * FROM consultations ORDER BY id DESC').catch(() => [[]]),
            mysqlPool.query('SELECT * FROM laboratory_requests ORDER BY id DESC').catch(() => [[]]),
            mysqlPool.query('SELECT * FROM billing_records ORDER BY id DESC').catch(() => [[]]),
            mysqlPool.query('SELECT * FROM clinic_branches').catch(() => [[]])
        ]);

        const parseJsonData = (val) => {
            if (!val) return {};
            if (typeof val === 'object') return val;
            try { return JSON.parse(val); } catch (e) { return {}; }
        };

        const db = {
            users: (usersRes || []).map(r => ({
                id: Number(r.id),
                email: (r.email || '').trim().toLowerCase(),
                role: r.role,
                patientType: r.patient_type || (r.role === 'Patient' ? 'New Patient' : null),
                fullName: r.full_name,
                name: r.full_name,
                phone: r.phone,
                contactNo: r.phone,
                contactNumber: r.phone,
                otp_status: r.otp_status,
                bannedUntil: r.banned_until,
                createdAt: r.created_at
            })),
            appointments: (appointmentsRes || []).map(r => ({
                id: Number(r.id),
                patientEmail: (r.patient_email || '').trim().toLowerCase(),
                patientName: r.patient_name,
                category: r.category,
                service: r.service,
                duration: r.duration,
                date: r.date,
                time: r.time,
                notes: r.notes,
                branch: r.branch || 'CarePlus Metro Branch',
                doctor: r.doctor || 'Dr. Robert Chen, MD',
                status: r.status,
                cancelledDueToEmergency: Boolean(r.cancelled_due_to_emergency),
                emergencyReason: r.emergency_reason,
                createdAt: r.created_at
            })),
            consultations: (consultationsRes || []).map(r => ({
                id: Number(r.id),
                patientName: r.patient_name,
                patientEmail: (r.patient_email || '').trim().toLowerCase(),
                doctorName: r.doctor_name,
                branch: r.branch,
                date: r.date,
                chiefComplaint: r.chief_complaint,
                vitalSigns: parseJsonData(r.vital_signs),
                diagnosis: r.diagnosis,
                clinicalNotes: r.clinical_notes,
                prescriptions: Array.isArray(parseJsonData(r.prescriptions)) ? parseJsonData(r.prescriptions) : [],
                labOrders: Array.isArray(parseJsonData(r.lab_orders)) ? parseJsonData(r.lab_orders) : [],
                createdAt: r.created_at
            })),
            laboratory_requests: (labRes || []).map(r => ({
                id: Number(r.id),
                patientName: r.patient_name,
                patientEmail: (r.patient_email || '').trim().toLowerCase(),
                testCode: r.test_code,
                testName: r.test_name,
                category: r.category,
                branch: r.branch,
                doctor: r.doctor,
                date: r.date,
                specimen: r.specimen,
                status: r.status,
                results: Array.isArray(parseJsonData(r.results)) ? parseJsonData(r.results) : [],
                createdAt: r.created_at
            })),
            billing_records: (billingRes || []).map(r => ({
                id: Number(r.id),
                patientName: r.patient_name,
                patientEmail: (r.patient_email || '').trim().toLowerCase(),
                branch: r.branch,
                date: r.date,
                items: Array.isArray(parseJsonData(r.items)) ? parseJsonData(r.items) : [],
                totalAmount: Number(r.total_amount),
                discount: Number(r.discount),
                amountPaid: Number(r.amount_paid),
                paymentMethod: r.payment_method,
                status: r.status,
                receiptNumber: r.receipt_number,
                createdAt: r.created_at
            })),
            branches: (branchesRes || []).map(r => ({
                id: r.id,
                name: r.name,
                shortName: r.short_name,
                tag: r.tag,
                address: r.address,
                phone: r.phone,
                hours: r.hours,
                email: r.email
            })),
            medical_records: {},
            dental_charts: {},
            intraoral_charts: {},
            patient_charts: {},
            auditLogs: (auditLogsRes || []).map(r => ({
                id: Number(r.id),
                action: r.action,
                details: r.details,
                timestamp: r.timestamp
            })),
            consent_records: (consentRes || []).map(r => ({
                email: (r.email || '').trim().toLowerCase(),
                signature: r.signature,
                dateSigned: r.date_signed,
                date_signed: r.date_signed
            })),
            xray_records: {}
        };

        (medRecordsRes || []).forEach(r => {
            if (r.email) {
                const normEmail = r.email.toLowerCase().trim();
                db.medical_records[normEmail] = parseJsonData(r.record_data);
                const u = db.users.find(usr => usr.email === normEmail);
                if (u && (!u.patientType || u.patientType === 'New Patient') && db.medical_records[normEmail]?.patientType) {
                    u.patientType = db.medical_records[normEmail].patientType;
                }
            }
        });
        (dentalChartsRes || []).forEach(r => { if (r.email) db.dental_charts[r.email.toLowerCase().trim()] = parseJsonData(r.chart_data); });
        (intraoralChartsRes || []).forEach(r => { if (r.email) db.intraoral_charts[r.email.toLowerCase().trim()] = parseJsonData(r.chart_data); });
        (patientChartsRes || []).forEach(r => { if (r.email) db.patient_charts[r.email.toLowerCase().trim()] = parseJsonData(r.chart_data); });
        (xrayRes || []).forEach(r => { if (r.email) db.xray_records[r.email.toLowerCase().trim()] = parseJsonData(r.record_data); });

        // Scoping logic:
        if (userRole === 'patient') {
            // Patient view: restricted strictly to own records
            const patientUser = db.users.filter(u => u.email === userEmail);
            const patientAppointments = db.appointments.filter(a => a.patientEmail === userEmail);
            const patientMed = db.medical_records[userEmail] ? { [userEmail]: db.medical_records[userEmail] } : {};
            const patientConsultations = (db.consultations || []).filter(c => c.patientEmail === userEmail);
            const patientLabs = (db.laboratory_requests || []).filter(l => l.patientEmail === userEmail);
            const patientBilling = (db.billing_records || []).filter(b => b.patientEmail === userEmail);
            const patientConsent = db.consent_records.filter(c => c.email === userEmail);
            const patientCharts = {
                clinic_settings: db.patient_charts?.clinic_settings || {},
                notifications: {
                    notifications: {},
                    appointment_notifications: (db.patient_charts?.notifications?.appointment_notifications || []).filter(n => (n.patientEmail || '').toLowerCase() === userEmail)
                }
            };

            return {
                users: patientUser,
                appointments: patientAppointments,
                consultations: patientConsultations,
                laboratory_requests: patientLabs,
                billing_records: patientBilling,
                branches: db.branches || [],
                medical_records: patientMed,
                dental_charts: {},
                intraoral_charts: {},
                patient_charts: patientCharts,
                consent_records: patientConsent,
                xray_records: {},
                auditLogs: []
            };
        }

        if (['superadmin', 'admin', 'staff', 'doctor', 'laboratory', 'billing'].includes(userRole)) {
            return db;
        }

        return null; // Unauthorized role
    };

    try {
        const db = await fetchDb();
        if (!db) {
            return res.status(403).json({
                error: 'Forbidden: You do not have permission to access clinical records.',
                code: 'FORBIDDEN'
            });
        }
        res.json(db);
    } catch (err) {
        console.error('[Backend API] Error fetching database from MySQL:', err.message);
        if (err.code === 'ER_NO_SUCH_TABLE') {
            console.log('[Backend API] Tables missing in MySQL. Running ensureDatabaseSchema and retrying...');
            try {
                await ensureDatabaseSchema(mysqlPool);
                const retryDb = await fetchDb();
                if (retryDb) return res.json(retryDb);
            } catch (retryErr) {
                console.error('[Backend API] Retry failed:', retryErr.message);
            }
        }
        res.status(500).json({
            error: 'Failed to fetch database from MySQL',
            message: err.message,
            code: err.code || 'DB_ERROR'
        });
    }
});

// 4. POST Database Sync API (Protected with Role-Based Scoping)
app.post(['/api/sync', '/sync'], verifyAuth, async (req, res) => {
    const userRole = (req.user?.role || '').toLowerCase();
    const userEmail = (req.user?.email || '').trim().toLowerCase();
    const { newDb, oldDb } = req.body;
    if (!newDb) return res.status(400).json({ error: 'Missing newDb payload' });

    try {
        // 0. Handle Deletions if oldDb is provided
        if (oldDb && Array.isArray(oldDb.users) && Array.isArray(newDb.users)) {
            // Patients are strictly prohibited from deleting any user accounts
            if (userRole !== 'patient') {
                const newIds = new Set(newDb.users.map(u => String(u.id)));
                const newEmails = new Set(newDb.users.map(u => (u.email || '').trim().toLowerCase()));
                for (const oldUser of oldDb.users) {
                    if (oldUser && (!newIds.has(String(oldUser.id)) && !newEmails.has((oldUser.email || '').trim().toLowerCase()))) {
                        const uId = oldUser.id;
                        const uEmail = (oldUser.email || '').trim().toLowerCase();
                        // Prevent deleting superadmin
                        if (oldUser.role === 'superadmin' || uEmail === 'superadmin@docdental.com') continue;

                        console.log(`[Sync Delete] Deleting user from MySQL: ID ${uId}, Email ${uEmail}`);
                        await mysqlPool.query('DELETE FROM users WHERE id = ? OR email = ?', [uId, uEmail]);
                        await mysqlPool.query('DELETE FROM user_tokens WHERE email = ?', [uEmail]).catch(() => {});
                        if (oldUser.role === 'Patient') {
                            await mysqlPool.query('DELETE FROM medical_records WHERE email = ?', [uEmail]).catch(() => {});
                            await mysqlPool.query('DELETE FROM dental_charts WHERE email = ?', [uEmail]).catch(() => {});
                            await mysqlPool.query('DELETE FROM intraoral_charts WHERE email = ?', [uEmail]).catch(() => {});
                            await mysqlPool.query('DELETE FROM patient_charts WHERE email = ?', [uEmail]).catch(() => {});
                            await mysqlPool.query('DELETE FROM xray_records WHERE email = ?', [uEmail]).catch(() => {});
                            await mysqlPool.query('DELETE FROM consent_records WHERE email = ?', [uEmail]).catch(() => {});
                            await mysqlPool.query('DELETE FROM appointments WHERE patient_email = ?', [uEmail]).catch(() => {});
                        }
                    }
                }
            }
        }

        if (oldDb && Array.isArray(oldDb.appointments) && Array.isArray(newDb.appointments)) {
            const newApptIds = new Set(newDb.appointments.map(a => String(a.id)));
            for (const oldAppt of oldDb.appointments) {
                if (oldAppt && oldAppt.id && !newApptIds.has(String(oldAppt.id))) {
                    const apptEmail = (oldAppt.patient_email || oldAppt.patientEmail || '').trim().toLowerCase();
                    // Patients can only delete their own appointments
                    if (userRole === 'patient' && apptEmail !== userEmail) {
                        continue;
                    }
                    console.log(`[Sync Delete] Deleting appointment from MySQL: ID ${oldAppt.id}`);
                    await mysqlPool.query('DELETE FROM appointments WHERE id = ?', [oldAppt.id]);
                }
            }
        }

        // 1. Sync Users (Patients cannot modify or create users via /api/sync)
        if (userRole !== 'patient' && Array.isArray(newDb.users)) {
            for (const u of newDb.users) {
                if (u && (u.email || u.id)) {
                    const normEmail = (u.email || '').trim().toLowerCase();
                    const pType = u.patientType || u.patient_type || (newDb.medical_records?.[normEmail]?.patientType) || (u.role === 'Patient' ? 'New Patient' : null);
                    const hashedPwd = u.password ? await hashPassword(u.password) : await hashPassword('User_2026');
                    await mysqlPool.query(`
                        INSERT INTO users (id, email, password, role, full_name, phone, temp_otp, reset_token, reset_token_expires, otp_status, banned_until, patient_type, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            email = VALUES(email),
                            password = IF(? IS NOT NULL AND ? != '', VALUES(password), users.password),
                            role = VALUES(role),
                            full_name = VALUES(full_name),
                            phone = VALUES(phone),
                            temp_otp = VALUES(temp_otp),
                            reset_token = VALUES(reset_token),
                            reset_token_expires = VALUES(reset_token_expires),
                            otp_status = VALUES(otp_status),
                            banned_until = VALUES(banned_until),
                            patient_type = VALUES(patient_type)
                    `, [
                        u.id || Date.now(),
                        normEmail,
                        hashedPwd,
                        u.role || 'Patient',
                        u.fullName || u.full_name || u.name || 'User',
                        u.phone || u.contactNo || u.contactNumber || null,
                        u.temp_otp || null,
                        u.reset_token || u.resetToken || null,
                        u.reset_token_expires || u.resetTokenExpires || null,
                        u.otp_status || 'Verified',
                        u.bannedUntil || u.banned_until || null,
                        pType,
                        u.createdAt ? new Date(u.createdAt) : new Date(),
                        u.password || null,
                        u.password || null
                    ]);
                }
            }
        }

        // 2. Sync Appointments
        if (Array.isArray(newDb.appointments)) {
            for (const a of newDb.appointments) {
                if (a && a.id) {
                    const apptEmail = (a.patientEmail || a.patient_email || '').trim().toLowerCase();
                    // If patient, restrict appointment upsert strictly to their own email
                    if (userRole === 'patient' && apptEmail !== userEmail) {
                        continue;
                    }

                    await mysqlPool.query(`
                        INSERT INTO appointments (id, patient_email, patient_name, category, service, duration, date, time, notes, status, cancelled_due_to_emergency, emergency_reason, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            patient_email = VALUES(patient_email),
                            patient_name = VALUES(patient_name),
                            category = VALUES(category),
                            service = VALUES(service),
                            duration = VALUES(duration),
                            date = VALUES(date),
                            time = VALUES(time),
                            notes = VALUES(notes),
                            status = VALUES(status),
                            cancelled_due_to_emergency = VALUES(cancelled_due_to_emergency),
                            emergency_reason = VALUES(emergency_reason)
                    `, [
                        a.id,
                        apptEmail,
                        a.patientName || a.patient_name || '',
                        a.category || null,
                        a.service || null,
                        a.duration || null,
                        a.date || null,
                        a.time || null,
                        a.notes || null,
                        a.status || 'Pending',
                        a.cancelledDueToEmergency || a.cancelled_due_to_emergency ? 1 : 0,
                        a.emergencyReason || a.emergency_reason || null,
                        a.createdAt ? new Date(a.createdAt) : new Date()
                    ]);
                }
            }
        }

        // 3. Sync JSON Tables (medical_records, dental_charts, intraoral_charts, patient_charts, xray_records)
        const syncJsonTable = async (tableName, colName, sourceObj) => {
            if (sourceObj && typeof sourceObj === 'object') {
                for (const [email, data] of Object.entries(sourceObj)) {
                    const normEmail = email.toLowerCase().trim();
                    // Patients can only update their own clinical records
                    if (userRole === 'patient' && normEmail !== userEmail) {
                        continue;
                    }
                    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
                    await mysqlPool.query(`
                        INSERT INTO ${tableName} (email, ${colName}, updated_at)
                        VALUES (?, ?, NOW())
                        ON DUPLICATE KEY UPDATE ${colName} = VALUES(${colName}), updated_at = NOW()
                    `, [normEmail, jsonStr]);
                }
            }
        };

        await syncJsonTable('medical_records', 'record_data', newDb.medical_records);
        await syncJsonTable('dental_charts', 'chart_data', newDb.dental_charts);
        await syncJsonTable('intraoral_charts', 'chart_data', newDb.intraoral_charts);
        if (userRole !== 'patient') {
            await syncJsonTable('patient_charts', 'chart_data', newDb.patient_charts);
        }
        await syncJsonTable('xray_records', 'record_data', newDb.xray_records);

        // 4. Sync Consent Records
        if (Array.isArray(newDb.consent_records)) {
            for (const c of newDb.consent_records) {
                if (c && c.email) {
                    const normalizedEmail = (c.email || '').toLowerCase().trim();
                    if (userRole === 'patient' && normalizedEmail !== userEmail) {
                        continue;
                    }
                    const sig = c.signature || '';
                    const dateSigned = c.dateSigned || c.date_signed || new Date().toISOString();
                    
                    if (sig || normalizedEmail) {
                        await mysqlPool.query(`
                            INSERT INTO consent_records (email, signature, date_signed, created_at)
                            VALUES (?, ?, ?, NOW())
                            ON DUPLICATE KEY UPDATE signature = VALUES(signature), date_signed = VALUES(date_signed)
                        `, [normalizedEmail, sig, dateSigned]);
                    }
                }
            }
        }

        // Also ensure any consent signatures stored in medical_records are synced to consent_records table
        if (newDb.medical_records && typeof newDb.medical_records === 'object') {
            for (const email of Object.keys(newDb.medical_records)) {
                const normalizedEmail = email.toLowerCase().trim();
                if (userRole === 'patient' && normalizedEmail !== userEmail) {
                    continue;
                }
                const med = newDb.medical_records[email];
                if (med && (med.signature || med.hasConsented)) {
                    const sig = med.signature || '';
                    const dateSigned = med.consentTimestamp || new Date().toISOString();

                    await mysqlPool.query(`
                        INSERT INTO consent_records (email, signature, date_signed, created_at)
                        VALUES (?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE signature = VALUES(signature), date_signed = VALUES(date_signed)
                    `, [normalizedEmail, sig, dateSigned]);
                }
            }
        }

        // 5. Sync Audit Logs (Staff / Admin only)
        if (userRole !== 'patient' && Array.isArray(newDb.auditLogs)) {
            for (const l of newDb.auditLogs) {
                if (l && l.action) {
                    await mysqlPool.query(`
                        INSERT INTO audit_logs (id, action, details, timestamp)
                        VALUES (?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE action = VALUES(action), details = VALUES(details)
                    `, [
                        l.id || Date.now(),
                        l.action,
                        l.details || null,
                        l.timestamp ? new Date(l.timestamp) : new Date()
                    ]);
                }
            }
        }

        // 6. Sync Consultations
        if (Array.isArray(newDb.consultations)) {
            for (const c of newDb.consultations) {
                if (c && c.id) {
                    await mysqlPool.query(`
                        INSERT INTO consultations (id, patient_name, patient_email, doctor_name, branch, date, chief_complaint, vital_signs, diagnosis, clinical_notes, prescriptions, lab_orders, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE
                            patient_name = VALUES(patient_name),
                            doctor_name = VALUES(doctor_name),
                            branch = VALUES(branch),
                            date = VALUES(date),
                            chief_complaint = VALUES(chief_complaint),
                            vital_signs = VALUES(vital_signs),
                            diagnosis = VALUES(diagnosis),
                            clinical_notes = VALUES(clinical_notes),
                            prescriptions = VALUES(prescriptions),
                            lab_orders = VALUES(lab_orders)
                    `, [
                        c.id,
                        c.patientName || '',
                        (c.patientEmail || '').toLowerCase().trim(),
                        c.doctorName || '',
                        c.branch || 'CarePlus Metro Branch',
                        c.date || new Date().toISOString().split('T')[0],
                        c.chiefComplaint || '',
                        JSON.stringify(c.vitalSigns || {}),
                        c.diagnosis || '',
                        c.clinicalNotes || '',
                        JSON.stringify(c.prescriptions || []),
                        JSON.stringify(c.labOrders || [])
                    ]).catch(e => console.warn('[Sync Consultations Warning]:', e.message));
                }
            }
        }

        // 7. Sync Laboratory Requests
        if (Array.isArray(newDb.laboratory_requests)) {
            for (const l of newDb.laboratory_requests) {
                if (l && l.id) {
                    await mysqlPool.query(`
                        INSERT INTO laboratory_requests (id, patient_name, patient_email, test_code, test_name, category, branch, doctor, date, specimen, status, results, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE
                            patient_name = VALUES(patient_name),
                            test_code = VALUES(test_code),
                            test_name = VALUES(test_name),
                            category = VALUES(category),
                            branch = VALUES(branch),
                            doctor = VALUES(doctor),
                            date = VALUES(date),
                            specimen = VALUES(specimen),
                            status = VALUES(status),
                            results = VALUES(results)
                    `, [
                        l.id,
                        l.patientName || '',
                        (l.patientEmail || '').toLowerCase().trim(),
                        l.testCode || 'LAB',
                        l.testName || '',
                        l.category || 'General',
                        l.branch || 'CarePlus Metro Branch',
                        l.doctor || '',
                        l.date || new Date().toISOString().split('T')[0],
                        l.specimen || 'Specimen',
                        l.status || 'Processing',
                        JSON.stringify(l.results || [])
                    ]).catch(e => console.warn('[Sync Laboratory Warning]:', e.message));
                }
            }
        }

        // 8. Sync Billing Records
        if (Array.isArray(newDb.billing_records)) {
            for (const b of newDb.billing_records) {
                if (b && b.id) {
                    await mysqlPool.query(`
                        INSERT INTO billing_records (id, patient_name, patient_email, branch, date, items, total_amount, discount, amount_paid, payment_method, status, receipt_number, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE
                            patient_name = VALUES(patient_name),
                            branch = VALUES(branch),
                            date = VALUES(date),
                            items = VALUES(items),
                            total_amount = VALUES(total_amount),
                            discount = VALUES(discount),
                            amount_paid = VALUES(amount_paid),
                            payment_method = VALUES(payment_method),
                            status = VALUES(status),
                            receipt_number = VALUES(receipt_number)
                    `, [
                        b.id,
                        b.patientName || '',
                        (b.patientEmail || '').toLowerCase().trim(),
                        b.branch || 'CarePlus Metro Branch',
                        b.date || new Date().toISOString().split('T')[0],
                        JSON.stringify(b.items || []),
                        Number(b.totalAmount || 0),
                        Number(b.discount || 0),
                        Number(b.amountPaid || 0),
                        b.paymentMethod || 'Cash',
                        b.status || 'Paid',
                        b.receiptNumber || `OR-${b.id}`
                    ]).catch(e => console.warn('[Sync Billing Warning]:', e.message));
                }
            }
        }

        broadcast('db_updated', { type: 'sync_completed', timestamp: new Date().toISOString() });
        res.json({ success: true, message: 'CarePlus MySQL Database sync completed.' });
    } catch (err) {
        console.error('[Backend API] Error executing MySQL database sync:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4C. POST Database Restore & Emergency Recovery API (Protected: Superadmin & Admin Only)
app.post(['/api/restore', '/restore'], verifyAuth, requireRole('superadmin', 'admin'), async (req, res) => {
    const { backupDb, mode = 'merge', restoredBy = 'Staff/Superadmin' } = req.body;
    if (!backupDb || typeof backupDb !== 'object') {
        return res.status(400).json({ success: false, error: 'Missing or invalid backupDb payload' });
    }

    try {
        // Safe non-destructive restore: existing tables are NOT wiped. Records are merged/updated via ON DUPLICATE KEY UPDATE.
        console.log(`[Database Restore] Safely merging records (Requested by ${restoredBy})...`);

        // Step 2: Restore Users
        if (Array.isArray(backupDb.users)) {
            for (const u of backupDb.users) {
                if (u && (u.email || u.id)) {
                    const normEmail = (u.email || '').trim().toLowerCase();
                    const pType = u.patientType || u.patient_type || (backupDb.medical_records?.[normEmail]?.patientType) || (u.role === 'Patient' ? 'New Patient' : null);
                    await mysqlPool.query(`
                        INSERT INTO users (id, email, password, role, full_name, phone, temp_otp, reset_token, reset_token_expires, otp_status, banned_until, patient_type, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            email = VALUES(email),
                            role = VALUES(role),
                            full_name = VALUES(full_name),
                            phone = VALUES(phone),
                            otp_status = VALUES(otp_status),
                            banned_until = VALUES(banned_until),
                            patient_type = VALUES(patient_type)
                    `, [
                        u.id || Date.now(),
                        normEmail,
                        u.password || 'User_2026',
                        u.role || 'Patient',
                        u.fullName || u.full_name || u.name || 'User',
                        u.phone || u.contactNo || u.contactNumber || null,
                        u.temp_otp || null,
                        u.reset_token || u.resetToken || null,
                        u.reset_token_expires || u.resetTokenExpires || null,
                        u.otp_status || 'Verified',
                        u.bannedUntil || u.banned_until || null,
                        pType,
                        u.createdAt ? new Date(u.createdAt) : new Date()
                    ]);
                }
            }
        }

        // Step 3: Restore Appointments
        if (Array.isArray(backupDb.appointments)) {
            for (const a of backupDb.appointments) {
                if (a && a.id) {
                    await mysqlPool.query(`
                        INSERT INTO appointments (id, patient_email, patient_name, category, service, duration, date, time, notes, status, cancelled_due_to_emergency, emergency_reason, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            patient_email = VALUES(patient_email),
                            patient_name = VALUES(patient_name),
                            category = VALUES(category),
                            service = VALUES(service),
                            duration = VALUES(duration),
                            date = VALUES(date),
                            time = VALUES(time),
                            notes = VALUES(notes),
                            status = VALUES(status),
                            cancelled_due_to_emergency = VALUES(cancelled_due_to_emergency),
                            emergency_reason = VALUES(emergency_reason)
                    `, [
                        a.id,
                        (a.patientEmail || a.patient_email || '').trim().toLowerCase(),
                        a.patientName || a.patient_name || '',
                        a.category || null,
                        a.service || null,
                        a.duration || null,
                        a.date || null,
                        a.time || null,
                        a.notes || null,
                        a.status || 'Pending',
                        a.cancelledDueToEmergency || a.cancelled_due_to_emergency ? 1 : 0,
                        a.emergencyReason || a.emergency_reason || null,
                        a.createdAt ? new Date(a.createdAt) : new Date()
                    ]);
                }
            }
        }

        // Step 4: Restore JSON Tables (medical_records, dental_charts, intraoral_charts, patient_charts, xray_records)
        const restoreJsonTable = async (tableName, colName, sourceObj) => {
            if (sourceObj && typeof sourceObj === 'object') {
                for (const [email, data] of Object.entries(sourceObj)) {
                    if (!email) continue;
                    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
                    await mysqlPool.query(`
                        INSERT INTO ${tableName} (email, ${colName}, updated_at)
                        VALUES (?, ?, NOW())
                        ON DUPLICATE KEY UPDATE ${colName} = VALUES(${colName}), updated_at = NOW()
                    `, [email.toLowerCase().trim(), jsonStr]);
                }
            }
        };

        await restoreJsonTable('medical_records', 'record_data', backupDb.medical_records);
        await restoreJsonTable('dental_charts', 'chart_data', backupDb.dental_charts);
        await restoreJsonTable('intraoral_charts', 'chart_data', backupDb.intraoral_charts);
        await restoreJsonTable('patient_charts', 'chart_data', backupDb.patient_charts);
        await restoreJsonTable('xray_records', 'record_data', backupDb.xray_records);

        // Step 5: Restore Consent Records
        if (Array.isArray(backupDb.consent_records)) {
            for (const c of backupDb.consent_records) {
                if (c && c.email) {
                    const normalizedEmail = (c.email || '').toLowerCase().trim();
                    const sig = c.signature || '';
                    const dateSigned = c.dateSigned || c.date_signed || new Date().toISOString();
                    await mysqlPool.query(`
                        INSERT INTO consent_records (email, signature, date_signed, created_at)
                        VALUES (?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE signature = VALUES(signature), date_signed = VALUES(date_signed)
                    `, [normalizedEmail, sig, dateSigned]);
                }
            }
        }

        // Step 6: Restore Pricelist
        if (Array.isArray(backupDb.pricelist)) {
            for (const item of backupDb.pricelist) {
                if (item && item.service) {
                    await mysqlPool.query(`
                        INSERT INTO clinic_pricelist (id, category, service, price, created_at)
                        VALUES (?, ?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE category = VALUES(category), service = VALUES(service), price = VALUES(price)
                    `, [item.id || null, item.category || 'General Services', item.service, String(item.price || '0')]);
                }
            }
        }

        // Step 7: Record Audit Log for System Recovery
        const logId = Date.now();
        const countsSummary = `${backupDb.users?.length || 0} users, ${backupDb.appointments?.length || 0} appts, ${Object.keys(backupDb.medical_records || {}).length} med records, ${Object.keys(backupDb.dental_charts || {}).length} dental charts`;
        const logAction = 'System Data Restored';
        const logDetails = `Emergency data recovery performed (${mode}) by ${restoredBy}. Recovered: ${countsSummary}.`;
        await mysqlPool.query(`
            INSERT INTO audit_logs (id, action, details, timestamp)
            VALUES (?, ?, ?, NOW())
        `, [logId, logAction, logDetails]).catch(() => {});

        // Step 8: Realtime Notification to connected clients
        try {
            const { broadcast } = require('./api/realtime');
            if (typeof broadcast === 'function') {
                broadcast('db_updated', {
                    type: 'database_restored',
                    mode,
                    restoredBy,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (e) {
            console.error('[Realtime Broadcast in Restore Catch]:', e);
        }

        console.log(`[Emergency Restore] Completed successfully (${mode}). Recovered ${countsSummary}.`);
        res.json({
            success: true,
            message: `Emergency data recovery completed successfully (${mode}).`,
            counts: {
                users: backupDb.users?.length || 0,
                appointments: backupDb.appointments?.length || 0,
                medicalRecords: Object.keys(backupDb.medical_records || {}).length,
                dentalCharts: Object.keys(backupDb.dental_charts || {}).length,
                pricelist: (backupDb.pricelist || []).length
            }
        });
        broadcast('db_updated', { type: 'database_restored', mode, restoredBy, timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('[Backend API] Error executing Emergency Database Restore:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4B. Dedicated Atomic Patient Registration API
app.post(['/api/register-patient', '/register-patient'], async (req, res) => {
    const { patientAccount, medicalRecord, dentalChart, intraoralChart, patientChart, consentRecord, xrays } = req.body;

    if (!patientAccount || !patientAccount.email || !patientAccount.fullName) {
        return res.status(400).json({ success: false, error: 'Patient account details (fullName, email) are required.' });
    }

    const emailNorm = (patientAccount.email || '').toLowerCase().trim();
    const fullName = (patientAccount.fullName || patientAccount.name || '').trim();
    const phone = (patientAccount.phone || patientAccount.contactNo || patientAccount.contactNumber || '').trim() || null;
    const patientType = patientAccount.patientType || medicalRecord?.patientType || 'New Patient';
    const rawPassword = patientAccount.password || 'User_2026';
    const hashedPassword = await hashPassword(rawPassword);
    const userId = Number(patientAccount.id) || Date.now();
    const createdAt = patientAccount.createdAt ? new Date(patientAccount.createdAt) : new Date();

    try {
        // 0. Prevent Account Takeover: Check if email already registered
        const [existingUsers] = await mysqlPool.query('SELECT id, email, role FROM users WHERE LOWER(email) = ?', [emailNorm]);
        if (existingUsers && existingUsers.length > 0) {
            return res.status(409).json({ 
                success: false, 
                error: 'An account with this email address already exists. Please log in instead.' 
            });
        }

        // 1. Insert into users table
        await mysqlPool.query(`
            INSERT INTO users (id, email, password, role, full_name, phone, temp_otp, otp_status, banned_until, patient_type, created_at)
            VALUES (?, ?, ?, 'Patient', ?, ?, null, 'Verified', null, ?, ?)
        `, [userId, emailNorm, hashedPassword, fullName, phone, patientType, createdAt]);

        // 2. Insert/Upsert into medical_records table
        const fullMedRecord = {
            fullName,
            name: fullName,
            email: emailNorm,
            phone: phone || '',
            contactNo: phone || '',
            contactNumber: phone || '',
            patientType,
            accountCreatedByClinic: true,
            createdAt: createdAt.toISOString(),
            ...(medicalRecord || {})
        };
        await mysqlPool.query(`
            INSERT INTO medical_records (email, record_data, updated_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE record_data = VALUES(record_data), updated_at = NOW()
        `, [emailNorm, JSON.stringify(fullMedRecord)]);

        // 3. Insert/Upsert into dental_charts table
        const fullDentalChart = dentalChart || { teeth: {}, clearedForBraces: false, lastUpdated: new Date().toISOString() };
        await mysqlPool.query(`
            INSERT INTO dental_charts (email, chart_data, updated_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE chart_data = VALUES(chart_data), updated_at = NOW()
        `, [emailNorm, JSON.stringify(fullDentalChart)]);

        // 4. Insert/Upsert into intraoral_charts table
        const fullIntraoral = intraoralChart || fullDentalChart;
        await mysqlPool.query(`
            INSERT INTO intraoral_charts (email, chart_data, updated_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE chart_data = VALUES(chart_data), updated_at = NOW()
        `, [emailNorm, JSON.stringify(fullIntraoral)]);

        // 5. Insert/Upsert into patient_charts table
        const fullPatientChart = patientChart || { teeth: fullDentalChart.teeth || {} };
        await mysqlPool.query(`
            INSERT INTO patient_charts (email, chart_data, updated_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE chart_data = VALUES(chart_data), updated_at = NOW()
        `, [emailNorm, JSON.stringify(fullPatientChart)]);

        // 6. Insert/Upsert consent record if provided
        if (consentRecord && (consentRecord.signature || consentRecord.hasConsented)) {
            const sig = consentRecord.signature || '';
            const dateSigned = consentRecord.dateSigned || consentRecord.date_signed || new Date().toISOString();
            await mysqlPool.query(`
                INSERT INTO consent_records (email, signature, date_signed, created_at)
                VALUES (?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE signature = VALUES(signature), date_signed = VALUES(date_signed)
            `, [emailNorm, sig, dateSigned]);
        }

        // 7. Insert/Upsert X-rays if provided
        if (xrays && Array.isArray(xrays) && xrays.length > 0) {
            await mysqlPool.query(`
                INSERT INTO xray_records (email, record_data, updated_at)
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE record_data = VALUES(record_data), updated_at = NOW()
            `, [emailNorm, JSON.stringify({ xrays })]);
        }

        // 8. Insert Audit Log
        const logId = Date.now();
        await mysqlPool.query(`
            INSERT INTO audit_logs (id, action, details, timestamp)
            VALUES (?, ?, ?, NOW())
        `, [logId, 'Registered Patient Account (Direct DB)', `${fullName} (${emailNorm}) - ${patientType}`]);

        // 9. Broadcast Realtime Sync Event
        try {
            const { broadcastRealtimeEvent } = require('./api/realtime');
            if (typeof broadcastRealtimeEvent === 'function') {
                broadcastRealtimeEvent('db_updated', { type: 'patient_registered', email: emailNorm, timestamp: new Date().toISOString() });
            }
        } catch (e) {}

        res.json({
            success: true,
            message: `Patient account for ${fullName} (${emailNorm}) successfully registered in MySQL database.`,
            patient: {
                id: userId,
                email: emailNorm,
                fullName,
                phone,
                role: 'Patient',
                patientType,
                otp_status: 'Verified',
                createdAt: createdAt.toISOString()
            }
        });
        broadcast('db_updated', { type: 'patient_registered', email: emailNorm, timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('[Backend API] Error registering patient in MySQL:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. GET Pricelist API
app.get(['/api/pricelist', '/pricelist'], async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM clinic_pricelist ORDER BY category ASC, service ASC');
        const mapped = (rows || []).map(r => ({
            id: r.id,
            category: r.category,
            name: r.service,
            price: r.price
        }));
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. POST Pricelist API (Protected: Superadmin & Admin Only)
app.post(['/api/pricelist', '/pricelist'], verifyAuth, requireRole('superadmin', 'admin'), async (req, res) => {
    const newList = req.body;
    try {
        await mysqlPool.query('TRUNCATE TABLE clinic_pricelist');
        for (const p of (newList || [])) {
            await mysqlPool.query(`
                INSERT INTO clinic_pricelist (category, service, price, created_at)
                VALUES (?, ?, ?, NOW())
            `, [p.category, p.name || p.service || '', String(p.price)]);
        }
        broadcast('db_updated', { type: 'pricelist_updated', timestamp: new Date().toISOString() });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. GET Profile Pic API
app.get(['/api/profile-pic/:email', '/profile-pic/:email'], async (req, res) => {
    const { email } = req.params;
    try {
        const [rows] = await mysqlPool.query('SELECT photo_data FROM profile_pics WHERE email = ?', [email]);
        if (rows.length > 0) {
            res.json({ photo_data: rows[0].photo_data });
        } else {
            res.json({ photo_data: null });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. POST Profile Pic API (Protected)
app.post(['/api/profile-pic', '/profile-pic'], verifyAuth, async (req, res) => {
    const { email, pic } = req.body;
    const userRole = (req.user?.role || '').toLowerCase();
    const userEmail = (req.user?.email || '').trim().toLowerCase();
    const targetEmail = (email || '').trim().toLowerCase();

    // Regular patient users can only update their own profile photo
    if (userRole === 'patient' && targetEmail !== userEmail) {
        return res.status(403).json({ error: 'Forbidden: You can only update your own profile picture.' });
    }

    try {
        await mysqlPool.query(`
            INSERT INTO profile_pics (email, photo_data, updated_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE photo_data = VALUES(photo_data), updated_at = NOW()
        `, [email, pic]);
        broadcast('db_updated', { type: 'profile_pic_updated', email, timestamp: new Date().toISOString() });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. GET Profile Pics (Bulk) API (Protected with verifyAuth)
app.get(['/api/profile-pics', '/profile-pics'], verifyAuth, async (req, res) => {
    try {
        const userRole = (req.user?.role || '').toLowerCase();
        const userEmail = (req.user?.email || '').trim().toLowerCase();

        // Patients only retrieve their own photo; clinic staff and admins can load all for clinical views
        if (userRole === 'patient') {
            const [rows] = await mysqlPool.query('SELECT * FROM profile_pics WHERE LOWER(email) = ?', [userEmail]);
            return res.json(rows || []);
        }

        const [rows] = await mysqlPool.query('SELECT * FROM profile_pics');
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9B. DELETE User API (Permanent Delete from MySQL - Superadmin & Admin Only)
app.delete(['/api/users/:id', '/users/:id'], verifyAuth, requireRole('superadmin', 'admin'), async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'User ID or Email is required.' });

    try {
        const decodedId = decodeURIComponent(id).trim().toLowerCase();
        const [users] = await mysqlPool.query(
            'SELECT * FROM users WHERE id = ? OR LOWER(email) = ?', 
            [id, decodedId]
        );

        if (users.length === 0) {
            return res.json({ success: true, message: 'User not found or already deleted from database.' });
        }

        const target = users[0];
        const uId = target.id;
        const uEmail = (target.email || '').toLowerCase().trim();
        const uRole = (target.role || '').toLowerCase().trim();

        // Prevent deletion of the primary Superadmin account
        if (uRole === 'superadmin' || uEmail === 'superadmin@docdental.com') {
            return res.status(403).json({ error: 'Forbidden: The primary superadmin account cannot be deleted.' });
        }

        console.log(`[Permanent User Deletion]: Deleting user ID ${uId} (${uEmail}) from MySQL`);

        await mysqlPool.query('DELETE FROM users WHERE id = ? OR email = ?', [uId, uEmail]);
        await mysqlPool.query('DELETE FROM user_tokens WHERE email = ?', [uEmail]).catch(() => {});
        await mysqlPool.query('DELETE FROM medical_records WHERE email = ?', [uEmail]).catch(() => {});
        await mysqlPool.query('DELETE FROM dental_charts WHERE email = ?', [uEmail]).catch(() => {});
        await mysqlPool.query('DELETE FROM intraoral_charts WHERE email = ?', [uEmail]).catch(() => {});
        await mysqlPool.query('DELETE FROM patient_charts WHERE email = ?', [uEmail]).catch(() => {});
        await mysqlPool.query('DELETE FROM xray_records WHERE email = ?', [uEmail]).catch(() => {});
        await mysqlPool.query('DELETE FROM consent_records WHERE email = ?', [uEmail]).catch(() => {});
        await mysqlPool.query('DELETE FROM appointments WHERE patient_email = ?', [uEmail]).catch(() => {});
        await mysqlPool.query('DELETE FROM profile_pics WHERE email = ?', [uEmail]).catch(() => {});

        broadcast('db_updated', { type: 'user_deleted', id: uId, email: uEmail, timestamp: new Date().toISOString() });
        res.json({ success: true, message: `User ${uEmail} permanently deleted from MySQL database.` });
    } catch (err) {
        console.error('[Permanent User Deletion Error]:', err);
        res.status(500).json({ error: 'Failed to delete user', details: err.message });
    }
});

// 9C. DELETE Appointment API (Protected)
app.delete(['/api/appointments/:id', '/appointments/:id'], verifyAuth, async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Appointment ID is required.' });

    const userRole = (req.user?.role || '').toLowerCase();
    const userEmail = (req.user?.email || '').trim().toLowerCase();

    try {
        const [apps] = await mysqlPool.query('SELECT * FROM appointments WHERE id = ?', [id]);
        if (apps.length === 0) {
            return res.json({ success: true, message: 'Appointment not found or already deleted.' });
        }

        // Patients can only delete their own appointments
        if (userRole === 'patient') {
            const apptPatientEmail = (apps[0].patient_email || '').trim().toLowerCase();
            if (apptPatientEmail !== userEmail) {
                return res.status(403).json({ error: 'Forbidden: You can only delete your own appointments.' });
            }
        }

        await mysqlPool.query('DELETE FROM appointments WHERE id = ?', [id]);
        broadcast('db_updated', { type: 'appointment_deleted', id, timestamp: new Date().toISOString() });
        res.json({ success: true, message: `Appointment ${id} permanently deleted from MySQL.` });
    } catch (err) {
        console.error('[Delete Appointment Error]:', err);
        res.status(500).json({ error: 'Failed to delete appointment', details: err.message });
    }
});

// -------------------------------------------------------------
// 10. STATEFUL (DB-INTEGRATED TOKEN) AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------

// A. POST /api/auth/login -> Issues JWT & Stores token in MySQL DB
app.post(['/api/auth/login', '/auth/login'], async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    try {
        const identifier = (email || '').trim().toLowerCase();
        const [userRes] = await mysqlPool.query(
            `SELECT * FROM users 
             WHERE LOWER(email) = ? 
                OR LOWER(email) LIKE CONCAT(?, '@%')`,
            [identifier, identifier]
        );
        
        if (userRes.length === 0) {
            return res.status(401).json({ success: false, error: 'Incorrect credentials.' });
        }

        const user = userRes[0];

        // Check password (supports Bcrypt hash & automatic plaintext upgrade)
        let passwordValid = false;
        if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
            passwordValid = await bcrypt.compare(password, user.password);
        } else if (user.password === password) {
            passwordValid = true;
            // Upgrade legacy password on successful login
            const upgradedHash = await hashPassword(password);
            await mysqlPool.query('UPDATE users SET password = ? WHERE id = ?', [upgradedHash, user.id]).catch(() => {});
        }

        if (!passwordValid) {
            return res.status(401).json({ success: false, error: 'Incorrect credentials.' });
        }

        // Check if user is banned
        if (user.banned_until && new Date(user.banned_until) > new Date()) {
            return res.status(403).json({ success: false, error: `Account is banned until ${user.banned_until}` });
        }

        // Generate JWT Token (Expires in 24 Hours)
        const token = jwt.sign(
            { 
                id: Number(user.id), 
                email: user.email, 
                role: user.role, 
                fullName: user.full_name 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Store Token in MySQL DB
        await mysqlPool.query(
            `INSERT INTO user_tokens (user_id, email, token, expires_at) 
             VALUES (?, ?, ?, ?)`,
            [user.id, user.email, token, expiresAt]
        );

        // Set HttpOnly Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            message: 'Authentication successful. Stateful token generated, saved to MySQL, and set as HttpOnly cookie.',
            token: token,
            tokenType: 'Bearer',
            expiresAt: expiresAt.toISOString(),
            user: {
                id: Number(user.id),
                email: user.email,
                role: user.role,
                fullName: user.full_name,
                name: user.full_name,
                phone: user.phone,
                patientType: user.patient_type || (user.role === 'Patient' ? 'New Patient' : null),
                otp_status: user.otp_status || 'Verified'
            }
        });
    } catch (err) {
        console.error('[Backend API] Login error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// B. POST /api/auth/logout -> Revokes & Deletes Token from MySQL DB
app.post(['/api/auth/logout', '/auth/logout'], verifyAuth, async (req, res) => {
    try {
        await mysqlPool.query('DELETE FROM user_tokens WHERE token = ?', [req.token]);
        res.clearCookie('token');
        res.json({
            success: true,
            message: 'Logout successful. Token revoked and deleted from database.'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// C. GET /api/auth/me -> Protected Endpoint Verifying Token against DB
app.get(['/api/auth/me', '/auth/me'], verifyAuth, async (req, res) => {
    res.json({
        success: true,
        message: 'Token checked and verified against active MySQL sessions.',
        authenticatedUser: req.user
    });
});

// D. GET /api/auth/tokens -> Inspect active tokens stored in DB (Superadmin Only)
app.get(['/api/auth/tokens', '/auth/tokens'], verifyAuth, requireRole('superadmin'), async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT id, user_id, email, created_at, expires_at FROM user_tokens ORDER BY created_at DESC');
        res.json({ success: true, count: rows.length, tokens: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// E. POST /api/auth/forgot-password -> Request Secure Password Reset Link
app.post(['/api/auth/forgot-password', '/auth/forgot-password'], async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required.' });
    }

    try {
        const cleanEmail = String(email).trim().toLowerCase();
        const [users] = await mysqlPool.query('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);

        if (users.length === 0) {
            // Anti-enumeration: still return success to client
            return res.json({ success: true, message: 'If that email address is registered, a password reset link has been sent.' });
        }

        const user = users[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

        await mysqlPool.query(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [token, expiresAt, user.id]
        );

        // Send reset email via nodemailer if configured
        try {
            const nodemailer = require('nodemailer');
            const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
            const gUser = (process.env.GMAIL_USER || '').trim();
            if (gUser && pass) {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: { user: gUser, pass }
                });
                const baseUrl = (process.env.APP_BASE_URL || req.headers.origin || 'http://localhost:3000').trim().replace(/\/+$/, '');
                const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
                transporter.sendMail({
                    from: `"Doc Dental Care Security" <${gUser}>`,
                    to: user.email,
                    subject: 'Reset Your Password - Doc Dental Care',
                    html: `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 30px auto; padding: 32px; border: 1px solid #e8e2d5; border-radius: 16px; background-color: #fffdf9;">
                            <h2 style="color: #B8860B; text-align: center;">Doc Dental Care</h2>
                            <p>Hello ${user.full_name || 'Valued User'},</p>
                            <p>We received a request to reset your password. Click the link below to choose a new password:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${resetLink}" style="background-color: #B8860B; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">Reset Password</a>
                            </div>
                            <p style="font-size: 13px; color: #777;">This link is valid for 15 minutes. If you did not make this request, you can safely ignore this email.</p>
                        </div>
                    `
                }).catch(mailErr => console.warn('[Forgot Password Email Dispatch Note]:', mailErr.message));
            }
        } catch (mailErr) {
            console.warn('[Forgot Password Email Dispatch Note]:', mailErr.message);
        }

        res.json({ success: true, message: 'If that email address is registered, a password reset link has been sent.' });
    } catch (err) {
        console.error('[Forgot Password Error]:', err);
        res.status(500).json({ success: false, error: 'Failed to process password reset request.' });
    }
});

// F. POST /api/auth/verify-reset-token -> Validate Reset Token Server-Side
app.post(['/api/auth/verify-reset-token', '/auth/verify-reset-token'], async (req, res) => {
    const { email, token } = req.body;
    if (!email || !token) {
        return res.status(400).json({ valid: false, error: 'Email and token are required.' });
    }

    try {
        const cleanEmail = String(email).trim().toLowerCase();
        const [users] = await mysqlPool.query(
            'SELECT id, email, role, reset_token, reset_token_expires FROM users WHERE LOWER(email) = ?',
            [cleanEmail]
        );

        if (users.length === 0) {
            return res.json({ valid: false, error: 'Account not found.' });
        }

        const user = users[0];
        if (!user.reset_token || user.reset_token !== token) {
            return res.json({ valid: false, error: 'This password reset link is invalid or has already been used.' });
        }

        if (user.reset_token_expires && Number(user.reset_token_expires) < Date.now()) {
            return res.json({ valid: false, error: 'This password reset link has expired (valid for 15 minutes). Please request a new one.' });
        }

        res.json({ valid: true, email: user.email, role: user.role });
    } catch (err) {
        res.status(500).json({ valid: false, error: err.message });
    }
});

// G. POST /api/auth/reset-password -> Reset Password with Valid Token
app.post(['/api/auth/reset-password', '/auth/reset-password'], async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
        return res.status(400).json({ success: false, error: 'Email, token, and new password are required.' });
    }

    try {
        const cleanEmail = String(email).trim().toLowerCase();
        const [users] = await mysqlPool.query(
            'SELECT id, email, reset_token, reset_token_expires FROM users WHERE LOWER(email) = ?',
            [cleanEmail]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, error: 'Account not found.' });
        }

        const user = users[0];
        if (!user.reset_token || user.reset_token !== token) {
            return res.status(400).json({ success: false, error: 'Invalid or expired password reset token.' });
        }

        if (user.reset_token_expires && Number(user.reset_token_expires) < Date.now()) {
            return res.status(400).json({ success: false, error: 'Password reset token has expired. Please request a new link.' });
        }

        const hashedPassword = await hashPassword(newPassword);
        await mysqlPool.query(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        res.json({ success: true, message: 'Password has been reset successfully. You may now log in.' });
    } catch (err) {
        console.error('[Reset Password Error]:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 11. SMTP Email Router
app.use(['/api', '/'], require('./api/email'));

// 12. Real-Time Event Stream & Broadcast Router
app.use(['/api', '/'], realtimeRouter);

// 13. Global Centralized Error Handler Middleware
app.use(errorHandler);

// Start listening when run directly (local development)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`[Backend Server] Doc Dental Care API (MySQL) listening at http://localhost:${PORT}`);
    });
}

module.exports = app;
