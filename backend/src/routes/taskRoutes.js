import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  getTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  updateTaskStatus,
  assignTask,
  addComment,
  getComments
} from '../controllers/taskController.js';

const router = express.Router();

// All routes below require login
router.use(authenticate);

// Task routes
router.get('/', getTasks);
router.post('/', authorize('project_manager', 'admin'), createTask);
router.get('/:id', getTaskById);
router.put('/:id', authorize('project_manager', 'admin'), updateTask);
router.delete('/:id', authorize('project_manager', 'admin'), deleteTask);
router.patch('/:id/status', updateTaskStatus);
router.post('/:id/assign', authorize('project_manager', 'admin'), assignTask);
router.post('/:id/comments', addComment);
router.get('/:id/comments', getComments);

export default router;