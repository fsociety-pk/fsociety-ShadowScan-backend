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
var analyticsControllers_exports = {};
__export(analyticsControllers_exports, {
  getActivitySummary: () => getActivitySummary,
  getDashboardStats: () => getDashboardStats,
  getPeakActivity: () => getPeakActivity,
  getToolUsageStats: () => getToolUsageStats,
  getTopUsers: () => getTopUsers,
  getTrends: () => getTrends
});
module.exports = __toCommonJS(analyticsControllers_exports);
var import_User = __toESM(require("../models/User"));
var import_AdminLog = __toESM(require("../models/AdminLog"));
const getDashboardStats = async (req, res) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
    const [totalUsers, totalScansAgg, activeToday, activeWeek] = await Promise.all([
      import_User.default.countDocuments(),
      import_User.default.aggregate([{ $group: { _id: null, total: { $sum: "$totalScans" } } }]).catch((err) => {
        console.error("Aggregation error:", err);
        return [];
      }),
      import_User.default.countDocuments({ lastLogin: { $gte: last24h } }),
      import_User.default.countDocuments({ lastLogin: { $gte: last7d } })
    ]);
    const totalScans = totalScansAgg[0]?.total || 0;
    res.json({
      success: true,
      data: {
        totalUsers,
        totalScans,
        activeUsersToday: activeToday,
        activeUsersThisWeek: activeWeek,
        systemHealthStatus: {
          status: "Operational",
          latency: "Normal",
          uptime: "99.9%"
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getToolUsageStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let matchQuery = {
      action: { $in: ["email_lookup", "username_scan", "phone_lookup", "metadata_extraction"] }
    };
    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate);
    } else {
      matchQuery.timestamp = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3) };
    }
    const stats = await import_AdminLog.default.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 }
        }
      }
    ]);
    const result = { email: 0, username: 0, phone: 0, metadata: 0 };
    stats.forEach((item) => {
      if (item._id === "email_lookup") result.email = item.count;
      else if (item._id === "username_scan") result.username = item.count;
      else if (item._id === "phone_lookup") result.phone = item.count;
      else if (item._id === "metadata_extraction") result.metadata = item.count;
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getTrends = async (req, res) => {
  try {
    const { timeframe, startDate, endDate } = req.query;
    let matchQuery = {
      action: { $in: ["email_lookup", "username_scan", "phone_lookup", "metadata_extraction"] }
    };
    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate);
    } else {
      let days = 30;
      if (timeframe === "7d") days = 7;
      else if (timeframe === "90d") days = 90;
      matchQuery.timestamp = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1e3) };
    }
    const trends = await import_AdminLog.default.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          scans: { $sum: 1 },
          users: { $addToSet: "$userId" }
        }
      },
      {
        $project: {
          date: "$_id",
          scans: 1,
          users: { $size: "$users" },
          _id: 0
        }
      },
      { $sort: { date: 1 } }
    ]);
    res.json({ success: true, data: trends });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getTopUsers = async (req, res) => {
  try {
    const topUsers = await import_User.default.find().sort({ totalScans: -1 }).limit(10).select("username email totalScans lastLogin");
    res.json({ success: true, data: topUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getActivitySummary = async (req, res) => {
  try {
    const activity = await import_AdminLog.default.find().sort({ timestamp: -1 }).limit(100).populate("userId", "username email");
    res.json({ success: true, data: activity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getPeakActivity = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let matchQuery = {
      action: { $in: ["email_lookup", "username_scan", "phone_lookup", "metadata_extraction"] }
    };
    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate);
    }
    const peakHours = await import_AdminLog.default.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $hour: "$timestamp" },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          hour: "$_id",
          count: 1,
          _id: 0
        }
      },
      { $sort: { hour: 1 } }
    ]);
    res.json({ success: true, data: peakHours });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getActivitySummary,
  getDashboardStats,
  getPeakActivity,
  getToolUsageStats,
  getTopUsers,
  getTrends
});
