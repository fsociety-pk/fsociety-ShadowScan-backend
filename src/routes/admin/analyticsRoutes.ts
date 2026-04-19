import express from 'express';
import { 
  getDashboardStats, 
  getToolUsageStats, 
  getTrends, 
  getTopUsers, 
  getActivitySummary,
  getPeakActivity
} from '../../controllers/analyticsControllers';
import { adminAuth } from '../../middleware/adminAuth';
import { rateLimit } from '../../middleware/rateLimit';

const router = express.Router();

router.use(adminAuth);
router.use(rateLimit('admin_analytics', { limit: 500, windowMs: 15 * 60 * 1000 })); // Increased limit for dashboard refresh

router.get('/dashboard', getDashboardStats);
router.get('/tools-usage', getToolUsageStats);
router.get('/trends', getTrends);
router.get('/top-users', getTopUsers);
router.get('/activity', getActivitySummary);
router.get('/peak-activity', getPeakActivity);

export default router;
