"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCSRF = exports.requireReauth = exports.logAdminAccess = exports.adminRateLimiter = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const rateLimiter_1 = require("./rateLimiter");
const AdminAuditLog_1 = __importDefault(require("../models/AdminAuditLog"));
const SystemSettings_1 = __importDefault(require("../models/SystemSettings"));
const env_1 = require("../config/env");
// 1. Admin Endpoint Rate Limiter (50 reqs / hour by default)
exports.adminRateLimiter = (0, rateLimiter_1.rateLimiter)(1000, 60 * 60 * 1000);
// 2. Admin Audit Log Middleware
const logAdminAccess = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Capture basic request info
    const adminId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!adminId)
        return next();
    const ipAddress = (req.headers['x-forwarded-for'] || req.ip || 'unknown');
    const method = req.method;
    const endpoint = req.originalUrl;
    // Clone body to mask passwords
    let changes = Object.assign({}, req.body);
    if (changes.password)
        changes.password = '***';
    if (changes.adminPassword)
        changes.adminPassword = '***';
    const action = method === 'GET' ? 'read' : method === 'POST' ? 'create' : method === 'PUT' || method === 'PATCH' ? 'update' : 'delete';
    // Fire and forget log creation
    AdminAuditLog_1.default.create({
        adminId,
        action,
        endpoint,
        method,
        ipAddress,
        changes
    }).catch(err => {
        // Only log error in development to avoid console noise
        if (process.env.NODE_ENV !== 'production') {
            console.error('Failed to write admin audit log:', err.message);
        }
    });
    return next();
});
exports.logAdminAccess = logAdminAccess;
// 3. Require Re-Auth (Sudo Mode)
const requireReauth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const settings = yield SystemSettings_1.default.findOne();
        if (settings && !settings.requireReauthForSensitiveOperations) {
            return next(); // disabled globally
        }
        const token = req.headers['x-sudo-token'];
        if (!token) {
            return res.status(403).json({ success: false, message: 'Re-authentication required. Please enter your password to continue.' });
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, (0, env_1.getJwtSecret)());
            if (decoded.id !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || decoded.type !== 'sudo') {
                throw new Error('Invalid sudo token');
            }
            next();
        }
        catch (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired sudo session. Please re-authenticate.' });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error checking re-auth requirements' });
    }
});
exports.requireReauth = requireReauth;
// 4. Custom CSRF Validation
const validateCSRF = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    // If we had cookie-based sessions, we'd compare cookie to header.
    // Since we use Auth headers, CSRF is naturally mitigated.
    // However, for strict compliance, we enforce an explicit anti-csrf header for state changes.
    const csrfToken = req.headers['x-csrf-token'];
    if (!csrfToken || csrfToken !== 'osint-csrf-protection') {
        return res.status(403).json({ success: false, message: 'CSRF token missing or invalid.' });
    }
    next();
};
exports.validateCSRF = validateCSRF;
