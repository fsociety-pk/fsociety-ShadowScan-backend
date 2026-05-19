"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const settingsControllers_1 = require("../../controllers/settingsControllers");
const adminAuth_1 = require("../../middleware/adminAuth");
const adminSecurity_1 = require("../../middleware/adminSecurity");
const router = express_1.default.Router();
router.use(adminAuth_1.adminAuth);
router.get('/', settingsControllers_1.getSettings);
router.patch('/', adminSecurity_1.requireReauth, settingsControllers_1.updateSettings);
exports.default = router;
