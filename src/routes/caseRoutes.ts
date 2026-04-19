import express from 'express';
import { getCases, getCaseById, createCase, updateCase, deleteCase } from '../controllers/caseController';
import { protect } from '../middleware/authMiddleware';
import { checkSettings } from '../middleware/checkSettings';

const router = express.Router();

// All routes require authentication for personal workspace
router.use(protect);
router.use(checkSettings);

router.get('/', getCases);
router.get('/:id', getCaseById);
router.post('/', createCase);
router.put('/:id', updateCase);
router.delete('/:id', deleteCase);

export default router;
