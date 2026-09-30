const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const dotenv = require('dotenv');
const dns = require('dns').promises;

// Guarantee environment variables are loaded across all execution contexts
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const { verifyTurnstileToken } = require('../middleware/turnstile');
const { verifyAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// Helper to get sanitized sender email
const getSenderEmail = () => (process.env.GMAIL_USER || '').trim();

// List of trusted popular email providers to skip redundant/flaky external DNS queries
const COMMON_EMAIL_DOMAINS = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.com.ph', 'yahoo.co.uk',
    'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com',
    'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com',
    'zoho.com', 'mail.com', 'yandex.com', 'gmx.com'
]);

// Helper to verify email syntax and check if domain has active MX records
const verifyEmailDeliverability = async (email) => {
    if (!email || typeof email !== 'string') {
        return { valid: false, reason: 'Email address is required.' };
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
        return { valid: false, reason: 'Invalid email syntax or format.' };
    }

    const domain = cleanEmail.split('@')[1];
    if (!domain) {
        return { valid: false, reason: 'Missing domain in email address.' };
    }

    // Disallow known fake/placeholder domains
    const blockedDomains = ['example.com', 'test.com', 'sample.com', 'invalid.com', 'fake.com', 'temp.com', 'none.com', 'null.com'];
    if (blockedDomains.includes(domain)) {
        return { valid: false, reason: `The domain "${domain}" is a placeholder domain and cannot receive real emails.` };
    }

    // Fast-path: well-known reliable mail domains are guaranteed to have active mail servers
    if (COMMON_EMAIL_DOMAINS.has(domain)) {
        return { valid: true, domain, mxCount: 5 };
    }

    try {
        // Run DNS MX lookup with a 4-second timeout to prevent hanging requests
        const mxPromise = dns.resolveMx(domain);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('DNS_TIMEOUT')), 4000));

        const mxRecords = await Promise.race([mxPromise, timeoutPromise]);
        if (!mxRecords || mxRecords.length === 0) {
            return { valid: false, reason: `The domain "${domain}" does not have active mail exchange (MX) servers.` };
        }
        return { valid: true, domain, mxCount: mxRecords.length };
    } catch (dnsErr) {
        const isTimeout = dnsErr.message === 'DNS_TIMEOUT' || dnsErr.code === 'ETIMEOUT' || dnsErr.code === 'SERVFAIL';
        // If DNS lookup timed out or had a transient network error, fail-open to avoid blocking valid users
        if (isTimeout) {
            console.warn(`[DNS MX Note]: DNS lookup timed out or returned transient error for "${domain}". Allowing account creation.`);
            return { valid: true, domain, mxCount: 1, note: 'DNS timeout - failed open' };
        }

        // Conclusively non-existent domain
        if (dnsErr.code === 'ENOTFOUND' || dnsErr.code === 'ENODATA' || dnsErr.code === 'NXDOMAIN') {
            return { 
                valid: false, 
                reason: `The email domain "${domain}" does not exist or has no mail servers registered.` 
            };
        }

        // For any other unexpected local DNS resolver network error, fail open with warning
        console.warn(`[DNS MX Error]: ${dnsErr.message} for domain "${domain}". Proceeding.`);
        return { valid: true, domain, mxCount: 1, note: 'DNS error - failed open' };
    }
};

// Route to verify email domain & MX existence before account creation
router.post(['/verify-email', '/api/verify-email'], async (req, res) => {
    const { email } = req.body;
    const result = await verifyEmailDeliverability(email);
    if (!result.valid) {
        return res.status(422).json({ success: false, error: result.reason });
    }
    res.json({ success: true, message: `Email domain "${result.domain}" has verified active mail servers.`, mxCount: result.mxCount });
});

// Initialize pooled SMTP transporter using Nodemailer Gmail service (compatible with local & serverless/Vercel)
let cachedTransporter = null;
const getTransporter = () => {
    const user = getSenderEmail();
    const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

    if (!user || !pass) {
        console.warn('[Email Transporter Error]: GMAIL_USER or GMAIL_APP_PASSWORD not set in environment.');
        return null;
    }

    if (!cachedTransporter) {
        cachedTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass },
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 15000
        });
    }

    return cachedTransporter;
};

// Helper to resolve the correct, active base URL dynamically and securely
const getBaseUrl = (req) => {
    if (process.env.APP_BASE_URL) {
        return process.env.APP_BASE_URL.trim().replace(/\/+$/, '');
    }

    const headerOrigin = (req.headers?.origin || '').trim().replace(/\/+$/, '');
    if (headerOrigin && (headerOrigin.startsWith('http://localhost') || headerOrigin.startsWith('http://127.0.0.1'))) {
        return headerOrigin;
    }

    return 'https://doc-dental-care-clinic.vercel.app';
};

router.post(['/send-reset-link', '/send-password-reset'], async (req, res) => {
    let { email, name, token } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is a required parameter.' });
    }

    email = String(email).trim().toLowerCase();
    name = String(name || 'Valued User').trim();

    const baseUrl = getBaseUrl(req);
    // Ignore any caller-supplied arbitrary resetLink to prevent phishing; generate strictly server-side
    const resolvedResetLink = token 
        ? `${baseUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` 
        : `${baseUrl}/forgot-password`;

    const transporter = getTransporter();
    if (!transporter) {
        return res.status(500).json({ 
            error: 'Gmail SMTPS is not configured on the server.',
            details: 'Please set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file.'
        });
    }

    const mailOptions = {
        from: `"Doc Dental Care Security" <${getSenderEmail()}>`,
        to: email,
        subject: 'Reset Your Password - Doc Dental Care',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 30px auto; padding: 32px; border: 1px solid #e8e2d5; border-radius: 16px; background-color: #fffdf9; box-shadow: 0 6px 18px rgba(0,0,0,0.04);">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h2 style="color: #B8860B; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px;">Doc Dental Care</h2>
                    <div style="text-transform: uppercase; color: #888; font-size: 10px; letter-spacing: 3px; margin-top: 5px;">Security & Account Recovery</div>
                </div>
                
                <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 20px 0;" />
                
                <p style="font-size: 15px; color: #333; line-height: 1.6; margin-top: 0;">Hello ${name},</p>
                
                <p style="font-size: 15px; color: #555; line-height: 1.6;">
                    We received a request to reset the password for your Doc Dental Care account. Click the button below to choose a new password:
                </p>
                
                <div style="text-align: center; margin: 35px 0;">
                    <a href="${resolvedResetLink}" target="_blank" rel="noopener noreferrer" style="font-size: 15px; font-weight: 700; color: #ffffff; background-color: #B8860B; padding: 14px 34px; border-radius: 28px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(184, 134, 11, 0.28); letter-spacing: 0.5px;">
                        Reset Password
                    </a>
                </div>
                
                <div style="background-color: #fcf8f0; padding: 16px 20px; border-radius: 10px; border: 1px solid #ebd9b6; margin: 25px 0;">
                    <p style="margin: 0 0 8px 0; font-size: 13.5px; color: #775a18; font-weight: 600;">
                        &#9200; This password reset link is valid for 15 minutes.
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #666; line-height: 1.5;">
                        If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged and your account is completely secure.
                    </p>
                </div>

                <p style="font-size: 12.5px; color: #888; text-align: center; margin-top: 25px; line-height: 1.5;">
                    Having trouble with the button? Copy and paste the link below into your web browser:<br />
                    <a href="${resolvedResetLink}" target="_blank" rel="noopener noreferrer" style="color: #B8860B; word-break: break-all; text-decoration: underline;">${resolvedResetLink}</a>
                </p>
                
                <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 30px 0;" />
                
                <p style="color: #999; font-size: 11px; text-align: center; margin-bottom: 0; line-height: 1.4;">
                    This is an automated security transmission from Doc Dental Care.<br />
                    &copy; 2026 Doc Dental Care. All rights reserved.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: `Password reset link delivered to ${email}` });
    } catch (error) {
        console.error('[Nodemailer Error]:', error);
        res.status(500).json({ error: 'Failed to deliver reset email over secure SMTP.', details: error.message });
    }
});

router.post('/send-otp', async (req, res) => {
    let { email, name, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required parameters.' });
    }

    email = String(email).trim().toLowerCase();
    name = String(name || 'Valued User').trim();
    otp = String(otp).trim();

    const transporter = getTransporter();
    if (!transporter) {
        return res.status(500).json({ 
            error: 'Gmail SMTPS is not configured on the server.',
            details: 'Please set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file.'
        });
    }

    const baseUrl = getBaseUrl(req);
    const portalUrl = `${baseUrl}/login`;

    const mailOptions = {
        from: `"Doc Dental Care" <${getSenderEmail()}>`,
        to: email,
        subject: 'Your Verification OTP Code - Doc Dental Care',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 30px auto; padding: 30px; border: 1px solid #e8e2d5; border-radius: 16px; background-color: #fffdf9; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h2 style="color: #B8860B; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px;">Doc Dental Care</h2>
                    <div style="text-transform: uppercase; color: #888; font-size: 10px; letter-spacing: 3px; margin-top: 5px;">Clinical System</div>
                </div>
                
                <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 20px 0;" />
                
                <p style="font-size: 15px; color: #333; line-height: 1.6; margin-top: 0;">Hello ${name},</p>
                
                <p style="font-size: 15px; color: #555; line-height: 1.6;">We received a request to retrieve or reset the password for your Doc Dental Care account.</p>
                
                <p style="font-size: 15px; color: #555; line-height: 1.6;">Please use the 6-digit One-Time Password (OTP) below to verify your identity and finalize your password updates:</p>
                
                <div style="text-align: center; margin: 35px 0;">
                    <span style="font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #1f1b18; background-color: #fcf8f0; padding: 12px 28px; border-radius: 10px; border: 1.5px solid #d4af37; display: inline-block; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);">${otp}</span>
                </div>
                
                <p style="font-size: 14px; color: #888; line-height: 1.5;">If you did not make this request, you can safely ignore this email. Your password will remain unchanged.</p>

                <p style="font-size: 13px; color: #777; text-align: center; margin-top: 25px;">
                    Portal Access: <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="color: #B8860B;">${portalUrl}</a>
                </p>
                
                <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 30px 0;" />
                
                <p style="color: #999; font-size: 11px; text-align: center; margin-bottom: 0; line-height: 1.4;">
                    This is an automated security transmission. Please do not reply directly to this message.<br />
                    &copy; 2026 Doc Dental Care. All rights reserved.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: `OTP delivered to ${email}` });
    } catch (error) {
        console.error('[Nodemailer Error]:', error);
        res.status(500).json({ error: 'Failed to deliver email over secure SMTP.', details: error.message });
    }
});

router.post('/send-verification-otp', async (req, res) => {
    let { email, name, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required parameters.' });
    }

    email = String(email).trim().toLowerCase();
    name = String(name || 'Valued User').trim();
    otp = String(otp).trim();

    const transporter = getTransporter();
    if (!transporter) {
        return res.status(500).json({ 
            error: 'Gmail SMTPS is not configured on the server.',
            details: 'Please set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file.'
        });
    }

    const baseUrl = getBaseUrl(req);
    const portalUrl = `${baseUrl}/login`;

    const mailOptions = {
        from: `"Doc Dental Care Security" <${getSenderEmail()}>`,
        to: email,
        subject: 'Verify Your Email Address - Doc Dental Care',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 30px auto; padding: 30px; border: 1px solid #e8e2d5; border-radius: 16px; background-color: #fffdf9; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h2 style="color: #B8860B; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px;">Doc Dental Care</h2>
                    <div style="text-transform: uppercase; color: #888; font-size: 10px; letter-spacing: 3px; margin-top: 5px;">Security & Account Verification</div>
                </div>
                
                <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 20px 0;" />
                
                <p style="font-size: 15px; color: #333; line-height: 1.6; margin-top: 0;">Hello ${name},</p>
                
                <p style="font-size: 15px; color: #555; line-height: 1.6;">Thank you for registering with Doc Dental Care. To complete your registration and activate your account, please verify your email address using the One-Time Password (OTP) code below:</p>
                
                <div style="text-align: center; margin: 35px 0;">
                    <span style="font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #1f1b18; background-color: #fcf8f0; padding: 12px 28px; border-radius: 10px; border: 1.5px solid #d4af37; display: inline-block; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);">${otp}</span>
                </div>
                
                <p style="font-size: 14px; color: #888; line-height: 1.5;">This verification code is valid for your current registration session. If you did not create an account with Doc Dental Care, please ignore this email.</p>

                <p style="font-size: 13px; color: #777; text-align: center; margin-top: 25px;">
                    Portal Access: <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="color: #B8860B;">${portalUrl}</a>
                </p>
                
                <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 30px 0;" />
                
                <p style="color: #999; font-size: 11px; text-align: center; margin-bottom: 0; line-height: 1.4;">
                    This is an automated security transmission. Please do not reply directly to this message.<br />
                    &copy; 2026 Doc Dental Care. All rights reserved.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: `Verification OTP delivered to ${email}` });
    } catch (error) {
        console.error('[Nodemailer Error]:', error);
        res.status(500).json({ error: 'Failed to deliver email over secure SMTP.', details: error.message });
    }
});

router.post('/send-welcome', async (req, res) => {
    let { email, name, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Email, password, and role are required parameters.' });
    }

    email = String(email).trim().toLowerCase();
    name = String(name || 'Valued User').trim();
    password = String(password).trim();
    role = String(role).trim();

    // 1. Verify email format and MX domain validity
    const check = await verifyEmailDeliverability(email);
    if (!check.valid) {
        return res.status(422).json({ 
            success: false, 
            error: check.reason,
            details: 'Account creation rejected because the recipient email domain does not exist or has no active mail exchange servers.' 
        });
    }

    const transporter = getTransporter();
    if (!transporter) {
        return res.status(500).json({ 
            success: false,
            error: 'Gmail SMTPS is not configured on the server.',
            details: 'Please set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file.'
        });
    }

    const isStaff = role.toLowerCase() === 'staff' || role.toLowerCase() === 'admin' || role.toLowerCase() === 'superadmin';
    const roleLabel = isStaff ? (role.toLowerCase() === 'superadmin' ? 'Super Administrator' : (role.toLowerCase() === 'admin' ? 'Clinic Administrator' : 'Staff Member')) : 'Valued Patient';
    
    const baseUrl = getBaseUrl(req);
    const portalUrl = isStaff ? `${baseUrl}/admin/login` : `${baseUrl}/login`;

    const mailOptions = {
        from: `"Doc Dental Care" <${getSenderEmail()}>`,
        to: email,
        subject: 'Welcome to Doc Dental Care - Account Created',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 30px auto; padding: 30px; border: 1px solid #e8e2d5; border-radius: 16px; background-color: #fffdf9; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h2 style="color: #B8860B; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px;">Doc Dental Care</h2>
                    <div style="text-transform: uppercase; color: #888; font-size: 10px; letter-spacing: 3px; margin-top: 5px;">Clinical System</div>
                </div>
                
                <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 20px 0;" />
                
                <p style="font-size: 15px; color: #333; line-height: 1.6; margin-top: 0;">Hello ${name},</p>
                
                <p style="font-size: 15px; color: #555; line-height: 1.6;">Welcome to Doc Dental Care! An account has been created for you as a <strong>${roleLabel}</strong> by the clinic administration.</p>
                
                <p style="font-size: 15px; color: #555; line-height: 1.6;">Below are your login credentials. Please log in and change your password as soon as possible:</p>
                
                <div style="background-color: #fcf8f0; padding: 20px; border-radius: 10px; border: 1.5px solid #d4af37; margin: 25px 0;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #555;"><strong>Email/Username:</strong> ${email}</p>
                    <p style="margin: 0; font-size: 14px; color: #555;"><strong>Temporary Password:</strong> <code style="font-size: 15px; background: #eaeaea; padding: 3px 6px; border-radius: 4px; font-family: monospace;">${password}</code></p>
                </div>
                
                <p style="font-size: 15px; color: #555; line-height: 1.6;">You can access the portal to view dental charts, medical records, and manage appointments here:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 15px; font-weight: bold; color: #ffffff; background-color: #B8860B; padding: 14px 32px; border-radius: 25px; text-decoration: none; display: inline-block; box-shadow: 0 4px 10px rgba(184, 134, 11, 0.25);">Go to Portal</a>
                </div>
                
                <p style="font-size: 13px; color: #777; text-align: center; margin-top: 15px;">
                    Or copy and paste this link into your browser:<br />
                    <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="color: #B8860B; word-break: break-all;">${portalUrl}</a>
                </p>
                
                <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 30px 0;" />
                
                <p style="color: #999; font-size: 11px; text-align: center; margin-bottom: 0; line-height: 1.4;">
                    This is an automated transmission. Please do not reply directly to this message.<br />
                    &copy; 2026 Doc Dental Care. All rights reserved.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: `Welcome credentials email successfully sent to ${email}` });
    } catch (error) {
        console.error('[Nodemailer Error]:', error);
        res.status(500).json({ error: 'Failed to deliver welcome email over secure SMTP.', details: error.message });
    }
});

router.post('/send-emergency', async (req, res) => {
    let { email, name, date, time, service, reason } = req.body;

    if (!email || !date || !reason) {
        return res.status(400).json({ error: 'Email, date, and reason are required parameters.' });
    }

    email = String(email).trim().toLowerCase();
    name = String(name || 'Valued Patient').trim();

    const transporter = getTransporter();
    if (!transporter) {
        return res.status(500).json({ 
            error: 'Gmail SMTPS is not configured on the server.',
            details: 'Please set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file.'
        });
    }

    const baseUrl = getBaseUrl(req);
    const portalUrl = `${baseUrl}/login`;

    const timeStr = time ? ` at <strong>${time}</strong>` : '';
    const serviceStr = service ? ` (${service})` : '';

    const mailOptions = {
        from: `"Doc Dental Care" <${getSenderEmail()}>`,
        to: email,
        subject: 'URGENT: Appointment Cancellation due to Emergency Closure - Doc Dental Care',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 30px auto; padding: 30px; border: 1.5px solid #dc3545; border-radius: 16px; background-color: #fffdf9; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h2 style="color: #dc3545; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px;">Doc Dental Care</h2>
                    <div style="text-transform: uppercase; color: #888; font-size: 10px; letter-spacing: 3px; margin-top: 5px;">Emergency Notice</div>
                </div>
                
                <hr style="border: 0; border-top: 1px solid #dc3545; margin: 20px 0; opacity: 0.3;" />
                
                <p style="font-size: 15px; color: #333; line-height: 1.6; margin-top: 0;">Hello ${name},</p>
                
                <p style="font-size: 15px; color: #555; line-height: 1.6;">We regret to inform you that your clinical appointment scheduled for <strong>${date}</strong>${timeStr}${serviceStr} has been <strong style="color: #dc3545;">cancelled</strong> due to an emergency clinic closure.</p>
                
                <div style="background-color: #fdf2f2; padding: 20px; border-radius: 10px; border: 1.5px solid #dc3545; margin: 25px 0;">
                    <p style="margin: 0; font-size: 14px; color: #721c24;"><strong>Reason for Closure:</strong> ${reason}</p>
                </div>
                
                <p style="font-size: 15px; color: #555; line-height: 1.6;">We apologize for the inconvenience this may cause. Please log back into the patient portal to reschedule your appointment at your earliest convenience:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 15px; font-weight: bold; color: #ffffff; background-color: #dc3545; padding: 14px 32px; border-radius: 25px; text-decoration: none; display: inline-block; box-shadow: 0 4px 10px rgba(220, 53, 69, 0.25);">Reschedule Appointment</a>
                </div>

                <p style="font-size: 13px; color: #777; text-align: center; margin-top: 15px;">
                    Portal Link: <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="color: #dc3545; word-break: break-all;">${portalUrl}</a>
                </p>

                <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 30px 0;" />
                
                <p style="color: #999; font-size: 11px; text-align: center; margin-bottom: 0; line-height: 1.4;">
                    This is an urgent automated notification regarding your clinical appointment.<br />
                    &copy; 2026 Doc Dental Care. All rights reserved.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: `Emergency cancellation notice delivered to ${email}` });
    } catch (error) {
        console.error('[Nodemailer Error]:', error);
        res.status(500).json({ error: 'Failed to deliver emergency email over secure SMTP.', details: error.message });
    }
});

router.post('/declare-emergency-closure', verifyAuth, requireRole('superadmin', 'admin'), async (req, res) => {
    const { date, reason } = req.body;

    if (!date || !reason) {
        return res.status(400).json({ success: false, error: 'Date and emergency reason are required.' });
    }

    const mysqlPool = req.app.get('dbPool');
    const transporter = getTransporter();

    try {
        let cancelledCount = 0;
        let emailsSent = 0;
        const sentEmails = [];
        const failedEmails = [];

        const targetDate = String(date).trim();
        const formattedDate = new Date(targetDate.includes('T') ? targetDate : `${targetDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const baseUrl = getBaseUrl(req);
        const portalUrl = `${baseUrl}/login`;

        let affectedAppointments = [];

        if (mysqlPool) {
            // 1. Fetch appointments scheduled for target date that are not cancelled
            const [rows] = await mysqlPool.query(
                `SELECT * FROM appointments WHERE TRIM(date) = ? AND status != 'Cancelled'`,
                [targetDate]
            );
            affectedAppointments = rows || [];

            // 2. Fetch users to resolve emails if patient_email is empty
            const [users] = await mysqlPool.query(`SELECT id, email, full_name FROM users`);
            const userMap = new Map();
            (users || []).forEach(u => {
                if (u.email) userMap.set((u.full_name || '').trim().toLowerCase(), u.email);
            });

            // 3. Mark appointments as cancelled in MySQL
            if (affectedAppointments.length > 0) {
                await mysqlPool.query(
                    `UPDATE appointments 
                     SET status = 'Cancelled', 
                         cancelled_due_to_emergency = 1, 
                         emergency_reason = ? 
                     WHERE TRIM(date) = ? AND status != 'Cancelled'`,
                    [reason, targetDate]
                );
                cancelledCount = affectedAppointments.length;
            }

            // 4. Update clinic_settings in patient_charts to mark date as unavailable
            const [chartRows] = await mysqlPool.query(
                `SELECT chart_data FROM patient_charts WHERE email = 'clinic_settings'`
            );
            let clinicSettings = {};
            if (chartRows.length > 0 && chartRows[0].chart_data) {
                try {
                    clinicSettings = typeof chartRows[0].chart_data === 'string' ? JSON.parse(chartRows[0].chart_data) : chartRows[0].chart_data;
                } catch (e) {}
            }
            const unavailableDates = Array.isArray(clinicSettings.unavailableDates) ? clinicSettings.unavailableDates : [];
            const updatedUnavailable = [
                ...unavailableDates.filter(item => item.date !== targetDate),
                { date: targetDate, reason: `Emergency: ${reason}` }
            ];
            clinicSettings.unavailableDates = updatedUnavailable;
            await mysqlPool.query(
                `INSERT INTO patient_charts (email, chart_data, updated_at)
                 VALUES ('clinic_settings', ?, NOW())
                 ON DUPLICATE KEY UPDATE chart_data = VALUES(chart_data), updated_at = NOW()`,
                [JSON.stringify(clinicSettings)]
            );

            // 5. In-app notifications in patient_charts ('notifications')
            const [notifRows] = await mysqlPool.query(
                `SELECT chart_data FROM patient_charts WHERE email = 'notifications'`
            );
            let notifData = { notifications: {}, appointment_notifications: [] };
            if (notifRows.length > 0 && notifRows[0].chart_data) {
                try {
                    notifData = typeof notifRows[0].chart_data === 'string' ? JSON.parse(notifRows[0].chart_data) : notifRows[0].chart_data;
                } catch (e) {}
            }
            if (!Array.isArray(notifData.appointment_notifications)) {
                notifData.appointment_notifications = [];
            }

            affectedAppointments.forEach(app => {
                let pEmail = (app.patient_email || app.patientEmail || '').trim();
                if (!pEmail && app.patient_name) {
                    pEmail = userMap.get((app.patient_name || '').trim().toLowerCase()) || '';
                }
                notifData.appointment_notifications.push({
                    id: `emergency-closure-${app.id}-${Date.now()}`,
                    patientEmail: pEmail,
                    message: `Clinic Emergency Closure on ${formattedDate}: ${reason}. Your appointment was cancelled.`,
                    type: 'Cancelled',
                    isRead: false,
                    timestamp: new Date().toISOString()
                });
            });

            await mysqlPool.query(
                `INSERT INTO patient_charts (email, chart_data, updated_at)
                 VALUES ('notifications', ?, NOW())
                 ON DUPLICATE KEY UPDATE chart_data = VALUES(chart_data), updated_at = NOW()`,
                [JSON.stringify(notifData)]
            );

            // 6. Send emergency emails to all affected patients
            if (transporter && affectedAppointments.length > 0) {
                const emailPromises = affectedAppointments.map(async (app) => {
                    let targetEmail = (app.patient_email || app.patientEmail || '').trim().toLowerCase();
                    if (!targetEmail && app.patient_name) {
                        targetEmail = (userMap.get((app.patient_name || '').trim().toLowerCase()) || '').trim().toLowerCase();
                    }

                    if (targetEmail && targetEmail.includes('@')) {
                        const patientName = app.patient_name || app.patientName || 'Patient';
                        const timeStr = app.time ? ` at <strong>${app.time}</strong>` : '';
                        const serviceStr = (app.service || app.category) ? ` (${app.service || app.category})` : '';

                        const mailOptions = {
                            from: `"Doc Dental Care" <${getSenderEmail()}>`,
                            to: targetEmail,
                            subject: 'URGENT: Appointment Cancellation due to Emergency Closure - Doc Dental Care',
                            html: `
                                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 30px auto; padding: 30px; border: 1.5px solid #dc3545; border-radius: 16px; background-color: #fffdf9; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                                    <div style="text-align: center; margin-bottom: 25px;">
                                        <h2 style="color: #dc3545; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px;">Doc Dental Care</h2>
                                        <div style="text-transform: uppercase; color: #888; font-size: 10px; letter-spacing: 3px; margin-top: 5px;">Emergency Notice</div>
                                    </div>
                                    
                                    <hr style="border: 0; border-top: 1px solid #dc3545; margin: 20px 0; opacity: 0.3;" />
                                    
                                    <p style="font-size: 15px; color: #333; line-height: 1.6; margin-top: 0;">Hello ${patientName},</p>
                                    
                                    <p style="font-size: 15px; color: #555; line-height: 1.6;">We regret to inform you that your clinical appointment scheduled for <strong>${formattedDate}</strong>${timeStr}${serviceStr} has been <strong style="color: #dc3545;">cancelled</strong> due to an emergency clinic closure.</p>
                                    
                                    <div style="background-color: #fdf2f2; padding: 20px; border-radius: 10px; border: 1.5px solid #dc3545; margin: 25px 0;">
                                        <p style="margin: 0; font-size: 14px; color: #721c24;"><strong>Reason for Closure:</strong> ${reason}</p>
                                    </div>
                                    
                                    <p style="font-size: 15px; color: #555; line-height: 1.6;">We apologize for the inconvenience this may cause. Please log back into the patient portal to reschedule your appointment at your earliest convenience:</p>
                                    
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 15px; font-weight: bold; color: #ffffff; background-color: #dc3545; padding: 14px 32px; border-radius: 25px; text-decoration: none; display: inline-block; box-shadow: 0 4px 10px rgba(220, 53, 69, 0.25);">Reschedule Appointment</a>
                                    </div>

                                    <p style="font-size: 13px; color: #777; text-align: center; margin-top: 15px;">
                                        Portal Link: <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="color: #dc3545; word-break: break-all;">${portalUrl}</a>
                                    </p>

                                    <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 30px 0;" />
                                    
                                    <p style="color: #999; font-size: 11px; text-align: center; margin-bottom: 0; line-height: 1.4;">
                                        This is an urgent automated notification regarding your clinical appointment.<br />
                                        &copy; 2026 Doc Dental Care. All rights reserved.
                                    </p>
                                </div>
                            `
                        };

                        try {
                            await transporter.sendMail(mailOptions);
                            emailsSent++;
                            sentEmails.push(targetEmail);
                        } catch (mailErr) {
                            console.error(`[Emergency Email Error] Failed for ${targetEmail}:`, mailErr.message);
                            failedEmails.push({ email: targetEmail, error: mailErr.message });
                        }
                    }
                });

                await Promise.all(emailPromises);
            }

            // 7. Audit log in MySQL
            const auditMsg = `Clinic closed on ${formattedDate} due to: ${reason}. ${cancelledCount} appointments cancelled (${emailsSent} emergency emails sent).`;
            await mysqlPool.query(
                `INSERT INTO audit_logs (id, action, details, timestamp)
                 VALUES (?, 'Emergency Closure Declared', ?, NOW())`,
                [Date.now(), auditMsg]
            );
        }

        res.json({
            success: true,
            date: targetDate,
            formattedDate,
            reason,
            cancelledCount,
            emailsSent,
            sentEmails,
            failedEmails,
            totalAffected: affectedAppointments.length
        });
    } catch (error) {
        console.error('[Declare Emergency Closure Catch]:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/send-appointment-status', async (req, res) => {
    let { email, name, status, date, time, service, reason } = req.body;

    if (!email || !status || !date) {
        return res.status(400).json({ error: 'Email, status, and date are required parameters.' });
    }

    email = String(email).trim().toLowerCase();
    name = String(name || 'Valued Patient').trim();
    status = String(status).trim();
    date = String(date).trim();

    const transporter = getTransporter();
    if (!transporter) {
        return res.status(500).json({ 
            error: 'Gmail SMTPS is not configured on the server.',
            details: 'Please set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file.'
        });
    }

    const baseUrl = getBaseUrl(req);
    const portalUrl = (process.env.APP_BASE_URL || baseUrl).trim().replace(/\/+$/, '');

    const timeStr = time ? ` at <strong>${time}</strong>` : '';
    const serviceStr = service ? ` for <strong>${service}</strong>` : '';
    
    let subject = `Appointment Notice: ${status} - Doc Dental Care`;
    let statusHeading = `Appointment ${status}`;
    let statusColor = '#B8860B';
    let statusMessage = '';

    if (status === 'Confirmed' || status === 'Approved') {
        subject = `Appointment Confirmed - Doc Dental Care`;
        statusHeading = `Appointment Confirmed`;
        statusColor = '#1f7a3a';
        statusMessage = `Your appointment${serviceStr} scheduled for <strong>${date}</strong>${timeStr} has been <strong style="color: #1f7a3a;">Confirmed</strong>.`;
    } else if (status === 'Cancelled') {
        subject = `Appointment Cancelled - Doc Dental Care`;
        statusHeading = `Appointment Cancelled`;
        statusColor = '#dc3545';
        const reasonText = reason ? `<br/><br/><strong>Reason for cancellation:</strong> ${reason}` : '';
        statusMessage = `Your appointment${serviceStr} scheduled for <strong>${date}</strong>${timeStr} has been <strong style="color: #dc3545;">Cancelled</strong>.${reasonText}`;
    } else if (status === 'Completed') {
        subject = `Appointment Completed - Doc Dental Care`;
        statusHeading = `Appointment Completed`;
        statusColor = '#2457a6';
        statusMessage = `Your appointment${serviceStr} scheduled for <strong>${date}</strong>${timeStr} has been marked as <strong style="color: #2457a6;">Completed</strong>. Thank you for visiting Doc Dental Care!`;
    } else if (status === "Didn't Come") {
        subject = `Missed Appointment Notice - Doc Dental Care`;
        statusHeading = `Missed Appointment`;
        statusColor = '#d97706';
        statusMessage = `Your appointment${serviceStr} scheduled for <strong>${date}</strong>${timeStr} was marked as missed (Didn't Come).`;
    } else if (status === 'Pending') {
        subject = `Appointment Request Received - Doc Dental Care`;
        statusHeading = `Appointment Pending`;
        statusColor = '#B8860B';
        statusMessage = `Your appointment${serviceStr} scheduled for <strong>${date}</strong>${timeStr} has been received and is currently in <strong>Pending</strong> status.`;
    } else {
        statusMessage = `Your appointment${serviceStr} scheduled for <strong>${date}</strong>${timeStr} is now <strong>${status}</strong>.`;
    }

    const mailOptions = {
        from: `"Doc Dental Care" <${getSenderEmail()}>`,
        to: email,
        subject: subject,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 30px auto; padding: 30px; border: 1px solid #e8e2d5; border-radius: 16px; background-color: #fffdf9; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h2 style="color: #B8860B; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px;">Doc Dental Care</h2>
                    <div style="text-transform: uppercase; color: #888; font-size: 10px; letter-spacing: 3px; margin-top: 5px;">Appointment Notification</div>
                </div>
                
                <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 20px 0;" />
                
                <p style="font-size: 15px; color: #333; line-height: 1.6; margin-top: 0;">Hello ${name},</p>
                
                <p style="font-size: 15px; color: #555; line-height: 1.6;">${statusMessage}</p>

                <div style="background-color: #fcf8f0; padding: 20px; border-radius: 10px; border: 1.5px solid ${statusColor}; margin: 25px 0;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #555;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${status}</span></p>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #555;"><strong>Date:</strong> ${date}</p>
                    ${time ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #555;"><strong>Time:</strong> ${time}</p>` : ''}
                    ${service ? `<p style="margin: 0; font-size: 14px; color: #555;"><strong>Service:</strong> ${service}</p>` : ''}
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 15px; font-weight: bold; color: #ffffff; background-color: #B8860B; padding: 14px 32px; border-radius: 25px; text-decoration: none; display: inline-block; box-shadow: 0 4px 10px rgba(184, 134, 11, 0.25);">View Appointment in Portal</a>
                </div>

                <p style="font-size: 13px; color: #777; text-align: center; margin-top: 15px;">
                    Or copy and paste this link into your browser:<br />
                    <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="color: #B8860B; word-break: break-all;">${portalUrl}</a>
                </p>
                
                <hr style="border: 0; border-top: 1px solid #e8e2d5; margin: 30px 0;" />
                
                <p style="color: #999; font-size: 11px; text-align: center; margin-bottom: 0; line-height: 1.4;">
                    This is an automated transmission regarding your clinical appointment.<br />
                    &copy; 2026 Doc Dental Care. All rights reserved.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: `Appointment status email delivered to ${email}` });
    } catch (error) {
        console.error('[Nodemailer Error]:', error);
        res.status(500).json({ error: 'Failed to deliver appointment status email over secure SMTP.', details: error.message });
    }
});

module.exports = router;
