"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var socialMediaFinderRoutes_exports = {};
__export(socialMediaFinderRoutes_exports, {
  default: () => socialMediaFinderRoutes_default
});
module.exports = __toCommonJS(socialMediaFinderRoutes_exports);
var import_express = require("express");
var import_socialMediaFinderController = require("../controllers/socialMediaFinderController");
var import_authMiddleware = require("../middleware/authMiddleware");
const router = (0, import_express.Router)();
router.post("/find", import_authMiddleware.protect, import_socialMediaFinderController.findSocialMediaProfiles);
router.post("/quick", import_authMiddleware.protect, import_socialMediaFinderController.quickSocialMediaLookup);
var socialMediaFinderRoutes_default = router;
