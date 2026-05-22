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
var smartFilterService_exports = {};
__export(smartFilterService_exports, {
  SmartFilterService: () => SmartFilterService,
  default: () => smartFilterService_default
});
module.exports = __toCommonJS(smartFilterService_exports);
class SmartFilterService {
  /**
   * Normalize result status to standard format
   */
  static normalizeStatus(result) {
    const status = String(result.status || result.found ? "found" : "").toLowerCase();
    if (status === "found" || result.found === true) return "found";
    if (status === "rate_limit" || status === "ratelimit") return "rate_limit";
    if (status === "error" || result.error) return "error";
    return "not_found";
  }
  /**
   * Get confidence score (0-100)
   */
  static getConfidence(result) {
    if (typeof result.confidence === "number") return result.confidence;
    if (typeof result.confidence === "string") {
      const numeric = parseInt(result.confidence);
      return isNaN(numeric) ? 50 : numeric;
    }
    if (result.statusCode === 200) return 90;
    if (result.statusCode === 404) return 10;
    if (result.verified === true) return 85;
    return 50;
  }
  /**
   * Filter results based on configuration
   */
  static filter(results, config = {}) {
    let filtered = [...results];
    if (config.status && config.status.length > 0) {
      filtered = filtered.filter(
        (r) => config.status.includes(this.normalizeStatus(r))
      );
    }
    if (config.confidence !== void 0 && config.confidence > 0) {
      filtered = filtered.filter(
        (r) => this.getConfidence(r) >= config.confidence
      );
    }
    if (config.search) {
      const term = config.search.toLowerCase();
      filtered = filtered.filter(
        (r) => r.platform?.toLowerCase().includes(term) || r.url?.toLowerCase().includes(term) || r.message?.toLowerCase().includes(term)
      );
    }
    return filtered;
  }
  /**
   * Sort results
   */
  static sort(results, by = "confidence") {
    const sorted = [...results];
    if (by === "confidence") {
      sorted.sort((a, b) => this.getConfidence(b) - this.getConfidence(a));
    } else if (by === "platform") {
      sorted.sort(
        (a, b) => (a.platform || "").localeCompare(b.platform || "")
      );
    } else if (by === "status") {
      const statusOrder = { found: 0, rate_limit: 1, error: 2, not_found: 3 };
      sorted.sort((a, b) => {
        const aStatus = this.normalizeStatus(a);
        const bStatus = this.normalizeStatus(b);
        return (statusOrder[aStatus] || 999) - (statusOrder[bStatus] || 999);
      });
    }
    return sorted;
  }
  /**
   * Categorize results by status
   */
  static categorize(results) {
    const categories = {
      found: [],
      rate_limit: [],
      error: [],
      not_found: []
    };
    results.forEach((result) => {
      const status = this.normalizeStatus(result);
      if (categories[status]) {
        categories[status].push(result);
      }
    });
    return categories;
  }
  /**
   * Get statistics about results
   */
  static getStats(results) {
    const categories = this.categorize(results);
    const confidences = results.map((r) => this.getConfidence(r));
    const verified = results.filter((r) => r.verified === true).length;
    return {
      total: results.length,
      found: categories.found.length,
      notFound: categories.not_found.length,
      rateLimit: categories.rate_limit.length,
      error: categories.error.length,
      averageConfidence: confidences.length > 0 ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0,
      verifiedCount: verified
    };
  }
  /**
   * Generate a full result with filtering and stats
   */
  static generateFullResults(results, config = {}) {
    const filtered = this.filter(results, config);
    const sorted = this.sort(filtered, config.sort);
    const categories = this.categorize(sorted);
    const stats = this.getStats(sorted);
    return {
      results: sorted,
      stats,
      categories,
      filters_applied: config
    };
  }
  /**
   * Clean and normalize results for frontend
   */
  static normalizeForFrontend(results) {
    return results.map((result) => ({
      ...result,
      status: this.normalizeStatus(result),
      confidence: this.getConfidence(result),
      isVerified: result.verified === true,
      platform: result.platform || "Unknown"
    }));
  }
}
var smartFilterService_default = SmartFilterService;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SmartFilterService
});
