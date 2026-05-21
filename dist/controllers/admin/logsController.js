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
var logsController_exports = {};
__export(logsController_exports, {
  getFilteredLogs: () => getFilteredLogs,
  getLogs: () => getLogs
});
module.exports = __toCommonJS(logsController_exports);
var import_AdminLog = __toESM(require("../../models/AdminLog"));
const getLogs = async (req, res) => {
  try {
    const logs = await import_AdminLog.default.find().populate("userId", "username").sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const getFilteredLogs = async (req, res) => {
  try {
    const { action, status, userId } = req.query;
    const query = {};
    if (action) query.action = action;
    if (status) query.status = status;
    if (userId) query.userId = userId;
    const logs = await import_AdminLog.default.find(query).populate("userId", "username").sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getFilteredLogs,
  getLogs
});
