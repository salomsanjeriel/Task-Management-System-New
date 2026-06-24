import fs from 'fs';
import { prisma } from '../config/prisma.js';
import { createAndSendNotification } from '../utils/notificationHelper.js';
import { broadcastTaskCreated, broadcastTaskUpdated, broadcastTaskDeleted } from '../sockets/emitEvents.js';
import { 
  sendTaskAssignmentEmail, 
  sendTaskStatusChangeEmail, 
  sendCommentNotificationEmail 
} from '../utils/emailHelper.js';



// GET /api/tasks - Get all tasks
export const getTasks = async (req, res) => {
  try {
    const { status, priority, project_id } = req.query;
    const tasks = await prisma.task.findMany({
      where: {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(project_id && { project_id }),
      },
      include: { 
        assignments: { include: { user: true } }, 
        creator: true,
        project: { select: { id: true, name: true } }
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
    const { title, description, priority, due_date, assignee_ids, project_id } = req.body;
    
    if (!title) {
      return res.status(400).json({ 
        errorCode: 'VALIDATION_ERROR', 
        message: 'Title is required' 
      });
    }

    if (!project_id) {
      return res.status(400).json({ 
        errorCode: 'VALIDATION_ERROR', 
        message: 'Project selection is required' 
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
        project_id,
        assignments: assignee_ids?.length
          ? { create: assignee_ids.map(uid => ({ user_id: uid })) }
          : undefined,
      },
      include: { assignments: { include: { user: true } }, project: true },
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

      // Send real email notifications to assignees
      if (task.assignments && task.assignments.length > 0) {
        for (const assignment of task.assignments) {
          if (assignment.user) {
            sendTaskAssignmentEmail({
              email: assignment.user.email,
              name: assignment.user.name,
              taskTitle: task.title,
              taskDescription: task.description,
              projectName: task.project?.name || 'Standalone Task',
              dueDate: task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date',
              priority: task.priority,
              taskId: task.id
            }).catch(err => console.error('Failed to send task assignment email:', err));
          }
        }
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
        project: { select: { id: true, name: true } }
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
    const { title, description, priority, due_date, project_id } = req.body;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { 
        title, 
        description, 
        priority, 
        due_date: due_date ? new Date(due_date) : undefined,
        project_id: project_id !== undefined ? (project_id || null) : undefined
      },
      include: { project: true }
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

    // Send task status change emails to recipients
    const updaterUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
    const updaterName = updaterUser?.name || 'Someone';

    if (recipientIds.size > 0) {
      const recipients = await prisma.user.findMany({
        where: { id: { in: Array.from(recipientIds) } }
      });
      for (const rec of recipients) {
        sendTaskStatusChangeEmail({
          email: rec.email,
          name: rec.name,
          taskTitle: task.title,
          oldStatus: oldTask.status,
          newStatus: task.status,
          changedBy: updaterName,
          taskId: task.id
        }).catch(err => console.error('Failed to send status update email:', err));
      }
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

    // Clear existing assignments first to replace assignee
    await prisma.taskAssignment.deleteMany({
      where: { task_id: req.params.id },
    });

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
      include: { assignments: { include: { user: true } }, project: true },
    });

    // Send task assignment emails to the assignees
    if (updatedTask.assignments && updatedTask.assignments.length > 0) {
      for (const assignment of updatedTask.assignments) {
        if (assignment.user) {
          sendTaskAssignmentEmail({
            email: assignment.user.email,
            name: assignment.user.name,
            taskTitle: updatedTask.title,
            taskDescription: updatedTask.description,
            projectName: updatedTask.project?.name || 'Standalone Task',
            dueDate: updatedTask.due_date ? new Date(updatedTask.due_date).toLocaleDateString() : 'No due date',
            priority: updatedTask.priority,
            taskId: updatedTask.id
          }).catch(err => console.error('Failed to send task assignment email:', err));
        }
      }
    }

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

    // Send comment notification emails to recipients
    if (recipientIds.size > 0) {
      const recipients = await prisma.user.findMany({
        where: { id: { in: Array.from(recipientIds) } }
      });
      for (const rec of recipients) {
        sendCommentNotificationEmail({
          email: rec.email,
          name: rec.name,
          taskTitle: task.title,
          commenterName,
          commentContent: content,
          taskId: task.id
        }).catch(err => console.error('Failed to send comment notification email:', err));
      }
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

// POST /api/tasks/:id/attachments - Add attachment
export const addAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'No file uploaded',
      });
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { assignments: true },
    });

    if (!task) {
      // Remove uploaded file if task is not found
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'Task not found',
      });
    }

    // Role check: Collaborators can only upload attachments to tasks they are assigned to
    if (req.user.role === 'collaborator') {
      const isAssigned = task.assignments.some(a => a.user_id === req.user.userId);
      if (!isAssigned) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({
          errorCode: 'FORBIDDEN',
          message: 'You can only upload attachments to tasks assigned to you',
        });
      }
    }

    const attachment = await prisma.attachment.create({
      data: {
        task_id: req.params.id,
        user_id: req.user.userId,
        file_name: req.file.originalname,
        file_path: req.file.path.replace(/\\/g, '/'),
        file_type: req.file.mimetype,
        file_size: req.file.size,
      },
      include: { user: true },
    });

    const uploaderUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
    const uploaderName = uploaderUser?.name || 'Someone';

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
        `<strong>${uploaderName}</strong> attached a file to <strong>"${task.title}"</strong>: <em>${attachment.file_name}</em>`
      );
    }

    const updatedTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { assignments: { include: { user: true } } },
    });
    broadcastTaskUpdated(io, updatedTask);

    res.status(201).json(attachment);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// GET /api/tasks/:id/attachments - Get attachments
export const getAttachments = async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { assignments: true },
    });

    if (!task) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'Task not found',
      });
    }

    // Role check: Collaborators can only view attachments on tasks they are assigned to
    if (req.user.role === 'collaborator') {
      const isAssigned = task.assignments.some(a => a.user_id === req.user.userId);
      if (!isAssigned) {
        return res.status(403).json({
          errorCode: 'FORBIDDEN',
          message: 'You can only view attachments of tasks assigned to you',
        });
      }
    }

    const attachments = await prisma.attachment.findMany({
      where: { task_id: req.params.id },
      include: { user: true },
      orderBy: { created_at: 'asc' },
    });

    res.json(attachments);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// DELETE /api/tasks/:id/attachments/:attachmentId - Delete attachment
export const deleteAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'Attachment not found',
      });
    }

    // Role check: Collaborators can only delete their own attachments
    if (req.user.role === 'collaborator' && attachment.user_id !== req.user.userId) {
      return res.status(403).json({
        errorCode: 'FORBIDDEN',
        message: 'You can only delete your own attachments',
      });
    }

    // Delete file from disk
    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    // Delete from database
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    const io = req.app.get('io');
    const updatedTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { assignments: { include: { user: true } } },
    });
    broadcastTaskUpdated(io, updatedTask);

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};