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
var osintAnalystController_exports = {};
__export(osintAnalystController_exports, {
  analyzeOsintData: () => analyzeOsintData
});
module.exports = __toCommonJS(osintAnalystController_exports);
var import_logActivity = require("../utils/logActivity");
function extractEmails(text) {
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  return [...new Set(text.match(re) || [])];
}
function extractPhones(text) {
  const re = /(?:\+?\d[\d\s\-().]{7,}\d)/g;
  const raw = text.match(re) || [];
  return [...new Set(raw.map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p.replace(/\D/g, "").length >= 8))];
}
function extractUsernames(text) {
  const re = /(?:@|username[:\s]+|handle[:\s]+|user[:\s]+)([a-zA-Z0-9_.\-]{3,30})/gi;
  const found = [];
  let m;
  while ((m = re.exec(text)) !== null) found.push(m[1]);
  return [...new Set(found)];
}
function extractUrls(text) {
  const re = /https?:\/\/[^\s"'<>]+/g;
  return [...new Set(text.match(re) || [])];
}
function extractIPs(text) {
  const re = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  return [...new Set((text.match(re) || []).filter((ip) => {
    const parts = ip.split(".").map(Number);
    return parts.every((p) => p >= 0 && p <= 255);
  }))];
}
function extractDomains(text) {
  const re = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|io|co|gov|edu|info|biz|xyz|tech|app|dev|me|us|uk|in|pk|de|fr|ca)\b/gi;
  const all = [...new Set(text.match(re) || [])];
  const emails = extractEmails(text);
  return all.filter((d) => !emails.some((e) => e.endsWith(d)));
}
function extractNames(text) {
  const stopWords = /* @__PURE__ */ new Set([
    "The",
    "This",
    "That",
    "With",
    "From",
    "Into",
    "Over",
    "Under",
    "Between",
    "After",
    "Before",
    "During",
    "About",
    "Against",
    "Along",
    "Among",
    "Also",
    "While",
    "When",
    "Where",
    "Which",
    "What",
    "Have",
    "Been",
    "Being",
    "Just",
    "More",
    "Than",
    "Such",
    "Both",
    "Each",
    "Even",
    "Only",
    "Very",
    "Much",
    "Many",
    "Some",
    "There",
    "They",
    "Their",
    "Your",
    "Email",
    "Phone",
    "User",
    "Name",
    "Date",
    "Born",
    "Case",
    "Risk",
    "High",
    "Medium",
    "Located",
    "Lives",
    "Work",
    "Known",
    "Based",
    "Social",
    "Account",
    "Platform",
    "Target",
    "Subject",
    "Found",
    "Data",
    "Info",
    "Full"
  ]);
  const re = /\b([A-Z][a-z]{1,20})\s([A-Z][a-z]{1,20})(?:\s([A-Z][a-z]{1,20}))?\b/g;
  const names = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const first = m[1], second = m[2];
    if (!stopWords.has(first) && !stopWords.has(second)) {
      names.push(m[0].trim());
    }
  }
  return [...new Set(names)].slice(0, 8);
}
function extractOrganizations(text) {
  const re = /(?:company|organization|org|employer|works?\s+at|employed\s+by|corporation|firm|agency|institute|university|college)[:\s]+([A-Za-z0-9\s&.,'-]{3,60})/gi;
  const found = [];
  let m;
  while ((m = re.exec(text)) !== null) found.push(m[1].trim());
  const corpRe = /\b([A-Z][A-Za-z0-9\s]{2,40}(?:Inc|Ltd|Corp|LLC|GmbH|Pvt|Pty|Co)\.?)\b/g;
  while ((m = corpRe.exec(text)) !== null) found.push(m[1].trim());
  return [...new Set(found)].slice(0, 5);
}
function extractLocations(text) {
  const re = /(?:location|address|city|country|state|region|lives?\s+in|based\s+in|from)[:\s]+([A-Za-z0-9\s,.-]{3,80})/gi;
  const found = [];
  let m;
  while ((m = re.exec(text)) !== null) found.push(m[1].trim());
  return [...new Set(found)].slice(0, 4);
}
function detectPlatforms(text) {
  const platformMap = {
    facebook: "Facebook",
    twitter: "Twitter/X",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    github: "GitHub",
    gitlab: "GitLab",
    youtube: "YouTube",
    tiktok: "TikTok",
    reddit: "Reddit",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    discord: "Discord",
    snapchat: "Snapchat",
    pinterest: "Pinterest",
    tumblr: "Tumblr",
    medium: "Medium",
    stackoverflow: "Stack Overflow",
    pastebin: "Pastebin",
    twitch: "Twitch",
    spotify: "Spotify",
    skype: "Skype",
    signal: "Signal",
    viber: "Viber"
  };
  const lower = text.toLowerCase();
  return Object.entries(platformMap).filter(([key]) => lower.includes(key)).map(([, label]) => label);
}
function computeRisk(entities) {
  let score = 0;
  const indicators = [];
  if (entities.emails.length > 0) {
    score += entities.emails.length * 15;
    indicators.push({ category: "Email Exposure", severity: "High", description: `${entities.emails.length} email address(es) found in public data. Enables account takeover and phishing attacks.`, evidence: entities.emails });
  }
  if (entities.phones.length > 0) {
    score += entities.phones.length * 12;
    indicators.push({ category: "Phone Number Exposure", severity: "High", description: `${entities.phones.length} phone number(s) identified. Susceptible to SIM-swapping and social engineering.`, evidence: entities.phones });
  }
  if (entities.ips.length > 0) {
    score += entities.ips.length * 8;
    indicators.push({ category: "IP Address Disclosure", severity: "Medium", description: `${entities.ips.length} IP address(es) present. May reveal geolocation or infrastructure details.`, evidence: entities.ips });
  }
  if (entities.platforms.length > 5) {
    score += 20;
    indicators.push({ category: "Excessive Platform Footprint", severity: "High", description: `Target linked to ${entities.platforms.length} platforms. Broad digital exposure increases attack surface.`, evidence: entities.platforms });
  } else if (entities.platforms.length > 2) {
    score += 10;
    indicators.push({ category: "Multi-Platform Presence", severity: "Medium", description: `Presence detected on ${entities.platforms.length} platforms.`, evidence: entities.platforms });
  }
  if (entities.domains.length > 0) {
    score += entities.domains.length * 5;
    indicators.push({ category: "Domain/Infrastructure Exposure", severity: "Medium", description: `${entities.domains.length} domain(s) associated with the target. May expose infrastructure topology.`, evidence: entities.domains });
  }
  if (entities.urls.length > 3) {
    score += 10;
    indicators.push({ category: "Digital Trail", severity: "Low", description: `${entities.urls.length} URLs found. Enables historical footprinting.`, evidence: entities.urls.slice(0, 5) });
  }
  const level = score >= 60 ? "High" : score >= 30 ? "Medium" : "Low";
  return { score: Math.min(score, 100), level, indicators };
}
function buildEntityMap(text) {
  return {
    emails: extractEmails(text),
    phones: extractPhones(text),
    usernames: extractUsernames(text),
    names: extractNames(text),
    organizations: extractOrganizations(text),
    locations: extractLocations(text),
    urls: extractUrls(text),
    domains: extractDomains(text),
    ips: extractIPs(text),
    platforms: detectPlatforms(text)
  };
}
function detectRelationships(entities) {
  const rels = [];
  entities.emails.forEach((email) => {
    const domain = email.split("@")[1];
    entities.domains.filter((d) => d === domain).forEach((d) => {
      rels.push({ entity1: email, entity2: d, relation: "Email hosted on domain", strength: "Strong" });
    });
    entities.urls.filter((u) => u.includes(domain)).forEach((u) => {
      rels.push({ entity1: email, entity2: u, relation: "Email domain matches URL", strength: "Strong" });
    });
  });
  entities.usernames.forEach((u) => {
    entities.platforms.forEach((p) => {
      rels.push({ entity1: u, entity2: p, relation: "Username detected on platform", strength: "Moderate" });
    });
  });
  entities.names.slice(0, 2).forEach((name) => {
    entities.emails.forEach((email) => {
      const parts = name.toLowerCase().split(" ");
      if (parts.some((p) => email.toLowerCase().includes(p))) {
        rels.push({ entity1: name, entity2: email, relation: "Name matches email identifier", strength: "Strong" });
      }
    });
    entities.organizations.forEach((org) => {
      rels.push({ entity1: name, entity2: org, relation: "Individual associated with organization", strength: "Moderate" });
    });
  });
  return rels.slice(0, 12);
}
function deriveKeyFindings(entities, risk) {
  const findings = [];
  if (entities.emails.length > 0)
    findings.push({ finding: `${entities.emails.length} email address(es) confirmed in provided intelligence data`, confidence: 0.95, category: "Identity" });
  if (entities.phones.length > 0)
    findings.push({ finding: `${entities.phones.length} phone number(s) extracted \u2014 potential SIM-swap vulnerability`, confidence: 0.9, category: "Personal Data" });
  if (entities.platforms.length > 0)
    findings.push({ finding: `Digital presence confirmed on ${entities.platforms.length} platform(s): ${entities.platforms.join(", ")}`, confidence: 0.88, category: "Digital Footprint" });
  if (entities.ips.length > 0)
    findings.push({ finding: `${entities.ips.length} IP address(es) extracted \u2014 geolocation and infrastructure mapping possible`, confidence: 0.85, category: "Network" });
  if (entities.names.length > 0)
    findings.push({ finding: `Likely real identities: ${entities.names.slice(0, 3).join(", ")}`, confidence: 0.75, category: "Identity" });
  if (entities.organizations.length > 0)
    findings.push({ finding: `Organizational affiliation detected: ${entities.organizations[0]}`, confidence: 0.8, category: "Organization" });
  if (entities.locations.length > 0)
    findings.push({ finding: `Geographic data exposed: ${entities.locations[0]}`, confidence: 0.78, category: "Location" });
  if (entities.domains.length > 0)
    findings.push({ finding: `${entities.domains.length} domain(s) associated \u2014 WHOIS and DNS reconnaissance applicable`, confidence: 0.85, category: "Infrastructure" });
  findings.push({ finding: `Overall risk assessment: ${risk.level} (Score: ${risk.score}/100)`, confidence: 1, category: "Risk Assessment" });
  return findings;
}
function generateRecommendations(entities, riskLevel) {
  const recs = [];
  if (entities.emails.length > 0) {
    recs.push("Immediately rotate passwords for all accounts linked to discovered email addresses.");
    recs.push("Enroll discovered email addresses in Have I Been Pwned (HIBP) breach monitoring.");
  }
  if (entities.phones.length > 0) {
    recs.push("Contact mobile carrier to enable SIM-lock / port freeze to prevent SIM-swap attacks.");
    recs.push("Remove phone number from public profile sections on all social platforms.");
  }
  if (entities.platforms.length > 0) {
    recs.push("Audit privacy settings on all identified social media platforms immediately.");
    recs.push("Enable Two-Factor Authentication (2FA/MFA) on every platform account discovered.");
  }
  if (entities.ips.length > 0) {
    recs.push("Conduct reverse-IP lookup and banner grabbing to assess infrastructure exposure.");
    recs.push("Implement a firewall policy change to restrict inbound connections from untrusted sources.");
  }
  if (entities.domains.length > 0) {
    recs.push("Run WHOIS, DNS enumeration, and certificate transparency log analysis on exposed domains.");
  }
  if (riskLevel === "High") {
    recs.push("Engage a professional threat intelligence team for active monitoring of discovered identifiers.");
    recs.push("Issue a Digital Takedown request for any personally identifiable information (PII) indexed publicly.");
  }
  recs.push("Implement an email aliasing strategy (e.g., SimpleLogin, AnonAddy) to decouple platform registrations.");
  recs.push("Establish automated alerts for new mentions of discovered identifiers on dark web forums.");
  return recs;
}
const analyzeOsintData = async (req, res) => {
  try {
    const { targetData, targetLabel } = req.body;
    if (!targetData || targetData.trim().length < 10) {
      return res.status(400).json({ message: "Insufficient data provided for analysis (minimum 10 characters)." });
    }
    const text = targetData;
    const entities = buildEntityMap(text);
    const risk = computeRisk(entities);
    const relationships = detectRelationships(entities);
    const keyFindings = deriveKeyFindings(entities, risk);
    const recommendations = generateRecommendations(entities, risk.level);
    const primaryTarget = targetLabel || entities.names[0] || entities.usernames[0] || entities.emails[0] || "Unknown Subject";
    const reportId = `OSINT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const report = {
      reportId,
      generatedAt,
      classification: "UNCLASSIFIED // FOR OFFICIAL USE ONLY",
      target: {
        label: primaryTarget,
        inputLength: text.length
      },
      executiveSummary: {
        overview: `An automated OSINT analysis of the provided intelligence data relating to "${primaryTarget}" has been completed. The investigation extracted ${entities.emails.length} email address(es), ${entities.phones.length} phone number(s), ${entities.platforms.length} platform reference(s), ${entities.names.length} probable name(s), and ${entities.ips.length} IP address(es) from the supplied data corpus. The subject's digital footprint presents a ${risk.level.toUpperCase()} exposure risk with an overall risk score of ${risk.score}/100. ${risk.level === "High" ? "Immediate remediation and monitoring is strongly advised." : risk.level === "Medium" ? "Targeted security improvements are recommended." : "Standard monitoring protocols apply."}`,
        riskLevel: risk.level,
        riskScore: risk.score,
        totalEntitiesExtracted: Object.values(entities).flat().length,
        platformsDetected: entities.platforms.length
      },
      targetProfile: {
        names: entities.names,
        emails: entities.emails,
        phones: entities.phones,
        usernames: entities.usernames,
        organizations: entities.organizations,
        locations: entities.locations
      },
      digitalFootprintAnalysis: {
        platforms: entities.platforms,
        domains: entities.domains,
        urls: entities.urls,
        ipAddresses: entities.ips,
        exposureScore: risk.score,
        dataExposureRisks: [
          ...entities.emails.length > 0 ? ["Email address exposure enables phishing, credential stuffing, and account enumeration."] : [],
          ...entities.phones.length > 0 ? ["Phone number exposure enables SIM-swap, voice phishing (vishing), and OTP interception."] : [],
          ...entities.platforms.length > 0 ? ["Multi-platform presence enables correlated identity profiling across services."] : [],
          ...entities.ips.length > 0 ? ["IP disclosure enables geolocation mapping and targeted network attacks."] : [],
          ...entities.domains.length > 0 ? ["Domain exposure enables subdomain enumeration and DNS-based attacks."] : []
        ]
      },
      relationshipAnalysis: {
        relationships,
        totalRelationships: relationships.length,
        strongConnections: relationships.filter((r) => r.strength === "Strong").length,
        clusterNotes: relationships.length > 0 ? `Analysis identified ${relationships.filter((r) => r.strength === "Strong").length} strong and ${relationships.filter((r) => r.strength === "Moderate").length} moderate connection(s) between discovered entities.` : "Insufficient entity co-occurrence to establish confirmed cross-platform relationships."
      },
      riskAssessment: {
        overallRiskScore: risk.score,
        riskLevel: risk.level,
        indicators: risk.indicators
      },
      keyFindings,
      investigationNotes: `This report was generated on ${new Date(generatedAt).toUTCString()} using the ShadowScan Automated OSINT Analysis Engine (v2.0). All findings are derived exclusively from the data provided by the operator and do not involve unauthorized access, hacking, or covert collection. Analysis is pattern-based and relies on publicly documented entity extraction heuristics. Findings should be corroborated by human analysts before operational use. Report ID: ${reportId}.`,
      recommendations
    };
    try {
      await (0, import_logActivity.logUserActivityDirect)(req.user?.id, "intelligence_report_generated", {
        reportId,
        target: primaryTarget,
        riskLevel: risk.level,
        entitiesFound: Object.values(entities).flat().length
      });
    } catch (_) {
    }
    res.json({ success: true, report });
  } catch (error) {
    console.error("OSINT Analyst error:", error);
    res.status(500).json({ message: "Analysis engine encountered an error.", error: error.message });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  analyzeOsintData
});
