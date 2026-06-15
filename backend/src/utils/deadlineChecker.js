import { prisma } from '../config/prisma.js';
import { createAndSendNotification } from './notificationHelper.js';

export function startDeadlineChecker(io) {
  // Check immediately on start
  checkDeadlines(io);

  // Then check every hour (3600000 ms)
  setInterval(() => {
    checkDeadlines(io);
  }, 3600000);
}

async function checkDeadlines(io) {
  try {
    const now = new Date();
    
    // Find tasks that have a due date in the near future (e.g. up to 2 days from now)
    // and are not completed.
    const tasks = await prisma.task.findMany({
      where: {
        due_date: {
          gt: now,
        },
        status: {
          not: 'completed',
        },
      },
      include: {
        assignments: true,
      },
    });

    for (const task of tasks) {
      const msDiff = task.due_date.getTime() - now.getTime();
      const daysDiff = msDiff / (1000 * 60 * 60 * 24);

      let deadlineType = null;
      let message = null;

      if (daysDiff > 0 && daysDiff <= 1.0) {
        deadlineType = 'tomorrow';
        message = `<strong>"${task.title}"</strong> is due <strong>tomorrow</strong>`;
      } else if (daysDiff > 1.0 && daysDiff <= 2.0) {
        deadlineType = 'in_2_days';
        message = `<strong>"${task.title}"</strong> deadline is <strong>in 2 days</strong>`;
      }

      if (!deadlineType || !message) continue;

      for (const assignment of task.assignments) {
        const userId = assignment.user_id;

        const existingNotif = await prisma.notification.findFirst({
          where: {
            user_id: userId,
            type: 'deadline',
            message: message,
          },
        });

        if (!existingNotif) {
          await createAndSendNotification(io, userId, 'deadline', message);
        }
      }
    }
  } catch (error) {
    console.error('Error checking deadlines:', error);
  }
}
