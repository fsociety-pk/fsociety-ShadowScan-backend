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
var adminAudit_exports = {};
__export(adminAudit_exports, {
  adminAudit: () => adminAudit
});
module.exports = __toCommonJS(adminAudit_exports);
var import_AdminLog = __toESM(require("../models/AdminLog"));
const adminAudit = async (req, res, next) => {
  const start = Date.now();
  res.on("finish", async () => {
    try {
      if (!req.user) return;
      const actionMapping = {
        "GET": "viewed",
        "POST": "created/performed",
        "PATCH": "updated",
        "PUT": "updated",
        "DELETE": "deleted"
      };
      let action = "admin_action";
      if (req.path.includes("block")) action = "user_blocked";
      else if (req.path.includes("unblock")) action = "user_blocked";
      if (req.path.includes("user")) {
        if (req.method === "POST") action = "user_created";
        else if (req.method === "DELETE") action = "user_deleted";
        else if (req.path.includes("block")) action = "user_blocked";
      }
      await import_AdminLog.default.create({
        userId: req.user.id,
        action,
        timestamp: /* @__PURE__ */ new Date(),
        toolName: "AdminPanel",
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.method !== "GET" ? req.body : {},
          status: res.statusCode,
          duration: `${Date.now() - start}ms`
        },
        ipAddress: req.ip || req.get("x-forwarded-for") || "unknown",
        status: res.statusCode < 400 ? "success" : "failed"
      });
    } catch (error) {
      console.error("Audit Log Error:", error);
    }
  });
  next();
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  adminAudit
});
