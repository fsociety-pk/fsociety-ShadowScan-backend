"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const analyticsControllers_1 = require("../../controllers/analyticsControllers");
const adminAuth_1 = require("../../middleware/adminAuth");
const rateLimit_1 = require("../../middleware/rateLimit");
const router = express_1.default.Router();
router.use(adminAuth_1.adminAuth);
router.use((0, rateLimit_1.rateLimit)('admin_analytics', { limit: 500, windowMs: 15 * 60 * 1000 })); // Increased limit for dashboard refresh
router.get('/dashboard', analyticsControllers_1.getDashboardStats);
router.get('/tools-usage', analyticsControllers_1.getToolUsageStats);
router.get('/trends', analyticsControllers_1.getTrends);
router.get('/top-users', analyticsControllers_1.getTopUsers);
router.get('/activity', analyticsControllers_1.getActivitySummary);
router.get('/peak-activity', analyticsControllers_1.getPeakActivity);
exports.default = router;
