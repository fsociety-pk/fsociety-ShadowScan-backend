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
var whatsappService_exports = {};
__export(whatsappService_exports, {
  fetchWhatsAppProfile: () => fetchWhatsAppProfile
});
module.exports = __toCommonJS(whatsappService_exports);
var import_axios = __toESM(require("axios"));
const fetchWhatsAppProfile = async (cleanPhone) => {
  const apiKey = process.env.RAPIDAPI_KEY;
  const apiHost1 = process.env.RAPIDAPI_HOST || "whatsapp-data1.p.rapidapi.com";
  const apiHost2 = process.env.PROFILE_PIC_HOST || "whatsapp-profile-pic.p.rapidapi.com";
  const apiHost3 = process.env.VALID_WHATSAPP_HOST || "valid-whatsapp.p.rapidapi.com";
  if (!apiKey || apiKey.trim() === "" || apiKey.startsWith("your_")) {
    throw new Error("WhatsApp intelligence provider is not configured");
  }
  try {
    console.log(`[WhatsApp OSINT] Querying primary Engine 1 (whatsapp-data1) for: ${cleanPhone}`);
    const response = await import_axios.default.get(`https://${apiHost1}/number/${cleanPhone}`, {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": apiHost1
      },
      timeout: 25e3,
      validateStatus: () => true
    });
    const result = response.data;
    if (result && (result.number || result.exists !== void 0 || result.phone)) {
      const isBusiness = !!result.isBusiness || !!result.businessProfile;
      let name = "N/A";
      if (result.name) name = result.name;
      else if (result.businessProfile?.localized_display_name) name = result.businessProfile.localized_display_name;
      else if (result.verifiedName) name = result.verifiedName;
      let status = "Active WhatsApp User";
      if (result.about) status = result.about;
      else if (result.status) status = result.status;
      else if (isBusiness) status = "Verified WhatsApp Business Account";
      const image = result.profilePic || result.urlImage || result.image || "";
      return {
        phone: result.phone || `+${cleanPhone}`,
        name: isBusiness && name === "N/A" ? "Verified Business" : name === "N/A" ? "Active WhatsApp User" : name,
        status,
        image,
        is_business: isBusiness,
        exists: result.exists !== false,
        source: "WhatsApp Profile Engine",
        last_updated: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  } catch (e) {
    console.warn("[WhatsApp OSINT] Primary Engine 1 failed:", e.message);
  }
  try {
    console.log(`[WhatsApp OSINT] Querying Engine 2 (whatsapp-profile-pic) for: ${cleanPhone}`);
    const response = await import_axios.default.get(`https://${apiHost2}/isbiz`, {
      headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": apiHost2 },
      params: { phone: cleanPhone },
      timeout: 15e3,
      validateStatus: () => true
    });
    const result = response.data;
    if (result && result.isbiz !== void 0) {
      const isBusiness = result.isbiz !== "Not a Business Account";
      return {
        phone: `+${cleanPhone}`,
        name: isBusiness ? "Verified WhatsApp Business" : "Active WhatsApp User",
        status: isBusiness ? "Verified WhatsApp Business Account" : "Active WhatsApp User Profile",
        image: "",
        is_business: isBusiness,
        exists: true,
        source: "WhatsApp Profile Pic Network",
        last_updated: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  } catch (e) {
    console.warn("[WhatsApp OSINT] Engine 2 failed:", e.message);
  }
  try {
    console.log(`[WhatsApp OSINT] Querying Engine 3 (valid-whatsapp) for: ${cleanPhone}`);
    const response = await import_axios.default.get(`https://${apiHost3}/isbiz`, {
      headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": apiHost3 },
      params: { phone: cleanPhone },
      timeout: 15e3,
      validateStatus: () => true
    });
    const result = response.data;
    if (result && result.isbiz !== void 0) {
      const isBusiness = result.isbiz !== "Not a Business Account";
      return {
        phone: `+${cleanPhone}`,
        name: isBusiness ? "Verified WhatsApp Business" : "Active WhatsApp User",
        status: isBusiness ? "Verified WhatsApp Business Account" : "Active WhatsApp User Profile",
        image: "",
        is_business: isBusiness,
        exists: true,
        source: "WhatsApp Verification Network",
        last_updated: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  } catch (e) {
    console.warn("[WhatsApp OSINT] Engine 3 failed:", e.message);
  }
  throw new Error("WhatsApp intelligence providers did not return usable data");
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  fetchWhatsAppProfile
});
