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
var AdminAuditLog_exports = {};
__export(AdminAuditLog_exports, {
  default: () => AdminAuditLog_default
});
module.exports = __toCommonJS(AdminAuditLog_exports);
var import_mongoose = __toESM(require("mongoose"));
const AdminAuditLogSchema = new import_mongoose.Schema({
  adminId: { type: import_mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true },
  endpoint: { type: String, required: true },
  method: { type: String, required: true },
  ipAddress: { type: String, required: true },
  changes: { type: import_mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
}, {
  // Make collection strictly immutable
  capped: { size: 1024 * 1024 * 50, max: 1e5, autoIndexId: true }
});
var AdminAuditLog_default = import_mongoose.default.model("AdminAuditLog", AdminAuditLogSchema);
