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
var logActivity_exports = {};
__export(logActivity_exports, {
  logUserActivity: () => logUserActivity,
  logUserActivityDirect: () => logUserActivityDirect
});
module.exports = __toCommonJS(logActivity_exports);
var import_AdminLog = __toESM(require("../models/AdminLog"));
var import_User = __toESM(require("../models/User"));
var import_SystemMetrics = __toESM(require("../models/SystemMetrics"));
const logUserActivity = async (req, action, toolName, metadata) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      console.warn(`[logActivity] Non-authenticated request attempted action: ${action}`);
      return;
    }
    const ipAddress = req.headers["x-forwarded-for"] || req.ip || "unknown";
    await import_AdminLog.default.create({
      userId,
      action,
      toolName,
      details: metadata,
      ipAddress,
      status: "success"
    });
    await import_User.default.findByIdAndUpdate(userId, { $inc: { totalScans: 1 } });
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const metricField = action === "email_lookup" ? "email" : action === "username_scan" ? "username" : action === "phone_lookup" ? "phone" : "metadata";
    const updateQuery = {
      $inc: {
        totalScans: 1,
        [`toolUsageBreakdown.${metricField}`]: 1
      }
    };
    await import_SystemMetrics.default.findOneAndUpdate(
      { date: today },
      updateQuery,
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error(`[logActivity] Failed to log activity or update metrics for action ${action}:`, error);
  }
};
const logUserActivityDirect = async (userId, action, metadata) => {
  try {
    if (!userId) {
      console.warn(`[logActivity] No userId provided for action: ${action}`);
      return;
    }
    await import_AdminLog.default.create({
      userId,
      action,
      toolName: "OSINT",
      details: metadata,
      ipAddress: "system",
      status: "success"
    });
    await import_User.default.findByIdAndUpdate(userId, { $inc: { totalScans: 1 } });
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    await import_SystemMetrics.default.findOneAndUpdate(
      { date: today },
      {
        $inc: {
          totalScans: 1,
          "toolUsageBreakdown.other": 1
        }
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error(`[logActivity] Failed to log activity for action ${action}:`, error);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  logUserActivity,
  logUserActivityDirect
});
