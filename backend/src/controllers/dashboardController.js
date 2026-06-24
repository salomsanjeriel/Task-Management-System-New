import { prisma } from '../config/prisma.js';

// GET /api/dashboard/stats
export const getDashboardStats = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.userId;

    let stats = {};

    if (role === 'admin') {
      const [totalUsers, activeUsers, totalProjects, totalTasks] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { is_active: true } }),
        prisma.project.count(),
        prisma.task.count()
      ]);
      stats = { totalUsers, activeUsers, totalProjects, totalTasks };
    } else if (role === 'project_manager') {
      const [managedProjects, pendingTasks, completedTasks] = await Promise.all([
        prisma.project.count({ where: { manager_id: userId } }),
        prisma.task.count({ where: { created_by: userId, status: { in: ['todo', 'in_progress'] } } }),
        prisma.task.count({ where: { created_by: userId, status: 'completed' } })
      ]);
      const totalTasks = pendingTasks + completedTasks;
      const teamProgress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
      stats = { managedProjects, pendingTasks, completedTasks, teamProgress };
    } else {
      // collaborator
      const [assignedTasks, completedTasks] = await Promise.all([
        prisma.task.count({ where: { assignments: { some: { user_id: userId } } } }),
        prisma.task.count({ where: { assignments: { some: { user_id: userId } }, status: 'completed' } })
      ]);
      
      const upcomingDeadlines = await prisma.task.count({
        where: {
          assignments: { some: { user_id: userId } },
          status: { not: 'completed' },
          due_date: { not: null, gte: new Date() } // Not perfectly finding "upcoming", but sufficient
        }
      });
      stats = { assignedTasks, completedTasks, upcomingDeadlines };
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ errorCode: 'SERVER_ERROR', message: error.message });
  }
};
