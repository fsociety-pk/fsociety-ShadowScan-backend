import express from 'express';
import * as searchController from '../controllers/searchController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Legacy case search
router.get('/', searchController.globalSearch);

// New endpoints for findings search
router.use(protect);

// Search across all findings
router.get('/findings/search', searchController.searchFindings);

// Get all findings for a specific case
router.get('/findings/case/:caseId', searchController.getCaseFindings);

export default router;
