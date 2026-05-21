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
var analyticsRoutes_exports = {};
__export(analyticsRoutes_exports, {
  default: () => analyticsRoutes_default
});
module.exports = __toCommonJS(analyticsRoutes_exports);
var import_express = __toESM(require("express"));
var import_analyticsControllers = require("../../controllers/analyticsControllers");
var import_adminAuth = require("../../middleware/adminAuth");
var import_rateLimit = require("../../middleware/rateLimit");
const router = import_express.default.Router();
router.use(import_adminAuth.adminAuth);
router.use((0, import_rateLimit.rateLimit)("admin_analytics", { limit: 500, windowMs: 15 * 60 * 1e3 }));
router.get("/dashboard", import_analyticsControllers.getDashboardStats);
router.get("/tools-usage", import_analyticsControllers.getToolUsageStats);
router.get("/trends", import_analyticsControllers.getTrends);
router.get("/top-users", import_analyticsControllers.getTopUsers);
router.get("/activity", import_analyticsControllers.getActivitySummary);
router.get("/peak-activity", import_analyticsControllers.getPeakActivity);
var analyticsRoutes_default = router;
