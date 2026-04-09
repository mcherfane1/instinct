/**
 * Centralized Express error handler. Mount last in index.js.
 */

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    console.error(`[Error] ${req.method} ${req.path} — ${status}:`, err.stack || err.message);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
