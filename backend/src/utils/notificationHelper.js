import { prisma } from '../config/prisma.js';
import { emitNotification } from '../sockets/emitEvents.js';

export async function createAndSendNotification(io, userId, type, message) {
  try {
    const notification = await prisma.notification.create({
      data: {
        user_id: userId,
        type,
        message,
      },
    });
    if (io) {
      emitNotification(io, userId, notification);
    }
    return notification;
  } catch (error) {
    console.error('Error creating/sending notification:', error);
  }
}
