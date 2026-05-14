import { Router } from 'express';
import { handleChat } from '../controllers/chatController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// @route   POST /api/chat
// @desc    Interact with OSINT AI assistant
// @access  Private
router.post('/', protect, handleChat);

export default router;
