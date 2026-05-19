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
exports.exportLogs = exports.detectAnomalies = exports.filterLogs = exports.getAllLogs = void 0;
const AdminLog_1 = __importDefault(require("../models/AdminLog"));
const User_1 = __importDefault(require("../models/User"));
/**
 * 1. Get All Logs with pagination
 */
const getAllLogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const logs = yield AdminLog_1.default.find()
            .populate('userId', 'username email')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);
        const total = yield AdminLog_1.default.countDocuments();
        res.json({
            success: true,
            data: logs,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getAllLogs = getAllLogs;
/**
 * 2. Filter Logs
 */
const filterLogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, action, dateFrom, dateTo, status, toolName, search } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;
        const query = {};
        if (userId)
            query.userId = userId;
        if (action)
            query.action = action;
        if (status)
            query.status = status;
        if (toolName)
            query.toolName = toolName;
        if (search) {
            // Create an array of conditions for $or
            const orConditions = [
                { ipAddress: { $regex: search, $options: 'i' } }
            ];
            // For username we need a separate check or aggregation but for now 
            // let's stick to IP regex in query and we can handle username in frontend or a more complex aggregation
            query.$or = orConditions;
        }
        if (dateFrom || dateTo) {
            query.timestamp = {};
            if (dateFrom)
                query.timestamp.$gte = new Date(dateFrom);
            if (dateTo)
                query.timestamp.$lte = new Date(dateTo);
        }
        const logs = yield AdminLog_1.default.find(query)
            .populate('userId', 'username email')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);
        const total = yield AdminLog_1.default.countDocuments(query);
        res.json({
            success: true,
            data: logs,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.filterLogs = filterLogs;
/**
 * 3. Detect Anomalies
 */
const detectAnomalies = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const anomalies = [];
        let alertLevel = 'low';
        // 1. Detect Burst Activity (> 50 scans in 1h)
        const burstActivity = yield AdminLog_1.default.aggregate([
            {
                $match: {
                    timestamp: { $gte: oneHourAgo },
                    action: { $in: ['email_lookup', 'username_scan', 'phone_lookup', 'metadata_extraction'] }
                }
            },
            {
                $group: {
                    _id: "$userId",
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 50 } } }
        ]);
        for (const activity of burstActivity) {
            const user = yield User_1.default.findById(activity._id).select('username');
            anomalies.push({
                type: 'Burst Activity',
                userId: activity._id,
                username: (user === null || user === void 0 ? void 0 : user.username) || 'Unknown',
                details: `Performed ${activity.count} scans in the last hour.`,
                severity: 'high'
            });
            alertLevel = 'high';
        }
        // 2. Detect Multiple Failed Logins (> 5 in 1h)
        const failedLogins = yield AdminLog_1.default.aggregate([
            {
                $match: {
                    timestamp: { $gte: oneHourAgo },
                    action: 'login_attempt',
                    status: 'failed'
                }
            },
            {
                $group: {
                    _id: "$userId",
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 5 } } }
        ]);
        for (const fail of failedLogins) {
            const user = yield User_1.default.findById(fail._id).select('username');
            anomalies.push({
                type: 'Multiple Failed Logins',
                userId: fail._id,
                username: (user === null || user === void 0 ? void 0 : user.username) || 'Unknown',
                details: `${fail.count} failed login attempts in the last hour.`,
                severity: 'medium'
            });
            if (alertLevel !== 'high')
                alertLevel = 'medium';
        }
        res.json({ success: true, data: { anomalies, alertLevel } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.detectAnomalies = detectAnomalies;
/**
 * 4. Export Logs to CSV
 */
const exportLogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, action, dateFrom, dateTo, status } = req.query;
        const query = {};
        if (userId)
            query.userId = userId;
        if (action)
            query.action = action;
        if (status)
            query.status = status;
        if (dateFrom || dateTo) {
            query.timestamp = {};
            if (dateFrom)
                query.timestamp.$gte = new Date(dateFrom);
            if (dateTo)
                query.timestamp.$lte = new Date(dateTo);
        }
        const logs = yield AdminLog_1.default.find(query)
            .populate('userId', 'username email')
            .sort({ timestamp: -1 });
        // Build CSV string
        let csv = 'Timestamp,User,Email,Action,Tool,Status,IP,Details\n';
        logs.forEach((log) => {
            var _a, _b;
            const timestamp = log.timestamp.toISOString();
            const username = ((_a = log.userId) === null || _a === void 0 ? void 0 : _a.username) || 'N/A';
            const email = ((_b = log.userId) === null || _b === void 0 ? void 0 : _b.email) || 'N/A';
            const details = JSON.stringify(log.details).replace(/"/g, '""');
            csv += `${timestamp},${username},${email},${log.action},${log.toolName},${log.status},${log.ipAddress || ''},"${details}"\n`;
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=logs_export_${Date.now()}.csv`);
        res.status(200).send(csv);
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.exportLogs = exportLogs;
