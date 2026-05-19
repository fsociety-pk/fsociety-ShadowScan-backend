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
exports.rotateAPIKeys = exports.toggleAPIIntegration = exports.getAPIIntegrations = exports.updateSettings = exports.getSettings = void 0;
const SystemSettings_1 = __importDefault(require("../models/SystemSettings"));
const AdminLog_1 = __importDefault(require("../models/AdminLog"));
const encryption_1 = require("../utils/encryption");
/**
 * 1. Get System Settings
 */
const getSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let settings = yield SystemSettings_1.default.findOne();
        if (!settings) {
            // Initialize full default settings if none exist
            settings = yield SystemSettings_1.default.create({
                enableAdminPanel: true,
                rateLimitPerHour: 100,
                enableEmailLookup: true,
                enableUsernameScan: true,
                enablePhoneLookup: true,
                enableMetadataExtraction: true,
                maintenanceMode: false,
                maxFileUploadSize: 5,
                adminEmail: 'admin@shadowscan.local',
                sendActivityAlerts: false,
                alertFrequency: 'daily',
                apiIntegrations: [
                    { name: 'HaveIBeenPwned', id: 'hibp', isActive: true },
                    { name: 'Gravatar', id: 'gravatar', isActive: true },
                    { name: 'Microsoft Credential API', id: 'ms_cred', isActive: false }
                ],
                adminIPWhitelist: [],
                enableIPWhitelist: false,
                requireReauthForSensitiveOperations: true
            });
        }
        res.json({ success: true, data: settings });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getSettings = getSettings;
/**
 * 2. Update System Settings
 */
const updateSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Sanitize Payload (Remove immutable/read-only fields that cause DB errors)
        const updateData = Object.assign({}, req.body);
        delete updateData._id;
        delete updateData.__v;
        delete updateData.createdAt;
        delete updateData.updatedAt;
        // Prevent accidental wipe of API integrations if not provided in this specific save block
        if (!updateData.apiIntegrations || updateData.apiIntegrations.length === 0) {
            delete updateData.apiIntegrations;
        }
        // 2. Prevent locking yourself out if you try to enable IP whitelist with empty list
        if (updateData.enableIPWhitelist === true && (!updateData.adminIPWhitelist || updateData.adminIPWhitelist.length === 0)) {
            const clientIp = (req.headers['x-forwarded-for'] || req.ip || 'unknown');
            updateData.adminIPWhitelist = [clientIp]; // Auto-add current IP to prevent lockout
        }
        const settings = yield SystemSettings_1.default.findOneAndUpdate({}, updateData, { returnDocument: 'after', upsert: true });
        yield AdminLog_1.default.create({
            userId: req.user.id,
            action: 'admin_action',
            toolName: 'AdminPanel',
            details: { action: 'update_settings', changes: updateData },
            status: 'success'
        });
        res.json({ success: true, data: settings });
    }
    catch (error) {
        console.error('SYSTEM_SETTINGS_SAVE_FAILURE:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.updateSettings = updateSettings;
/**
 * 3. Get API Integrations (Filter out sensitive data)
 */
const getAPIIntegrations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const settings = yield SystemSettings_1.default.findOne();
        const integrations = (settings === null || settings === void 0 ? void 0 : settings.apiIntegrations.map(api => ({
            name: api.name,
            id: api.id,
            isActive: api.isActive,
            lastChecked: api.lastChecked,
            hasKey: !!api.apiKey
        }))) || [];
        res.json({ success: true, data: integrations });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getAPIIntegrations = getAPIIntegrations;
/**
 * 4. Toggle API Integration
 */
const toggleAPIIntegration = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { apiId, status } = req.body;
        const settings = yield SystemSettings_1.default.findOneAndUpdate({ "apiIntegrations.id": apiId }, { "$set": { "apiIntegrations.$.isActive": status, "apiIntegrations.$.lastChecked": new Date() } }, { returnDocument: 'after' });
        if (!settings)
            return res.status(404).json({ success: false, message: 'API integration not found' });
        yield AdminLog_1.default.create({
            userId: req.user.id,
            action: 'admin_action',
            toolName: 'AdminPanel',
            details: { action: 'toggle_api', apiId, status },
            status: 'success'
        });
        res.json({ success: true, message: `API ${apiId} ${status ? 'enabled' : 'disabled'}` });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.toggleAPIIntegration = toggleAPIIntegration;
/**
 * 5. Rotate API Keys
 */
const rotateAPIKeys = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { apiId } = req.body;
        // Mock logic for key rotation
        const newRawKey = `rotated_${Math.random().toString(36).slice(-16)}`;
        const encryptedKey = (0, encryption_1.encryptAPIKey)(newRawKey);
        yield SystemSettings_1.default.findOneAndUpdate({ "apiIntegrations.id": apiId }, { "$set": { "apiIntegrations.$.apiKey": encryptedKey, "apiIntegrations.$.lastChecked": new Date() } });
        yield AdminLog_1.default.create({
            userId: req.user.id,
            action: 'admin_action',
            toolName: 'AdminPanel',
            details: { action: 'rotate_api_key', apiId },
            status: 'success'
        });
        res.json({
            success: true,
            message: `API Key for ${apiId} rotated successfully.`,
            newKey: newRawKey // Returning once as requested
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.rotateAPIKeys = rotateAPIKeys;
