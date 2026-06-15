const { PrismaClient } = require('@prisma/client');
const { signToken } = require('../utils/jwt');
const { comparePassword, hashPassword, validatePasswordPolicy } = require('../utils/password');

const prisma = new PrismaClient();

/**
 * POST /api/auth/login
 * Login with email + password → returns JWT token + user data
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Email and password are required.',
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Incorrect email or password. Please try again.',
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        errorCode: 'ACCOUNT_DEACTIVATED',
        message: 'Your account has been deactivated. Contact an administrator.',
      });
    }

    // Compare password with bcrypt hash
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Incorrect email or password. Please try again.',
      });
    }

    // Sign JWT token
    const token = signToken({ userId: user.id, role: user.role });

    // Return user data + token
    res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        must_reset_password: user.must_reset_password,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/reset-password
 * Reset password (authenticated) — enforces password policy
 */
async function resetPassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Old password and new password are required.',
      });
    }

    // Get user from DB
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'User not found.',
      });
    }

    // Verify old password
    const isOldPasswordValid = await comparePassword(oldPassword, user.password_hash);

    if (!isOldPasswordValid) {
      return res.status(400).json({
        errorCode: 'INVALID_PASSWORD',
        message: 'Current password is incorrect.',
      });
    }

    // Validate new password against policy
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      return res.status(400).json({
        errorCode: 'WEAK_PASSWORD',
        message: 'Password does not meet policy requirements.',
        details: policy.errors,
      });
    }

    // Hash and update password
    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: newHash,
        must_reset_password: false,
      },
    });

    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Get current authenticated user's info
 */
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        must_reset_password: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'User not found.',
      });
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

module.exports = { login, resetPassword, getMe };
