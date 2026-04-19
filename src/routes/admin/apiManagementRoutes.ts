import express from 'express';
import { getAPIIntegrations, toggleAPIIntegration, rotateAPIKeys } from '../../controllers/settingsControllers';
import { adminAuth } from '../../middleware/adminAuth';
import { requireReauth } from '../../middleware/adminSecurity';

const router = express.Router();

router.use(adminAuth);
router.get('/', getAPIIntegrations);
router.patch('/toggle', toggleAPIIntegration);
router.post('/rotate', requireReauth, rotateAPIKeys);

export default router;
