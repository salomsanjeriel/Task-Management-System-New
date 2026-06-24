import { prisma } from '../config/prisma.js';
import { createAndSendNotification } from '../utils/notificationHelper.js';
import {
  broadcastProjectCreated,
  broadcastProjectUpdated,
  broadcastProjectDeleted
} from '../sockets/emitEvents.js';
import { sendProjectAssignmentEmail } from '../utils/emailHelper.js';

// GET /api/projects - Get all projects
export const getProjects = async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let whereClause = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    if (req.user.role === 'project_manager') {
      whereClause.manager_id = req.user.userId;
    } else if (req.user.role !== 'admin') {
      // Collaborator sees projects they are assigned to via tasks
      const tasks = await prisma.task.findMany({
        where: { assignments: { some: { user_id: req.user.userId } }, project_id: { not: null } },
        select: { project_id: true }
      });
      const projectIds = [...new Set(tasks.map(t => t.project_id))];
      whereClause.id = { in: projectIds };
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        creator: true,
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tasks: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const projectsWithStats = projects.map((project) => {
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((t) => t.status === 'completed').length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      const { tasks, ...rest } = project;
      return {
        ...rest,
        totalTasks,
        completedTasks,
        progress,
      };
    });

    res.json(projectsWithStats);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// GET /api/projects/:id - Get project by ID
export const getProjectById = async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tasks: {
          include: {
            assignments: {
              include: {
                user: {
                  select: { id: true, name: true },
                },
              },
            },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ errorCode: 'NOT_FOUND', message: 'Project not found' });
    }

    // Role-based access control
    if (req.user.role === 'project_manager' && project.manager_id !== req.user.userId) {
      return res.status(403).json({ errorCode: 'FORBIDDEN', message: 'You do not have access to this project' });
    }

    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter((t) => t.status === 'completed').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      ...project,
      totalTasks,
      completedTasks,
      progress,
    });
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// POST /api/projects - Create a project
export const createProject = async (req, res) => {
  try {
    const { name, description, status, manager_id } = req.body;

    if (!name || !manager_id) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: 'Name and Manager ID are required',
      });
    }

    const managerUser = await prisma.user.findUnique({ where: { id: manager_id } });
    if (!managerUser) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'Assigned manager not found',
      });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        manager_id: req.user.userId,
      },
    });

    const io = req.app.get('io');

    // Notify the assigned manager (if they aren't the creator)
    if (manager_id !== req.user.userId) {
      const creatorUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
      const creatorName = creatorUser?.name || 'An administrator';
      await createAndSendNotification(
        io,
        manager_id,
        'administrative',
        `<strong>${creatorName}</strong> assigned you as manager of project <strong>"${project.name}"</strong>`
      );

      // Send project manager assignment email
      if (managerUser) {
        sendProjectAssignmentEmail({
          email: managerUser.email,
          name: managerUser.name,
          projectName: project.name,
          projectDescription: project.description,
          role: managerUser.role,
          timeline: new Date(project.created_at).toLocaleDateString(),
          projectId: project.id
        }).catch(err => console.error('Failed to send project assignment email:', err));
      }
    }

    broadcastProjectCreated(io, project);

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// PUT /api/projects/:id - Update a project
export const updateProject = async (req, res) => {
  try {
    const { name, description, status, manager_id } = req.body;

    const existingProject = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existingProject) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: 'Project not found',
      });
    }

    if (req.user.role === 'project_manager' && existingProject.manager_id !== req.user.userId) {
      return res.status(403).json({ errorCode: 'FORBIDDEN', message: 'You do not have permission to edit this project' });
    }
    
    let managerUser = null;
    if (manager_id) {
      managerUser = await prisma.user.findUnique({ where: { id: manager_id } });
      if (!managerUser) {
        return res.status(404).json({
          errorCode: 'NOT_FOUND',
          message: 'Assigned manager not found',
        });
      }
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        status,
        manager_id,
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const io = req.app.get('io');

    // Notify manager if manager changed
    if (manager_id && manager_id !== existingProject.manager_id && manager_id !== req.user.userId) {
      const updaterUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
      const updaterName = updaterUser?.name || 'Someone';
      await createAndSendNotification(
        io,
        manager_id,
        'administrative',
        `<strong>${updaterName}</strong> assigned you as manager of project <strong>"${project.name}"</strong>`
      );

      // Send project manager assignment email
      if (managerUser) {
        sendProjectAssignmentEmail({
          email: managerUser.email,
          name: managerUser.name,
          projectName: project.name,
          projectDescription: project.description,
          role: managerUser.role,
          timeline: new Date(project.created_at).toLocaleDateString(),
          projectId: project.id
        }).catch(err => console.error('Failed to send project assignment email:', err));
      }
    }

    broadcastProjectUpdated(io, project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};

// DELETE /api/projects/:id - Delete a project
export const deleteProject = async (req, res) => {
  try {
    const existingProject = await prisma.project.findUnique({ 
      where: { id: req.params.id },
      include: { _count: { select: { tasks: true } } }
    });

    if (!existingProject) {
      return res.status(404).json({ errorCode: 'NOT_FOUND', message: 'Project not found' });
    }

    if (req.user.role === 'project_manager' && existingProject.manager_id !== req.user.userId) {
      return res.status(403).json({ errorCode: 'FORBIDDEN', message: 'You do not have permission to delete this project' });
    }

    if (existingProject._count.tasks > 0) {
      return res.status(400).json({ 
        errorCode: 'VALIDATION_ERROR', 
        message: 'Cannot delete project because it has tasks. Please delete or reassign the tasks first.' 
      });
    }

    await prisma.project.delete({ where: { id: req.params.id } });

    const io = req.app.get('io');
    broadcastProjectDeleted(io, req.params.id);

    res.json({ message: 'Project and all associated tasks deleted successfully' });
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};
