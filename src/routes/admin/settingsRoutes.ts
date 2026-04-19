import express from 'express';
import { getSettings, updateSettings } from '../../controllers/settingsControllers';
import { adminAuth } from '../../middleware/adminAuth';
import { requireReauth } from '../../middleware/adminSecurity';

const router = express.Router();

router.use(adminAuth);
router.get('/', getSettings);
router.patch('/', requireReauth, updateSettings);

export default router;
