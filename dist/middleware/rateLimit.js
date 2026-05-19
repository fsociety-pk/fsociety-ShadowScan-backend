"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLimits = exports.searchLimits = exports.authLimits = exports.rateLimit = void 0;
const stores = {};
/**
 * Advanced rate limiting middleware.
 * Supports different limits for different categories (e.g., 'search', 'admin', 'auth').
 */
const rateLimit = (category, config) => {
    if (!stores[category]) {
        stores[category] = {};
    }
    const store = stores[category];
    return (req, res, next) => {
        var _a;
        // Identify by User ID if available, otherwise by IP
        const identifier = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || req.ip || req.get('x-forwarded-for') || 'unknown';
        const currentTime = Date.now();
        if (!store[identifier] || currentTime > store[identifier].resetTime) {
            store[identifier] = {
                count: 1,
                resetTime: currentTime + config.windowMs,
            };
            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', config.limit);
            res.setHeader('X-RateLimit-Remaining', config.limit - 1);
            res.setHeader('X-RateLimit-Reset', Math.ceil(store[identifier].resetTime / 1000));
            return next();
        }
        store[identifier].count++;
        const remaining = config.limit - store[identifier].count;
        res.setHeader('X-RateLimit-Limit', config.limit);
        res.setHeader('X-RateLimit-Remaining', remaining < 0 ? 0 : remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(store[identifier].resetTime / 1000));
        if (store[identifier].count > config.limit) {
            return res.status(429).json({
                success: false,
                message: `Too many requests for ${category}. Please try again later.`,
                retryAfter: Math.ceil((store[identifier].resetTime - currentTime) / 1000)
            });
        }
        next();
    };
};
exports.rateLimit = rateLimit;
// Common limit presets
exports.authLimits = (0, exports.rateLimit)('auth', { limit: 10, windowMs: 15 * 60 * 1000 }); // 10 attempts per 15 mins
exports.searchLimits = (0, exports.rateLimit)('search', { limit: 50, windowMs: 60 * 60 * 1000 }); // 50 searches per hour
exports.adminLimits = (0, exports.rateLimit)('admin', { limit: 500, windowMs: 60 * 60 * 1000 }); // 500 admin actions per hour
