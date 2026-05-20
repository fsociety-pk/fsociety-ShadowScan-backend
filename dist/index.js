"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./config/db"));
const keyRotation_1 = require("./crons/keyRotation");
const env_1 = require("./config/env");
dotenv_1.default.config();
(0, env_1.getJwtSecret)();
// Connect to Database
(0, db_1.default)();
// Initialize Crons
(0, keyRotation_1.initKeyRotationCron)();
const app = (0, express_1.default)();
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || '';
const FRONTEND_ORIGINS = process.env.FRONTEND_ORIGINS || FRONTEND_URL || '';
const allowedOrigins = FRONTEND_ORIGINS
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const corsOptions = {
    origin: (origin, callback) => {
        // Allow server-to-server or tools without Origin header
        if (!origin)
            return callback(null, true);
        // If allowedOrigins provided, only allow exact matches
        if (allowedOrigins.length > 0) {
            return callback(null, allowedOrigins.includes(origin));
        }
        // Otherwise allow any origin (use caution in production)
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-sudo-token', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400 // Cache preflight for 24h
};
app.use((0, cors_1.default)(corsOptions));
// Handle OPTIONS preflight for all routes
app.options(/.*/, (0, cors_1.default)(corsOptions));
// Ensure CORS headers are set for any responses even if some middleware short-circuits
app.use((req, res, next) => {
    const requestOrigin = req.header('Origin');
    let originToSet = FRONTEND_URL || '*';
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
        originToSet = requestOrigin;
    }
    res.setHeader('Access-Control-Allow-Origin', originToSet);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token, x-sudo-token, Accept, Origin, X-Requested-With');
    if (req.method === 'OPTIONS')
        return res.sendStatus(204);
    next();
});
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
const PORT = process.env.PORT || 5000;
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const caseRoutes_1 = __importDefault(require("./routes/caseRoutes"));
const searchRoutes_1 = __importDefault(require("./routes/searchRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const toolRoutes_1 = __importDefault(require("./routes/toolRoutes"));
const kaliToolsRoutes_1 = __importDefault(require("./routes/kaliToolsRoutes"));
const socialMediaFinderRoutes_1 = __importDefault(require("./routes/socialMediaFinderRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const intelligenceReportRoutes_1 = __importDefault(require("./routes/intelligenceReportRoutes"));
const admin_1 = __importDefault(require("./routes/admin"));
const osintAnalystRoutes_1 = __importDefault(require("./routes/osintAnalystRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
// Basic Route
app.get('/', (req, res) => {
    res.send('<h1>Fsociety ShadowScan API</h1><p>Status: ONLINE</p><p>Use the frontend to access the dashboard.</p>');
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Fsociety ShadowScan API is running' });
});
app.use('/api/auth', authRoutes_1.default);
app.use('/api/cases', caseRoutes_1.default);
app.use('/api/search', searchRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/tools', toolRoutes_1.default);
app.use('/api/kali-tools', kaliToolsRoutes_1.default);
app.use('/api/social-media', socialMediaFinderRoutes_1.default);
app.use('/api/reports', reportRoutes_1.default);
app.use('/api/intelligence', intelligenceReportRoutes_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/osint-analyst', osintAnalystRoutes_1.default);
app.use('/api/chat', chatRoutes_1.default);
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
