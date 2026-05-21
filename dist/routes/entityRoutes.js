"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const entityController_1 = require("../controllers/entityController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.use(authMiddleware_1.protect);
router.post('/', entityController_1.createEntity);
router.get('/case/:caseId', entityController_1.getEntitiesByCase);
router.delete('/:id', entityController_1.deleteEntity);
exports.default = router;
