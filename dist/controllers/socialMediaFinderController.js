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
var socialMediaFinderController_exports = {};
__export(socialMediaFinderController_exports, {
  findSocialMediaProfiles: () => findSocialMediaProfiles,
  quickSocialMediaLookup: () => quickSocialMediaLookup
});
module.exports = __toCommonJS(socialMediaFinderController_exports);
var import_axios = __toESM(require("axios"));
var import_logActivity = require("../utils/logActivity");
var import_Finding = __toESM(require("../models/Finding"));
const extractUsernamesFromEmail = (email) => {
  const usernames = /* @__PURE__ */ new Set();
  const [localPart] = email.split("@");
  usernames.add(localPart);
  usernames.add(localPart.replace(/[._-]/g, ""));
  usernames.add(localPart.replace(/\./g, "_"));
  usernames.add(localPart.replace(/\./g, "-"));
  const parts = localPart.split(/[._-]/);
  if (parts.length > 1) {
    usernames.add(`${parts[0]}${parts[1]}`);
    usernames.add(`${parts[1]}${parts[0]}`);
    usernames.add(parts[0]);
    usernames.add(parts[1]);
    usernames.add(`${parts[0]}.${parts[1]}`);
    usernames.add(`${parts[0]}_${parts[1]}`);
  }
  const withoutNumbers = localPart.replace(/\d+$/, "");
  if (withoutNumbers !== localPart) usernames.add(withoutNumbers);
  return Array.from(usernames).slice(0, 12);
};
const checkPlatform = async (username, platform) => {
  try {
    const url = platform.url_pattern.replace("{username}", encodeURIComponent(username));
    const response = await import_axios.default.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml"
      },
      timeout: 5e3,
      maxRedirects: 3,
      validateStatus: () => true
    });
    const statusCode = response.status;
    const html = response.data;
    const isFound = platform.status_code ? statusCode === platform.status_code : html && html.length > 100 && !html.toLowerCase().includes("not found");
    if (isFound) {
      return {
        platform: platform.name,
        username,
        profileUrl: url,
        found: true,
        verified: true,
        detectionMethod: "HTTP-Status"
      };
    }
    return null;
  } catch (error) {
    return null;
  }
};
const findSocialMediaProfiles = async (req, res) => {
  const { input, caseId } = req.body;
  if (!input || input.trim().length === 0) {
    return res.status(400).json({ message: "Username or email required" });
  }
  try {
    const results = {
      input,
      inputType: input.includes("@") ? "email" : "username",
      timestamp: /* @__PURE__ */ new Date(),
      profiles: [],
      summary: {
        totalPlatformsChecked: 0,
        profilesFound: 0,
        verified: 0
      }
    };
    let usernamesToCheck = [];
    if (input.includes("@")) {
      usernamesToCheck = extractUsernamesFromEmail(input);
    } else {
      usernamesToCheck = [input];
    }
    const platforms = [
      // Social Networks
      { name: "Twitter", url_pattern: "https://twitter.com/{username}", status_code: 200 },
      { name: "Instagram", url_pattern: "https://instagram.com/{username}/", status_code: 200 },
      { name: "Facebook", url_pattern: "https://facebook.com/{username}", status_code: 200 },
      { name: "TikTok", url_pattern: "https://tiktok.com/@{username}", status_code: 200 },
      { name: "LinkedIn", url_pattern: "https://linkedin.com/in/{username}", status_code: 200 },
      { name: "LinkedIn (URL slug)", url_pattern: "https://www.linkedin.com/in/{username}/", status_code: 200 },
      { name: "Snapchat", url_pattern: "https://snapchat.com/add/{username}", status_code: 200 },
      { name: "Pinterest", url_pattern: "https://pinterest.com/{username}", status_code: 200 },
      { name: "Reddit", url_pattern: "https://reddit.com/user/{username}", status_code: 200 },
      { name: "Mastodon", url_pattern: "https://mastodon.social/@{username}", status_code: 200 },
      { name: "Bluesky", url_pattern: "https://bsky.app/profile/{username}", status_code: 200 },
      { name: "Threads", url_pattern: "https://threads.net/@{username}", status_code: 200 },
      // Developer Platforms
      { name: "GitHub", url_pattern: "https://github.com/{username}", status_code: 200 },
      { name: "GitLab", url_pattern: "https://gitlab.com/{username}", status_code: 200 },
      { name: "Bitbucket", url_pattern: "https://bitbucket.org/{username}", status_code: 200 },
      { name: "Stack Overflow", url_pattern: "https://stackoverflow.com/users/*//{username}", status_code: 200 },
      { name: "CodePen", url_pattern: "https://codepen.io/{username}", status_code: 200 },
      { name: "Repl.it", url_pattern: "https://repl.it/@{username}", status_code: 200 },
      { name: "Glitch", url_pattern: "https://glitch.com/@{username}", status_code: 200 },
      // Video Platforms
      { name: "YouTube", url_pattern: "https://youtube.com/@{username}", status_code: 200 },
      { name: "Twitch", url_pattern: "https://twitch.tv/{username}", status_code: 200 },
      { name: "Rumble", url_pattern: "https://rumble.com/c/{username}", status_code: 200 },
      { name: "Dailymotion", url_pattern: "https://dailymotion.com/{username}", status_code: 200 },
      { name: "Vimeo", url_pattern: "https://vimeo.com/{username}", status_code: 200 },
      // Streaming & Gaming
      { name: "Steam", url_pattern: "https://steamcommunity.com/search/users/{username}", status_code: 200 },
      { name: "Discord", url_pattern: "https://discordapp.com/users/{username}", status_code: 200 },
      { name: "Xbox Live", url_pattern: "https://xboxgamertag.com/search/{username}", status_code: 200 },
      { name: "PlayStation", url_pattern: "https://psnprofiles.com/{username}", status_code: 200 },
      // Music Platforms
      { name: "Spotify", url_pattern: "https://open.spotify.com/user/{username}", status_code: 200 },
      { name: "SoundCloud", url_pattern: "https://soundcloud.com/{username}", status_code: 200 },
      { name: "Bandcamp", url_pattern: "https://bandcamp.com/{username}", status_code: 200 },
      // Photo & Creative
      { name: "Flickr", url_pattern: "https://flickr.com/photos/{username}", status_code: 200 },
      { name: "DeviantArt", url_pattern: "https://deviantart.com/{username}", status_code: 200 },
      { name: "Behance", url_pattern: "https://behance.net/{username}", status_code: 200 },
      { name: "ArtStation", url_pattern: "https://artstation.com/{username}", status_code: 200 },
      // Blogging & Content
      { name: "Medium", url_pattern: "https://medium.com/@{username}", status_code: 200 },
      { name: "Substack", url_pattern: "https://substack.com/@{username}", status_code: 200 },
      { name: "Quora", url_pattern: "https://quora.com/profile/{username}", status_code: 200 },
      { name: "Rumble Blog", url_pattern: "https://rumble.com/user/{username}", status_code: 200 },
      // Messaging & Community
      { name: "Telegram", url_pattern: "https://t.me/{username}", status_code: 200 },
      { name: "Slack", url_pattern: "https://workspace.slack.com/archives/{username}", status_code: 200 },
      { name: "Nextdoor", url_pattern: "https://nextdoor.com/{username}", status_code: 200 },
      // Forum & Discussion
      { name: "4chan", url_pattern: "https://boards.4chan.org/g/search/username/{username}", status_code: 200 },
      { name: "HackerNews", url_pattern: "https://news.ycombinator.com/user?id={username}", status_code: 200 },
      // Job & Professional
      { name: "AngelList", url_pattern: "https://angel.co/{username}", status_code: 200 },
      { name: "Indeed", url_pattern: "https://profiles.indeed.com/{username}", status_code: 200 },
      // Fitness & Lifestyle
      { name: "MyFitnessPal", url_pattern: "https://www.myfitnesspal.com/profile/{username}", status_code: 200 },
      { name: "Strava", url_pattern: "https://strava.com/athletes/{username}", status_code: 200 },
      // Dating & Social
      { name: "Tinder", url_pattern: "https://tinder.com/@{username}", status_code: 200 },
      { name: "Badoo", url_pattern: "https://badoo.com/{username}", status_code: 200 },
      // Shopping & Marketplace
      { name: "eBay", url_pattern: "https://ebay.com/usr/{username}", status_code: 200 },
      { name: "Etsy", url_pattern: "https://etsy.com/shop/{username}", status_code: 200 },
      { name: "Amazon Seller", url_pattern: "https://amazon.com/s?field-keywords={username}", status_code: 200 },
      // Travel & Reviews
      { name: "TripAdvisor", url_pattern: "https://tripadvisor.com/members/{username}", status_code: 200 },
      { name: "Yelp", url_pattern: "https://yelp.com/user_details?userid={username}", status_code: 200 },
      // Cryptocurrency
      { name: "Coinbase", url_pattern: "https://coinbase.com/addresses/{username}", status_code: 200 }
    ];
    const foundProfiles = [];
    for (const username of usernamesToCheck) {
      for (const platform of platforms) {
        const profile = await checkPlatform(username, platform);
        if (profile) {
          profile.username = username;
          foundProfiles.push(profile);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    const uniqueProfiles = Array.from(
      new Map(foundProfiles.map((p) => [p.profileUrl, p])).values()
    );
    results.profiles = uniqueProfiles;
    results.summary.totalPlatformsChecked = platforms.length * usernamesToCheck.length;
    results.summary.profilesFound = uniqueProfiles.length;
    results.summary.verified = uniqueProfiles.filter((p) => p.verified).length;
    results.byCategory = {
      social_networks: uniqueProfiles.filter(
        (p) => ["Twitter", "Instagram", "Facebook", "TikTok", "LinkedIn", "Snapchat", "Pinterest", "Reddit", "Mastodon", "Bluesky", "Threads"].includes(p.platform)
      ),
      developer: uniqueProfiles.filter(
        (p) => ["GitHub", "GitLab", "Bitbucket", "Stack Overflow", "CodePen", "Repl.it", "Glitch"].includes(p.platform)
      ),
      content: uniqueProfiles.filter(
        (p) => ["YouTube", "Twitch", "Medium", "Substack", "Rumble", "Dailymotion"].includes(p.platform)
      ),
      gaming: uniqueProfiles.filter(
        (p) => ["Steam", "Discord", "Xbox Live", "PlayStation", "Twitch"].includes(p.platform)
      ),
      other: uniqueProfiles.filter(
        (p) => ![
          "Twitter",
          "Instagram",
          "Facebook",
          "TikTok",
          "LinkedIn",
          "Snapchat",
          "Pinterest",
          "Reddit",
          "Mastodon",
          "Bluesky",
          "Threads",
          "GitHub",
          "GitLab",
          "Bitbucket",
          "Stack Overflow",
          "CodePen",
          "Repl.it",
          "Glitch",
          "YouTube",
          "Twitch",
          "Medium",
          "Substack",
          "Rumble",
          "Dailymotion",
          "Steam",
          "Discord",
          "Xbox Live",
          "PlayStation"
        ].includes(p.platform)
      )
    };
    (0, import_logActivity.logUserActivity)(req, "social_media_finder", "Social Media Profile Finder", {
      input,
      profilesFound: uniqueProfiles.length
    });
    if (caseId) {
      try {
        const finding = new import_Finding.default({
          caseId,
          findingType: "social_media_profiles",
          source: "Social Media Profile Finder (Multi-Platform OSINT)",
          username: input,
          data: results,
          confidence: 95,
          isVerified: true,
          tags: ["social-media", "osint", "multi-platform", ...uniqueProfiles.map((p) => p.platform.toLowerCase())]
        });
        await finding.save();
      } catch (findingError) {
        console.error("Error saving social media finding:", findingError);
      }
    }
    res.json(results);
  } catch (error) {
    console.error("Social media finder error:", error);
    res.status(500).json({ message: "Social media profile search failed" });
  }
};
const quickSocialMediaLookup = async (req, res) => {
  const { input } = req.body;
  if (!input) {
    return res.status(400).json({ message: "Username or email required" });
  }
  try {
    const topPlatforms = [
      { name: "Twitter", url_pattern: "https://twitter.com/{username}" },
      { name: "Instagram", url_pattern: "https://instagram.com/{username}/" },
      { name: "GitHub", url_pattern: "https://github.com/{username}" },
      { name: "LinkedIn", url_pattern: "https://linkedin.com/in/{username}" },
      { name: "TikTok", url_pattern: "https://tiktok.com/@{username}" },
      { name: "Reddit", url_pattern: "https://reddit.com/user/{username}" },
      { name: "YouTube", url_pattern: "https://youtube.com/@{username}" },
      { name: "Twitch", url_pattern: "https://twitch.tv/{username}" },
      { name: "Facebook", url_pattern: "https://facebook.com/{username}" },
      { name: "Discord", url_pattern: "https://discordapp.com/users/{username}" },
      { name: "Medium", url_pattern: "https://medium.com/@{username}" },
      { name: "DeviantArt", url_pattern: "https://deviantart.com/{username}" },
      { name: "Snapchat", url_pattern: "https://snapchat.com/add/{username}" },
      { name: "Telegram", url_pattern: "https://t.me/{username}" },
      { name: "Pinterest", url_pattern: "https://pinterest.com/{username}" }
    ];
    const username = input.includes("@") ? extractUsernamesFromEmail(input)[0] : input;
    const quickResults = [];
    for (const platform of topPlatforms) {
      const profile = await checkPlatform(username, platform);
      if (profile) {
        quickResults.push(profile);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    res.json({
      input,
      foundProfiles: quickResults,
      count: quickResults.length,
      timestamp: /* @__PURE__ */ new Date()
    });
  } catch (error) {
    console.error("Quick lookup error:", error);
    res.status(500).json({ message: "Quick lookup failed" });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  findSocialMediaProfiles,
  quickSocialMediaLookup
});
