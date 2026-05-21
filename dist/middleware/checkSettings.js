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
var checkSettings_exports = {};
__export(checkSettings_exports, {
  checkSettings: () => checkSettings
});
module.exports = __toCommonJS(checkSettings_exports);
var import_SystemSettings = __toESM(require("../models/SystemSettings"));
let cachedSettings = null;
let lastFetch = 0;
const CACHE_TTL = 3e4;
const getSettings = async () => {
  const now = Date.now();
  if (!cachedSettings || now - lastFetch > CACHE_TTL) {
    cachedSettings = await import_SystemSettings.default.findOne();
    lastFetch = now;
  }
  return cachedSettings;
};
const checkSettings = async (req, res, next) => {
  try {
    const settings = await getSettings();
    if (!settings) return next();
    const isAdmin = req.user?.role === "admin";
    if (settings.maintenanceMode && !isAdmin) {
      return res.status(503).json({
        success: false,
        message: "PLATFORM_UNDER_MAINTENANCE: The ShadowScan grid is currently undergoing scheduled optimization. Access is restricted.",
        retryAfter: 3600
      });
    }
    const path = req.path;
    if (path.includes("/api/tools/email-lookup") && !settings.enableEmailLookup) {
      return res.status(403).json({ success: false, message: "INTELLIGENCE_DENIED: Email lookup capability is currently offline." });
    }
    if (path.includes("/api/tools/username-lookup") && !settings.enableUsernameScan) {
      return res.status(403).json({ success: false, message: "INTELLIGENCE_DENIED: Username intelligence node is currently offline." });
    }
    if (path.includes("/api/tools/phone-lookup-pk") && !settings.enablePhoneLookup) {
      return res.status(403).json({ success: false, message: "INTELLIGENCE_DENIED: Pakistan Phone Intelligence grid is currently offline." });
    }
    if (path.includes("/api/tools/extract-metadata") && !settings.enableMetadataExtraction) {
      return res.status(403).json({ success: false, message: "INTELLIGENCE_DENIED: Metadata forensic extraction is currently offline." });
    }
    next();
  } catch (error) {
    console.error("Settings Check Error:", error);
    next();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkSettings
});
