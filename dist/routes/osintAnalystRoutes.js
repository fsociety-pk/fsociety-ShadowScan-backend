"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const osintAnalystController_1 = require("../controllers/osintAnalystController");
const router = express_1.default.Router();
// POST /api/osint-analyst/analyze
// Accepts raw target data text and returns a structured intelligence report
router.post('/analyze', authMiddleware_1.protect, osintAnalystController_1.analyzeOsintData);
exports.default = router;
