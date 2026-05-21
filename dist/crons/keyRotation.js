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
var keyRotation_exports = {};
__export(keyRotation_exports, {
  initKeyRotationCron: () => initKeyRotationCron
});
module.exports = __toCommonJS(keyRotation_exports);
var import_node_cron = __toESM(require("node-cron"));
var import_SystemSettings = __toESM(require("../models/SystemSettings"));
var import_AdminAuditLog = __toESM(require("../models/AdminAuditLog"));
const initKeyRotationCron = () => {
  import_node_cron.default.schedule("0 0 1 * *", async () => {
    console.log("[CRON] Starting monthly API key rotation...");
    try {
      const settings = await import_SystemSettings.default.findOne();
      if (!settings) return;
      const updatedIntegrations = settings.apiIntegrations.map((api) => {
        const mockNewKey = `rotated_${Math.random().toString(36).slice(-10)}`;
        return {
          ...api,
          lastChecked: /* @__PURE__ */ new Date()
        };
      });
      await import_SystemSettings.default.updateOne({}, { $set: { apiIntegrations: updatedIntegrations } });
      await import_AdminAuditLog.default.create({
        adminId: null,
        // System action
        action: "system_cron",
        endpoint: "internal_cron_job",
        method: "CRON",
        ipAddress: "127.0.0.1",
        changes: { action: "monthly_api_key_rotation_check" },
        timestamp: /* @__PURE__ */ new Date()
      });
      console.log("[CRON] API key rotation check completed.");
    } catch (error) {
      console.error("[CRON] API key rotation failed:", error);
    }
  });
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  initKeyRotationCron
});
