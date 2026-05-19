"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const caseController_1 = require("../controllers/caseController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const checkSettings_1 = require("../middleware/checkSettings");
const router = express_1.default.Router();
// All routes require authentication for personal workspace
router.use(authMiddleware_1.protect);
router.use(checkSettings_1.checkSettings);
router.get('/', caseController_1.getCases);
router.get('/:id', caseController_1.getCaseById);
router.post('/', caseController_1.createCase);
router.put('/:id', caseController_1.updateCase);
router.delete('/:id', caseController_1.deleteCase);
exports.default = router;
