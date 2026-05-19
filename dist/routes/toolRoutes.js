"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const toolController_1 = require("../controllers/toolController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const checkSettings_1 = require("../middleware/checkSettings");
const router = (0, express_1.Router)();
// Protect and enforce system settings
router.use(authMiddleware_1.protect);
router.use(checkSettings_1.checkSettings);
// Multer Configuration
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});
// Email Forensic Analysis
router.post('/email-lookup', toolController_1.emailLookup);
// Username Intelligence
router.post('/username-lookup', toolController_1.usernameLookup);
// Metadata Forensic Extraction
router.post('/extract-metadata', upload.single('file'), toolController_1.extractMetadata);
// Pakistan Phone Intelligence
router.post('/phone-lookup-pk', toolController_1.phoneLookupPK);
// NexusOSINT Intelligence
router.post('/nexus-lookup', toolController_1.nexusOSINTLookup);
// Network Recon Intelligence
router.post('/network-recon', toolController_1.networkRecon);
// Image OSINT Intelligence (Gemini AI Vision Engine)
router.post('/image-osint', upload.single('file'), toolController_1.imageOSINT);
exports.default = router;
