"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adminControllers_1 = require("../../controllers/adminControllers");
const adminAuth_1 = require("../../middleware/adminAuth");
const adminSecurity_1 = require("../../middleware/adminSecurity");
const router = express_1.default.Router();
// Apply admin protection to all routes
router.use(adminAuth_1.adminAuth);
router.get('/', adminControllers_1.getAllUsers);
router.post('/', adminControllers_1.createUser);
router.get('/:id', adminControllers_1.getUserDetails);
router.patch('/:id', adminControllers_1.updateUser);
router.delete('/:id', adminSecurity_1.requireReauth, adminControllers_1.deleteUser);
router.post('/:id/block', (req, res) => { req.body.isActive = false; (0, adminControllers_1.toggleUserStatus)(req, res); });
router.post('/:id/unblock', (req, res) => { req.body.isActive = true; (0, adminControllers_1.toggleUserStatus)(req, res); });
router.post('/:id/reset-password', adminSecurity_1.requireReauth, adminControllers_1.resetUserPassword);
exports.default = router;
