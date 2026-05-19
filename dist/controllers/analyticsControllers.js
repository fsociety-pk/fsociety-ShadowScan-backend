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
exports.getPeakActivity = exports.getActivitySummary = exports.getTopUsers = exports.getTrends = exports.getToolUsageStats = exports.getDashboardStats = void 0;
const User_1 = __importDefault(require("../models/User"));
const AdminLog_1 = __importDefault(require("../models/AdminLog"));
/**
 * 1. Get Dashboard Overview Stats
 */
const getDashboardStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const [totalUsers, totalScansAgg, activeToday, activeWeek] = yield Promise.all([
            User_1.default.countDocuments(),
            User_1.default.aggregate([{ $group: { _id: null, total: { $sum: "$totalScans" } } }]).catch(err => { console.error('Aggregation error:', err); return []; }),
            User_1.default.countDocuments({ lastLogin: { $gte: last24h } }),
            User_1.default.countDocuments({ lastLogin: { $gte: last7d } })
        ]);
        const totalScans = ((_a = totalScansAgg[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
        res.json({
            success: true,
            data: {
                totalUsers,
                totalScans,
                activeUsersToday: activeToday,
                activeUsersThisWeek: activeWeek,
                systemHealthStatus: {
                    status: 'Operational',
                    latency: 'Normal',
                    uptime: '99.9%'
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getDashboardStats = getDashboardStats;
/**
 * 2. Get Tool Usage Stats (Last 30 Days)
 */
const getToolUsageStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate } = req.query;
        let matchQuery = {
            action: { $in: ['email_lookup', 'username_scan', 'phone_lookup', 'metadata_extraction'] }
        };
        if (startDate || endDate) {
            matchQuery.timestamp = {};
            if (startDate)
                matchQuery.timestamp.$gte = new Date(startDate);
            if (endDate)
                matchQuery.timestamp.$lte = new Date(endDate);
        }
        else {
            matchQuery.timestamp = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        }
        const stats = yield AdminLog_1.default.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: "$action",
                    count: { $sum: 1 }
                }
            }
        ]);
        // Format output as requested: { email: X, username: Y, ... }
        const result = { email: 0, username: 0, phone: 0, metadata: 0 };
        stats.forEach(item => {
            if (item._id === 'email_lookup')
                result.email = item.count;
            else if (item._id === 'username_scan')
                result.username = item.count;
            else if (item._id === 'phone_lookup')
                result.phone = item.count;
            else if (item._id === 'metadata_extraction')
                result.metadata = item.count;
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getToolUsageStats = getToolUsageStats;
/**
 * 3. Get Trends (Daily scan counts)
 */
const getTrends = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { timeframe, startDate, endDate } = req.query;
        let matchQuery = {
            action: { $in: ['email_lookup', 'username_scan', 'phone_lookup', 'metadata_extraction'] }
        };
        if (startDate || endDate) {
            matchQuery.timestamp = {};
            if (startDate)
                matchQuery.timestamp.$gte = new Date(startDate);
            if (endDate)
                matchQuery.timestamp.$lte = new Date(endDate);
        }
        else {
            let days = 30;
            if (timeframe === '7d')
                days = 7;
            else if (timeframe === '90d')
                days = 90;
            matchQuery.timestamp = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
        }
        const trends = yield AdminLog_1.default.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                    scans: { $sum: 1 },
                    users: { $addToSet: "$userId" }
                }
            },
            {
                $project: {
                    date: "$_id",
                    scans: 1,
                    users: { $size: "$users" },
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);
        res.json({ success: true, data: trends });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getTrends = getTrends;
/**
 * 4. Get Top 10 Active Users
 */
const getTopUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const topUsers = yield User_1.default.find()
            .sort({ totalScans: -1 })
            .limit(10)
            .select('username email totalScans lastLogin');
        res.json({ success: true, data: topUsers });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getTopUsers = getTopUsers;
/**
 * 5. Get Real-time Activity Summary (Last 100)
 */
const getActivitySummary = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const activity = yield AdminLog_1.default.find()
            .sort({ timestamp: -1 })
            .limit(100)
            .populate('userId', 'username email');
        res.json({ success: true, data: activity });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getActivitySummary = getActivitySummary;
/**
 * 6. Get Peak Activity by Hour
 */
const getPeakActivity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate } = req.query;
        let matchQuery = {
            action: { $in: ['email_lookup', 'username_scan', 'phone_lookup', 'metadata_extraction'] }
        };
        if (startDate || endDate) {
            matchQuery.timestamp = {};
            if (startDate)
                matchQuery.timestamp.$gte = new Date(startDate);
            if (endDate)
                matchQuery.timestamp.$lte = new Date(endDate);
        }
        const peakHours = yield AdminLog_1.default.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: { $hour: "$timestamp" },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    hour: "$_id",
                    count: 1,
                    _id: 0
                }
            },
            { $sort: { hour: 1 } }
        ]);
        res.json({ success: true, data: peakHours });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getPeakActivity = getPeakActivity;
