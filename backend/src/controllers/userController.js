import { prisma } from '../config/prisma.js';
import { hashPassword } from '../utils/hashHelper.js';
import { createAndSendNotification } from '../utils/notificationHelper.js';

// GET /api/users - Get all users
export const getUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const users = await prisma.user.findMany({
      where: {
        ...(role && { role }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        must_reset_password: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// POST /api/users - Create user
export const createUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Name, email, and role are required',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid email format',
      });
    }

    const validRoles = ['admin', 'project_manager', 'collaborator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid role',
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Email already exists',
      });
    }

    const tempPassword = 'Temp@1234';
    const password_hash = await hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: { name, email, role, password_hash },
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

    res.status(201).json({
      user,
      temp_password: tempPassword,
      message: 'User created. Share the temp password with them.',
    });
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// GET /api/users/:id - Get user by ID
export const getUserById = async (req, res) => {
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
      },
    });

    if (!user) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// PUT /api/users/:id - Update user
export const updateUser = async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { name, email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
      },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// PATCH /api/users/:id/deactivate - Deactivate user
export const deactivateUser = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { is_active: false },
    });

    const io = req.app.get('io');
    await createAndSendNotification(
      io,
      req.params.id,
      'administrative',
      `Your account has been deactivated`
    );

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// PATCH /api/users/:id/activate - Activate user
export const activateUser = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { is_active: true },
    });

    const io = req.app.get('io');
    await createAndSendNotification(
      io,
      req.params.id,
      'administrative',
      `Your account has been activated`
    );

    res.json({ message: 'User activated successfully' });
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// PATCH /api/users/:id/role - Update user role
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'project_manager', 'collaborator'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid role',
      });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    const io = req.app.get('io');
    const roleMap = {
      admin: 'Administrator',
      project_manager: 'Project Manager',
      collaborator: 'Collaborator',
    };
    const readableRole = roleMap[role] || role;

    await createAndSendNotification(
      io,
      req.params.id,
      'administrative',
      `Your role has been updated to <strong>${readableRole}</strong>`
    );

    res.json(user);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};