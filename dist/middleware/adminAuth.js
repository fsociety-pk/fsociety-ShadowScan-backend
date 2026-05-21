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
var adminAuth_exports = {};
__export(adminAuth_exports, {
  adminAuth: () => adminAuth
});
module.exports = __toCommonJS(adminAuth_exports);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var import_roleCheck = require("../utils/roleCheck");
var import_env = require("../config/env");
const adminAuth = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = import_jsonwebtoken.default.verify(
        token,
        (0, import_env.getJwtSecret)()
      );
      if (!(0, import_roleCheck.isAdmin)(decoded)) {
        return res.status(403).json({
          success: false,
          message: "Access denied: Admin privileges required"
        });
      }
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized: Invalid or expired token"
      });
    }
  }
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized: No token provided"
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  adminAuth
});
