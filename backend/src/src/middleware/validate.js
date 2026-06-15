const { validationResult } = require('express-validator');

/**
 * Validation Middleware
 * Runs after express-validator check chains.
 * If there are validation errors, returns 400 with field-level details.
 */
function validate(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      errorCode: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: errors.array().map((err) => ({
        field: err.path,
        issue: err.msg,
        value: err.value,
      })),
    });
  }

  next();
}

module.exports = validate;
