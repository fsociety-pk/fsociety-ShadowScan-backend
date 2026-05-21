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
var Report_exports = {};
__export(Report_exports, {
  default: () => Report_default
});
module.exports = __toCommonJS(Report_exports);
var import_mongoose = __toESM(require("mongoose"));
const ReportSchema = new import_mongoose.Schema({
  caseId: { type: import_mongoose.Schema.Types.ObjectId, ref: "Case", required: true, index: true },
  template: { type: String, enum: ["fbi", "corporate"], required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: import_mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  entities: [
    {
      type: { type: String, enum: ["email", "phone", "username", "domain", "person", "organization", "ip", "location"] },
      value: String,
      confidence: { type: Number, min: 0, max: 100 }
    }
  ],
  riskLevel: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Medium" },
  findings_count: { type: Number, default: 0 },
  visualReport: { type: import_mongoose.Schema.Types.Mixed, default: null },
  syntheticDataUsed: { type: Boolean, default: false }
}, { timestamps: true });
ReportSchema.index({ caseId: 1, createdAt: -1 });
ReportSchema.index({ generatedBy: 1, createdAt: -1 });
var Report_default = import_mongoose.default.model("Report", ReportSchema);
