/**
 * Authorization Middleware Factory
 * Checks if the authenticated user has one of the allowed roles.
 *
 * Usage: authorize('admin', 'project_manager')
 *
 * @param  {...string} allowedRoles - Roles that can access this route
 * @returns {Function} Express middleware
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    // authenticate middleware must run first
    if (!req.user) {
      return res.status(401).json({
        errorCode: 'AUTHENTICATION_REQUIRED',
        message: 'You must be logged in to access this resource.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        errorCode: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
        details: {
          requiredRoles: allowedRoles,
          yourRole: req.user.role,
        },
      });
    }

    next();
  };
}

module.exports = authorize;
