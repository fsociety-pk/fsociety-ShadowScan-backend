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
exports.checkSettings = void 0;
const SystemSettings_1 = __importDefault(require("../models/SystemSettings"));
let cachedSettings = null;
let lastFetch = 0;
const CACHE_TTL = 30000; // 30 seconds
const getSettings = () => __awaiter(void 0, void 0, void 0, function* () {
    const now = Date.now();
    if (!cachedSettings || (now - lastFetch) > CACHE_TTL) {
        cachedSettings = yield SystemSettings_1.default.findOne();
        lastFetch = now;
    }
    return cachedSettings;
});
/**
 * Middleware to enforce global system settings.
 * Checks for maintenance mode and tool enablement.
 */
const checkSettings = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const settings = yield getSettings();
        if (!settings)
            return next();
        // 1. Maintenance Mode
        // Skip for admins so they can turn it off
        const isAdmin = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === 'admin';
        if (settings.maintenanceMode && !isAdmin) {
            return res.status(503).json({
                success: false,
                message: 'PLATFORM_UNDER_MAINTENANCE: The ShadowScan grid is currently undergoing scheduled optimization. Access is restricted.',
                retryAfter: 3600
            });
        }
        // 2. Tool Enablement
        const path = req.path;
        if (path.includes('/api/tools/email-lookup') && !settings.enableEmailLookup) {
            return res.status(403).json({ success: false, message: 'INTELLIGENCE_DENIED: Email lookup capability is currently offline.' });
        }
        if (path.includes('/api/tools/username-lookup') && !settings.enableUsernameScan) {
            return res.status(403).json({ success: false, message: 'INTELLIGENCE_DENIED: Username intelligence node is currently offline.' });
        }
        if (path.includes('/api/tools/phone-lookup-pk') && !settings.enablePhoneLookup) {
            return res.status(403).json({ success: false, message: 'INTELLIGENCE_DENIED: Pakistan Phone Intelligence grid is currently offline.' });
        }
        if (path.includes('/api/tools/extract-metadata') && !settings.enableMetadataExtraction) {
            return res.status(403).json({ success: false, message: 'INTELLIGENCE_DENIED: Metadata forensic extraction is currently offline.' });
        }
        next();
    }
    catch (error) {
        console.error('Settings Check Error:', error);
        next(); // Pro-fail: allow request if settings check fails
    }
});
exports.checkSettings = checkSettings;
