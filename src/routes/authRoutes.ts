import express from 'express';
import { registerUser, loginUser, checkAdmin, sudoElevate } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/check-admin', protect, checkAdmin);
router.post('/sudo', protect, sudoElevate);

export default router;
