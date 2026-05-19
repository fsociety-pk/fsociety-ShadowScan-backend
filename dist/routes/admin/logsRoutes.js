"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const logsControllers_1 = require("../../controllers/logsControllers");
const adminAuth_1 = require("../../middleware/adminAuth");
const rateLimit_1 = require("../../middleware/rateLimit");
const router = express_1.default.Router();
router.use(adminAuth_1.adminAuth);
router.use((0, rateLimit_1.rateLimit)('admin_logs', { limit: 500, windowMs: 15 * 60 * 1000 }));
router.get('/', logsControllers_1.getAllLogs);
router.get('/filter', logsControllers_1.filterLogs);
router.get('/anomalies', logsControllers_1.detectAnomalies);
router.get('/export', logsControllers_1.exportLogs);
exports.default = router;
