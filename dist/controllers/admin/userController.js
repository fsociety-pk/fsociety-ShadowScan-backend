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
  blockUser: () => blockUser,
  createUser: () => createUser,
  deleteUser: () => deleteUser,
  getUsers: () => getUsers,
  unblockUser: () => unblockUser,
  updateUser: () => updateUser
});
module.exports = __toCommonJS(userController_exports);
var import_User = __toESM(require("../../models/User"));
const getUsers = async (req, res) => {
  try {
    const users = await import_User.default.find().select("-passwordHash");
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const deleteUser = async (req, res) => {
  try {
    const user = await import_User.default.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const createUser = async (req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet" });
};
const updateUser = async (req, res) => {
  try {
    const user = await import_User.default.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after" }).select("-passwordHash");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const blockUser = async (req, res) => {
  try {
    const user = await import_User.default.findByIdAndUpdate(req.params.id, { isActive: false }, { returnDocument: "after" });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User blocked", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const unblockUser = async (req, res) => {
  try {
    const user = await import_User.default.findByIdAndUpdate(req.params.id, { isActive: true }, { returnDocument: "after" });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User unblocked", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  blockUser,
  createUser,
  deleteUser,
  getUsers,
  unblockUser,
  updateUser
});
