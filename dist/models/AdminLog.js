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
var AdminLog_exports = {};
__export(AdminLog_exports, {
  default: () => AdminLog_default
});
module.exports = __toCommonJS(AdminLog_exports);
var import_mongoose = __toESM(require("mongoose"));
const AdminLogSchema = new import_mongoose.Schema({
  userId: { type: import_mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: {
    type: String,
    enum: [
      "email_lookup",
      "username_scan",
      "phone_lookup",
      "metadata_extraction",
      "user_created",
      "user_deleted",
      "user_blocked",
      "login_attempt",
      "password_reset_request",
      "admin_action",
      "admin_promotion",
      "api_toggle",
      "api_rotate",
      "settings_update",
      "maintenance_toggle",
      "network_recon",
      "sherlock_search",
      "exiftool_metadata",
      "whois_lookup",
      "nmap_scan",
      "social_media_finder",
      "intelligence_report_generated"
    ],
    required: true
  },
  timestamp: { type: Date, default: Date.now },
  toolName: { type: String, required: true },
  details: { type: import_mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  status: { type: String, enum: ["success", "failed"], required: true }
});
var AdminLog_default = import_mongoose.default.model("AdminLog", AdminLogSchema);
