"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_dotenv = __toESM(require("dotenv"));
var import_User = __toESM(require("../models/User"));
var import_db = __toESM(require("../config/db"));
import_dotenv.default.config();
const seedAdmin = async () => {
  try {
    await (0, import_db.default)();
    const adminEmail = "admin@shadowscan.local";
    const newUsername = "spyhunter";
    const newPassword = process.env.INITIAL_ADMIN_PASSWORD || "ChangeMe123!";
    if (!process.env.INITIAL_ADMIN_PASSWORD) {
      console.warn("\u26A0\uFE0F WARNING: INITIAL_ADMIN_PASSWORD not set in .env. Using default insecure password.");
    }
    let adminUser = await import_User.default.findOne({
      $or: [
        { username: "admin" },
        { username: newUsername },
        { email: adminEmail }
      ]
    });
    const salt = await import_bcryptjs.default.genSalt(10);
    const passwordHash = await import_bcryptjs.default.hash(newPassword, salt);
    if (adminUser) {
      console.log("Updating existing admin user credentials...");
      adminUser.username = newUsername;
      adminUser.passwordHash = passwordHash;
      adminUser.role = "admin";
      adminUser.isActive = true;
      await adminUser.save();
      console.log("\u2705 Admin credentials updated successfully!");
    } else {
      console.log("Creating new admin user...");
      await import_User.default.create({
        username: newUsername,
        email: adminEmail,
        passwordHash,
        role: "admin",
        points: 1e3,
        totalScans: 0,
        isActive: true
      });
      console.log("\u2705 Admin user created successfully!");
    }
    console.log(`Username: ${newUsername}`);
    console.log(`Password: ${newPassword}`);
    process.exit(0);
  } catch (error) {
    console.error("\u274C Error seeding admin:", error);
    process.exit(1);
  }
};
seedAdmin();
