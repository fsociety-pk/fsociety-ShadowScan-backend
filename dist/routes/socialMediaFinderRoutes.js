"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const socialMediaFinderController_1 = require("../controllers/socialMediaFinderController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
/**
 * @route   POST /api/social-media/find
 * @desc    Find all social media profiles for a username or email
 * @access  Private
 * @body    { input: string (username or email), caseId?: string }
 * @returns Comprehensive list of found social media profiles
 */
router.post('/find', authMiddleware_1.protect, socialMediaFinderController_1.findSocialMediaProfiles);
/**
 * @route   POST /api/social-media/quick
 * @desc    Quick search on top 15 social media platforms
 * @access  Private
 * @body    { input: string (username or email) }
 * @returns Fast results for common platforms
 */
router.post('/quick', authMiddleware_1.protect, socialMediaFinderController_1.quickSocialMediaLookup);
exports.default = router;
