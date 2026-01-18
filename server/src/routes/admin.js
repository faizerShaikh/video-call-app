import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import {
  getUsers,
  getUserById,
  approveUser,
  rejectUser,
  suspendUser,
  unsuspendUser,
  bulkApprove,
  deleteUser,
  getDashboardStats
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Dashboard stats
router.get('/dashboard/stats', getDashboardStats);

// User management
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.post('/users/:id/approve', approveUser);
router.post('/users/:id/reject', rejectUser);
router.post('/users/:id/suspend', suspendUser);
router.post('/users/:id/unsuspend', unsuspendUser);
router.delete('/users/:id', deleteUser);
router.post('/users/bulk-approve', bulkApprove);

export default router;
