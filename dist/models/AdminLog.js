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
const AdminLogSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
        type: String,
        enum: [
            'email_lookup',
            'username_scan',
            'phone_lookup',
            'metadata_extraction',
            'user_created',
            'user_deleted',
            'user_blocked',
            'login_attempt',
            'password_reset_request',
            'admin_action',
            'admin_promotion',
            'api_toggle',
            'api_rotate',
            'settings_update',
            'maintenance_toggle',
            'network_recon',
            'sherlock_search',
            'exiftool_metadata',
            'whois_lookup',
            'nmap_scan',
            'social_media_finder',
            'intelligence_report_generated'
        ],
        required: true
    },
    timestamp: { type: Date, default: Date.now },
    toolName: { type: String, required: true },
    details: { type: mongoose_1.Schema.Types.Mixed },
    ipAddress: { type: String },
    status: { type: String, enum: ['success', 'failed'], required: true }
});
exports.default = mongoose_1.default.model('AdminLog', AdminLogSchema);
