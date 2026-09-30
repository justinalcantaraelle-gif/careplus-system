/**
 * errorHandler.js
 * Express global centralized error handling middleware.
 * Must take 4 arguments: (err, req, res, next).
 */

const errorHandler = (err, req, res, next) => {
    console.error('[Global Backend Error]:', err.stack || err.message || err);

    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

    res.status(statusCode).json({
        error: err.message || 'An unexpected server error occurred.',
        code: err.code || 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString()
    });
};

module.exports = errorHandler;
