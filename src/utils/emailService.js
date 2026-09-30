/**
 * emailService.js
 * 
 * Reusable utility to send transactional emails directly from the React client 
 * using Nodemailer SMTPS hosted on the local backend server.
 */

import { getAuthToken } from './storage';

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

export const getClientOrigin = () => {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return window.location.origin;
    }
    return process.env.APP_BASE_URL || 'https://doc-dental-care-clinic.vercel.app';
};

export const sendPasswordResetLink = async (recipientEmail, recipientName, token, resetLink = null, turnstileToken = null) => {
    try {
        const origin = getClientOrigin();
        const computedResetLink = resetLink || `${origin}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(recipientEmail)}`;

        const payload = {
            email: recipientEmail,
            name: recipientName,
            token: token,
            resetLink: computedResetLink,
            origin: origin
        };
        if (turnstileToken && turnstileToken !== 'bypass' && !turnstileToken.startsWith('XXXX')) {
            payload.turnstileToken = turnstileToken;
        }

        let response = await fetch(`${getApiBaseUrl()}/api/send-reset-link`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return { success: true, resetLink: computedResetLink };
        }

        // Retry fallback if status 400/403
        if (response.status === 403 || response.status === 400) {
            response = await fetch(`${getApiBaseUrl()}/api/send-reset-link`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: recipientEmail,
                    name: recipientName,
                    token: token,
                    resetLink: computedResetLink,
                    origin: origin
                })
            });
            if (response.ok) {
                return { success: true, resetLink: computedResetLink };
            }
        }

        const errData = await response.json().catch(() => ({}));
        console.error('Backend Email API Error:', errData);
        return { success: false, reason: errData.error || errData.details || 'SERVER_ERROR', resetLink: computedResetLink };
    } catch (e) {
        console.error('Failed to communicate with local email API:', e);
        const origin = getClientOrigin();
        const computedResetLink = resetLink || `${origin}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(recipientEmail)}`;
        return { success: false, reason: 'BACKEND_NOT_RUNNING', resetLink: computedResetLink };
    }
};

export const sendOtpEmail = async (recipientEmail, recipientName, otp, turnstileToken = null) => {
    try {
        const payload = {
            email: recipientEmail,
            name: recipientName,
            otp: otp,
            origin: getClientOrigin()
        };
        if (turnstileToken && turnstileToken !== 'bypass' && !turnstileToken.startsWith('XXXX')) {
            payload.turnstileToken = turnstileToken;
        }

        let response = await fetch(`${getApiBaseUrl()}/api/send-otp`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return { success: true };
        }

        // Retry without turnstile token if legacy server process returned 403
        if (response.status === 403 || response.status === 400) {
            response = await fetch(`${getApiBaseUrl()}/api/send-otp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: recipientEmail,
                    name: recipientName,
                    otp: otp,
                    origin: getClientOrigin()
                })
            });
            if (response.ok) {
                return { success: true };
            }
        }

        const errData = await response.json().catch(() => ({}));
        console.error('Backend Email API Error:', errData);
        return { success: false, reason: errData.error || errData.details || 'SERVER_ERROR' };
    } catch (e) {
        console.error('Failed to communicate with local email API:', e);
        return { success: false, reason: 'BACKEND_NOT_RUNNING' };
    }
};

export const sendVerificationOtp = async (recipientEmail, recipientName, otp, turnstileToken = null) => {
    try {
        const payload = {
            email: recipientEmail,
            name: recipientName,
            otp: otp,
            origin: getClientOrigin()
        };
        if (turnstileToken && turnstileToken !== 'bypass' && !turnstileToken.startsWith('XXXX')) {
            payload.turnstileToken = turnstileToken;
        }

        let response = await fetch(`${getApiBaseUrl()}/api/send-verification-otp`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return { success: true };
        }

        if (response.status === 403 || response.status === 400) {
            response = await fetch(`${getApiBaseUrl()}/api/send-verification-otp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: recipientEmail,
                    name: recipientName,
                    otp: otp,
                    origin: getClientOrigin()
                })
            });
            if (response.ok) {
                return { success: true };
            }
        }

        const errData = await response.json().catch(() => ({}));
        console.error('Backend Email API Error:', errData);
        return { success: false, reason: errData.error || errData.details || 'SERVER_ERROR' };
    } catch (e) {
        console.error('Failed to communicate with local email API:', e);
        return { success: false, reason: 'BACKEND_NOT_RUNNING' };
    }
};

export const verifyEmailAddress = async (recipientEmail) => {
    try {
        const cleanEmail = (recipientEmail || '').trim().toLowerCase();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(cleanEmail)) {
            return { valid: false, reason: 'Please enter a valid email address format (e.g. name@domain.com).' };
        }

        const response = await fetch(`${getApiBaseUrl()}/api/verify-email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email: cleanEmail })
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
            return { valid: true, domain: data.message };
        }
        return { valid: false, reason: data.error || data.details || 'The email domain does not exist or has no active mail exchange servers.' };
    } catch (e) {
        return { valid: true, warning: 'Offline check' };
    }
};

export const sendWelcomeEmail = async (recipientEmail, recipientName, temporaryPassword, role) => {
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/send-welcome`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: recipientEmail,
                name: recipientName,
                password: temporaryPassword,
                role: role,
                origin: getClientOrigin()
            })
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
            return { success: true };
        } else {
            console.error('Backend Email API Error:', data);
            return { success: false, reason: data.error || data.details || 'Email deliverability verification failed.' };
        }
    } catch (e) {
        console.error('Failed to communicate with local email API:', e);
        return { success: false, reason: 'Email server is currently unreachable.' };
    }
};

export const sendEmergencyEmail = async (recipientEmail, recipientName, date, reason, time = null, service = null) => {
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/send-emergency`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: recipientEmail,
                name: recipientName,
                date: date,
                reason: reason,
                time: time,
                service: service,
                origin: getClientOrigin()
            })
        });

        if (response.ok) {
            return { success: true };
        } else {
            const errData = await response.json().catch(() => ({}));
            console.error('Backend Email API Error:', errData);
            return { success: false, reason: errData.error || errData.details || 'SERVER_ERROR' };
        }
    } catch (e) {
        console.error('Failed to communicate with local email API:', e);
        return { success: false, reason: 'BACKEND_NOT_RUNNING' };
    }
};

export const sendAppointmentStatusEmail = async (recipientEmail, recipientName, { status, date, time, service, reason }) => {
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/send-appointment-status`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: recipientEmail,
                name: recipientName,
                status: status,
                date: date,
                time: time,
                service: service,
                reason: reason,
                origin: getClientOrigin()
            })
        });

        if (response.ok) {
            return { success: true };
        } else {
            const errData = await response.json().catch(() => ({}));
            console.error('Backend Email API Error:', errData);
            return { success: false, reason: errData.error || errData.details || 'SERVER_ERROR' };
        }
    } catch (e) {
        console.error('Failed to communicate with local email API:', e);
        return { success: false, reason: 'BACKEND_NOT_RUNNING' };
    }
};

export const declareEmergencyClosure = async (date, reason) => {
    try {
        const token = getAuthToken();
        const headers = {
            "Content-Type": "application/json"
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(`${getApiBaseUrl()}/api/declare-emergency-closure`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
                date: date,
                reason: reason,
                origin: getClientOrigin()
            })
        });

        if (response.ok) {
            const data = await response.json();
            return { success: true, ...data };
        } else {
            const errData = await response.json().catch(() => ({}));
            console.error('Backend Emergency Closure Error:', errData);
            return { success: false, reason: errData.error || errData.details || 'SERVER_ERROR' };
        }
    } catch (e) {
        console.error('Failed to communicate with local declare-emergency-closure API:', e);
        return { success: false, reason: 'BACKEND_NOT_RUNNING' };
    }
};
