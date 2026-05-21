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
var logsControllers_exports = {};
__export(logsControllers_exports, {
  detectAnomalies: () => detectAnomalies,
  exportLogs: () => exportLogs,
  filterLogs: () => filterLogs,
  getAllLogs: () => getAllLogs
});
module.exports = __toCommonJS(logsControllers_exports);
var import_AdminLog = __toESM(require("../models/AdminLog"));
var import_User = __toESM(require("../models/User"));
const getAllLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const logs = await import_AdminLog.default.find().populate("userId", "username email").sort({ timestamp: -1 }).skip(skip).limit(limit);
    const total = await import_AdminLog.default.countDocuments();
    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const filterLogs = async (req, res) => {
  try {
    const { userId, action, dateFrom, dateTo, status, toolName, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;
    const query = {};
    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (status) query.status = status;
    if (toolName) query.toolName = toolName;
    if (search) {
      const orConditions = [
        { ipAddress: { $regex: search, $options: "i" } }
      ];
      query.$or = orConditions;
    }
    if (dateFrom || dateTo) {
      query.timestamp = {};
      if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
      if (dateTo) query.timestamp.$lte = new Date(dateTo);
    }
    const logs = await import_AdminLog.default.find(query).populate("userId", "username email").sort({ timestamp: -1 }).skip(skip).limit(limit);
    const total = await import_AdminLog.default.countDocuments(query);
    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const detectAnomalies = async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
    const anomalies = [];
    let alertLevel = "low";
    const burstActivity = await import_AdminLog.default.aggregate([
      {
        $match: {
          timestamp: { $gte: oneHourAgo },
          action: { $in: ["email_lookup", "username_scan", "phone_lookup", "metadata_extraction"] }
        }
      },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 50 } } }
    ]);
    for (const activity of burstActivity) {
      const user = await import_User.default.findById(activity._id).select("username");
      anomalies.push({
        type: "Burst Activity",
        userId: activity._id,
        username: user?.username || "Unknown",
        details: `Performed ${activity.count} scans in the last hour.`,
        severity: "high"
      });
      alertLevel = "high";
    }
    const failedLogins = await import_AdminLog.default.aggregate([
      {
        $match: {
          timestamp: { $gte: oneHourAgo },
          action: "login_attempt",
          status: "failed"
        }
      },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 5 } } }
    ]);
    for (const fail of failedLogins) {
      const user = await import_User.default.findById(fail._id).select("username");
      anomalies.push({
        type: "Multiple Failed Logins",
        userId: fail._id,
        username: user?.username || "Unknown",
        details: `${fail.count} failed login attempts in the last hour.`,
        severity: "medium"
      });
      if (alertLevel !== "high") alertLevel = "medium";
    }
    res.json({ success: true, data: { anomalies, alertLevel } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const exportLogs = async (req, res) => {
  try {
    const { userId, action, dateFrom, dateTo, status } = req.query;
    const query = {};
    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.timestamp = {};
      if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
      if (dateTo) query.timestamp.$lte = new Date(dateTo);
    }
    const logs = await import_AdminLog.default.find(query).populate("userId", "username email").sort({ timestamp: -1 });
    let csv = "Timestamp,User,Email,Action,Tool,Status,IP,Details\n";
    logs.forEach((log) => {
      const timestamp = log.timestamp.toISOString();
      const username = log.userId?.username || "N/A";
      const email = log.userId?.email || "N/A";
      const details = JSON.stringify(log.details).replace(/"/g, '""');
      csv += `${timestamp},${username},${email},${log.action},${log.toolName},${log.status},${log.ipAddress || ""},"${details}"
`;
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=logs_export_${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  detectAnomalies,
  exportLogs,
  filterLogs,
  getAllLogs
});
