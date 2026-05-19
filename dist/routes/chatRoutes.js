"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_1 = require("../controllers/chatController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// @route   POST /api/chat
// @desc    Interact with OSINT AI assistant
// @access  Private
router.post('/', authMiddleware_1.protect, chatController_1.handleChat);
exports.default = router;
