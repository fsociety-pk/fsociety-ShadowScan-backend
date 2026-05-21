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
var chatController_exports = {};
__export(chatController_exports, {
  handleChat: () => handleChat
});
module.exports = __toCommonJS(chatController_exports);
var import_groq_sdk = __toESM(require("groq-sdk"));
const groq = new import_groq_sdk.default({
  apiKey: process.env.GROQ_API_KEY || "dummy_key"
});
const handleChat = async (req, res) => {
  try {
    const { message, history, image_url } = req.body;
    if (!message && !image_url) {
      return res.status(400).json({ success: false, message: "Message or image is required" });
    }
    const systemPrompt = {
      role: "system",
      content: `You are an advanced AI OSINT (Open Source Intelligence) Assistant integrated into the ShadowScan Platform. 
Your primary goal is to help users with investigations, explain findings, answer general security questions, and produce practical guidance.

Available tool tabs at \`/tools\`:
- **Username Lookup** (powered by Sherlock) - Page link: \`[Username Lookup](/tools?tool=username)\`
- **Email Intelligence** (powered by Holehe) - Page link: \`[Email Intelligence](/tools?tool=email)\`
- **DNS Lookup** (powered by Whois) - Page link: \`[DNS Lookup](/tools?tool=dns)\`
- **Metadata Forensic Extractor** (powered by ExifTool) - Page link: \`[Metadata Extractor](/tools?tool=metadata)\`
- **WhatsApp OSINT** - Page link: \`[WhatsApp OSINT](/tools?tool=phone)\`

Rules:
1. Answer the user's actual question directly; do not force every reply into tool recommendations.
2. When the user asks about choosing a tool, include the direct link(s) above.
3. For report or analysis requests, provide structured output with headings, bullet points, and concise interpretations.
4. Maintain a professional, clear tone. Do not assist with illegal activity or unauthorized access.
5. Keep answers actionable and context-aware.`
    };
    let userContent = message || "Analyze this image.";
    if (image_url) {
      userContent = [
        { type: "text", text: message || "Please perform OSINT analysis on this image." },
        { type: "image_url", image_url: { url: image_url } }
      ];
    }
    const messages = [
      systemPrompt,
      ...history || [],
      { role: "user", content: userContent }
    ];
    if (!process.env.GROQ_API_KEY) {
      const fallback = message ? `I can help with analysis, report structuring, and OSINT guidance. I currently cannot reach Groq because \`GROQ_API_KEY\` is not configured on the server. Once configured, ask me again and I will provide full AI responses.

Quick start:
- Use [Username Lookup](/tools?tool=username) for handles
- Use [Email Intelligence](/tools?tool=email) for email traces
- Use [WhatsApp OSINT](/tools?tool=phone) for phone intelligence
- Use [DNS Lookup](/tools?tool=dns) for domains` : "Please send a question or an image for analysis.";
      return res.json({ success: true, reply: fallback });
    }
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: image_url ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile",
      temperature: 0.45,
      max_tokens: 1200
    });
    const reply = chatCompletion.choices[0]?.message?.content || "Error: Could not generate a response.";
    res.json({
      success: true,
      reply
    });
  } catch (error) {
    console.error("Groq Chat Error:", error?.response?.data || error.message || error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to process chat request",
      details: error?.response?.data || null
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handleChat
});
