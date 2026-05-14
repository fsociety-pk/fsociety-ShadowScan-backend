import express, { Router } from 'express';
import {
  findSocialMediaProfiles,
  quickSocialMediaLookup,
} from '../controllers/socialMediaFinderController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

/**
 * @route   POST /api/social-media/find
 * @desc    Find all social media profiles for a username or email
 * @access  Private
 * @body    { input: string (username or email), caseId?: string }
 * @returns Comprehensive list of found social media profiles
 */
router.post('/find', protect, findSocialMediaProfiles);

/**
 * @route   POST /api/social-media/quick
 * @desc    Quick search on top 15 social media platforms
 * @access  Private
 * @body    { input: string (username or email) }
 * @returns Fast results for common platforms
 */
router.post('/quick', protect, quickSocialMediaLookup);

export default router;
