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
var toolRoutes_exports = {};
__export(toolRoutes_exports, {
  default: () => toolRoutes_default
});
module.exports = __toCommonJS(toolRoutes_exports);
var import_express = require("express");
var import_multer = __toESM(require("multer"));
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_toolController = require("../controllers/toolController");
var import_authMiddleware = require("../middleware/authMiddleware");
var import_checkSettings = require("../middleware/checkSettings");
const router = (0, import_express.Router)();
const uploadsDir = import_path.default.join(process.cwd(), "uploads");
if (!import_fs.default.existsSync(uploadsDir)) {
  import_fs.default.mkdirSync(uploadsDir, { recursive: true });
}
router.use(import_authMiddleware.protect);
router.use(import_checkSettings.checkSettings);
const storage = import_multer.default.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + import_path.default.extname(file.originalname));
  }
});
const upload = (0, import_multer.default)({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
  // 100MB
});
router.post("/email-lookup", import_toolController.emailLookup);
router.post("/username-lookup", import_toolController.usernameLookup);
router.post("/extract-metadata", upload.single("file"), import_toolController.extractMetadata);
router.post("/phone-lookup-pk", import_toolController.phoneLookupPK);
router.post("/nexus-lookup", import_toolController.nexusOSINTLookup);
router.post("/network-recon", import_toolController.networkRecon);
router.post("/image-osint", upload.single("file"), import_toolController.imageOSINT);
var toolRoutes_default = router;
