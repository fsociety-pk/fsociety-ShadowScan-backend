"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const intelligenceReportController_1 = require("../controllers/intelligenceReportController");
const router = express_1.default.Router();
// Generate comprehensive intelligence report for a case
router.post('/generate', authMiddleware_1.protect, intelligenceReportController_1.generateIntelligenceReport);
// Analyze specific target within a case
router.post('/analyze-target', authMiddleware_1.protect, intelligenceReportController_1.analyzeTarget);
// Export report as JSON
router.post('/export-json', authMiddleware_1.protect, intelligenceReportController_1.exportReportJSON);
exports.default = router;
