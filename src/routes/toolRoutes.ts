import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { emailLookup, usernameLookup, extractMetadata, phoneLookupPK } from '../controllers/toolController';
import { protect } from '../middleware/authMiddleware';
import { checkSettings } from '../middleware/checkSettings';

const router = Router();

// Protect and enforce system settings
router.use(protect);
router.use(checkSettings);

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
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

export default router;
