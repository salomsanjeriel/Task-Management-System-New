
import { prisma } from '../config/prisma.js';
import { createAndSendNotification } from '../utils/notificationHelper.js';
import { broadcastTaskCreated, broadcastTaskUpdated, broadcastTaskDeleted } from '../sockets/emitEvents.js';



// GET /api/tasks - Get all tasks
export const getTasks = async (req, res) => {
  try {
    const { status, priority } = req.query;
    const tasks = await prisma.task.findMany({
      where: {
        ...(status && { status }),
        ...(priority && { priority }),
      },
      include: { 
        assignments: { include: { user: true } }, 
        creator: true 
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// POST /api/tasks - Create a task
export const createTask = async (req, res) => {
  try {
    const { title, description, priority, due_date, assignee_ids } = req.body;
    
    if (!title) {
      return res.status(400).json({ 
        errorCode: 'VALIDATION_ERROR', 
        message: 'Title is required' 
      });
    }

    if (due_date && new Date(due_date) < new Date()) {
      return res.status(400).json({ 
        errorCode: 'VALIDATION_ERROR', 
        message: 'Due date cannot be in the past' 
      });
    }

    const creatorUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
    const creatorName = creatorUser?.name || 'Someone';

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority,
        due_date: due_date ? new Date(due_date) : null,
        created_by: req.user.userId,
        assignments: assignee_ids?.length
          ? { create: assignee_ids.map(uid => ({ user_id: uid })) }
          : undefined,
      },
      include: { assignments: { include: { user: true } } },
    });

    const io = req.app.get('io');
    if (assignee_ids && assignee_ids.length > 0) {
      for (const uid of assignee_ids) {
        await createAndSendNotification(
          io,
          uid,
          'assigned',
          `<strong>${creatorName}</strong> assigned you to <strong>"${task.title}"</strong>`
        );
      }
    }

    // Notify all active admins about task creation
    const admins = await prisma.user.findMany({ where: { role: 'admin', is_active: true } });
    for (const admin of admins) {
      if (admin.id !== req.user.userId) {
        await createAndSendNotification(
          io,
          admin.id,
          'assigned',
          `<strong>${creatorName}</strong> created task <strong>"${task.title}"</strong>`
        );
      }
    }

    broadcastTaskCreated(io, task);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// GET /api/tasks/:id - Get single task
export const getTaskById = async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { 
        assignments: { include: { user: true } }, 
        comments: { include: { user: true } }, 
      },
    });

    if (!task) {
      return res.status(404).json({ 
        errorCode: 'NOT_FOUND', 
        message: 'Task not found' 
      });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// PUT /api/tasks/:id - Update task
export const updateTask = async (req, res) => {
  try {
    const { title, description, priority, due_date } = req.body;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { 
        title, 
        description, 
        priority, 
        due_date: due_date ? new Date(due_date) : undefined 
      },
    });

    const io = req.app.get('io');
    broadcastTaskUpdated(io, task);

    res.json(task);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// DELETE /api/tasks/:id - Delete task
export const deleteTask = async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    const io = req.app.get('io');
    broadcastTaskDeleted(io, req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// PATCH /api/tasks/:id/status - Update task status
export const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['todo', 'in_progress', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        errorCode: 'VALIDATION_ERROR', 
        message: 'Invalid status. Must be todo, in_progress, or completed' 
      });
    }

    const oldTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { assignments: true },
    });

    if (!oldTask) {
      return res.status(404).json({ 
        errorCode: 'NOT_FOUND', 
        message: 'Task not found' 
      });
    }

    if (req.user.role === 'collaborator') {
      const isAssigned = oldTask.assignments.some(a => a.user_id === req.user.userId);
      if (!isAssigned) {
        return res.status(403).json({
          errorCode: 'FORBIDDEN',
          message: 'You do not have permission to change the status of this task'
        });
      }
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { status },
      include: { assignments: { include: { user: true } } },
    });

    const io = req.app.get('io');
    
    const statusMap = {
      todo: 'To Do',
      in_progress: 'In Progress',
      completed: 'Completed',
    };
    const readableStatus = statusMap[status] || status;

    const admins = await prisma.user.findMany({ where: { role: 'admin', is_active: true } });

    const recipientIds = new Set([
      task.created_by,
      ...task.assignments.map(a => a.user_id),
      ...admins.map(admin => admin.id),
    ]);
    recipientIds.delete(req.user.userId);

    for (const userId of recipientIds) {
      await createAndSendNotification(
        io,
        userId,
        'status',
        `<strong>"${task.title}"</strong> was moved to <strong>${readableStatus}</strong>`
      );
    }

    broadcastTaskUpdated(io, task);

    res.json(task);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// POST /api/tasks/:id/assign - Assign users to task
export const assignTask = async (req, res) => {
  try {
    const { user_ids } = req.body;

    if (!user_ids || user_ids.length === 0) {
      return res.status(400).json({ 
        errorCode: 'VALIDATION_ERROR', 
        message: 'user_ids are required' 
      });
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { assignments: true },
    });

    if (!task) {
      return res.status(404).json({ 
        errorCode: 'NOT_FOUND', 
        message: 'Task not found' 
      });
    }

    await prisma.taskAssignment.createMany({
      data: user_ids.map(uid => ({ 
        task_id: req.params.id, 
        user_id: uid 
      })),
      skipDuplicates: true,
    });

    const assignerUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
    const assignerName = assignerUser?.name || 'Someone';

    const io = req.app.get('io');

    for (const uid of user_ids) {
      const alreadyAssigned = task.assignments.some(a => a.user_id === uid);
      if (!alreadyAssigned) {
        await createAndSendNotification(
          io,
          uid,
          'assigned',
          `<strong>${assignerName}</strong> assigned you to <strong>"${task.title}"</strong>`
        );
      }
    }

    const updatedTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { assignments: { include: { user: true } } },
    });

    broadcastTaskUpdated(io, updatedTask);

    res.json({ message: 'Users assigned successfully' });
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// POST /api/tasks/:id/comments - Add comment
export const addComment = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ 
        errorCode: 'VALIDATION_ERROR', 
        message: 'Comment content is required' 
      });
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { assignments: true },
    });

    if (!task) {
      return res.status(404).json({ 
        errorCode: 'NOT_FOUND', 
        message: 'Task not found' 
      });
    }

    if (req.user.role === 'collaborator') {
      const isAssigned = task.assignments.some(a => a.user_id === req.user.userId);
      if (!isAssigned) {
        return res.status(403).json({
          errorCode: 'FORBIDDEN',
          message: 'You can only comment on tasks assigned to you'
        });
      }
    }

    const comment = await prisma.comment.create({
      data: { 
        task_id: req.params.id, 
        user_id: req.user.userId, 
        content 
      },
      include: { user: true },
    });

    const commenterUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
    const commenterName = commenterUser?.name || 'Someone';

    const io = req.app.get('io');
    
    const admins = await prisma.user.findMany({ where: { role: 'admin', is_active: true } });

    const recipientIds = new Set([
      task.created_by,
      ...task.assignments.map(a => a.user_id),
      ...admins.map(admin => admin.id),
    ]);
    recipientIds.delete(req.user.userId);

    for (const userId of recipientIds) {
      await createAndSendNotification(
        io,
        userId,
        'comment',
        `<strong>${commenterName}</strong> commented on <strong>"${task.title}"</strong>: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`
      );
    }

    const updatedTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { assignments: { include: { user: true } } },
    });
    broadcastTaskUpdated(io, updatedTask);

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// GET /api/tasks/:id/comments - Get comments
export const getComments = async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { task_id: req.params.id },
      include: { user: true },
      orderBy: { created_at: 'asc' },
    });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};