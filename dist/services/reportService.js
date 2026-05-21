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
var reportService_exports = {};
__export(reportService_exports, {
  generateAIReport: () => generateAIReport,
  generateFullReport: () => generateFullReport
});
module.exports = __toCommonJS(reportService_exports);
var import_generative_ai = require("@google/generative-ai");
const genAI = new import_generative_ai.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const candidateModels = [
  process.env.GEMINI_MODEL,
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
].filter((model) => Boolean(model));
const withTimeout = (promise, timeoutMs, message) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
};
const TYPE_COLORS = {
  target: "#0ea5e9",
  person: "#8b5cf6",
  email: "#ef4444",
  phone: "#10b981",
  username: "#6366f1",
  domain: "#f59e0b",
  ip: "#06b6d4",
  organization: "#14b8a6",
  location: "#fb923c",
  wallet: "#a855f7",
  social: "#ec4899"
};
const getColor = (type) => TYPE_COLORS[type.toLowerCase()] || "#64748b";
const GEMINI_SYSTEM_PROMPT = `You are ShadowScan \u2014 an elite OSINT intelligence analyst AI.
You receive raw intelligence findings entered by an investigator in "key: value" format.
Your job is to analyze ALL the data, extract every possible entity, build relationship maps, and return a perfectly-structured JSON intelligence report.

CRITICAL RULES:
- Parse every line of findings. If it's "email: x@y.com", extract as email entity.
- Separate all entity types: names, emails, phones, usernames, social accounts, IPs, domains, locations, vehicles, organizations, crypto wallets, known associates.
- Build relationship edges between entities that share patterns (same person owns email+username+phone etc.)
- Risk rating: Low < Medium < High < Critical. Be accurate \u2014 if you see crypto wallets, dark web references, multiple accounts, rate HIGH/CRITICAL.
- For Pakistani phone numbers starting with +92, note carrier (30x=Jazz, 31x=Zong, 33x=Ufone, 34x=Telenor).
- Generate a realistic, detailed narrative in markdown.
- Your ENTIRE output must be valid JSON in the exact schema below. No extra text outside the JSON.`;
const buildPrompt = (caseTitle, rawFindings, targetProfile) => `
Analyze this OSINT investigation and return a structured JSON intelligence report.

CASE TITLE: ${caseTitle}

TARGET PROFILE (quick-fill fields):
- Name: ${targetProfile?.name || "Unknown"}
- Email: ${targetProfile?.email || "N/A"}
- Phone: ${targetProfile?.phone || "N/A"}
- Social: ${targetProfile?.socialMedia || "N/A"}

RAW FINDINGS FROM INVESTIGATOR:
\`\`\`
${rawFindings}
\`\`\`

Return ONLY this JSON structure (no markdown wrapper, no extra text):
{
  "markdownContent": "# Intelligence Report\\n## Executive Summary\\n...(full detailed narrative with ## sections)...",
  "visualReport": {
    "target": "Primary target name/identifier",
    "summary": "2-3 sentence executive summary of findings",
    "riskLevel": "Low|Medium|High|Critical",
    "confidenceScore": 0-100,
    "tags": ["tag1", "tag2"],
    "entitiesByType": {
      "Names / Aliases": ["Ahmed Khan", "AK Shadow"],
      "Email Addresses": ["x@gmail.com"],
      "Phone Numbers": ["+92 300 1234567"],
      "Usernames": ["shadow_pk", "fsociety_pk"],
      "Social Media Accounts": ["@shadow_pk on Twitter", "Telegram: @shadow_ops"],
      "IP Addresses": ["111.68.100.55"],
      "Domains": ["example.pk"],
      "Organizations": ["Systems Limited"],
      "Locations": ["Islamabad, Pakistan"],
      "Vehicles": ["Honda Civic, LEB-1234"],
      "Crypto Wallets": ["0x9b2f..."],
      "Known Associates": ["Usman Ali (FAST NUCES)"]
    },
    "digitalFootprint": {
      "socialAccounts": [],
      "emails": [],
      "phoneNumbers": [],
      "ipAddresses": [],
      "domains": [],
      "wallets": [],
      "usernames": []
    },
    "highlightedFindings": ["finding 1", "finding 2"],
    "timeline": [{"event": "description of a key discovery"}],
    "riskFactors": ["risk factor 1", "risk factor 2"],
    "recommendations": ["action 1", "action 2"],
    "relationships": [
      {
        "source": "Ahmed Khan",
        "sourceType": "person",
        "target": "ahmed@gmail.com",
        "targetType": "email",
        "relation": "OWNS",
        "strength": "strong"
      }
    ],
    "relationshipGraph": {
      "nodes": [
        {"id": "target", "label": "Ahmed Khan", "type": "target", "color": "#0ea5e9"},
        {"id": "n-0", "label": "ahmed@gmail.com", "type": "email", "color": "#ef4444"}
      ],
      "edges": [
        {"source": "target", "target": "n-0", "relation": "OWNS", "strength": "strong"}
      ]
    }
  }
}`;
const buildFallbackVisual = (caseTitle, rawFindings, targetProfile) => {
  const lines = rawFindings.split("\n").filter((l) => l.includes(":"));
  const entitiesByType = {};
  const nodes = [
    { id: "target", label: targetProfile?.name || caseTitle, type: "target", color: getColor("target") }
  ];
  const edges = [];
  const emails = [];
  const phoneNumbers = [];
  const usernames = [];
  const ipAddresses = [];
  const domains = [];
  const socialAccounts = [];
  const wallets = [];
  lines.forEach((line, idx) => {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) return;
    const key = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();
    if (!value) return;
    let type = "note";
    if (["email"].includes(key)) {
      type = "email";
      emails.push(value);
      entitiesByType["Email Addresses"] = [...entitiesByType["Email Addresses"] || [], value];
    } else if (["phone", "contact", "mobile"].includes(key)) {
      type = "phone";
      phoneNumbers.push(value);
      entitiesByType["Phone Numbers"] = [...entitiesByType["Phone Numbers"] || [], value];
    } else if (["username", "user", "handle"].includes(key)) {
      type = "username";
      usernames.push(value);
      entitiesByType["Usernames"] = [...entitiesByType["Usernames"] || [], value];
    } else if (["ip"].includes(key)) {
      type = "ip";
      ipAddresses.push(value);
      entitiesByType["IP Addresses"] = [...entitiesByType["IP Addresses"] || [], value];
    } else if (["domain"].includes(key)) {
      type = "domain";
      domains.push(value);
      entitiesByType["Domains"] = [...entitiesByType["Domains"] || [], value];
    } else if (["name", "alias", "friend", "known_associate"].includes(key)) {
      type = "person";
      entitiesByType["Names / Aliases"] = [...entitiesByType["Names / Aliases"] || [], value];
    } else if (["location", "city", "address"].includes(key)) {
      type = "location";
      entitiesByType["Locations"] = [...entitiesByType["Locations"] || [], value];
    } else if (["organization", "employer", "company"].includes(key)) {
      type = "organization";
      entitiesByType["Organizations"] = [...entitiesByType["Organizations"] || [], value];
    } else if (["telegram", "discord", "twitter", "x_profile", "linkedin", "github"].includes(key)) {
      type = "social";
      socialAccounts.push(value);
      entitiesByType["Social Media Accounts"] = [...entitiesByType["Social Media Accounts"] || [], `${key}: ${value}`];
    } else if (["wallet"].includes(key)) {
      type = "wallet";
      wallets.push(value);
      entitiesByType["Crypto Wallets"] = [...entitiesByType["Crypto Wallets"] || [], value];
    } else if (["vehicle"].includes(key)) {
      entitiesByType["Vehicles"] = [...entitiesByType["Vehicles"] || [], value];
    }
    if (type !== "note") {
      const nodeId = `n-${idx}`;
      nodes.push({ id: nodeId, label: value.slice(0, 40), type, color: getColor(type) });
      edges.push({ source: "target", target: nodeId, relation: key.toUpperCase(), strength: "medium" });
    }
  });
  return {
    target: targetProfile?.name || caseTitle,
    summary: `Intelligence report generated from ${lines.length} raw findings. Manual analysis required to verify all extracted entities.`,
    riskLevel: "Medium",
    confidenceScore: 65,
    tags: [caseTitle, "OSINT", "Manual Extract"],
    entitiesByType,
    digitalFootprint: { socialAccounts, emails, phoneNumbers, ipAddresses, domains, wallets, usernames },
    highlightedFindings: Object.entries(entitiesByType).slice(0, 6).map(([k, v]) => `${v.length} ${k} found`),
    timeline: [{ event: `Raw intelligence gathered with ${lines.length} labeled findings` }],
    riskFactors: ["Manual extraction used \u2014 AI analysis unavailable"],
    recommendations: ["Review all extracted entities for accuracy", "Cross-reference with additional OSINT tools"],
    relationships: edges.map((e) => ({
      source: nodes.find((n) => n.id === e.source)?.label || e.source,
      sourceType: nodes.find((n) => n.id === e.source)?.type || "unknown",
      target: nodes.find((n) => n.id === e.target)?.label || e.target,
      targetType: nodes.find((n) => n.id === e.target)?.type || "unknown",
      relation: e.relation,
      strength: e.strength
    })),
    relationshipGraph: { nodes, edges }
  };
};
const generateFullReport = async (caseTitle, rawFindings, targetProfile) => {
  if (!process.env.GEMINI_API_KEY) {
    const fallback2 = buildFallbackVisual(caseTitle, rawFindings, targetProfile);
    return {
      markdownContent: `# Intelligence Report: ${caseTitle}

## Summary
${fallback2.summary}

## Raw Findings
${rawFindings}`,
      visualReport: fallback2
    };
  }
  const prompt = buildPrompt(caseTitle, rawFindings, targetProfile);
  let lastError;
  const generationTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 25e3);
  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await withTimeout(model.generateContent({
        contents: [
          { role: "user", parts: [{ text: GEMINI_SYSTEM_PROMPT + "\n\n" + prompt }] }
        ],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 8192,
          responseMimeType: "application/json"
        }
      }), generationTimeoutMs, `Gemini generation timed out after ${generationTimeoutMs}ms`);
      const responseText = result.response.text().trim();
      if (!responseText) {
        lastError = new Error(`Empty response from ${modelName}`);
        continue;
      }
      const cleanJson = responseText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (!parsed.markdownContent || !parsed.visualReport) {
        throw new Error("Gemini response missing required fields");
      }
      if (parsed.visualReport.relationshipGraph?.nodes) {
        parsed.visualReport.relationshipGraph.nodes = parsed.visualReport.relationshipGraph.nodes.map((n) => ({
          ...n,
          color: n.color || getColor(n.type || "default")
        }));
      }
      console.log(`[ReportService] Gemini (${modelName}) returned structured report successfully`);
      return {
        markdownContent: parsed.markdownContent,
        visualReport: parsed.visualReport
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ReportService] Model ${modelName} failed:`, message);
      if (!/404|not found|unsupported/i.test(message)) {
        break;
      }
    }
  }
  console.warn("[ReportService] All Gemini models failed. Using intelligent fallback.", lastError);
  const fallback = buildFallbackVisual(caseTitle, rawFindings, targetProfile);
  return {
    markdownContent: `# Intelligence Report: ${caseTitle}

## Summary
${fallback.summary}

## Raw Findings
${rawFindings}`,
    visualReport: fallback
  };
};
const generateAIReport = async (systemPrompt, caseData, findingsData) => {
  const result = await generateFullReport(
    caseData?.title || "Unknown Case",
    caseData?.description || JSON.stringify(findingsData),
    caseData?.targetProfile || {}
  );
  return result.markdownContent;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateAIReport,
  generateFullReport
});
