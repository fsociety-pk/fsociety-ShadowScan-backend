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
var rateLimiter_exports = {};
__export(rateLimiter_exports, {
  rateLimiter: () => rateLimiter
});
module.exports = __toCommonJS(rateLimiter_exports);
const store = {};
const rateLimiter = (limit, windowMs) => {
  return (req, res, next) => {
    const ip = req.ip || req.get("x-forwarded-for") || "unknown";
    const currentTime = Date.now();
    if (!store[ip] || currentTime > store[ip].resetTime) {
      store[ip] = {
        count: 1,
        resetTime: currentTime + windowMs
      };
      return next();
    }
    store[ip].count++;
    if (store[ip].count > limit) {
      return res.status(429).json({
        success: false,
        message: "Too many requests, please try again later."
      });
    }
    next();
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  rateLimiter
});
