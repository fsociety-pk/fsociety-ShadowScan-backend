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
exports.logUserActivityDirect = exports.logUserActivity = void 0;
const AdminLog_1 = __importDefault(require("../models/AdminLog"));
const User_1 = __importDefault(require("../models/User"));
const SystemMetrics_1 = __importDefault(require("../models/SystemMetrics"));
/**
 * Logs user activity for OSINT tools without blocking request execution.
 * Also increments relevant user and system metrics.
 */
const logUserActivity = (req, action, toolName, metadata) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            console.warn(`[logActivity] Non-authenticated request attempted action: ${action}`);
            return;
        }
        const ipAddress = (req.headers['x-forwarded-for'] || req.ip || 'unknown');
        // 1. Create the Audit Log Entry
        yield AdminLog_1.default.create({
            userId,
            action,
            toolName,
            details: metadata,
            ipAddress,
            status: 'success'
        });
        // 2. Increment User Total Scans
        yield User_1.default.findByIdAndUpdate(userId, { $inc: { totalScans: 1 } });
        // 3. Update Daily System Metrics
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Determine which nested field to increment based on the action
        const metricField = action === 'email_lookup' ? 'email'
            : action === 'username_scan' ? 'username'
                : action === 'phone_lookup' ? 'phone'
                    : 'metadata';
        const updateQuery = {
            $inc: {
                totalScans: 1,
                [`toolUsageBreakdown.${metricField}`]: 1
            }
        };
        // Use upsert to atomically create the document if it doesn't exist for today,
        // otherwise increment existing fields.
        yield SystemMetrics_1.default.findOneAndUpdate({ date: today }, updateQuery, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
    }
    catch (error) {
        // Non-blocking catch: just print the error and let the parent process continue safely.
        console.error(`[logActivity] Failed to log activity or update metrics for action ${action}:`, error);
    }
});
exports.logUserActivity = logUserActivity;
/**
 * Alternative logging function that works with userId directly
 */
const logUserActivityDirect = (userId, action, metadata) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!userId) {
            console.warn(`[logActivity] No userId provided for action: ${action}`);
            return;
        }
        // Create the Audit Log Entry
        yield AdminLog_1.default.create({
            userId,
            action,
            toolName: 'OSINT',
            details: metadata,
            ipAddress: 'system',
            status: 'success'
        });
        // Increment User Total Scans
        yield User_1.default.findByIdAndUpdate(userId, { $inc: { totalScans: 1 } });
        // Update Daily System Metrics
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        yield SystemMetrics_1.default.findOneAndUpdate({ date: today }, {
            $inc: {
                totalScans: 1,
                'toolUsageBreakdown.other': 1
            }
        }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
    }
    catch (error) {
        console.error(`[logActivity] Failed to log activity for action ${action}:`, error);
    }
});
exports.logUserActivityDirect = logUserActivityDirect;
