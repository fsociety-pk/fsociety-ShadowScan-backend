import express from 'express';
import { getProfile } from '../controllers/userController';
import { protect } from '../middleware/authMiddleware';
import { checkSettings } from '../middleware/checkSettings';

const router = express.Router();

// Only profile remains, and it's protected
router.get('/profile', protect, checkSettings, getProfile);

export default router;
