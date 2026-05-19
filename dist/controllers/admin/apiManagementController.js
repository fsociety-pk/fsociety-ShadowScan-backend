"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateApiIntegration = exports.getApiIntegrations = void 0;
const getApiIntegrations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json({
        success: true,
        data: [
            { id: 'virustotal', name: 'VirusTotal', status: 'connected', usage: '45%' },
            { id: 'shodan', name: 'Shodan', status: 'connected', usage: '12%' },
            { id: 'hunterio', name: 'Hunter.io', status: 'disconnected', usage: '0' }
        ]
    });
});
exports.getApiIntegrations = getApiIntegrations;
const updateApiIntegration = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json({ success: true, message: `Integration ${req.params.id} updated (mock)` });
});
exports.updateApiIntegration = updateApiIntegration;
