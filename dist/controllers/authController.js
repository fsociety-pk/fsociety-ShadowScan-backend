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
var authController_exports = {};
__export(authController_exports, {
  checkAdmin: () => checkAdmin,
  loginUser: () => loginUser,
  registerUser: () => registerUser,
  sudoElevate: () => sudoElevate
});
module.exports = __toCommonJS(authController_exports);
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var import_User = __toESM(require("../models/User"));
var import_AdminLog = __toESM(require("../models/AdminLog"));
var import_SystemSettings = __toESM(require("../models/SystemSettings"));
var import_env = require("../config/env");
const generateToken = (id, role) => {
  return import_jsonwebtoken.default.sign({ id, role }, (0, import_env.getJwtSecret)(), {
    expiresIn: "30d"
  });
};
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const query = { $or: [{ username }] };
    if (email) {
      query.$or.push({ email });
    }
    const userExists = await import_User.default.findOne(query);
    if (userExists) {
      res.status(400).json({
        success: false,
        message: "Username already exists"
      });
      return;
    }
    const salt = await import_bcryptjs.default.genSalt(10);
    const passwordHash = await import_bcryptjs.default.hash(password, salt);
    const user = await import_User.default.create({
      username,
      email,
      passwordHash,
      role: "user"
      // explicit default
    });
    await import_AdminLog.default.create({
      userId: user._id,
      action: "user_created",
      toolName: "AuthSystem",
      details: { username: user.username, email: user.email },
      ipAddress: req.ip || req.get("x-forwarded-for") || "unknown",
      status: "success"
    });
    if (user) {
      res.status(201).json({
        _id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        points: user.points,
        token: generateToken(user.id, user.role)
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid user data"
      });
    }
  } catch (error) {
    if (error.code === 11e3) {
      res.status(400).json({
        success: false,
        message: "Username already exists"
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await import_User.default.findOne({ username });
    if (user && await import_bcryptjs.default.compare(password, user.passwordHash)) {
      if (user.role === "admin") {
        const settings = await import_SystemSettings.default.findOne();
        if (settings && settings.enableIPWhitelist && settings.adminIPWhitelist && settings.adminIPWhitelist.length > 0) {
          const clientIp = req.headers["x-forwarded-for"] || req.ip || "unknown";
          if (!settings.adminIPWhitelist.includes(clientIp)) {
            await import_AdminLog.default.create({
              userId: user._id,
              action: "login_attempt",
              toolName: "AuthSystem",
              details: { username: user.username, reason: "IP Address blocked by Admin IP Whitelist" },
              ipAddress: clientIp,
              status: "failed"
            });
            res.status(403).json({ success: false, message: "Access denied from this IP address." });
            return;
          }
        }
      }
      res.json({
        _id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        points: user.points,
        token: generateToken(user.id, user.role)
      });
      await import_AdminLog.default.create({
        userId: user._id,
        action: "login_attempt",
        toolName: "AuthSystem",
        details: { username: user.username },
        ipAddress: req.ip || req.get("x-forwarded-for") || "unknown",
        status: "success"
      });
    } else {
      if (user) {
        await import_AdminLog.default.create({
          userId: user._id,
          action: "login_attempt",
          toolName: "AuthSystem",
          details: { username: user.username, reason: "Invalid password" },
          ipAddress: req.ip || req.get("x-forwarded-for") || "unknown",
          status: "failed"
        });
      }
      res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
const checkAdmin = async (req, res) => {
  try {
    if (req.user && req.user.role === "admin") {
      const settings = await import_SystemSettings.default.findOne();
      if (settings && settings.enableAdminPanel === false) {
        res.json({ isAdmin: false, message: "Admin panel is currently disabled system-wide." });
        return;
      }
      res.json({ isAdmin: true });
    } else {
      res.json({ isAdmin: false });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
const sudoElevate = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }
    const user = await import_User.default.findById(userId);
    if (!user || user.role !== "admin" || !await import_bcryptjs.default.compare(password, user.passwordHash)) {
      res.status(403).json({ success: false, message: "Invalid password" });
      return;
    }
    const sudoToken = import_jsonwebtoken.default.sign(
      { id: user.id, type: "sudo" },
      (0, import_env.getJwtSecret)(),
      { expiresIn: "15m" }
    );
    res.json({ success: true, sudoToken });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkAdmin,
  loginUser,
  registerUser,
  sudoElevate
});
