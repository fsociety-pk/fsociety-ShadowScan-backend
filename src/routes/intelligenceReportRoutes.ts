import express from 'express';
import { protect } from '../middleware/authMiddleware';
import {
  generateIntelligenceReport,
  analyzeTarget,
  exportReportJSON,
} from '../controllers/intelligenceReportController';

const router = express.Router();

// Generate comprehensive intelligence report for a case
router.post('/generate', protect, generateIntelligenceReport);

// Analyze specific target within a case
router.post('/analyze-target', protect, analyzeTarget);

// Export report as JSON
router.post('/export-json', protect, exportReportJSON);

export default router;
