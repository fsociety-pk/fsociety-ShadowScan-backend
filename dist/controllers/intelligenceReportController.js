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
var intelligenceReportController_exports = {};
__export(intelligenceReportController_exports, {
  analyzeTarget: () => analyzeTarget,
  exportReportJSON: () => exportReportJSON,
  generateIntelligenceReport: () => generateIntelligenceReport
});
module.exports = __toCommonJS(intelligenceReportController_exports);
var import_Finding = __toESM(require("../models/Finding"));
var import_Case = __toESM(require("../models/Case"));
var import_logActivity = require("../utils/logActivity");
var import_groq_sdk = __toESM(require("groq-sdk"));
const groq = new import_groq_sdk.default({
  apiKey: process.env.GROQ_API_KEY || "dummy_key"
});
function extractEntities(findings) {
  const entities = [];
  const seenEntities = /* @__PURE__ */ new Set();
  findings.forEach((finding) => {
    if (finding.data) {
      const data = finding.data;
      if (data.username && !seenEntities.has(data.username)) {
        entities.push({
          type: "username",
          value: data.username,
          source: data.platform || finding.source,
          confidence: 0.95
        });
        seenEntities.add(data.username);
      }
      if (data.email && !seenEntities.has(data.email)) {
        entities.push({
          type: "email",
          value: data.email,
          confidence: 0.9
        });
        seenEntities.add(data.email);
      }
      if (data.phone && !seenEntities.has(data.phone)) {
        entities.push({
          type: "phone",
          value: data.phone,
          confidence: 0.85
        });
        seenEntities.add(data.phone);
      }
      if (data.name && !seenEntities.has(data.name)) {
        entities.push({
          type: "name",
          value: data.name,
          confidence: 0.8
        });
        seenEntities.add(data.name);
      }
      if (data.organization && !seenEntities.has(data.organization)) {
        entities.push({
          type: "organization",
          value: data.organization,
          confidence: 0.75
        });
        seenEntities.add(data.organization);
      }
      if (data.location && !seenEntities.has(data.location)) {
        entities.push({
          type: "location",
          value: data.location,
          confidence: 0.7
        });
        seenEntities.add(data.location);
      }
    }
  });
  return entities;
}
function detectRelationships(findings, entities) {
  const relationships = [];
  const detectedPairs = /* @__PURE__ */ new Set();
  findings.forEach((finding, index) => {
    findings.forEach((otherFinding, otherIndex) => {
      if (index < otherIndex && finding.data && otherFinding.data) {
        const data1 = finding.data;
        const data2 = otherFinding.data;
        const source1 = data1.platform || finding.source;
        const source2 = data2.platform || otherFinding.source;
        const pairKey = [source1, source2].sort().join("-");
        if (!detectedPairs.has(pairKey)) {
          let strength = 0;
          let commonFields = 0;
          const evidence = [];
          if (data1.email === data2.email && data1.email) {
            strength += 0.4;
            commonFields++;
            evidence.push("Same email address");
          }
          if (data1.phone === data2.phone && data1.phone) {
            strength += 0.35;
            commonFields++;
            evidence.push("Same phone number");
          }
          if (data1.name === data2.name && data1.name) {
            strength += 0.3;
            commonFields++;
            evidence.push("Same name");
          }
          if (data1.username === data2.username && data1.username) {
            strength += 0.4;
            commonFields++;
            evidence.push("Same username");
          }
          if (strength > 0) {
            relationships.push({
              entity1: source1,
              entity2: source2,
              type: commonFields > 1 ? "Strong Connection" : "Likely Connection",
              strength: Math.min(strength, 1),
              evidence
            });
            detectedPairs.add(pairKey);
          }
        }
      }
    });
  });
  return relationships;
}
function calculateRiskScore(findings, entities) {
  let score = 0;
  const sourceCount = new Set(findings.map((f) => f.source || f.data?.platform)).size;
  score += Math.min(sourceCount * 5, 30);
  const exposedPersonalData = entities.filter((e) => e.type !== "username" && e.type !== "organization").length;
  score += exposedPersonalData * 10;
  const highRiskSources = ["tinder", "bumble", "dating", "onlyfans", "patreon"];
  const hasHighRiskSource = findings.some((f) => {
    const source = f.source || f.data?.platform || "";
    return highRiskSources.some((p) => source.toLowerCase().includes(p));
  });
  if (hasHighRiskSource) score += 20;
  if (entities.some((e) => e.type === "email")) score += 15;
  if (entities.some((e) => e.type === "phone")) score += 10;
  return Math.min(score, 100);
}
function assessRiskLevel(score) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}
function generateRiskIndicators(findings, entities) {
  const indicators = [];
  const sourceCount = new Set(findings.map((f) => f.source || f.data?.platform)).size;
  if (sourceCount > 15) {
    indicators.push({
      category: "Excessive Platform Presence",
      severity: "High",
      description: `Target found on ${sourceCount} different platforms. High digital footprint visibility.`,
      evidence: Array.from(new Set(findings.map((f) => f.source || f.data?.platform))).slice(0, 10)
    });
  }
  const uniqueEmails = new Set(findings.map((f) => f.data?.email || f.email).filter(Boolean));
  if (uniqueEmails.size > 0) {
    indicators.push({
      category: "Email-Linked Accounts",
      severity: "High",
      description: `Multiple accounts linked to same email address(es). Potential for account takeover chains.`,
      evidence: Array.from(uniqueEmails)
    });
  }
  const locations = entities.filter((e) => e.type === "location").map((e) => e.value);
  if (locations.length > 0) {
    indicators.push({
      category: "Geographic Data Exposure",
      severity: "Medium",
      description: `Target location information exposed on ${locations.length} platform(s).`,
      evidence: locations
    });
  }
  const personalData = entities.filter((e) => ["phone", "name", "email"].includes(e.type)).length;
  if (personalData >= 3) {
    indicators.push({
      category: "Personal Identifier Exposure",
      severity: "High",
      description: `Multiple personal identifiers (name, email, phone) discovered. Enables social engineering attacks.`,
      evidence: entities.filter((e) => ["phone", "name", "email"].includes(e.type)).map((e) => `${e.type}: ${e.value}`)
    });
  }
  const devSources = findings.filter((f) => {
    const source = f.source || f.data?.platform || "";
    return ["github", "gitlab", "stackoverflow", "codepen"].some((p) => source.toLowerCase().includes(p));
  });
  if (devSources.length > 0) {
    indicators.push({
      category: "Developer Account Exposure",
      severity: "Medium",
      description: `Developer accounts found. Code repositories may contain sensitive information.`,
      evidence: devSources.map((f) => f.source || f.data?.platform)
    });
  }
  return indicators;
}
const generateIntelligenceReport = async (req, res) => {
  try {
    const { caseId, username, email } = req.body;
    if (!caseId) {
      return res.status(400).json({ message: "Case ID is required" });
    }
    const targetCase = await import_Case.default.findById(caseId).lean();
    if (!targetCase) {
      return res.status(404).json({ message: "Case not found" });
    }
    const findings = await import_Finding.default.find({ caseId }).lean();
    if (findings.length === 0) {
      return res.status(400).json({ message: "No findings available for this case" });
    }
    const entities = extractEntities(findings);
    const primaryIdentifiers = entities.filter((e) => e.confidence >= 0.9);
    const secondaryIdentifiers = entities.filter((e) => e.confidence < 0.9);
    const relationships = detectRelationships(findings, entities);
    const riskScore = calculateRiskScore(findings, entities);
    const riskLevel = assessRiskLevel(riskScore);
    const riskIndicators = generateRiskIndicators(findings, entities);
    const devSources = findings.filter((f) => {
      const source = f.source || f.data?.platform || "";
      return ["github", "gitlab", "stackoverflow", "codepen"].some((p) => source.toLowerCase().includes(p));
    });
    const platformDistribution = {};
    findings.forEach((f) => {
      const source = f.source || f.data?.platform || "unknown";
      platformDistribution[source] = (platformDistribution[source] || 0) + 1;
    });
    const platformsList = Array.from(
      new Set(findings.map((f) => f.source || f.data?.platform))
    ).map((platform) => ({
      name: platform || "unknown",
      status: "Verified",
      metadata: findings.find((f) => f.source === platform || f.data?.platform === platform)?.data
    }));
    const keyFindings = [
      {
        finding: `Target identified across ${platformsList.length} unique platforms`,
        evidence: platformsList.map((p) => p.name),
        confidence: 0.95
      },
      {
        finding: `${entities.filter((e) => e.type === "email").length} email address(es) linked to accounts`,
        evidence: entities.filter((e) => e.type === "email").map((e) => e.value),
        confidence: 0.9
      },
      {
        finding: `${relationships.length} cross-platform account connections detected`,
        evidence: relationships.map((r) => `${r.entity1} \u2194 ${r.entity2}`),
        confidence: 0.85
      }
    ];
    const exposureRisk = Math.round(entities.length / 10 * 100);
    const recommendations = [];
    if (riskLevel === "High") {
      recommendations.push("Conduct comprehensive account audit and password reset across all platforms");
      recommendations.push("Enable multi-factor authentication (MFA) on all discovered accounts");
      recommendations.push("Review privacy settings on all social media platforms");
    }
    if (entities.some((e) => e.type === "phone")) {
      recommendations.push("Consider SIM swap protection through carrier security settings");
    }
    if (entities.some((e) => e.type === "email")) {
      recommendations.push("Implement email forwarding rules to detect unauthorized access attempts");
    }
    if (devSources.length > 0) {
      recommendations.push("Audit publicly accessible code repositories for sensitive information exposure");
    }
    recommendations.push("Implement email aliasing strategy to reduce account linkage");
    recommendations.push("Establish monitoring for new account registrations using known identifiers");
    let connectionStrength = 0;
    if (relationships.length > 0) {
      connectionStrength = relationships.reduce((acc, rel) => acc + rel.strength, 0) / relationships.length;
    }
    const clusterAnalysis = [];
    const highStrengthRelationships = relationships.filter((r) => r.strength > 0.7);
    if (highStrengthRelationships.length > 0) {
      clusterAnalysis.push(`Strong cluster detected: ${highStrengthRelationships.length} high-strength connections`);
      const clusteredPlatforms = /* @__PURE__ */ new Set();
      highStrengthRelationships.forEach((r) => {
        clusteredPlatforms.add(r.entity1);
        clusteredPlatforms.add(r.entity2);
      });
      clusterAnalysis.push(`Core platforms: ${Array.from(clusteredPlatforms).join(", ")}`);
    }
    const prompt = `You are an AI OSINT Analyst. Generate an executive summary overview, investigation notes, and 3-5 recommendations for this OSINT report based on the following findings:
Target: ${username || email}
Risk Level: ${riskLevel}
Platforms found: ${platformsList.length}
Key Findings: ${JSON.stringify(keyFindings)}
Risk Indicators: ${JSON.stringify(riskIndicators)}
Relationships: ${relationships.length}

Respond ONLY with a valid JSON object with this exact structure:
{
  "overview": "string",
  "investigationNotes": "string",
  "recommendations": ["string"]
}`;
    let aiGenerated = {
      overview: `Comprehensive OSINT investigation of target ${username || email} revealed extensive digital presence across multiple platforms. Digital footprint analysis indicates ${riskLevel} risk exposure with significant account linkage patterns detected.`,
      investigationNotes: `Investigation conducted on ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]} using automated OSINT tools. All findings based on publicly available information only. No unauthorized access or hacking was used in this investigation. Data analysis based on ${findings.length} distinct findings across ${platformsList.length} platforms.`,
      recommendations
    };
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "mixtral-8x7b-32768",
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1024
      });
      const aiResponse = JSON.parse(chatCompletion.choices[0]?.message?.content || "{}");
      if (aiResponse.overview) aiGenerated.overview = aiResponse.overview;
      if (aiResponse.investigationNotes) aiGenerated.investigationNotes = aiResponse.investigationNotes;
      if (aiResponse.recommendations && aiResponse.recommendations.length > 0) aiGenerated.recommendations = [...aiGenerated.recommendations, ...aiResponse.recommendations];
    } catch (e) {
      console.error("Groq AI Generation failed, falling back to algorithmic report", e);
    }
    const report = {
      reportId: `IR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      target: { username, email },
      executiveSummary: {
        overview: aiGenerated.overview,
        profileCount: platformsList.length,
        platformsDiscovered: platformsList.map((p) => p.name),
        riskLevel
      },
      targetProfile: {
        primaryIdentifiers,
        secondaryIdentifiers,
        platforms: platformsList
      },
      digitalFootprintAnalysis: {
        totalFindings: findings.length,
        platformDistribution,
        exposureRisk,
        dataExposureRisks: [
          "Email address exposure enables password reset attacks",
          "Phone number exposure enables SIM swap attacks",
          "Username consistency across platforms enables targeted attacks"
        ].filter((_, i) => i < entities.filter((e) => e.type !== "username").length + 1)
      },
      relationshipAnalysis: {
        detectedRelationships: relationships,
        connectionStrength: Math.round(connectionStrength * 100) / 100,
        clusterAnalysis
      },
      riskAssessment: {
        overallRiskScore: riskScore,
        riskLevel,
        indicators: riskIndicators
      },
      keyFindings,
      investigationNotes: aiGenerated.investigationNotes,
      recommendations: aiGenerated.recommendations
    };
    await (0, import_logActivity.logUserActivityDirect)(req.user.id, "intelligence_report_generated", {
      caseId,
      target: username || email,
      platformsDiscovered: platformsList.length,
      riskLevel
    });
    res.json({ success: true, report });
  } catch (error) {
    console.error("Intelligence report generation error:", error);
    res.status(500).json({ message: "Error generating intelligence report", error: error.message });
  }
};
const analyzeTarget = async (req, res) => {
  try {
    const { caseId, username, email } = req.body;
    if (!caseId) {
      return res.status(400).json({ message: "Case ID is required" });
    }
    if (!username && !email) {
      return res.status(400).json({ message: "Username or email is required" });
    }
    const query = { caseId };
    if (username) {
      query.$or = [{ "data.username": username }, { username }];
    }
    if (email) {
      query.$or = query.$or ? [...query.$or, { "data.email": email }, { email }] : [{ "data.email": email }, { email }];
    }
    const findings = await import_Finding.default.find(query).lean();
    res.json({
      success: true,
      targetAnalysis: {
        target: { username, email },
        findingsCount: findings.length,
        platforms: Array.from(new Set(findings.map((f) => f.source || f.data?.platform))),
        entities: extractEntities(findings),
        relationships: detectRelationships(findings, extractEntities(findings))
      }
    });
  } catch (error) {
    console.error("Target analysis error:", error);
    res.status(500).json({ message: "Error analyzing target", error: error.message });
  }
};
const exportReportJSON = async (req, res) => {
  try {
    const { caseId, username, email } = req.body;
    if (!caseId) {
      return res.status(400).json({ message: "Case ID is required" });
    }
    const targetCase = await import_Case.default.findById(caseId).lean();
    if (!targetCase) {
      return res.status(404).json({ message: "Case not found" });
    }
    const findings = await import_Finding.default.find({ caseId }).lean();
    if (findings.length === 0) {
      return res.status(400).json({ message: "No findings available for export" });
    }
    const entities = extractEntities(findings);
    const platformDistribution = {};
    findings.forEach((f) => {
      const source = f.source || f.data?.platform || "unknown";
      platformDistribution[source] = (platformDistribution[source] || 0) + 1;
    });
    const riskScore = calculateRiskScore(findings, entities);
    const riskLevel = assessRiskLevel(riskScore);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="intelligence-report-${Date.now()}.json"`);
    const report = {
      reportId: `IR-${Date.now()}`,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      target: { username, email },
      executiveSummary: {
        overview: `OSINT Investigation Report`,
        profileCount: new Set(findings.map((f) => f.source || f.data?.platform)).size,
        platformsDiscovered: Array.from(new Set(findings.map((f) => f.source || f.data?.platform))),
        riskLevel
      },
      findings,
      entities,
      platformDistribution,
      riskAssessment: {
        overallRiskScore: riskScore,
        riskLevel,
        indicators: generateRiskIndicators(findings, entities)
      }
    };
    res.json(report);
  } catch (error) {
    console.error("Report export error:", error);
    res.status(500).json({ message: "Error exporting report", error: error.message });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  analyzeTarget,
  exportReportJSON,
  generateIntelligenceReport
});
