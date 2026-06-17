import express from 'express';
import {
  getUsers,
  createUser,
  getUserById,
  updateUser,
  deactivateUser,
  activateUser,
  updateUserRole,
} from '../controllers/userController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

router.use(authenticate);

// Allow get users for both admin and project manager
router.get('/', authorize('admin', 'project_manager'), getUsers);

// Rest of user routes are admin-only
router.use(authorize('admin'));
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.patch('/:id/deactivate', deactivateUser);
router.patch('/:id/activate', activateUser);
router.patch('/:id/role', updateUserRole);

export default router;