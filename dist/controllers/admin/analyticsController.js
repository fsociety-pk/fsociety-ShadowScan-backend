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
exports.getTrends = exports.getToolUsage = exports.getDashboardMetrics = void 0;
const SystemMetrics_1 = __importDefault(require("../../models/SystemMetrics"));
const getDashboardMetrics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const metrics = yield SystemMetrics_1.default.findOne().sort({ date: -1 });
        res.json({ success: true, data: metrics });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
exports.getDashboardMetrics = getDashboardMetrics;
const getToolUsage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const metrics = yield SystemMetrics_1.default.find().select('date toolUsageBreakdown').sort({ date: -1 }).limit(30);
        res.json({ success: true, data: metrics });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
exports.getToolUsage = getToolUsage;
const getTrends = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const trends = yield SystemMetrics_1.default.find().select('date totalScans totalUsers activeUsers').sort({ date: -1 }).limit(30);
        res.json({ success: true, data: trends });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
exports.getTrends = getTrends;
