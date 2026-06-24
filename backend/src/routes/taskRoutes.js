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
  getComments,
  addAttachment,
  getAttachments,
  deleteAttachment
} from '../controllers/taskController.js';
import { upload } from '../config/multerConfig.js';

const router = express.Router();

// All routes below require login
router.use(authenticate);

// Task routes
router.get('/', getTasks);
router.post('/', authorize('project_manager'), createTask);
router.get('/:id', getTaskById);
router.put('/:id', authorize('project_manager'), updateTask);
router.delete('/:id', authorize('project_manager'), deleteTask);
router.patch('/:id/status', authorize('project_manager', 'collaborator'), updateTaskStatus);
router.post('/:id/assign', authorize('project_manager'), assignTask);
router.post('/:id/comments', addComment);
router.get('/:id/comments', getComments);
router.post('/:id/attachments', upload.single('file'), addAttachment);
router.get('/:id/attachments', getAttachments);
router.delete('/:id/attachments/:attachmentId', deleteAttachment);

export default router;