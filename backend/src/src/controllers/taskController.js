const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper: Create a notification
async function createNotification(userId, type, message) {
  return prisma.notification.create({
    data: { user_id: userId, type, message },
  });
}

// Map frontend status/priority names to DB enum values
const STATUS_MAP = {
  'To Do': 'todo',
  'In Progress': 'in_progress',
  'Completed': 'completed',
  'todo': 'todo',
  'in_progress': 'in_progress',
  'completed': 'completed',
};

const PRIORITY_MAP = {
  'Low': 'low',
  'Medium': 'medium',
  'High': 'high',
  'low': 'low',
  'medium': 'medium',
  'high': 'high',
};

// Map DB enum values back to frontend display names
const STATUS_DISPLAY = {
  'todo': 'To Do',
  'in_progress': 'In Progress',
  'completed': 'Completed',
};

const PRIORITY_DISPLAY = {
  'low': 'Low',
  'medium': 'Medium',
  'high': 'High',
};

// Role display name mapping
const ROLE_DISPLAY = {
  'admin': 'Administrator',
  'project_manager': 'Project Manager',
  'collaborator': 'Collaborator',
};

// Format a task for API response (convert DB enums to frontend names)
function formatTask(task) {
  return {
    ...task,
    status: STATUS_DISPLAY[task.status] || task.status,
    priority: PRIORITY_DISPLAY[task.priority] || task.priority,
    dueDate: task.due_date ? task.due_date.toISOString().split('T')[0] : null,
    assignee: task.assignments?.[0]?.user?.name || 'Unassigned',
    assigneeId: task.assignments?.[0]?.user?.id || null,
    creatorName: task.creator?.name || 'Unknown',
    creator: task.creator ? {
      ...task.creator,
      role: ROLE_DISPLAY[task.creator.role] || task.creator.role,
    } : undefined,
    assignments: task.assignments?.map((a) => ({
      ...a,
      user: a.user ? {
        ...a.user,
        role: ROLE_DISPLAY[a.user.role] || a.user.role,
      } : a.user,
    })),
  };
}

/**
 * GET /api/tasks
 * List tasks — filter by status, priority, assignee; search by title
 */
async function getAll(req, res, next) {
  try {
    const { status, priority, assignee, search } = req.query;

    const where = {};

    if (status && status !== 'All') {
      where.status = STATUS_MAP[status] || status;
    }
    if (priority && priority !== 'All') {
      where.priority = PRIORITY_MAP[priority] || priority;
    }
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (assignee) {
      where.assignments = {
        some: { user_id: assignee },
      };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, role: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json(tasks.map(formatTask));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tasks
 * Create a new task — PM only
 */
async function create(req, res, next) {
  try {
    const { title, description, priority, status, dueDate, assigneeId } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Title is required.',
        details: { field: 'title', issue: 'Title cannot be empty' },
      });
    }

    // Validate due date is not in the past
    if (dueDate) {
      const due = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) {
        return res.status(400).json({
          errorCode: 'VALIDATION_ERROR',
          message: 'Due date cannot be in the past.',
          details: { field: 'dueDate', issue: 'Must be today or later' },
        });
      }
    }

    // Create the task
    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        priority: PRIORITY_MAP[priority] || 'medium',
        status: STATUS_MAP[status] || 'todo',
        due_date: dueDate ? new Date(dueDate) : null,
        created_by: req.user.userId,
      },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    // If assigneeId provided, create assignment
    if (assigneeId) {
      // Verify the user exists
      const assigneeUser = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (assigneeUser) {
        await prisma.taskAssignment.create({
          data: { task_id: task.id, user_id: assigneeId },
        });

        // Send notification to assigned user
        await createNotification(
          assigneeId,
          'assignment',
          `You have been assigned to "${task.title}".`
        );

        // Re-fetch with assignments
        const updated = await prisma.task.findUnique({
          where: { id: task.id },
          include: {
            creator: { select: { id: true, name: true, role: true } },
            assignments: {
              include: {
                user: { select: { id: true, name: true, email: true, role: true } },
              },
            },
          },
        });
        return res.status(201).json(formatTask(updated));
      }
    }

    res.status(201).json(formatTask(task));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tasks/:id
 * Get single task with assignees and comments
 */
async function getById(req, res, next) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        comments: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'Task not found.',
      });
    }

    res.status(200).json(formatTask(task));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/tasks/:id
 * Update task — PM only
 */
async function update(req, res, next) {
  try {
    const { title, description, priority, status, dueDate, assigneeId } = req.body;

    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description;
    if (priority) data.priority = PRIORITY_MAP[priority] || priority;
    if (status) data.status = STATUS_MAP[status] || status;
    if (dueDate !== undefined) data.due_date = dueDate ? new Date(dueDate) : null;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data,
      include: {
        creator: { select: { id: true, name: true, role: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    // Update assignment if assigneeId changed
    if (assigneeId !== undefined) {
      // Remove existing assignments
      await prisma.taskAssignment.deleteMany({ where: { task_id: task.id } });

      if (assigneeId) {
        await prisma.taskAssignment.create({
          data: { task_id: task.id, user_id: assigneeId },
        });

        await createNotification(
          assigneeId,
          'assignment',
          `You have been assigned to "${task.title}".`
        );
      }
    }

    // Notify all assignees about the update
    const assignments = await prisma.taskAssignment.findMany({
      where: { task_id: task.id },
    });
    for (const assignment of assignments) {
      if (assignment.user_id !== req.user.userId) {
        await createNotification(
          assignment.user_id,
          'status_change',
          `"${task.title}" has been updated.`
        );
      }
    }

    // Re-fetch updated task
    const updated = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    res.status(200).json(formatTask(updated));
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/tasks/:id
 * Delete task — PM only
 */
async function remove(req, res, next) {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });

    if (!task) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'Task not found.',
      });
    }

    await prisma.task.delete({ where: { id: req.params.id } });

    res.status(200).json({ message: 'Task deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/tasks/:id/status
 * Update task status — Collaborator (own tasks) + PM
 */
async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Status is required.',
      });
    }

    const dbStatus = STATUS_MAP[status];
    if (!dbStatus) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid status. Must be: To Do, In Progress, or Completed.',
      });
    }

    // For collaborators, check they are assigned to this task
    if (req.user.role === 'collaborator') {
      const assignment = await prisma.taskAssignment.findFirst({
        where: {
          task_id: req.params.id,
          user_id: req.user.userId,
        },
      });

      if (!assignment) {
        return res.status(403).json({
          errorCode: 'FORBIDDEN',
          message: 'You can only update status of tasks assigned to you.',
        });
      }
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { status: dbStatus },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    // Notify creator and other assignees
    const notifyUsers = new Set();
    if (task.created_by !== req.user.userId) notifyUsers.add(task.created_by);
    task.assignments.forEach((a) => {
      if (a.user_id !== req.user.userId) notifyUsers.add(a.user_id);
    });

    for (const userId of notifyUsers) {
      await createNotification(
        userId,
        'status_change',
        `"${task.title}" was moved to ${STATUS_DISPLAY[dbStatus]}.`
      );
    }

    res.status(200).json(formatTask(task));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tasks/:id/assign
 * Assign users to a task — PM only
 */
async function assign(req, res, next) {
  try {
    const { userIds } = req.body; // Array of user IDs

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'userIds array is required.',
      });
    }

    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'Task not found.',
      });
    }

    // Verify all users exist
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
    });

    if (users.length !== userIds.length) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'One or more user IDs are invalid.',
      });
    }

    // Remove existing assignments and create new ones
    await prisma.taskAssignment.deleteMany({ where: { task_id: req.params.id } });

    for (const userId of userIds) {
      await prisma.taskAssignment.create({
        data: { task_id: req.params.id, user_id: userId },
      });

      // Notify each assigned user
      await createNotification(
        userId,
        'assignment',
        `You have been assigned to "${task.title}".`
      );
    }

    // Fetch updated task
    const updated = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    res.status(200).json(formatTask(updated));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tasks/:id/comments
 * Add a comment to a task — any authenticated user
 */
async function addComment(req, res, next) {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Comment content is required.',
      });
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { assignments: true },
    });

    if (!task) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'Task not found.',
      });
    }

    const comment = await prisma.comment.create({
      data: {
        task_id: req.params.id,
        user_id: req.user.userId,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Get commenter's name for notification
    const commenter = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { name: true },
    });

    // Notify task creator and assignees (except the commenter)
    const notifyUsers = new Set();
    if (task.created_by !== req.user.userId) notifyUsers.add(task.created_by);
    task.assignments.forEach((a) => {
      if (a.user_id !== req.user.userId) notifyUsers.add(a.user_id);
    });

    for (const userId of notifyUsers) {
      await createNotification(
        userId,
        'comment',
        `${commenter.name} commented on "${task.title}": "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`
      );
    }

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tasks/:id/comments
 * Get comments for a task
 */
async function getComments(req, res, next) {
  try {
    const comments = await prisma.comment.findMany({
      where: { task_id: req.params.id },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json(comments);
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, create, getById, update, remove, updateStatus, assign, addComment, getComments };
