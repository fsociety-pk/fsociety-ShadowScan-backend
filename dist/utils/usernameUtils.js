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
var usernameUtils_exports = {};
__export(usernameUtils_exports, {
  generateUsernameVariations: () => generateUsernameVariations
});
module.exports = __toCommonJS(usernameUtils_exports);
const generateUsernameVariations = (username) => {
  const variations = /* @__PURE__ */ new Set();
  const cleaned = username.trim();
  variations.add(cleaned);
  variations.add(cleaned.toLowerCase());
  variations.add(cleaned.toUpperCase());
  variations.add(cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase());
  const parts = cleaned.split(/[\s._-]/);
  if (parts.length > 1) {
    const p = parts.filter((part) => part.length > 0);
    variations.add(p.join(""));
    variations.add(p.join("_"));
    variations.add(p.join("."));
    variations.add(p.join("-"));
  }
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  variations.add(`${cleaned}${currentYear}`);
  variations.add(`${cleaned}123`);
  if (cleaned.includes("l") || cleaned.includes("o") || cleaned.includes("i")) {
    let swapped = cleaned.toLowerCase().replace(/l/g, "1").replace(/o/g, "0").replace(/i/g, "1");
    variations.add(swapped);
  }
  return Array.from(variations).slice(0, 15);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateUsernameVariations
});
