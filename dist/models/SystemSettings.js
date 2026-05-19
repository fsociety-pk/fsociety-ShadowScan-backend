"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const SystemSettingsSchema = new mongoose_1.Schema({
    enableAdminPanel: { type: Boolean, default: true },
    rateLimitPerHour: { type: Number, default: 100 },
    enableEmailLookup: { type: Boolean, default: true },
    enableUsernameScan: { type: Boolean, default: true },
    enablePhoneLookup: { type: Boolean, default: true },
    enableMetadataExtraction: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    maxFileUploadSize: { type: Number, default: 5 }, // 5MB
    adminEmail: { type: String, default: 'admin@shadowscan.local' },
    sendActivityAlerts: { type: Boolean, default: false },
    alertFrequency: {
        type: String,
        enum: ['real-time', 'daily', 'weekly'],
        default: 'daily'
    },
    apiIntegrations: [{
            name: { type: String, required: true },
            id: { type: String, required: true, unique: true },
            isActive: { type: Boolean, default: true },
            lastChecked: { type: Date, default: Date.now },
            apiKey: { type: String }
        }],
    adminIPWhitelist: { type: [String], default: [] },
    enableIPWhitelist: { type: Boolean, default: false },
    requireReauthForSensitiveOperations: { type: Boolean, default: true }
}, { timestamps: true });
exports.default = mongoose_1.default.model('SystemSettings', SystemSettingsSchema);
