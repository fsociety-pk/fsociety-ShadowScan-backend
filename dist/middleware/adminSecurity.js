"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var adminSecurity_exports = {};
__export(adminSecurity_exports, {
  adminRateLimiter: () => adminRateLimiter,
  logAdminAccess: () => logAdminAccess,
  requireReauth: () => requireReauth,
  validateCSRF: () => validateCSRF
});
module.exports = __toCommonJS(adminSecurity_exports);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var import_rateLimiter = require("./rateLimiter");
var import_AdminAuditLog = __toESM(require("../models/AdminAuditLog"));
var import_SystemSettings = __toESM(require("../models/SystemSettings"));
var import_env = require("../config/env");
const adminRateLimiter = (0, import_rateLimiter.rateLimiter)(1e3, 60 * 60 * 1e3);
const logAdminAccess = async (req, res, next) => {
  const adminId = req.user?.id;
  if (!adminId) return next();
  const ipAddress = req.headers["x-forwarded-for"] || req.ip || "unknown";
  const method = req.method;
  const endpoint = req.originalUrl;
  let changes = { ...req.body };
  if (changes.password) changes.password = "***";
  if (changes.adminPassword) changes.adminPassword = "***";
  const action = method === "GET" ? "read" : method === "POST" ? "create" : method === "PUT" || method === "PATCH" ? "update" : "delete";
  import_AdminAuditLog.default.create({
    adminId,
    action,
    endpoint,
    method,
    ipAddress,
    changes
  }).catch((err) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to write admin audit log:", err.message);
    }
  });
  return next();
};
const requireReauth = async (req, res, next) => {
  try {
    const settings = await import_SystemSettings.default.findOne();
    if (settings && !settings.requireReauthForSensitiveOperations) {
      return next();
    }
    const token = req.headers["x-sudo-token"];
    if (!token) {
      return res.status(403).json({ success: false, message: "Re-authentication required. Please enter your password to continue." });
    }
    try {
      const decoded = import_jsonwebtoken.default.verify(token, (0, import_env.getJwtSecret)());
      if (decoded.id !== req.user?.id || decoded.type !== "sudo") {
        throw new Error("Invalid sudo token");
      }
      next();
    } catch (err) {
      return res.status(403).json({ success: false, message: "Invalid or expired sudo session. Please re-authenticate." });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error checking re-auth requirements" });
  }
};
const validateCSRF = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const csrfToken = req.headers["x-csrf-token"];
  if (!csrfToken || csrfToken !== "osint-csrf-protection") {
    return res.status(403).json({ success: false, message: "CSRF token missing or invalid." });
  }
  next();
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  adminRateLimiter,
  logAdminAccess,
  requireReauth,
  validateCSRF
});
