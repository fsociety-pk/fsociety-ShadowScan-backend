"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const roleCheck_1 = require("../utils/roleCheck");
const env_1 = require("../config/env");
const adminAuth = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jsonwebtoken_1.default.verify(token, (0, env_1.getJwtSecret)());
            if (!(0, roleCheck_1.isAdmin)(decoded)) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Admin privileges required'
                });
            }
            req.user = decoded;
            next();
        }
        catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized: Invalid or expired token'
            });
        }
    }
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized: No token provided'
        });
    }
};
exports.adminAuth = adminAuth;
