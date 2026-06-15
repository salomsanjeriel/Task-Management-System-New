const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/notifications
 * Get current user's notifications (newest first)
 */
async function getAll(req, res, next) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { user_id: req.user.userId },
      orderBy: { created_at: 'desc' },
    });

    // Format for frontend
    const formatted = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      text: n.message,
      read: n.is_read,
      time: getRelativeTime(n.created_at),
      created_at: n.created_at,
    }));

    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
async function markAsRead(req, res, next) {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { is_read: true },
    });

    res.status(200).json({ id: notification.id, read: true });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/notifications/read-all
 * Mark all of current user's notifications as read
 */
async function markAllAsRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: {
        user_id: req.user.userId,
        is_read: false,
      },
      data: { is_read: true },
    });

    res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Convert a date to a relative time string (e.g., "2 minutes ago")
 */
function getRelativeTime(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(date).toLocaleDateString();
}

module.exports = { getAll, markAsRead, markAllAsRead };
