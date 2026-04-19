import express from 'express';
import { 
  getAllUsers, 
  getUserDetails, 
  deleteUser, 
  createUser, 
  updateUser, 
  toggleUserStatus, 
  resetUserPassword 
} from '../../controllers/adminControllers';
import { adminAuth } from '../../middleware/adminAuth';
import { requireReauth } from '../../middleware/adminSecurity';

const router = express.Router();

// Apply admin protection to all routes
router.use(adminAuth);

router.get('/', getAllUsers);
router.post('/', createUser);
router.get('/:id', getUserDetails);
router.patch('/:id', updateUser);
router.delete('/:id', requireReauth, deleteUser);
router.post('/:id/block', (req, res) => { req.body.isActive = false; toggleUserStatus(req, res); });
router.post('/:id/unblock', (req, res) => { req.body.isActive = true; toggleUserStatus(req, res); });
router.post('/:id/reset-password', requireReauth, resetUserPassword);

export default router;
