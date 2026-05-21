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
var searchController_exports = {};
__export(searchController_exports, {
  getCaseFindings: () => getCaseFindings,
  globalSearch: () => globalSearch,
  searchFindings: () => searchFindings
});
module.exports = __toCommonJS(searchController_exports);
var import_Case = __toESM(require("../models/Case"));
var import_Finding = __toESM(require("../models/Finding"));
const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user?.id;
    if (!q) {
      return res.status(400).json({ message: "Missing search query" });
    }
    const query = q;
    const cases = await import_Case.default.find({
      $text: { $search: query },
      createdBy: userId
    }).limit(20);
    res.json({
      cases,
      entities: []
      // Return empty array to maintain frontend compatibility if needed
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const searchFindings = async (req, res) => {
  try {
    const { q, type, caseId, source } = req.query;
    const userId = req.user?.id;
    if (!q) {
      return res.status(400).json({ message: "Missing search query" });
    }
    const query = q;
    const searchFilter = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9\-\s\(\)]{7,}$/;
    if (emailRegex.test(query)) {
      searchFilter.email = { $regex: query, $options: "i" };
    } else if (phoneRegex.test(query)) {
      searchFilter.phone = { $regex: query, $options: "i" };
    } else {
      searchFilter.$or = [
        { email: { $regex: query, $options: "i" } },
        { username: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
        { domain: { $regex: query, $options: "i" } }
      ];
    }
    if (type) {
      searchFilter.findingType = type;
    }
    if (source) {
      searchFilter.source = source;
    }
    let caseFilter = {};
    if (caseId) {
      searchFilter.caseId = caseId;
    } else {
      const userCases = await import_Case.default.find({ createdBy: userId }).select("_id");
      const caseIds = userCases.map((c) => c._id);
      searchFilter.caseId = { $in: caseIds };
    }
    const findings = await import_Finding.default.find(searchFilter).populate("caseId", "title").sort({ createdAt: -1 }).limit(50);
    const groupedFindings = findings.reduce((acc, finding) => {
      if (!acc[finding.findingType]) {
        acc[finding.findingType] = [];
      }
      acc[finding.findingType].push(finding);
      return acc;
    }, {});
    res.json({
      success: true,
      query,
      totalResults: findings.length,
      findings,
      grouped: groupedFindings,
      summary: {
        total: findings.length,
        byType: Object.entries(groupedFindings).reduce(
          (acc, [type2, items]) => {
            acc[type2] = items.length;
            return acc;
          },
          {}
        ),
        bySource: findings.reduce((acc, f) => {
          acc[f.source] = (acc[f.source] || 0) + 1;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getCaseFindings = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { type, source } = req.query;
    const filter = { caseId };
    if (type) {
      filter.findingType = type;
    }
    if (source) {
      filter.source = source;
    }
    const findings = await import_Finding.default.find(filter).sort({ createdAt: -1 });
    const stats = {
      total: findings.length,
      byType: {},
      bySource: {},
      highConfidence: findings.filter((f) => f.confidence >= 80).length,
      verified: findings.filter((f) => f.isVerified).length
    };
    findings.forEach((f) => {
      stats.byType[f.findingType] = (stats.byType[f.findingType] || 0) + 1;
      stats.bySource[f.source] = (stats.bySource[f.source] || 0) + 1;
    });
    res.json({
      success: true,
      caseId,
      findings,
      stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getCaseFindings,
  globalSearch,
  searchFindings
});
