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
var admin_exports = {};
__export(admin_exports, {
  default: () => admin_default
});
module.exports = __toCommonJS(admin_exports);
var import_express = __toESM(require("express"));
var import_userRoutes = __toESM(require("./userRoutes"));
var import_analyticsRoutes = __toESM(require("./analyticsRoutes"));
var import_logsRoutes = __toESM(require("./logsRoutes"));
var import_settingsRoutes = __toESM(require("./settingsRoutes"));
var import_apiManagementRoutes = __toESM(require("./apiManagementRoutes"));
var import_checkSettings = require("../../middleware/checkSettings");
var import_adminAuth = require("../../middleware/adminAuth");
var import_adminControllers = require("../../controllers/adminControllers");
var import_adminSecurity = require("../../middleware/adminSecurity");
const router = import_express.default.Router();
router.use(import_checkSettings.checkSettings);
router.use(import_adminSecurity.adminRateLimiter);
router.use(import_adminSecurity.logAdminAccess);
router.use(import_adminSecurity.validateCSRF);
router.use("/users", import_userRoutes.default);
router.use("/analytics", import_analyticsRoutes.default);
router.use("/logs", import_logsRoutes.default);
router.use("/settings", import_settingsRoutes.default);
router.use("/api-integrations", import_apiManagementRoutes.default);
router.post("/promote/:userId", import_adminAuth.adminAuth, import_adminSecurity.requireReauth, import_adminControllers.promoteUser);
var admin_default = router;
