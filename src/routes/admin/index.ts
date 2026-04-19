import express from 'express';
import userRoutes from './userRoutes';
import analyticsRoutes from './analyticsRoutes';
import logsRoutes from './logsRoutes';
import settingsRoutes from './settingsRoutes';
import apiManagementRoutes from './apiManagementRoutes';
import { checkSettings } from '../../middleware/checkSettings';
import { adminAuth } from '../../middleware/adminAuth';
import { promoteUser } from '../../controllers/adminControllers';
import { adminRateLimiter, logAdminAccess, validateCSRF, requireReauth } from '../../middleware/adminSecurity';

const router = express.Router();

router.use(checkSettings);
router.use(adminRateLimiter);
router.use(logAdminAccess);
router.use(validateCSRF);

router.use('/users', userRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/logs', logsRoutes);
router.use('/settings', settingsRoutes);
router.use('/api-integrations', apiManagementRoutes);

router.post('/promote/:userId', adminAuth, requireReauth, promoteUser);

export default router;
