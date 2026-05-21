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
var roleCheck_exports = {};
__export(roleCheck_exports, {
  hasSufficientPoints: () => hasSufficientPoints,
  isActive: () => isActive,
  isAdmin: () => isAdmin
});
module.exports = __toCommonJS(roleCheck_exports);
const isAdmin = (user) => {
  return user && user.role === "admin";
};
const isActive = (user) => {
  return user && user.isActive === true;
};
const hasSufficientPoints = (user, requiredPoints) => {
  return (user.points || 0) >= requiredPoints;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  hasSufficientPoints,
  isActive,
  isAdmin
});
