import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getDashboardStats } from '../controllers/dashboardController.js';

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard statistics
 */

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 */
router.get('/stats', getDashboardStats);

export default router;
