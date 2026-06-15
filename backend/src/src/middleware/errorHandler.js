/**
 * Global Error Handler Middleware
 * Catches all errors and returns structured JSON responses.
 * Must be registered LAST in the middleware chain.
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);

  // Prisma known errors
  if (err.code === 'P2002') {
    // Unique constraint violation
    const field = err.meta?.target?.[0] || 'field';
    return res.status(400).json({
      errorCode: 'DUPLICATE_ENTRY',
      message: `A record with this ${field} already exists.`,
      details: { field },
    });
  }

  if (err.code === 'P2025') {
    // Record not found
    return res.status(404).json({
      errorCode: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    });
  }

  // Validation errors (from express-validator)
  if (err.type === 'VALIDATION_ERROR') {
    return res.status(400).json({
      errorCode: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: err.errors,
    });
  }

  // Custom application errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      errorCode: err.errorCode || 'APPLICATION_ERROR',
      message: err.message,
      details: err.details || null,
    });
  }

  // Default 500 server error
  res.status(500).json({
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
}

module.exports = errorHandler;
