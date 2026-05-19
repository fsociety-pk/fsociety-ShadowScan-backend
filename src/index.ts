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

const corsOptions = {
  origin: true, // Reflects the incoming origin — allows any origin with credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-sudo-token', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // Cache preflight for 24h
};

app.use(cors(corsOptions));

// Handle OPTIONS preflight for all routes (Express 5 / path-to-regexp v8 compatible)
app.options('/{*path}', cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


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
