import express, { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import {
  sherlockSearch,
  exiftoolMetadata,
  whoisLookup,
  nmapScan,
  checkToolsAvailability
} from '../controllers/kaliToolsController';
import { protect } from '../middleware/authMiddleware';

const router = Router();
const uploadDir = '/tmp/osint-uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration for file uploads
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
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
router.post('/sherlock', protect, sherlockSearch);

/**
 * @route   GET /api/kali-tools/sherlock/stream
 * @desc    Stream live Sherlock output via Server-Sent Events
 * @access  Private (token in query param)
 */
import { sherlockStream } from '../controllers/kaliToolsController';
router.get('/sherlock/stream', sherlockStream);

/**
 * @route   POST /api/kali-tools/exiftool
 * @desc    Extract metadata from uploaded files using ExifTool
 * @access  Private
 * @body    multipart/form-data with file and optional caseId
 */
router.post('/exiftool', protect, upload.single('file'), exiftoolMetadata);

/**
 * @route   POST /api/kali-tools/whois
 * @desc    Perform Whois lookup on domain or IP
 * @access  Private
 * @body    { target: string, caseId?: string }
 */
router.post('/whois', protect, whoisLookup);



/**
 * @route   POST /api/kali-tools/nmap
 * @desc    Network scanning (DEPRECATED)
 * @access  Private
 * @deprecated Use DNS reconnaissance or API-based scanning instead
 */
router.post('/nmap', protect, nmapScan);

/**
 * @route   GET /api/kali-tools/status
 * @desc    Check which Kali tools are installed and available
 * @access  Private
 */
router.get('/status', protect, checkToolsAvailability);

export default router;
