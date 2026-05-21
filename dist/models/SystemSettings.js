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
var SystemSettings_exports = {};
__export(SystemSettings_exports, {
  default: () => SystemSettings_default
});
module.exports = __toCommonJS(SystemSettings_exports);
var import_mongoose = __toESM(require("mongoose"));
const SystemSettingsSchema = new import_mongoose.Schema({
  enableAdminPanel: { type: Boolean, default: true },
  rateLimitPerHour: { type: Number, default: 100 },
  enableEmailLookup: { type: Boolean, default: true },
  enableUsernameScan: { type: Boolean, default: true },
  enablePhoneLookup: { type: Boolean, default: true },
  enableMetadataExtraction: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  maxFileUploadSize: { type: Number, default: 5 },
  // 5MB
  adminEmail: { type: String, default: "admin@shadowscan.local" },
  sendActivityAlerts: { type: Boolean, default: false },
  alertFrequency: {
    type: String,
    enum: ["real-time", "daily", "weekly"],
    default: "daily"
  },
  apiIntegrations: [{
    name: { type: String, required: true },
    id: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    lastChecked: { type: Date, default: Date.now },
    apiKey: { type: String }
  }],
  adminIPWhitelist: { type: [String], default: [] },
  enableIPWhitelist: { type: Boolean, default: false },
  requireReauthForSensitiveOperations: { type: Boolean, default: true }
}, { timestamps: true });
var SystemSettings_default = import_mongoose.default.model("SystemSettings", SystemSettingsSchema);
