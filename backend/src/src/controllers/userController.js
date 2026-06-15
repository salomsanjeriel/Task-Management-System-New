const { PrismaClient } = require('@prisma/client');
const { hashPassword, generateTempPassword } = require('../utils/password');

const prisma = new PrismaClient();

/**
 * GET /api/users
 * List all users — searchable by name/email, filterable by role
 * Admin only
 */
async function getAll(req, res, next) {
  try {
    const { search, role } = req.query;

    const where = {};

    // Search by name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by role
    if (role && role !== 'All') {
      where.role = role;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        must_reset_password: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/users
 * Create a new user with a temporary password
 * Admin only
 */
async function create(req, res, next) {
  try {
    const { name, email, role } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Name and email are required.',
      });
    }

    // Validate email format
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Enter a valid email address.',
        details: { field: 'email', issue: 'Invalid email format' },
      });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({
        errorCode: 'DUPLICATE_ENTRY',
        message: 'A user with this email already exists.',
        details: { field: 'email' },
      });
    }

    // Generate temp password and hash it
    const tempPassword = generateTempPassword();
    const password_hash = await hashPassword(tempPassword);

    // Map frontend role names to DB enum values
    const roleMap = {
      'Administrator': 'admin',
      'Project Manager': 'project_manager',
      'Collaborator': 'collaborator',
      'admin': 'admin',
      'project_manager': 'project_manager',
      'collaborator': 'collaborator',
    };

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: roleMap[role] || 'collaborator',
        must_reset_password: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });

    // Log temp password to console (Member 4 may add email later)
    console.log(`\n🔑 New user created: ${email}`);
    console.log(`   Temporary password: ${tempPassword}\n`);

    res.status(201).json({
      ...user,
      message: 'User created successfully. Temporary password logged to console.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/:id
 * Get a single user by ID
 * Admin only
 */
async function getById(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        must_reset_password: true,
        created_at: true,
        updated_at: true,
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

/**
 * PUT /api/users/:id
 * Update user details (name, email, role)
 * Admin only
 */
async function update(req, res, next) {
  try {
    const { name, email, role } = req.body;

    const roleMap = {
      'Administrator': 'admin',
      'Project Manager': 'project_manager',
      'Collaborator': 'collaborator',
      'admin': 'admin',
      'project_manager': 'project_manager',
      'collaborator': 'collaborator',
    };

    const data = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = roleMap[role] || role;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        updated_at: true,
      },
    });

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id/deactivate
 * Deactivate a user (set is_active = false)
 * Admin only
 */
async function deactivate(req, res, next) {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { is_active: false },
      select: { id: true, name: true, is_active: true },
    });

    // Create notification for the affected user
    await prisma.notification.create({
      data: {
        user_id: req.params.id,
        type: 'admin',
        message: 'Your account has been deactivated by an administrator.',
      },
    });

    res.status(200).json({ ...user, message: 'User deactivated successfully.' });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id/activate
 * Re-activate a user (set is_active = true)
 * Admin only
 */
async function activate(req, res, next) {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { is_active: true },
      select: { id: true, name: true, is_active: true },
    });

    res.status(200).json({ ...user, message: 'User activated successfully.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, create, getById, update, deactivate, activate };
