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
exports.getFilteredLogs = exports.getLogs = void 0;
const AdminLog_1 = __importDefault(require("../../models/AdminLog"));
const getLogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const logs = yield AdminLog_1.default.find().populate('userId', 'username').sort({ timestamp: -1 }).limit(100);
        res.json({ success: true, data: logs });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
exports.getLogs = getLogs;
const getFilteredLogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { action, status, userId } = req.query;
        const query = {};
        if (action)
            query.action = action;
        if (status)
            query.status = status;
        if (userId)
            query.userId = userId;
        const logs = yield AdminLog_1.default.find(query).populate('userId', 'username').sort({ timestamp: -1 }).limit(100);
        res.json({ success: true, data: logs });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
exports.getFilteredLogs = getFilteredLogs;
