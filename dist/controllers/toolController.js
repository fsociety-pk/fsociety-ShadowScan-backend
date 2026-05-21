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
var toolController_exports = {};
__export(toolController_exports, {
  emailLookup: () => emailLookup,
  extractMetadata: () => extractMetadata,
  imageOSINT: () => imageOSINT,
  networkRecon: () => networkRecon,
  nexusOSINTLookup: () => nexusOSINTLookup,
  pasteSearch: () => pasteSearch,
  phoneLookupPK: () => phoneLookupPK,
  usernameLookup: () => usernameLookup
});
module.exports = __toCommonJS(toolController_exports);
var import_generative_ai = require("@google/generative-ai");
var import_axios = __toESM(require("axios"));
var import_crypto = __toESM(require("crypto"));
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_child_process = require("child_process");
var import_util = require("util");
var import_platforms = require("../config/platforms");
var import_usernameUtils = require("../utils/usernameUtils");
var import_requestManager = require("../utils/requestManager");
var import_logActivity = require("../utils/logActivity");
var import_Finding = __toESM(require("../models/Finding"));
var import_whatsappService = require("../services/whatsappService");
var import_phoneInfogaService = require("../services/phoneInfogaService");
const execPromise = (0, import_util.promisify)(import_child_process.exec);
const extractUsernames = (email) => {
  const handle = email.split("@")[0].toLowerCase();
  const usernames = /* @__PURE__ */ new Set();
  usernames.add(handle);
  usernames.add(handle.replace(/[._-]/g, ""));
  if (handle.includes(".")) usernames.add(handle.replace(/\./g, "_"));
  if (handle.includes("_")) usernames.add(handle.replace(/_/g, "."));
  usernames.add(handle.replace(/\d+$/, ""));
  const parts = handle.split(/[._-]/);
  if (parts.length > 1) {
    parts.forEach((part) => {
      if (part.length > 2) usernames.add(part);
    });
    if (parts.length === 2) {
      usernames.add(`${parts[1]}.${parts[0]}`);
      usernames.add(`${parts[1]}${parts[0]}`);
    }
  }
  return Array.from(usernames).slice(0, 8);
};
const getPythonPath = () => {
  const venvPath = import_path.default.join(__dirname, "../../venv/bin/python");
  if (import_fs.default.existsSync(venvPath)) return venvPath;
  return "python3";
};
const getEmailProviderType = (email) => {
  const commonWebmail = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "me.com", "aol.com"];
  const domain = email.split("@")[1].toLowerCase();
  if (commonWebmail.includes(domain)) return "webmail";
  if (["yopmail.com", "mailinator.com", "tempmail.com"].includes(domain)) return "disposable";
  return "corporate";
};
const calculateMatchPercentage = (html, signatures) => {
  if (!signatures || signatures.length === 0) return 0;
  let matches = 0;
  signatures.forEach((sig) => {
    if (html.toLowerCase().includes(sig.toLowerCase())) {
      matches++;
    }
  });
  return matches / signatures.length * 100;
};
const probePlatformWithSignatures = async (username, platform) => {
  const url = platform.url_pattern.replace("{username}", username);
  const isSpecial = ["github", "linkedin"].includes(platform.name.toLowerCase());
  if (isSpecial) {
    await (0, import_requestManager.enforceDelay)(platform.name);
  }
  const axiosConfig = isSpecial ? (0, import_requestManager.getRequestConfig)(platform.name) : {
    headers: {
      "User-Agent": (0, import_requestManager.getRandomUA)(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5"
    },
    timeout: 8e3,
    validateStatus: () => true
  };
  let response;
  let retries = 1;
  const performRequest = async () => {
    try {
      const res = await import_axios.default.get(url, axiosConfig);
      if ((res.status === 403 || res.status === 429) && retries > 0) {
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 2e3));
        if (axiosConfig.headers) axiosConfig.headers["User-Agent"] = (0, import_requestManager.getRandomUA)();
        return performRequest();
      }
      return res;
    } catch (e) {
      if (retries > 0 && (!e.response || e.response.status >= 500)) {
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 2e3));
        return performRequest();
      }
      throw e;
    }
  };
  try {
    response = await performRequest();
    let html = response.data ? response.data.toString() : "";
    let status = response.status;
    if (status === 200) {
      if (platform.not_found_signatures.some((sig) => html.includes(sig))) {
        return { status: "not_found", url, confidence: 0.9 };
      }
      if (platform.suspended_signatures.some((sig) => html.includes(sig))) {
        return { status: "suspended", url, confidence: 0.9 };
      }
      return { status: "found", url, confidence: platform.confidence_weight || 0.9 };
    } else if (status === 404) {
      return { status: "not_found", url, confidence: 0.99 };
    } else if (status === 403 || status === 429) {
      return { status: "unknown", url, message: "Blocked by rate limiting/WAF", confidence: 0 };
    } else if (status === 410) {
      return { status: "suspended", url, confidence: 0.99 };
    }
    return { status: "not_found", url, confidence: 0.5 };
  } catch (e) {
    return { status: "error", url, message: "Connection failed", confidence: 0 };
  }
};
const probePlatform = async (username, platformName) => {
  const config = import_platforms.platforms.find((p) => p.name.toLowerCase() === platformName.toLowerCase());
  if (config) {
    const res = await probePlatformWithSignatures(username, config);
    return { found: res.status === "found", url: res.status === "found" ? res.url : "" };
  }
  const fallbackUrls = {
    facebook: `https://www.facebook.com/${username}`,
    x: `https://x.com/${username}`,
    github_pages: `https://${username}.github.io/`
  };
  const url = fallbackUrls[platformName];
  if (!url) return { found: false, url: "" };
  try {
    const response = await import_axios.default.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 4e3,
      validateStatus: (status) => status < 500
    });
    const isFound = response.status === 200 && !response.data.includes("Page Not Found");
    return { found: isFound, url: isFound ? url : "" };
  } catch (e) {
    return { found: false, url: "" };
  }
};
const lookupHolehe = async (email) => {
  return new Promise((resolve) => {
    let childProcess;
    try {
      childProcess = (0, import_child_process.spawn)("holehe", ["--no-color", email]);
    } catch (err) {
      return resolve(null);
    }
    let output = "";
    const timeout = setTimeout(() => {
      try {
        childProcess.kill();
      } catch (e) {
      }
      resolve(null);
    }, 4e4);
    childProcess.stdout.on("data", (data) => {
      output += data.toString();
    });
    childProcess.stderr.on("data", (data) => {
      output += data.toString();
    });
    childProcess.on("error", (err) => {
      clearTimeout(timeout);
      return resolve(null);
    });
    childProcess.on("close", () => {
      clearTimeout(timeout);
      try {
        const lines = output.split("\n");
        const sites = [];
        for (const line of lines) {
          let status = null;
          if (line.includes("[+] ")) status = "found";
          else if (line.includes("[-] ")) status = "not_found";
          else if (line.includes("[x] ")) status = "rate_limit";
          else if (line.includes("[!] ")) status = "error";
          if (status) {
            const parts = line.split(/\[\+\]|\[-\]|\[x\]|\[!\]/);
            if (parts.length >= 2) {
              let domainPart = parts[1].trim();
              if (domainPart.includes("/")) {
                domainPart = domainPart.split("/")[0].trim();
              }
              const domain = domainPart.trim();
              if (domain) {
                sites.push({ domain, status });
              }
            }
          }
        }
        resolve({
          raw: output,
          sites
        });
      } catch (e) {
        resolve(null);
      }
    });
  });
};
const nexusOSINTLookup = async (req, res) => {
  const { phone, caseId } = req.body;
  if (!phone) {
    res.status(400).json({ message: "Phone number required" });
    return;
  }
  const cleanPhone = phone.replace(/\D/g, "");
  try {
    const [whatsappResult, phoneInfogaResult] = await Promise.allSettled([
      (0, import_whatsappService.fetchWhatsAppProfile)(cleanPhone),
      (0, import_phoneInfogaService.fetchPhoneInfoga)(phone)
    ]);
    let combinedResult = {
      targetPhone: `+${cleanPhone}`,
      last_updated: (/* @__PURE__ */ new Date()).toISOString(),
      source: "NexusOSINT Engine",
      exists: false
    };
    if (whatsappResult.status === "fulfilled") {
      combinedResult = { ...combinedResult, whatsapp: whatsappResult.value, exists: true };
    } else {
      combinedResult.whatsapp = null;
      combinedResult.whatsappError = whatsappResult.reason.message;
    }
    if (phoneInfogaResult.status === "fulfilled") {
      combinedResult = { ...combinedResult, phoneinfoga: phoneInfogaResult.value };
    } else {
      combinedResult.phoneinfoga = null;
    }
    if (!combinedResult.whatsapp && !combinedResult.phoneinfoga?.success) {
      res.status(502).json({ message: "NexusOSINT providers did not return usable data", error: combinedResult.whatsappError });
      return;
    }
    (0, import_logActivity.logUserActivity)(req, "phone_lookup", "NexusOSINT Intelligence", { phone: cleanPhone });
    if (caseId) {
      try {
        const finding = new import_Finding.default({
          caseId,
          findingType: "phone_lookup",
          source: "NexusOSINT",
          phone: `+${cleanPhone}`,
          data: combinedResult,
          confidence: combinedResult.whatsapp?.exists ? 95 : 70,
          isVerified: !!combinedResult.whatsapp?.exists,
          tags: ["nexus-osint", "whatsapp", "phoneinfoga"]
        });
        await finding.save();
      } catch (fError) {
        console.error("Error saving NexusOSINT finding");
      }
    }
    res.json(combinedResult);
  } catch (error) {
    console.error("NexusOSINT Error:", error);
    res.status(500).json({ message: "Internal server error during phone lookup" });
  }
};
const aggregateResults = (raw) => {
  const profile = {
    name: raw.gravatar?.aboutMe || "Unknown",
    avatar: raw.gravatar?.thumbnailUrl || null,
    bio: raw.gravatar?.aboutMe || null,
    location: null,
    sources: [],
    confidence_score: 0
  };
  const professional = {
    company: null,
    title: null,
    domain: raw.email.split("@")[1],
    department: null
  };
  const socialMap = /* @__PURE__ */ new Map();
  const apiSocials = [
    ...raw.discoveredLinks
  ];
  apiSocials.forEach((s) => {
    const plat = s.platform.toLowerCase();
    if (!socialMap.has(plat) || s.confidence === "High") {
      socialMap.set(plat, { ...s, verified: s.confidence === "High" });
    }
  });
  let score = 0;
  if (raw.holehe) {
    score += 0.8;
    profile.sources.push("Holehe Engine");
  }
  if (raw.gravatar) {
    score += 0.1;
    profile.sources.push("Gravatar");
  }
  profile.confidence_score = Math.min(Math.round(score * 100) / 100, 1);
  profile.verified = profile.confidence_score > 0.6;
  return {
    profile,
    professional,
    social_profiles: Array.from(socialMap.values()),
    email_type: getEmailProviderType(raw.email)
  };
};
const emailLookup = async (req, res) => {
  const { email, caseId } = req.body;
  if (!email || !email.includes("@")) {
    res.status(400).json({ message: "Valid email required" });
    return;
  }
  try {
    const rawResults = {
      email,
      timestamp: /* @__PURE__ */ new Date(),
      gravatar: null,
      holehe: null,
      breaches: [],
      discoveredLinks: []
    };
    const targetUsernames = extractUsernames(email);
    const mainUsername = targetUsernames[0];
    const [gravatar, holehe] = await Promise.all([
      (async () => {
        const hash = import_crypto.default.createHash("md5").update(email.toLowerCase()).digest("hex");
        try {
          const gravRes = await import_axios.default.get(`https://en.gravatar.com/${hash}.json`, { timeout: 3e3 });
          return gravRes.data.entry?.[0];
        } catch {
          return null;
        }
      })(),
      lookupHolehe(email)
    ]);
    rawResults.gravatar = gravatar;
    rawResults.holehe = holehe;
    if (holehe && holehe.sites) {
      holehe.sites.forEach((siteObj) => {
        const site = siteObj.domain;
        const platformName = site.split(".")[0];
        const capitalized = platformName.charAt(0).toUpperCase() + platformName.slice(1);
        rawResults.discoveredLinks.push({
          platform: capitalized,
          url: `https://${site}`,
          username: email,
          status: siteObj.status,
          confidence: siteObj.status === "found" ? "High" : "Possible"
        });
      });
    }
    const discoveryTasks = [];
    import_platforms.platforms.forEach((platform) => {
      targetUsernames.forEach((username) => {
        discoveryTasks.push(probePlatformWithSignatures(username, platform).then((res2) => ({ ...res2, platform: platform.name, username })));
      });
    });
    const discoveryResults = await Promise.all(discoveryTasks);
    const foundPlatforms = /* @__PURE__ */ new Set();
    discoveryResults.forEach((res2) => {
      if ((res2.status === "found" || res2.status === "suspended") && !foundPlatforms.has(res2.platform)) {
        foundPlatforms.add(res2.platform);
        rawResults.discoveredLinks.push({
          platform: res2.platform,
          url: res2.url,
          username: res2.username,
          status: res2.status,
          confidence: res2.username === mainUsername ? "High" : "Possible"
        });
      }
    });
    const HIBP_KEY = process.env.HIBP_API_KEY;
    if (HIBP_KEY) {
      try {
        const breachRes = await import_axios.default.get(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
          headers: { "hibp-api-key": HIBP_KEY },
          timeout: 5e3
        });
        rawResults.breaches = (breachRes.data || []).map((b) => ({
          breach_name: b.Name,
          date: b.BreachDate,
          exposed_data: b.DataClasses,
          severity: b.DataClasses.length > 5 ? "high" : b.DataClasses.length > 2 ? "medium" : "low"
        }));
      } catch (e) {
        if (e.response?.status === 404) rawResults.breaches = [];
      }
    }
    const aggregated = aggregateResults(rawResults);
    (0, import_logActivity.logUserActivity)(req, "email_lookup", "Email Intelligence", { target: email, foundSources: aggregated.profile.sources });
    let findingId = null;
    if (caseId) {
      try {
        const finding = new import_Finding.default({
          caseId,
          findingType: "email_lookup",
          source: "Holehe OSINT Engine",
          email,
          data: rawResults,
          confidence: Math.min(100, aggregated.profile.sources.length * 20),
          // Confidence based on sources found
          isVerified: !!aggregated.profile.verified,
          tags: ["email-lookup", aggregated.profile.type || "webmail"]
        });
        const saved = await finding.save();
        findingId = saved._id;
      } catch (findingError) {
        console.error("Error saving finding:", findingError);
      }
    }
    res.json({
      email,
      status: aggregated.profile.sources.length > 0 ? "success" : "partial",
      ...aggregated,
      breaches: rawResults.breaches,
      holehe: rawResults.holehe,
      last_updated: (/* @__PURE__ */ new Date()).toISOString(),
      findingId
      // Return Finding ID for frontend reference
    });
  } catch (error) {
    console.error("Advanced Email lookup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const usernameLookup = async (req, res) => {
  const { username, caseId } = req.body;
  if (!username) {
    res.status(400).json({ message: "Target username required" });
    return;
  }
  try {
    const variations = (0, import_usernameUtils.generateUsernameVariations)(username);
    const results = [];
    const batchSize = 5;
    for (let i = 0; i < import_platforms.platforms.length; i += batchSize) {
      const batch = import_platforms.platforms.slice(i, i + batchSize);
      const batchTasks = batch.flatMap(
        (platform) => (
          // Only try variations for high-priority platforms or keep it simple
          [username].map(async (v) => {
            const probeRes = await probePlatformWithSignatures(v, platform);
            return {
              platform: platform.name,
              username: v,
              ...probeRes
            };
          })
        )
      );
      const batchResults = await Promise.all(batchTasks);
      results.push(...batchResults);
      if (i + batchSize < import_platforms.platforms.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    const foundCount = results.filter((r) => r.status === "found").length;
    const suspendedCount = results.filter((r) => r.status === "suspended").length;
    (0, import_logActivity.logUserActivity)(req, "username_scan", "Username Intelligence", {
      target: username,
      platformsScanned: import_platforms.platforms.length,
      found: foundCount,
      suspended: suspendedCount
    });
    let findingIds = [];
    if (caseId) {
      try {
        const foundMatches = results.filter((r) => r.status === "found" || r.status === "suspended");
        for (const match of foundMatches) {
          const finding = new import_Finding.default({
            caseId,
            findingType: "username_search",
            source: match.platform,
            username: match.username,
            data: match,
            confidence: match.status === "found" ? 95 : 70,
            isVerified: match.status === "found",
            tags: ["username-search", match.platform.toLowerCase()]
          });
          const saved = await finding.save();
          findingIds.push(saved._id.toString());
        }
      } catch (findingError) {
        console.error("Error saving username findings:", findingError);
      }
    }
    res.json({
      target: username,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      matches: results.filter((r) => r.status === "found" || r.status === "suspended"),
      summary: {
        total_scanned: import_platforms.platforms.length,
        found: foundCount,
        suspended: suspendedCount
      },
      findingIds
      // Return Finding IDs for frontend reference
    });
  } catch (error) {
    console.error("Username intelligence error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const extractMetadata = async (req, res) => {
  if (!req.file) {
    console.error("[METADATA_OSINT] Error: No file uploaded");
    res.status(400).json({ status: "error", message: "No file uploaded" });
    return;
  }
  const { filename, path: filePath, size, mimetype } = req.file;
  const { caseId } = req.body;
  const pythonPath = getPythonPath();
  const scriptPath = import_path.default.join(__dirname, "../scripts/metadata_engine.py");
  console.log(`[METADATA_OSINT] Received upload: ${filename} (${mimetype}, ${size} bytes)`);
  const cleanup = () => {
    if (import_fs.default.existsSync(filePath)) {
      import_fs.default.unlink(filePath, (err) => {
        if (err) console.error(`[METADATA_OSINT] Cleanup error for ${filename}:`, err);
        else console.log(`[METADATA_OSINT] Temp file deleted: ${filename}`);
      });
    }
  };
  try {
    const startTime = Date.now();
    console.log(`[METADATA_OSINT] Spawning process: ${pythonPath} ${scriptPath}`);
    const pythonProcess = (0, import_child_process.spawn)(pythonPath, [scriptPath, filePath]);
    let outputData = "";
    let errorData = "";
    let isFinished = false;
    const WATCHDOG_MS = parseInt(process.env.METADATA_TIMEOUT_MS || "") || 6e4;
    const timeout = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        try {
          pythonProcess.kill();
        } catch (e) {
        }
        cleanup();
        console.error(`[METADATA_OSINT] Timeout (${WATCHDOG_MS}ms) reached for: ${filename}`);
        if (!res.headersSent) {
          res.status(504).json({
            status: "error",
            message: `Forensic extraction timed out (${WATCHDOG_MS}ms max)`,
            error: "TIMEOUT"
          });
        }
      }
    }, WATCHDOG_MS);
    pythonProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });
    pythonProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });
    pythonProcess.on("close", async (code) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timeout);
      cleanup();
      const extractionTime = Date.now() - startTime;
      if (code !== 0) {
        console.error(`[METADATA_OSINT] Process crash [Code ${code}]: ${errorData}`);
        try {
          const parsed = JSON.parse(outputData || "{}");
          if (!res.headersSent) return res.status(200).json(parsed);
        } catch (parseErr) {
          try {
            const exifOut = await execPromise(`exiftool -json -G1 -n "${filePath}"`);
            const parsedExif = JSON.parse(exifOut.stdout || "[]");
            const exifResult = parsedExif[0] || { status: "error", message: "ExifTool returned empty" };
            if (!res.headersSent) return res.status(200).json({ status: "partial", exif: exifResult, engine_error: errorData });
          } catch (exifErr) {
            if (!res.headersSent) return res.status(500).json({ status: "error", message: "Forensic engine crash and ExifTool fallback failed", error: errorData });
          }
        }
        return;
      }
      try {
        const result = JSON.parse(outputData);
        console.log(`[METADATA_OSINT] Success: ${filename} processed in ${extractionTime}ms`);
        (0, import_logActivity.logUserActivity)(req, "metadata_extraction", "Metadata Forensic Engine", {
          filename,
          size,
          mimetype,
          processingTimeMs: extractionTime
        });
        let findingId = null;
        if (caseId) {
          try {
            const finding = new import_Finding.default({
              caseId,
              findingType: "metadata",
              source: "Metadata Forensic Engine",
              data: result,
              confidence: 95,
              // Metadata is usually accurate
              isVerified: true,
              tags: ["metadata", mimetype.split("/")[0] || "file"]
            });
            const saved = await finding.save();
            findingId = saved._id;
          } catch (findingError) {
            console.error("Error saving metadata finding:", findingError);
          }
        }
        res.json({ ...result, findingId });
      } catch (e) {
        console.error(`[METADATA_OSINT] Invalid JSON from engine: ${outputData}`);
        res.status(500).json({
          status: "error",
          message: "Failed to parse forensic data",
          error: outputData
        });
      }
    });
  } catch (error) {
    if (import_fs.default.existsSync(filePath)) import_fs.default.unlinkSync(filePath);
    console.error(`[METADATA_OSINT] Internal Controller Error:`, error);
    res.status(500).json({ status: "error", message: "Internal processing error" });
  }
};
const phoneLookupPK = async (req, res) => {
  const { phone, caseId } = req.body;
  const startTime = Date.now();
  console.log(`[PHONE_OSINT] Request received: ${phone} at ${(/* @__PURE__ */ new Date()).toISOString()}`);
  if (!phone) {
    res.status(400).json({ message: "Phone number required" });
    return;
  }
  const pythonPath = getPythonPath();
  const scriptPath = import_path.default.join(__dirname, "../scripts/phone_engine_pk.py");
  try {
    const pythonProcess = (0, import_child_process.spawn)(pythonPath, [scriptPath, phone]);
    let outputData = "";
    let errorData = "";
    let processFinished = false;
    const timeoutWatchdog = setTimeout(() => {
      if (!processFinished) {
        pythonProcess.kill();
        const timeoutMsg = `[PHONE_OSINT] Error: Process timed out for ${phone}`;
        console.error(timeoutMsg);
        if (!res.headersSent) {
          res.status(504).json({
            status: "error",
            error: "Timeout",
            message: "Telephony engine took too long to respond (5s limit)"
          });
        }
      }
    }, 5e3);
    pythonProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });
    pythonProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });
    pythonProcess.on("close", async (code) => {
      processFinished = true;
      clearTimeout(timeoutWatchdog);
      const duration = Date.now() - startTime;
      if (code !== 0) {
        const errorLog = `[PHONE_OSINT] Engine crashed. Code: ${code}, Stderr: ${errorData}`;
        console.error(errorLog);
        if (!res.headersSent) {
          res.status(500).json({
            status: "error",
            error: "Process Error",
            message: "Telephony engine failed to execute",
            details: errorData
          });
        }
        return;
      }
      try {
        const result = JSON.parse(outputData);
        console.log(`[PHONE_OSINT] Success: ${phone} processed in ${duration}ms`);
        (0, import_logActivity.logUserActivity)(req, "phone_lookup", "PK Phone Intelligence", {
          phone,
          processingTimeMs: duration
        });
        let findingId = null;
        if (caseId) {
          try {
            const finding = new import_Finding.default({
              caseId,
              findingType: "phone_lookup",
              source: "Pakistan Telephony Engine",
              phone,
              data: result,
              confidence: result.operator ? 85 : 60,
              isVerified: !!result.operator,
              tags: ["phone-lookup", "pakistan"]
            });
            const saved = await finding.save();
            findingId = saved._id;
          } catch (findingError) {
            console.error("Error saving phone finding:", findingError);
          }
        }
        if (!res.headersSent) {
          res.json({ ...result, findingId });
        }
      } catch (e) {
        const parseError = `[PHONE_OSINT] JSON Parse Error for ${phone}. Output: ${outputData}`;
        console.error(parseError);
        if (!res.headersSent) {
          res.status(500).json({
            status: "error",
            error: "Parse Error",
            message: "Invalid engine output format"
          });
        }
      }
    });
  } catch (error) {
    console.error(`[PHONE_OSINT] Controller Exception: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ status: "error", message: "Internal server error" });
    }
  }
};
const networkRecon = async (req, res) => {
  const { target, caseId } = req.body;
  if (!target) {
    res.status(400).json({ message: "Target (IP or Domain) required" });
    return;
  }
  try {
    const results = {
      target,
      shodan: null,
      virustotal: null,
      abuseipdb: null,
      censys: null,
      timestamp: /* @__PURE__ */ new Date()
    };
    const SHODAN_KEY = process.env.SHODAN_API_KEY;
    if (SHODAN_KEY) {
      try {
        const shodanRes = await import_axios.default.get(`https://api.shodan.io/shodan/host/${target}?key=${SHODAN_KEY}`, { timeout: 5e3 });
        results.shodan = shodanRes.data;
      } catch (e) {
        console.error("Shodan error:", target);
      }
    }
    const VT_KEY = process.env.VIRUSTOTAL_API_KEY;
    if (VT_KEY) {
      try {
        const vtRes = await import_axios.default.get(`https://www.virustotal.com/api/v3/ip_addresses/${target}`, {
          headers: { "x-apikey": VT_KEY },
          timeout: 5e3
        });
        results.virustotal = vtRes.data;
      } catch (e) {
        try {
          const vtDomainRes = await import_axios.default.get(`https://www.virustotal.com/api/v3/domains/${target}`, {
            headers: { "x-apikey": VT_KEY },
            timeout: 5e3
          });
          results.virustotal = vtDomainRes.data;
        } catch (err) {
          console.error("VT error:", target);
        }
      }
    }
    const ABUSE_KEY = process.env.ABUSEIPDB_API_KEY;
    if (ABUSE_KEY) {
      try {
        const abuseRes = await import_axios.default.get(`https://api.abuseipdb.com/api/v2/check`, {
          params: { ipAddress: target, maxAgeInDays: 90 },
          headers: { "Key": ABUSE_KEY, "Accept": "application/json" },
          timeout: 5e3
        });
        results.abuseipdb = abuseRes.data;
      } catch (e) {
        console.error("AbuseIPDB error:", target);
      }
    }
    const CENSYS_ID = process.env.CENSYS_API_ID;
    const CENSYS_SECRET = process.env.CENSYS_API_SECRET;
    if (CENSYS_ID && CENSYS_SECRET) {
      try {
        const auth = Buffer.from(`${CENSYS_ID}:${CENSYS_SECRET}`).toString("base64");
        const censysRes = await import_axios.default.get(`https://search.censys.io/api/v2/hosts/${target}`, {
          headers: { "Authorization": `Basic ${auth}` },
          timeout: 5e3
        });
        results.censys = censysRes.data;
      } catch (e) {
        console.error("Censys error:", target);
      }
    }
    (0, import_logActivity.logUserActivity)(req, "network_recon", "Network Intelligence", { target });
    if (caseId) {
      try {
        const finding = new import_Finding.default({
          caseId,
          findingType: "network_recon",
          source: "Multi-Source (Shodan, VT, AbuseIPDB, Censys)",
          data: results,
          confidence: 90,
          isVerified: true,
          tags: ["network", "recon"]
        });
        await finding.save();
      } catch (fError) {
        console.error("Error saving network finding");
      }
    }
    res.json(results);
  } catch (error) {
    console.error("Network recon error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const pasteSearch = async (req, res) => {
  const { query, caseId } = req.body;
  const API_KEY = process.env.PASTEBIN_API_KEY;
  if (!query) {
    res.status(400).json({ message: "Search query required" });
    return;
  }
  try {
    const results = {
      query,
      matches: [],
      timestamp: /* @__PURE__ */ new Date()
    };
    if (API_KEY) {
      console.log(`Searching Pastebin for: ${query}`);
    }
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Paste search failed" });
  }
};
const imageOSINT = async (req, res) => {
  const { caseId } = req.body;
  const file = req.file;
  if (!file) {
    res.status(400).json({ message: "No image file uploaded" });
    return;
  }
  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      res.status(500).json({ message: "Gemini API Key is not configured in backend environment" });
      return;
    }
    const genAI = new import_generative_ai.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const imagePath = file.path;
    const mimeType = file.mimetype;
    const imagePart = {
      inlineData: {
        data: import_fs.default.readFileSync(imagePath).toString("base64"),
        mimeType
      }
    };
    const userPrompt = `Perform an exhaustive visual forensic analysis on the attached image to extract OSINT and actionable intelligence.
Please provide a highly detailed, professional-grade analysis report covering:

1. **EXECUTIVE GEOLOCATION SUMMARY & ANALYSIS**:
   * Estimate the exact or approximate location where this image was captured.
   * Provide a detailed rationale citing recognizable landmarks, architectural styles, street signs, foliage/vegetation types, license plate formats, or utility pole configurations.
   * Attempt to estimate or guess coordinates (Latitude/Longitude) if possible, with an estimation confidence level (Low/Medium/High).

2. **VISUAL CLUES & SIGNATURE DETECTION**:
   * **Objects & Brands**: Identify specific car makes/models, brand logos on buildings/clothing, unique equipment, or manufactured products.
   * **Text & Typography**: Extract any readable text, street names, billboard advertisements, shop names, or language/script markings.
   * **Culture & Region**: Analyze signs of driving side (left/right hand drive), power plug outlets visible, specific clothing styles, or regional weather/terrain indications.

3. **METADATA & FORENSIC CHECKS**:
   * Identify any apparent visual anomalies or indications of digital tampering, synthetic generation (AI-generated features, blending errors), or double compression artifacts.

4. **INTELLIGENCE CORRELATIONS**:
   * Identify potential threat matrix contexts or other digital footprints that can link this image to a physical location, organization, or operational unit.

Please structure your report in clean, beautiful Markdown format with clear subheadings, and present your findings in a highly technical, investigative manner suitable for a cyber forensic presentation.`;
    const result = await model.generateContent([userPrompt, imagePart]);
    const responseText = result.response.text();
    try {
      import_fs.default.unlinkSync(imagePath);
    } catch (unlinkErr) {
      console.error("Error unlinking uploaded image file:", unlinkErr);
    }
    if (caseId) {
      try {
        const finding = new import_Finding.default({
          caseId,
          findingType: "image_osint",
          source: "Gemini AI Vision Engine",
          data: {
            analysis: responseText,
            fileName: file.originalname,
            mimeType: file.mimetype
          },
          confidence: 85,
          isVerified: true,
          tags: ["image-osint", "gemini-vision", "imint"]
        });
        await finding.save();
      } catch (saveErr) {
        console.error("Error saving image osint finding:", saveErr);
      }
    }
    res.json({
      success: true,
      analysis: responseText,
      fileName: file.originalname,
      mimeType: file.mimetype
    });
  } catch (error) {
    console.error("Image OSINT error:", error);
    res.status(500).json({
      message: "Error processing Image OSINT via Gemini API",
      error: error.message
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  emailLookup,
  extractMetadata,
  imageOSINT,
  networkRecon,
  nexusOSINTLookup,
  pasteSearch,
  phoneLookupPK,
  usernameLookup
});
