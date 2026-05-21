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
var caseController_exports = {};
__export(caseController_exports, {
  createCase: () => createCase,
  deleteCase: () => deleteCase,
  getCaseById: () => getCaseById,
  getCases: () => getCases,
  updateCase: () => updateCase
});
module.exports = __toCommonJS(caseController_exports);
var import_Case = __toESM(require("../models/Case"));
const getCases = async (req, res) => {
  try {
    const userId = req.user?.id;
    const cases = await import_Case.default.find({ createdBy: userId }).sort({ createdAt: -1 });
    res.json(cases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getCaseById = async (req, res) => {
  try {
    const userId = req.user?.id;
    const investigation = await import_Case.default.findOne({ _id: req.params.id, createdBy: userId });
    if (!investigation) {
      return res.status(404).json({ message: "Investigation case not found or access denied." });
    }
    res.json(investigation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const createCase = async (req, res) => {
  try {
    const {
      title,
      description,
      rawFindings,
      category,
      priority,
      clues,
      toolsSuggested,
      notes,
      targetProfile,
      images
    } = req.body;
    const normalizedDescription = typeof description === "string" && description.trim() ? description.trim() : typeof rawFindings === "string" ? rawFindings.trim() : "";
    if (!title || !category || !normalizedDescription) {
      return res.status(400).json({
        message: "title, category, and description/rawFindings are required."
      });
    }
    const inferredClues = Array.isArray(clues) ? clues : typeof rawFindings === "string" ? rawFindings.split("\n").map((line) => line.trim()).filter(Boolean) : [];
    const imageSummary = Array.isArray(images) && images.length > 0 ? `

Attached images:
${images.map((img, index) => `- ${img.label || img.fileName || `image-${index + 1}`}`).join("\n")}` : "";
    const newCase = await import_Case.default.create({
      title,
      description: normalizedDescription,
      category,
      priority,
      clues: inferredClues,
      notes: `${notes || ""}${imageSummary}`.trim(),
      createdBy: req.user?.id,
      toolsSuggested: toolsSuggested || [],
      targetProfile: targetProfile || {},
      status: "Active"
    });
    res.status(201).json({ message: "Investigation case created", id: newCase._id });
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};
const updateCase = async (req, res) => {
  try {
    const userId = req.user?.id;
    const updatedCase = await import_Case.default.findOneAndUpdate(
      { _id: req.params.id, createdBy: userId },
      req.body,
      { returnDocument: "after" }
    );
    if (!updatedCase) {
      return res.status(404).json({ message: "Investigation case not found or access denied." });
    }
    res.json(updatedCase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const deleteCase = async (req, res) => {
  try {
    const userId = req.user?.id;
    const deletedCase = await import_Case.default.findOneAndDelete({ _id: req.params.id, createdBy: userId });
    if (!deletedCase) {
      return res.status(404).json({ message: "Investigation case not found or access denied." });
    }
    res.json({ message: "Investigation case archived/deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCase,
  deleteCase,
  getCaseById,
  getCases,
  updateCase
});
