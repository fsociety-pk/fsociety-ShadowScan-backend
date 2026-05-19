"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const checkSettings_1 = require("../middleware/checkSettings");
const router = express_1.default.Router();
// Only profile remains, and it's protected
router.get('/profile', authMiddleware_1.protect, checkSettings_1.checkSettings, userController_1.getProfile);
exports.default = router;
