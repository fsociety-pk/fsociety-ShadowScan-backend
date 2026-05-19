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
exports.sudoElevate = exports.checkAdmin = exports.loginUser = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const AdminLog_1 = __importDefault(require("../models/AdminLog"));
const SystemSettings_1 = __importDefault(require("../models/SystemSettings"));
const env_1 = require("../config/env");
const generateToken = (id, role) => {
    return jsonwebtoken_1.default.sign({ id, role }, (0, env_1.getJwtSecret)(), {
        expiresIn: '30d',
    });
};
const registerUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, email, password } = req.body;
        const query = { $or: [{ username }] };
        if (email) {
            query.$or.push({ email });
        }
        const userExists = yield User_1.default.findOne(query);
        if (userExists) {
            res.status(400).json({
                success: false,
                message: 'Username already exists'
            });
            return;
        }
        const salt = yield bcryptjs_1.default.genSalt(10);
        const passwordHash = yield bcryptjs_1.default.hash(password, salt);
        const user = yield User_1.default.create({
            username,
            email,
            passwordHash,
            role: 'user' // explicit default
        });
        yield AdminLog_1.default.create({
            userId: user._id,
            action: 'user_created',
            toolName: 'AuthSystem',
            details: { username: user.username, email: user.email },
            ipAddress: req.ip || req.get('x-forwarded-for') || 'unknown',
            status: 'success'
        });
        if (user) {
            res.status(201).json({
                _id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                points: user.points,
                token: generateToken(user.id, user.role),
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: 'Invalid user data'
            });
        }
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                message: 'Username already exists'
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
exports.registerUser = registerUser;
const loginUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, password } = req.body;
        const user = yield User_1.default.findOne({ username });
        if (user && (yield bcryptjs_1.default.compare(password, user.passwordHash))) {
            // Check Admin IP Whitelist
            if (user.role === 'admin') {
                const settings = yield SystemSettings_1.default.findOne();
                if (settings && settings.enableIPWhitelist && settings.adminIPWhitelist && settings.adminIPWhitelist.length > 0) {
                    const clientIp = (req.headers['x-forwarded-for'] || req.ip || 'unknown');
                    if (!settings.adminIPWhitelist.includes(clientIp)) {
                        yield AdminLog_1.default.create({
                            userId: user._id,
                            action: 'login_attempt',
                            toolName: 'AuthSystem',
                            details: { username: user.username, reason: 'IP Address blocked by Admin IP Whitelist' },
                            ipAddress: clientIp,
                            status: 'failed'
                        });
                        res.status(403).json({ success: false, message: 'Access denied from this IP address.' });
                        return;
                    }
                }
            }
            res.json({
                _id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                points: user.points,
                token: generateToken(user.id, user.role),
            });
            yield AdminLog_1.default.create({
                userId: user._id,
                action: 'login_attempt',
                toolName: 'AuthSystem',
                details: { username: user.username },
                ipAddress: req.ip || req.get('x-forwarded-for') || 'unknown',
                status: 'success'
            });
        }
        else {
            if (user) {
                yield AdminLog_1.default.create({
                    userId: user._id,
                    action: 'login_attempt',
                    toolName: 'AuthSystem',
                    details: { username: user.username, reason: 'Invalid password' },
                    ipAddress: req.ip || req.get('x-forwarded-for') || 'unknown',
                    status: 'failed'
                });
            }
            res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
exports.loginUser = loginUser;
const checkAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.user && req.user.role === 'admin') {
            const settings = yield SystemSettings_1.default.findOne();
            // If settings don't exist yet, we default to enabled. If they do, respect the flag.
            if (settings && settings.enableAdminPanel === false) {
                res.json({ isAdmin: false, message: 'Admin panel is currently disabled system-wide.' });
                return;
            }
            res.json({ isAdmin: true });
        }
        else {
            res.json({ isAdmin: false });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
exports.checkAdmin = checkAdmin;
const sudoElevate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { password } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }
        const user = yield User_1.default.findById(userId);
        if (!user || user.role !== 'admin' || !(yield bcryptjs_1.default.compare(password, user.passwordHash))) {
            res.status(403).json({ success: false, message: 'Invalid password' });
            return;
        }
        const sudoToken = jsonwebtoken_1.default.sign({ id: user.id, type: 'sudo' }, (0, env_1.getJwtSecret)(), { expiresIn: '15m' });
        res.json({ success: true, sudoToken });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.sudoElevate = sudoElevate;
