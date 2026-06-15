const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// All task routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: List all tasks (filterable by status, priority, assignee)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tasks
 */
router.get('/', taskController.getAll);

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task (Project Manager only)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authorize('admin', 'project_manager'), taskController.create);

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Get task details with assignees and comments
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', taskController.getById);

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Update a task (Project Manager only)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authorize('admin', 'project_manager'), taskController.update);

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete a task (Project Manager only)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authorize('admin', 'project_manager'), taskController.remove);

/**
 * @swagger
 * /api/tasks/{id}/status:
 *   patch:
 *     summary: Update task status (Collaborator can update own tasks)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/status', taskController.updateStatus);

/**
 * @swagger
 * /api/tasks/{id}/assign:
 *   post:
 *     summary: Assign users to a task (Project Manager only)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/assign', authorize('admin', 'project_manager'), taskController.assign);

/**
 * @swagger
 * /api/tasks/{id}/comments:
 *   post:
 *     summary: Add a comment to a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/comments', taskController.addComment);

/**
 * @swagger
 * /api/tasks/{id}/comments:
 *   get:
 *     summary: Get comments for a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/comments', taskController.getComments);

module.exports = router;
