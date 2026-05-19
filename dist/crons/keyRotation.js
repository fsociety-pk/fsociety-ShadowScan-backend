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
exports.initKeyRotationCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const SystemSettings_1 = __importDefault(require("../models/SystemSettings"));
const AdminAuditLog_1 = __importDefault(require("../models/AdminAuditLog"));
/**
 * Monthly API Key Rotation Job
 * Runs on the 1st of every month at midnight
 */
const initKeyRotationCron = () => {
    node_cron_1.default.schedule('0 0 1 * *', () => __awaiter(void 0, void 0, void 0, function* () {
        console.log('[CRON] Starting monthly API key rotation...');
        try {
            const settings = yield SystemSettings_1.default.findOne();
            if (!settings)
                return;
            // In a real scenario, this would call external provider APIs to refresh keys.
            // Here we simulate it by re-encrypting or "rotating" the existing ones or generating mocks.
            const updatedIntegrations = settings.apiIntegrations.map(api => {
                // Mock rotation: append a rotation stamp or re-encrypt
                const mockNewKey = `rotated_${Math.random().toString(36).slice(-10)}`;
                return Object.assign(Object.assign({}, api), { lastChecked: new Date() });
            });
            yield SystemSettings_1.default.updateOne({}, { $set: { apiIntegrations: updatedIntegrations } });
            // Log the systemic rotation
            yield AdminAuditLog_1.default.create({
                adminId: null, // System action
                action: 'system_cron',
                endpoint: 'internal_cron_job',
                method: 'CRON',
                ipAddress: '127.0.0.1',
                changes: { action: 'monthly_api_key_rotation_check' },
                timestamp: new Date()
            });
            console.log('[CRON] API key rotation check completed.');
        }
        catch (error) {
            console.error('[CRON] API key rotation failed:', error);
        }
    }));
};
exports.initKeyRotationCron = initKeyRotationCron;
