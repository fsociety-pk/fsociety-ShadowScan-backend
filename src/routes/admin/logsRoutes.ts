import express from 'express';
import { getAllLogs, filterLogs, detectAnomalies, exportLogs } from '../../controllers/logsControllers';
import { adminAuth } from '../../middleware/adminAuth';
import { rateLimit } from '../../middleware/rateLimit';

const router = express.Router();

router.use(adminAuth);
router.use(rateLimit('admin_logs', { limit: 500, windowMs: 15 * 60 * 1000 }));

router.get('/', getAllLogs);
router.get('/filter', filterLogs);
router.get('/anomalies', detectAnomalies);
router.get('/export', exportLogs);

export default router;
