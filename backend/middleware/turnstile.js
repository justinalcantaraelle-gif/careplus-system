const verifyTurnstileToken = async (req, res, next) => {
    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    const token = req.body?.turnstileToken || req.headers['x-turnstile-token'];
    const isDev = process.env.NODE_ENV !== 'production';

    // 1. If Turnstile secret key is not set at all, skip verification cleanly with a warning in development
    if (!secretKey) {
        if (isDev) {
            console.warn('[Turnstile Middleware] TURNSTILE_SECRET_KEY is not set. Bypassing verification in dev.');
            return next();
        }
        return res.status(500).json({ error: 'Turnstile configuration missing.' });
    }

    const isDummyKey = secretKey.startsWith('1x000000') || secretKey.startsWith('2x000000') || secretKey.startsWith('3x000000');

    // 2. Allow bypass only for dummy test keys in development
    if (isDummyKey && isDev && (token === 'bypass' || (token && token.startsWith('XXXX')))) {
        console.warn('[Turnstile Middleware] Dummy test key/token detected. Bypassing Turnstile siteverify.');
        return next();
    }

    // 3. Require valid Turnstile token
    if (!token) {
        return res.status(400).json({
            error: 'Security Verification Required',
            details: 'Cloudflare Turnstile token is missing. Please complete the security check.'
        });
    }

    try {
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

        const formData = new URLSearchParams();
        formData.append('secret', secretKey);
        formData.append('response', token);
        if (ip) formData.append('remoteip', ip);

        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        const outcome = await response.json();

        if (outcome.success) {
            return next();
        } else {
            console.warn('[Turnstile Verification Warning]:', outcome['error-codes']);

            // In local dev / test keys or mismatched dev domain error codes, allow fallback in development
            const isTestErrorCode = outcome['error-codes']?.some(err => 
                ['invalid-input-response', 'invalid-input-secret', 'bad-request', 'missing-input-response'].includes(err)
            );

            if (isDev && (isDummyKey || isTestErrorCode)) {
                console.warn('[Turnstile Middleware] Development test response detected. Allowing local fallback.');
                return next();
            }

            // In Production on Vercel: Enforce strict 403 Forbidden security protection!
            return res.status(403).json({
                error: 'Security Verification Failed',
                details: 'Cloudflare Turnstile validation failed. Please refresh and try again.'
            });
        }
    } catch (err) {
        console.error('[Turnstile API Error]: Cloudflare server unreachable:', err.message);
        if (isDev && isDummyKey) {
            return next();
        }
        return res.status(503).json({
            error: 'Security Service Unavailable',
            details: 'Cloudflare verification service is temporarily unreachable.'
        });
    }
};

module.exports = { verifyTurnstileToken };
