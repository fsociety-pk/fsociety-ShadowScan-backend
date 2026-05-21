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
var userController_exports = {};
__export(userController_exports, {
  getProfile: () => getProfile
});
module.exports = __toCommonJS(userController_exports);
var import_User = __toESM(require("../models/User"));
const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const user = await import_User.default.findById(userId).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      user,
      stats: {
        // Logic for personal stats can be added here
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getProfile
});
