import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db';
import { initKeyRotationCron } from './crons/keyRotation';

dotenv.config();

// Connect to Database
connectDB();

// Initialize Crons
initKeyRotationCron();

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
import adminRoutes from './routes/admin';

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
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
