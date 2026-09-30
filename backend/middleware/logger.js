/**
 * logger.js
 * Express middleware to log incoming HTTP requests and response performance.
 */

const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const { method, originalUrl } = req;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        const statusTag = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';
        
        // Suppress routine database polling logs unless an error occurred
        if ((originalUrl === '/api/database' || originalUrl === '/database') && statusCode < 400) {
            return;
        }

        console.log(`[${new Date().toISOString()}] ${statusTag} ${method} ${originalUrl} ${statusCode} - ${duration}ms (${ip})`);
    });

    next();
};

module.exports = requestLogger;
