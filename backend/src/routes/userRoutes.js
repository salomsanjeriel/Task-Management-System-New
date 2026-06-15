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
router.use(authorize('admin'));

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.patch('/:id/deactivate', deactivateUser);
router.patch('/:id/activate', activateUser);
router.patch('/:id/role', updateUserRole);

export default router;