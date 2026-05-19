"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = void 0;
const store = {};
const rateLimiter = (limit, windowMs) => {
    return (req, res, next) => {
        const ip = req.ip || req.get('x-forwarded-for') || 'unknown';
        const currentTime = Date.now();
        if (!store[ip] || currentTime > store[ip].resetTime) {
            store[ip] = {
                count: 1,
                resetTime: currentTime + windowMs,
            };
            return next();
        }
        store[ip].count++;
        if (store[ip].count > limit) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests, please try again later.',
            });
        }
        next();
    };
};
exports.rateLimiter = rateLimiter;
