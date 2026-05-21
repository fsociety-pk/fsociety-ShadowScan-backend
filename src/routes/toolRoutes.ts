import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { 
    emailLookup, 
    usernameLookup, 
    extractMetadata, 
    phoneLookupPK, 
    networkRecon, 
    nexusOSINTLookup,
    imageOSINT
} from '../controllers/toolController';
import { protect } from '../middleware/authMiddleware';
import { checkSettings } from '../middleware/checkSettings';

const router = Router();
const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Protect and enforce system settings
router.use(protect);
router.use(checkSettings);

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Email Forensic Analysis
router.post('/email-lookup', emailLookup);

// Username Intelligence
router.post('/username-lookup', usernameLookup);

// Metadata Forensic Extraction
router.post('/extract-metadata', upload.single('file'), extractMetadata);

// Pakistan Phone Intelligence
router.post('/phone-lookup-pk', phoneLookupPK);


// NexusOSINT Intelligence
router.post('/nexus-lookup', nexusOSINTLookup);

// Network Recon Intelligence
router.post('/network-recon', networkRecon);

// Image OSINT Intelligence (Gemini AI Vision Engine)
router.post('/image-osint', upload.single('file'), imageOSINT);

export default router;
