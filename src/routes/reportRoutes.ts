import express from 'express';
import * as reportController from '../controllers/reportController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Generate report
router.post('/generate', reportController.generateReport);

// Get specific report
router.get('/:reportId', reportController.getReport);

// Get all reports for a case
router.get('/case/:caseId', reportController.getCaseReports);

// Export report to PDF
router.get('/:reportId/export/pdf', reportController.exportReportPDF);

// Export report to JSON
router.get('/:reportId/export/json', reportController.exportReportJSON);

export default router;
