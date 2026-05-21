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
var Finding_exports = {};
__export(Finding_exports, {
  default: () => Finding_default
});
module.exports = __toCommonJS(Finding_exports);
var import_mongoose = __toESM(require("mongoose"));
const FindingSchema = new import_mongoose.Schema({
  caseId: { type: import_mongoose.Schema.Types.ObjectId, ref: "Case", required: true, index: true },
  findingType: {
    type: String,
    enum: ["email_lookup", "username_search", "phone_lookup", "breach", "metadata", "other"],
    required: true,
    index: true
  },
  source: { type: String, required: true, index: true },
  email: { type: String, index: true, sparse: true },
  username: { type: String, index: true, sparse: true },
  phone: { type: String, index: true, sparse: true },
  domain: { type: String, index: true, sparse: true },
  data: { type: import_mongoose.Schema.Types.Mixed, required: true },
  confidence: { type: Number, min: 0, max: 100, default: 75 },
  isVerified: { type: Boolean, default: false },
  tags: [{ type: String }]
}, { timestamps: true });
FindingSchema.index({ caseId: 1, findingType: 1 });
FindingSchema.index({ caseId: 1, createdAt: -1 });
FindingSchema.index({ email: 1, phone: 1, username: 1 });
var Finding_default = import_mongoose.default.model("Finding", FindingSchema);
