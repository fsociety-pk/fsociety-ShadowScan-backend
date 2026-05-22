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
var kaliToolsController_exports = {};
__export(kaliToolsController_exports, {
  checkToolsAvailability: () => checkToolsAvailability,
  exiftoolMetadata: () => exiftoolMetadata,
  nmapScan: () => nmapScan,
  sherlockSearch: () => sherlockSearch,
  sherlockStream: () => sherlockStream,
  whoisLookup: () => whoisLookup
});
module.exports = __toCommonJS(kaliToolsController_exports);
var import_child_process = require("child_process");
var import_util = require("util");
var import_path = __toESM(require("path"));
var import_fs = __toESM(require("fs"));
var import_axios = __toESM(require("axios"));
var import_logActivity = require("../utils/logActivity");
var import_Finding = __toESM(require("../models/Finding"));
const execPromise = (0, import_util.promisify)(import_child_process.exec);
const toolExists = async (toolName) => {
  try {
    await execPromise(`which ${toolName}`);
    return true;
  } catch {
    return false;
  }
};
const sherlockSearch = async (req, res) => {
  const { username, caseId } = req.body;
  if (!username || username.trim().length === 0) {
    return res.status(400).json({ message: "Username required" });
  }
  const cleanUsername = username.trim().substring(0, 50);
  try {
    const normalizeStatus = (item) => {
      const status = String(item?.status || "").toLowerCase();
      const message = String(item?.message || item?.detail || item?.output || "").toLowerCase();
      if (status === "found" || item?.found === true) return "found";
      if (status === "rate_limit" || message.includes("rate limit") || message.includes("429")) return "rate_limit";
      if (status === "error" || item?.error || message.includes("error")) return "error";
      return "not_found";
    };
    const normalizePlatform = (item) => {
      const platformName = item?.platform || item?.site || item?.name || item?.title || "Unknown Platform";
      const url = item?.url || item?.link || item?.profile || "";
      const status = normalizeStatus(item);
      return {
        platform: platformName,
        url,
        status,
        statusCode: typeof item?.statusCode === "number" ? item.statusCode : status === "found" ? 200 : status === "rate_limit" ? 429 : status === "error" ? 500 : 404,
        message: item?.message || item?.detail || item?.note || ""
      };
    };
    const results = {
      tool: "Sherlock",
      username: cleanUsername,
      timestamp: /* @__PURE__ */ new Date(),
      platforms: [],
      method: "Unknown"
    };
    const hasSherlock = await toolExists("sherlock");
    if (!hasSherlock) {
      const FALLBACK_PLATFORMS = [
        { name: "GitHub", pattern: `https://github.com/${cleanUsername}` },
        { name: "Twitter", pattern: `https://twitter.com/${cleanUsername}` },
        { name: "Instagram", pattern: `https://instagram.com/${cleanUsername}` },
        { name: "Reddit", pattern: `https://reddit.com/user/${cleanUsername}` },
        { name: "LinkedIn", pattern: `https://linkedin.com/in/${cleanUsername}` },
        { name: "TikTok", pattern: `https://tiktok.com/@${cleanUsername}` },
        { name: "Facebook", pattern: `https://facebook.com/${cleanUsername}` },
        { name: "YouTube", pattern: `https://youtube.com/@${cleanUsername}` },
        { name: "Twitch", pattern: `https://twitch.tv/${cleanUsername}` },
        { name: "Pinterest", pattern: `https://pinterest.com/${cleanUsername}` },
        { name: "DeviantArt", pattern: `https://deviantart.com/${cleanUsername}` },
        { name: "Keybase", pattern: `https://keybase.io/${cleanUsername}` },
        { name: "Medium", pattern: `https://medium.com/@${cleanUsername}` },
        { name: "Telegram", pattern: `https://t.me/${cleanUsername}` },
        { name: "Steam", pattern: `https://steamcommunity.com/id/${cleanUsername}` }
      ];
      const foundPlatforms = [];
      for (const platform of FALLBACK_PLATFORMS) {
        try {
          const response = await import_axios.default.head(platform.pattern, {
            timeout: 5e3,
            headers: { "User-Agent": "Mozilla/5.0" },
            maxRedirects: 1,
            validateStatus: (s) => s < 500
          });
          if (response.status === 200 || response.status === 301 || response.status === 302) {
            foundPlatforms.push({
              platform: platform.name,
              url: platform.pattern,
              status: "found",
              statusCode: 200,
              message: "Profile found"
            });
          }
        } catch (err) {
        }
      }
      results.platforms = foundPlatforms.length > 0 ? foundPlatforms : FALLBACK_PLATFORMS.map((p) => ({
        platform: p.name,
        url: p.pattern,
        status: "not_found",
        statusCode: 404,
        message: "No profile found"
      }));
      results.method = "API-Fallback";
    } else {
      try {
        const { stdout, stderr } = await execPromise(
          `sherlock "${cleanUsername}" --print-all --json 2>&1`,
          { maxBuffer: 10 * 1024 * 1024, timeout: 6e4 }
          // 1 min timeout
        );
        const platformMap = /* @__PURE__ */ new Map();
        try {
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonData = JSON.parse(jsonMatch[0]);
            for (const [platform, data] of Object.entries(jsonData)) {
              if (data && typeof data === "object") {
                const item = data;
                const found = item.exists === true || item.found === true;
                platformMap.set(platform.toLowerCase(), {
                  platform,
                  found,
                  status: found ? "found" : "not_found",
                  url: item.url || "",
                  statusCode: found ? 200 : 404,
                  message: item.message || (found ? "Profile found" : "No profile found")
                });
              }
            }
          }
        } catch (jsonErr) {
          const lines = stdout.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (/^\[(\+|-|!|\*)\]/.test(trimmed)) {
              const match = trimmed.match(/^\[([+\-!*])\]\s*(.*?):\s*(.*)$/);
              if (match && match.length >= 4) {
                const flag = (match[1] || "").trim();
                const platform = (match[2] || "").trim();
                const detail = (match[3] || "").trim();
                const status = flag === "+" ? "found" : flag === "!" ? "rate_limit" : flag === "*" ? "error" : "not_found";
                if (platform) {
                  platformMap.set(platform.toLowerCase(), {
                    platform,
                    found: status === "found",
                    status,
                    url: status === "found" ? detail : "",
                    statusCode: status === "found" ? 200 : status === "rate_limit" ? 429 : status === "error" ? 500 : 404,
                    message: detail
                  });
                }
              }
            }
          }
        }
        const platforms = Array.from(platformMap.values()).map(normalizePlatform);
        results.platforms = platforms.length > 0 ? platforms : [];
        results.method = "Local-Sherlock";
        const reportPath = import_path.default.join(process.cwd(), `${cleanUsername}.txt`);
        if (import_fs.default.existsSync(reportPath)) {
          try {
            import_fs.default.unlinkSync(reportPath);
          } catch (_) {
          }
        }
      } catch (execError) {
        console.error("Sherlock exec error:", execError);
        results.platforms = [];
        results.method = "Failed";
        results.error = "Sherlock execution encountered an issue";
      }
    }
    (0, import_logActivity.logUserActivity)(req, "sherlock_search", "Sherlock Username Search", { target: cleanUsername });
    if (caseId) {
      try {
        const finding = new import_Finding.default({
          caseId,
          findingType: "sherlock_search",
          source: "Sherlock (OSINT)",
          username: cleanUsername,
          data: results,
          confidence: results.platforms.filter((p) => p.status === "found").length > 0 ? 85 : 20,
          isVerified: false,
          tags: ["sherlock", "username-search", "osint"]
        });
        await finding.save();
      } catch (findingError) {
        console.error("Error saving sherlock finding:", findingError);
      }
    }
    const foundCount = results.platforms.filter((p) => p.status === "found").length;
    const totalChecked = results.platforms.length || 0;
    const successRate = totalChecked > 0 ? `${(foundCount / totalChecked * 100).toFixed(2)}%` : "0%";
    res.json({
      ...results,
      summary: {
        totalPlatformsChecked: totalChecked,
        platformsFound: foundCount,
        successRate,
        status: foundCount > 0 ? "success" : "no_results"
      }
    });
  } catch (error) {
    console.error("Sherlock search error:", error);
    res.status(200).json({
      tool: "Sherlock",
      username: cleanUsername,
      platforms: [],
      summary: {
        totalPlatformsChecked: 0,
        platformsFound: 0,
        successRate: "0%",
        status: "error"
      },
      error: error.message || "Sherlock search encountered an error"
    });
  }
};
const sherlockStream = async (req, res) => {
  const { username, caseId } = req.query;
  if (!username) {
    res.status(400).json({ message: "Username required" });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}

`);
  };
  send({ type: "status", message: `[*] Starting username scan for: ${username}` });
  try {
    const hasSherlock = await toolExists("sherlock");
    if (!hasSherlock) {
      const PLATFORMS = [
        { name: "GitHub", url: `https://github.com/${username}` },
        { name: "Twitter", url: `https://twitter.com/${username}` },
        { name: "Instagram", url: `https://instagram.com/${username}` },
        { name: "Reddit", url: `https://reddit.com/user/${username}` },
        { name: "LinkedIn", url: `https://linkedin.com/in/${username}` },
        { name: "TikTok", url: `https://tiktok.com/@${username}` },
        { name: "Pinterest", url: `https://pinterest.com/${username}` },
        { name: "Twitch", url: `https://twitch.tv/${username}` },
        { name: "YouTube", url: `https://youtube.com/@${username}` },
        { name: "DeviantArt", url: `https://deviantart.com/${username}` },
        { name: "Keybase", url: `https://keybase.io/${username}` },
        { name: "Medium", url: `https://medium.com/@${username}` },
        { name: "Telegram", url: `https://t.me/${username}` },
        { name: "Steam", url: `https://steamcommunity.com/id/${username}` },
        { name: "Fiverr", url: `https://fiverr.com/${username}` },
        { name: "Replit", url: `https://replit.com/@${username}` },
        { name: "HackerNews", url: `https://news.ycombinator.com/user?id=${username}` },
        { name: "GitLab", url: `https://gitlab.com/${username}` },
        { name: "Codepen", url: `https://codepen.io/${username}` },
        { name: "Flickr", url: `https://flickr.com/people/${username}` },
        { name: "Pastebin", url: `https://pastebin.com/u/${username}` },
        { name: "NPM", url: `https://npmjs.com/~${username}` }
      ];
      const foundPlatforms = [];
      for (const platform of PLATFORMS) {
        send({ type: "log", message: `[~] Checking ${platform.name}...` });
        try {
          const httpResp = await import_axios.default.get(platform.url, {
            timeout: 5e3,
            headers: { "User-Agent": "Mozilla/5.0" },
            validateStatus: (s) => s < 500
          });
          const found = httpResp.status === 200;
          if (found) {
            send({ type: "found", platform: platform.name, url: platform.url, statusCode: httpResp.status });
            foundPlatforms.push({ platform: platform.name, found: true, url: platform.url, statusCode: httpResp.status });
          } else {
            send({ type: "not_found", platform: platform.name });
          }
        } catch {
          send({ type: "not_found", platform: platform.name });
        }
      }
      if (caseId) {
        try {
          const finding = new import_Finding.default({
            caseId,
            findingType: "username_search",
            source: "Username OSINT",
            username,
            data: { platforms: foundPlatforms, username },
            confidence: 80,
            isVerified: false,
            tags: ["username-search", "osint"]
          });
          await finding.save();
        } catch {
        }
      }
      send({ type: "done", summary: { totalChecked: PLATFORMS.length, found: foundPlatforms.length } });
    } else {
      const { spawn: spawn2 } = await import("child_process");
      const proc = spawn2("sherlock", [username, "--timeout", "10", "--print-found"], { stdio: ["ignore", "pipe", "pipe"] });
      const foundPlatforms = [];
      proc.stdout.on("data", (chunk) => {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.includes("[+]")) {
            const match = trimmed.match(/\[\+\]\s(.*?):\s(.*)/);
            if (match) {
              const platform = match[1].trim();
              const url = match[2].trim();
              foundPlatforms.push({ platform, found: true, url, statusCode: 200 });
              send({ type: "found", platform, url, statusCode: 200 });
            } else {
              send({ type: "log", message: trimmed });
            }
          } else {
            send({ type: "log", message: trimmed });
          }
        }
      });
      proc.stderr.on("data", (chunk) => {
        send({ type: "log", message: chunk.toString().trim() });
      });
      await new Promise((resolve) => proc.on("close", resolve));
      if (caseId && foundPlatforms.length > 0) {
        try {
          const finding = new import_Finding.default({
            caseId,
            findingType: "username_search",
            source: "Username OSINT",
            username,
            data: { platforms: foundPlatforms, username },
            confidence: 90,
            isVerified: false,
            tags: ["username-search", "sherlock"]
          });
          await finding.save();
        } catch {
        }
      }
      send({ type: "done", summary: { totalChecked: foundPlatforms.length + 10, found: foundPlatforms.length } });
    }
  } catch (err) {
    send({ type: "error", message: err.message || "Stream failed" });
  }
  res.end();
};
const exiftoolMetadata = async (req, res) => {
  const { caseId } = req.body;
  if (!req.file) {
    return res.status(400).json({ message: "File upload required" });
  }
  try {
    const filePath = req.file.path;
    const results = {
      tool: "ExifTool",
      filename: req.file.originalname,
      filesize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: /* @__PURE__ */ new Date(),
      metadata: {},
      sensitiveData: {
        gps: null,
        creator: null,
        copyright: null,
        software: null,
        cameraModel: null,
        dateTime: null,
        deviceId: null
      }
    };
    const hasExiftool = await toolExists("exiftool");
    if (!hasExiftool) {
      try {
        import_fs.default.unlinkSync(filePath);
      } catch (_) {
      }
      return res.status(200).json({
        ...results,
        method: "Unavailable",
        message: "ExifTool not installed. Install with: apt-get install exiftool"
      });
    }
    try {
      const { stdout } = await execPromise(`exiftool -json "${filePath}" 2>&1`, { maxBuffer: 5 * 1024 * 1024 });
      try {
        const metadata = JSON.parse(stdout);
        results.metadata = metadata[0] || {};
        results.method = "ExifTool";
        if (metadata[0]) {
          const data = metadata[0];
          results.sensitiveData = {
            gps: data.GPSLatitude ? {
              latitude: data.GPSLatitude,
              longitude: data.GPSLongitude,
              altitude: data.GPSAltitude
            } : null,
            creator: data.Creator || null,
            copyright: data.Copyright || null,
            software: data.Software || null,
            cameraModel: data.Model || null,
            dateTime: data.DateTime || data.DateTimeOriginal || null,
            deviceId: data.DeviceID || null
          };
        }
      } catch (parseErr) {
        results.metadata = { raw: stdout };
        results.method = "ExifTool (Raw)";
      }
    } catch (execError) {
      console.error("ExifTool error:", execError);
      results.method = "Failed";
      results.error = "ExifTool extraction failed";
    }
    (0, import_logActivity.logUserActivity)(req, "exiftool_metadata", "ExifTool Metadata Extraction", {
      filename: req.file.originalname
    });
    if (caseId) {
      try {
        const finding = new import_Finding.default({
          caseId,
          findingType: "metadata_extraction",
          source: "ExifTool (OSINT)",
          data: results,
          confidence: Object.values(results.sensitiveData).some((v) => v !== null) ? 90 : 40,
          isVerified: true,
          tags: ["exiftool", "metadata", req.file.mimetype.split("/")[0]]
        });
        await finding.save();
      } catch (findingError) {
        console.error("Error saving exiftool finding:", findingError);
      }
    }
    try {
      import_fs.default.unlinkSync(filePath);
    } catch (_) {
    }
    res.json({
      status: "success",
      ...results
    });
  } catch (error) {
    console.error("ExifTool metadata error:", error);
    try {
      import_fs.default.unlinkSync(req.file.path);
    } catch (_) {
    }
    res.status(200).json({
      message: "Metadata extraction encountered an issue",
      tool: "ExifTool",
      status: "error",
      error: error.message
    });
  }
};
const whoisLookup = async (req, res) => {
  const { target, caseId } = req.body;
  if (!target || target.trim().length === 0) {
    return res.status(400).json({ message: "Target domain or IP required" });
  }
  const cleanTarget = target.trim().substring(0, 255);
  try {
    const results = {
      tool: "Whois",
      target: cleanTarget,
      timestamp: /* @__PURE__ */ new Date(),
      data: {},
      summary: {
        registrar: null,
        registrationDate: null,
        expirationDate: null,
        nameServers: [],
        organization: null,
        address: null,
        email: null,
        phone: null
      }
    };
    const hasWhois = await toolExists("whois");
    if (!hasWhois) {
      return res.status(200).json({
        ...results,
        method: "Unavailable",
        message: "Whois tool not installed. Install with: apt-get install whois"
      });
    }
    try {
      const { stdout, stderr } = await execPromise(`whois "${cleanTarget}" 2>&1`, { maxBuffer: 5 * 1024 * 1024, timeout: 15e3 });
      const output = stdout || stderr;
      const lines = output.split("\n");
      const data = {};
      lines.forEach((line) => {
        if (line.includes(":")) {
          const colonIndex = line.indexOf(":");
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          if (key && value) {
            data[key] = value;
          }
        }
      });
      results.data = data;
      results.method = "Local-Whois";
      results.summary = {
        registrar: data["Registrar"] || data["registrar"] || data["Sponsoring Registrar"] || null,
        registrationDate: data["Creation Date"] || data["created"] || data["Created Date"] || null,
        expirationDate: data["Registry Expiry Date"] || data["expiry_date"] || data["Expiration Date"] || null,
        nameServers: lines.filter((l) => l.toLowerCase().includes("name server") || l.toLowerCase().includes("nameserver")).map((l) => l.split(":")[1]?.trim()).filter(Boolean) || [],
        organization: data["Organization"] || data["organisation"] || data["Org"] || null,
        address: data["Address"] || data["address"] || null,
        email: data["Email"] || data["email"] || data["admin-email"] || null,
        phone: data["Phone"] || data["phone"] || data["admin-phone"] || null
      };
    } catch (execError) {
      console.error("Whois error:", execError);
      results.method = "Failed";
      results.error = "Whois lookup failed";
    }
    (0, import_logActivity.logUserActivity)(req, "whois_lookup", "Whois Domain/IP Lookup", { target: cleanTarget });
    if (caseId) {
      try {
        const finding = new import_Finding.default({
          caseId,
          findingType: "whois_lookup",
          source: "Whois (OSINT)",
          domain: cleanTarget,
          data: results,
          confidence: results.summary.registrar ? 85 : 40,
          isVerified: true,
          tags: ["whois", "domain-info", "osint"]
        });
        await finding.save();
      } catch (findingError) {
        console.error("Error saving whois finding:", findingError);
      }
    }
    res.json({
      status: "success",
      ...results
    });
  } catch (error) {
    console.error("Whois lookup error:", error);
    res.status(200).json({
      tool: "Whois",
      target: cleanTarget,
      status: "error",
      message: error.message || "Whois lookup encountered an issue"
    });
  }
};
const nmapScan = async (req, res) => {
  return res.status(410).json({
    message: "Nmap tool has been deprecated and removed. Use DNS reconnaissance or API-based scanning instead."
  });
};
const checkToolsAvailability = async (req, res) => {
  const tools = ["sherlock", "exiftool", "whois", "dnsrecon", "recon-ng"];
  const availability = {};
  try {
    for (const tool of tools) {
      availability[tool] = await toolExists(tool);
    }
    res.json({
      status: "success",
      timestamp: /* @__PURE__ */ new Date(),
      tools: availability,
      installed: Object.values(availability).filter(Boolean).length,
      total: tools.length,
      recommendation: Object.values(availability).filter(Boolean).length < 3 ? "Install Kali tools for enhanced OSINT capabilities: sudo apt-get install sherlock exiftool whois" : "Major tools are available",
      deprecated: {
        nmap: "Removed - use DNS reconnaissance or API-based scanning",
        theharvester: "Removed - use email OSINT tools instead"
      }
    });
  } catch (error) {
    console.error("Tool availability check error:", error);
    res.status(500).json({ message: "Failed to check tool availability" });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkToolsAvailability,
  exiftoolMetadata,
  nmapScan,
  sherlockSearch,
  sherlockStream,
  whoisLookup
});
