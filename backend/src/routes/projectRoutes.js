import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
} from '../controllers/projectController.js';

const router = express.Router();

// All project routes require authentication
router.use(authenticate);

// View projects (accessible to all authenticated users)
router.get('/', getProjects);
router.get('/:id', getProjectById);

// Only Project Managers can manage projects
router.post('/', authorize('project_manager'), createProject);
router.put('/:id', authorize('project_manager'), updateProject);
router.delete('/:id', authorize('project_manager'), deleteProject);

export default router;
