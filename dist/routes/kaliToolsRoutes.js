"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const kaliToolsController_1 = require("../controllers/kaliToolsController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Multer configuration for file uploads
const upload = (0, multer_1.default)({
    dest: '/tmp/osint-uploads/',
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff',
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type'));
        }
    }
});
/**
 * @route   POST /api/kali-tools/sherlock
 * @desc    Search username across social platforms using Sherlock
 * @access  Private
 * @body    { username: string, caseId?: string }
 */
router.post('/sherlock', authMiddleware_1.protect, kaliToolsController_1.sherlockSearch);
/**
 * @route   GET /api/kali-tools/sherlock/stream
 * @desc    Stream live Sherlock output via Server-Sent Events
 * @access  Private (token in query param)
 */
const kaliToolsController_2 = require("../controllers/kaliToolsController");
router.get('/sherlock/stream', kaliToolsController_2.sherlockStream);
/**
 * @route   POST /api/kali-tools/exiftool
 * @desc    Extract metadata from uploaded files using ExifTool
 * @access  Private
 * @body    multipart/form-data with file and optional caseId
 */
router.post('/exiftool', authMiddleware_1.protect, upload.single('file'), kaliToolsController_1.exiftoolMetadata);
/**
 * @route   POST /api/kali-tools/whois
 * @desc    Perform Whois lookup on domain or IP
 * @access  Private
 * @body    { target: string, caseId?: string }
 */
router.post('/whois', authMiddleware_1.protect, kaliToolsController_1.whoisLookup);
/**
 * @route   POST /api/kali-tools/nmap
 * @desc    Perform network and port scanning using Nmap
 * @access  Private
 * @body    { target: string, scanType?: 'basic'|'aggressive'|'stealth', caseId?: string }
 */
router.post('/nmap', authMiddleware_1.protect, kaliToolsController_1.nmapScan);
/**
 * @route   GET /api/kali-tools/status
 * @desc    Check which Kali tools are installed and available
 * @access  Private
 */
router.get('/status', authMiddleware_1.protect, kaliToolsController_1.checkToolsAvailability);
exports.default = router;
