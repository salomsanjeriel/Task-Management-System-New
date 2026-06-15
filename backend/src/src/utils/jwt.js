const jwt = require('jsonwebtoken');

/**
 * Sign a JWT token with userId and role
 * @param {Object} payload - { userId, role }
 * @returns {string} Signed JWT token
 */
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || '1h',
  });
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token string
 * @returns {Object} Decoded payload { userId, role, iat, exp }
 */
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
