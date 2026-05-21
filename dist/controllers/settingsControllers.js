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
var settingsControllers_exports = {};
__export(settingsControllers_exports, {
  getAPIIntegrations: () => getAPIIntegrations,
  getSettings: () => getSettings,
  rotateAPIKeys: () => rotateAPIKeys,
  toggleAPIIntegration: () => toggleAPIIntegration,
  updateSettings: () => updateSettings
});
module.exports = __toCommonJS(settingsControllers_exports);
var import_SystemSettings = __toESM(require("../models/SystemSettings"));
var import_AdminLog = __toESM(require("../models/AdminLog"));
var import_encryption = require("../utils/encryption");
const getSettings = async (req, res) => {
  try {
    let settings = await import_SystemSettings.default.findOne();
    if (!settings) {
      settings = await import_SystemSettings.default.create({
        enableAdminPanel: true,
        rateLimitPerHour: 100,
        enableEmailLookup: true,
        enableUsernameScan: true,
        enablePhoneLookup: true,
        enableMetadataExtraction: true,
        maintenanceMode: false,
        maxFileUploadSize: 5,
        adminEmail: "admin@shadowscan.local",
        sendActivityAlerts: false,
        alertFrequency: "daily",
        apiIntegrations: [
          { name: "HaveIBeenPwned", id: "hibp", isActive: true },
          { name: "Gravatar", id: "gravatar", isActive: true },
          { name: "Microsoft Credential API", id: "ms_cred", isActive: false }
        ],
        adminIPWhitelist: [],
        enableIPWhitelist: false,
        requireReauthForSensitiveOperations: true
      });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const updateSettings = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    if (!updateData.apiIntegrations || updateData.apiIntegrations.length === 0) {
      delete updateData.apiIntegrations;
    }
    if (updateData.enableIPWhitelist === true && (!updateData.adminIPWhitelist || updateData.adminIPWhitelist.length === 0)) {
      const clientIp = req.headers["x-forwarded-for"] || req.ip || "unknown";
      updateData.adminIPWhitelist = [clientIp];
    }
    const settings = await import_SystemSettings.default.findOneAndUpdate({}, updateData, { returnDocument: "after", upsert: true });
    await import_AdminLog.default.create({
      userId: req.user.id,
      action: "admin_action",
      toolName: "AdminPanel",
      details: { action: "update_settings", changes: updateData },
      status: "success"
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("SYSTEM_SETTINGS_SAVE_FAILURE:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
const getAPIIntegrations = async (req, res) => {
  try {
    const settings = await import_SystemSettings.default.findOne();
    const integrations = settings?.apiIntegrations.map((api) => ({
      name: api.name,
      id: api.id,
      isActive: api.isActive,
      lastChecked: api.lastChecked,
      hasKey: !!api.apiKey
    })) || [];
    res.json({ success: true, data: integrations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const toggleAPIIntegration = async (req, res) => {
  try {
    const { apiId, status } = req.body;
    const settings = await import_SystemSettings.default.findOneAndUpdate(
      { "apiIntegrations.id": apiId },
      { "$set": { "apiIntegrations.$.isActive": status, "apiIntegrations.$.lastChecked": /* @__PURE__ */ new Date() } },
      { returnDocument: "after" }
    );
    if (!settings) return res.status(404).json({ success: false, message: "API integration not found" });
    await import_AdminLog.default.create({
      userId: req.user.id,
      action: "admin_action",
      toolName: "AdminPanel",
      details: { action: "toggle_api", apiId, status },
      status: "success"
    });
    res.json({ success: true, message: `API ${apiId} ${status ? "enabled" : "disabled"}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const rotateAPIKeys = async (req, res) => {
  try {
    const { apiId } = req.body;
    const newRawKey = `rotated_${Math.random().toString(36).slice(-16)}`;
    const encryptedKey = (0, import_encryption.encryptAPIKey)(newRawKey);
    await import_SystemSettings.default.findOneAndUpdate(
      { "apiIntegrations.id": apiId },
      { "$set": { "apiIntegrations.$.apiKey": encryptedKey, "apiIntegrations.$.lastChecked": /* @__PURE__ */ new Date() } }
    );
    await import_AdminLog.default.create({
      userId: req.user.id,
      action: "admin_action",
      toolName: "AdminPanel",
      details: { action: "rotate_api_key", apiId },
      status: "success"
    });
    res.json({
      success: true,
      message: `API Key for ${apiId} rotated successfully.`,
      newKey: newRawKey
      // Returning once as requested
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getAPIIntegrations,
  getSettings,
  rotateAPIKeys,
  toggleAPIIntegration,
  updateSettings
});
