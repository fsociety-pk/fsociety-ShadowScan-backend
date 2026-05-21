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
var apiManagementController_exports = {};
__export(apiManagementController_exports, {
  getApiIntegrations: () => getApiIntegrations,
  updateApiIntegration: () => updateApiIntegration
});
module.exports = __toCommonJS(apiManagementController_exports);
const getApiIntegrations = async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: "virustotal", name: "VirusTotal", status: "connected", usage: "45%" },
      { id: "shodan", name: "Shodan", status: "connected", usage: "12%" },
      { id: "hunterio", name: "Hunter.io", status: "disconnected", usage: "0" }
    ]
  });
};
const updateApiIntegration = async (req, res) => {
  res.json({ success: true, message: `Integration ${req.params.id} updated (mock)` });
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getApiIntegrations,
  updateApiIntegration
});
