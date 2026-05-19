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
exports.adminAudit = void 0;
const AdminLog_1 = __importDefault(require("../models/AdminLog"));
/**
 * Middleware to audit every admin request.
 * Logs user ID, action, timestamp, IP, and status to AdminLog.
 */
const adminAudit = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const start = Date.now();
    // Intercept response finish event to log status and details
    res.on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (!req.user)
                return; // Only log if authenticated
            const actionMapping = {
                'GET': 'viewed',
                'POST': 'created/performed',
                'PATCH': 'updated',
                'PUT': 'updated',
                'DELETE': 'deleted'
            };
            // Extract specific action from req.path or body if needed
            // This is a simplified version; in production, you might want more granular mapping
            let action = 'admin_action';
            if (req.path.includes('block'))
                action = 'user_blocked';
            else if (req.path.includes('unblock'))
                action = 'user_blocked'; // Enum: user_blocked used for both block/unblock in schema? 
            // Wait, let's check the schema again. 
            // actions: 'email_lookup', 'username_scan', 'phone_lookup', 'metadata_extraction', 'user_created', 'user_deleted', 'user_blocked'
            if (req.path.includes('user')) {
                if (req.method === 'POST')
                    action = 'user_created';
                else if (req.method === 'DELETE')
                    action = 'user_deleted';
                else if (req.path.includes('block'))
                    action = 'user_blocked';
            }
            yield AdminLog_1.default.create({
                userId: req.user.id,
                action: action,
                timestamp: new Date(),
                toolName: 'AdminPanel',
                details: {
                    method: req.method,
                    path: req.path,
                    query: req.query,
                    body: req.method !== 'GET' ? req.body : {},
                    status: res.statusCode,
                    duration: `${Date.now() - start}ms`
                },
                ipAddress: req.ip || req.get('x-forwarded-for') || 'unknown',
                status: res.statusCode < 400 ? 'success' : 'failed'
            });
        }
        catch (error) {
            console.error('Audit Log Error:', error);
        }
    }));
    next();
});
exports.adminAudit = adminAudit;
