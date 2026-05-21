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
var SystemMetrics_exports = {};
__export(SystemMetrics_exports, {
  default: () => SystemMetrics_default
});
module.exports = __toCommonJS(SystemMetrics_exports);
var import_mongoose = __toESM(require("mongoose"));
const SystemMetricsSchema = new import_mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  totalScans: { type: Number, default: 0 },
  totalUsers: { type: Number, default: 0 },
  activeUsers: { type: Number, default: 0 },
  toolUsageBreakdown: {
    email: { type: Number, default: 0 },
    username: { type: Number, default: 0 },
    phone: { type: Number, default: 0 },
    metadata: { type: Number, default: 0 }
  },
  topUsers: [{
    userId: { type: import_mongoose.Schema.Types.ObjectId, ref: "User" },
    scanCount: { type: Number, default: 0 }
  }]
});
var SystemMetrics_default = import_mongoose.default.model("SystemMetrics", SystemMetricsSchema);
