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
var kaliToolsRoutes_exports = {};
__export(kaliToolsRoutes_exports, {
  default: () => kaliToolsRoutes_default
});
module.exports = __toCommonJS(kaliToolsRoutes_exports);
var import_express = require("express");
var import_fs = __toESM(require("fs"));
var import_multer = __toESM(require("multer"));
var import_kaliToolsController = require("../controllers/kaliToolsController");
var import_authMiddleware = require("../middleware/authMiddleware");
var import_kaliToolsController2 = require("../controllers/kaliToolsController");
const router = (0, import_express.Router)();
const uploadDir = "/tmp/osint-uploads";
if (!import_fs.default.existsSync(uploadDir)) {
  import_fs.default.mkdirSync(uploadDir, { recursive: true });
}
const upload = (0, import_multer.default)({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 },
  // 50MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/tiff",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  }
});
router.post("/sherlock", import_authMiddleware.protect, import_kaliToolsController.sherlockSearch);
router.get("/sherlock/stream", import_kaliToolsController2.sherlockStream);
router.post("/exiftool", import_authMiddleware.protect, upload.single("file"), import_kaliToolsController.exiftoolMetadata);
router.post("/whois", import_authMiddleware.protect, import_kaliToolsController.whoisLookup);
router.post("/nmap", import_authMiddleware.protect, import_kaliToolsController.nmapScan);
router.get("/status", import_authMiddleware.protect, import_kaliToolsController.checkToolsAvailability);
var kaliToolsRoutes_default = router;
