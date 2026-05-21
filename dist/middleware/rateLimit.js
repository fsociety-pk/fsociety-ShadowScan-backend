"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var rateLimit_exports = {};
__export(rateLimit_exports, {
  adminLimits: () => adminLimits,
  authLimits: () => authLimits,
  rateLimit: () => rateLimit,
  searchLimits: () => searchLimits
});
module.exports = __toCommonJS(rateLimit_exports);
const stores = {};
const rateLimit = (category, config) => {
  if (!stores[category]) {
    stores[category] = {};
  }
  const store = stores[category];
  return (req, res, next) => {
    const identifier = req.user?.id || req.ip || req.get("x-forwarded-for") || "unknown";
    const currentTime = Date.now();
    if (!store[identifier] || currentTime > store[identifier].resetTime) {
      store[identifier] = {
        count: 1,
        resetTime: currentTime + config.windowMs
      };
      res.setHeader("X-RateLimit-Limit", config.limit);
      res.setHeader("X-RateLimit-Remaining", config.limit - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil(store[identifier].resetTime / 1e3));
      return next();
    }
    store[identifier].count++;
    const remaining = config.limit - store[identifier].count;
    res.setHeader("X-RateLimit-Limit", config.limit);
    res.setHeader("X-RateLimit-Remaining", remaining < 0 ? 0 : remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(store[identifier].resetTime / 1e3));
    if (store[identifier].count > config.limit) {
      return res.status(429).json({
        success: false,
        message: `Too many requests for ${category}. Please try again later.`,
        retryAfter: Math.ceil((store[identifier].resetTime - currentTime) / 1e3)
      });
    }
    next();
  };
};
const authLimits = rateLimit("auth", { limit: 10, windowMs: 15 * 60 * 1e3 });
const searchLimits = rateLimit("search", { limit: 50, windowMs: 60 * 60 * 1e3 });
const adminLimits = rateLimit("admin", { limit: 500, windowMs: 60 * 60 * 1e3 });
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  adminLimits,
  authLimits,
  rateLimit,
  searchLimits
});
