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
var Case_exports = {};
__export(Case_exports, {
  default: () => Case_default
});
module.exports = __toCommonJS(Case_exports);
var import_mongoose = __toESM(require("mongoose"));
const CaseSchema = new import_mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Medium", index: true },
  category: { type: String, required: true, index: true },
  clues: [{ type: String }],
  notes: { type: String, default: "" },
  status: { type: String, enum: ["Active", "Closed", "Archived"], default: "Active", index: true },
  targetProfile: {
    name: String,
    email: String,
    phone: String,
    organization: String,
    location: String,
    socialMedia: String,
    additionalNotes: String
  },
  createdBy: { type: import_mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  toolsSuggested: [{ type: String }],
  findings: [{ type: import_mongoose.Schema.Types.ObjectId, ref: "Finding", index: true }],
  reportGenerated: { type: Boolean, default: false, index: true },
  reportTemplate: { type: String, enum: ["fbi", "corporate"], sparse: true },
  lastReportId: { type: import_mongoose.Schema.Types.ObjectId, ref: "Report", sparse: true },
  tags: [{ type: String, index: true }]
}, { timestamps: true });
CaseSchema.index({ title: "text", description: "text", notes: "text" });
CaseSchema.index({ createdBy: 1, createdAt: -1 });
var Case_default = import_mongoose.default.model("Case", CaseSchema);
