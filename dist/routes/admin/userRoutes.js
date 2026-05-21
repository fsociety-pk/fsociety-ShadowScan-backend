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
var userRoutes_exports = {};
__export(userRoutes_exports, {
  default: () => userRoutes_default
});
module.exports = __toCommonJS(userRoutes_exports);
var import_express = __toESM(require("express"));
var import_adminControllers = require("../../controllers/adminControllers");
var import_adminAuth = require("../../middleware/adminAuth");
var import_adminSecurity = require("../../middleware/adminSecurity");
const router = import_express.default.Router();
router.use(import_adminAuth.adminAuth);
router.get("/", import_adminControllers.getAllUsers);
router.post("/", import_adminControllers.createUser);
router.get("/:id", import_adminControllers.getUserDetails);
router.patch("/:id", import_adminControllers.updateUser);
router.delete("/:id", import_adminSecurity.requireReauth, import_adminControllers.deleteUser);
router.post("/:id/block", (req, res) => {
  req.body.isActive = false;
  (0, import_adminControllers.toggleUserStatus)(req, res);
});
router.post("/:id/unblock", (req, res) => {
  req.body.isActive = true;
  (0, import_adminControllers.toggleUserStatus)(req, res);
});
router.post("/:id/reset-password", import_adminSecurity.requireReauth, import_adminControllers.resetUserPassword);
var userRoutes_default = router;
