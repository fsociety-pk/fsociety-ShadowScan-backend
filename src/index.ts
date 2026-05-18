import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db';
import { initKeyRotationCron } from './crons/keyRotation';
import { getJwtSecret } from './config/env';

dotenv.config();
getJwtSecret();

// Connect to Database
connectDB();

// Initialize Crons
initKeyRotationCron();

const app = express();

const envFrontendOrigins = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  'https://fsociety-shadow-scan-frontend.vercel.app',
  process.env.FRONTEND_URL,
  ...envFrontendOrigins
].filter(Boolean) as string[];

// Helper to normalize origins (strips protocols and trailing slashes) for reliable matching
const normalizeOrigin = (url: string): string => {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
};

const corsOptions = {
  origin: (origin: string | undefined, callback: any) => {
    // Allow requests with no origin (like mobile apps, postman, or curl)
    if (!origin) return callback(null, true);
    
    const normalizedOrigin = normalizeOrigin(origin);
    
    // Check if the normalized origin is allowed
    const isAllowed = allowedOrigins.some(allowed => normalizeOrigin(allowed) === normalizedOrigin) ||
                      normalizedOrigin.endsWith('.vercel.app') ||
                      normalizedOrigin.startsWith('localhost:') ||
                      normalizedOrigin === 'localhost' ||
                      normalizedOrigin.startsWith('127.0.0.1:') ||
                      normalizedOrigin === '127.0.0.1';
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin} (Normalized: ${normalizedOrigin})`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-sudo-token'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());


const PORT = process.env.PORT || 5000;

import authRoutes from './routes/authRoutes';
import caseRoutes from './routes/caseRoutes';

import searchRoutes from './routes/searchRoutes';
import userRoutes from './routes/userRoutes';
import toolRoutes from './routes/toolRoutes';
import kaliToolsRoutes from './routes/kaliToolsRoutes';
import socialMediaFinderRoutes from './routes/socialMediaFinderRoutes';
import reportRoutes from './routes/reportRoutes';
import intelligenceReportRoutes from './routes/intelligenceReportRoutes';
import adminRoutes from './routes/admin';
import osintAnalystRoutes from './routes/osintAnalystRoutes';
import chatRoutes from './routes/chatRoutes';

// Basic Route
app.get('/', (req, res) => {
  res.send('<h1>Fsociety ShadowScan API</h1><p>Status: ONLINE</p><p>Use the frontend to access the dashboard.</p>');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Fsociety ShadowScan API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);

app.use('/api/search', searchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/kali-tools', kaliToolsRoutes);
app.use('/api/social-media', socialMediaFinderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/intelligence', intelligenceReportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/osint-analyst', osintAnalystRoutes);
app.use('/api/chat', chatRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
