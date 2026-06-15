const { verifyToken } = require('../utils/jwt');

/**
 * Authentication Middleware
 * - Reads JWT from Authorization: Bearer <token> header
 * - Verifies the token
 * - Attaches req.user = { userId, role } to request
 * - Returns 401 if token is missing, invalid, or expired
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        errorCode: 'AUTHENTICATION_REQUIRED',
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        errorCode: 'TOKEN_EXPIRED',
        message: 'Token has expired. Please login again.',
      });
    }

    return res.status(401).json({
      errorCode: 'INVALID_TOKEN',
      message: 'Invalid token. Please login again.',
    });
  }
}

module.exports = authenticate;
