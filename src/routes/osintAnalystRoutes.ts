import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { analyzeOsintData } from '../controllers/osintAnalystController';

const router = express.Router();

// POST /api/osint-analyst/analyze
// Accepts raw target data text and returns a structured intelligence report
router.post('/analyze', protect, analyzeOsintData);

export default router;
