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
var encryption_exports = {};
__export(encryption_exports, {
  decryptAPIKey: () => decryptAPIKey,
  encryptAPIKey: () => encryptAPIKey
});
module.exports = __toCommonJS(encryption_exports);
var import_crypto = __toESM(require("crypto"));
var import_dotenv = __toESM(require("dotenv"));
import_dotenv.default.config();
const ALGORITHM = "aes-256-cbc";
const SECRET_KEY = import_crypto.default.scryptSync(process.env.ADMIN_PANEL_SECRET || "", "salt", 32);
if (!process.env.ADMIN_PANEL_SECRET) {
  console.error("FATAL: ADMIN_PANEL_SECRET is not set in environment variables!");
}
const encryptAPIKey = (text) => {
  const iv = import_crypto.default.randomBytes(16);
  const cipher = import_crypto.default.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
};
const decryptAPIKey = (hash) => {
  try {
    const parts = hash.split(":");
    if (parts.length !== 2) return hash;
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = Buffer.from(parts[1], "hex");
    const decipher = import_crypto.default.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encryptedText, void 0, "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Decryption failed, returning raw string to prevent app crash");
    return hash;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  decryptAPIKey,
  encryptAPIKey
});
