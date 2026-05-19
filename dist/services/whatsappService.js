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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWhatsAppProfile = void 0;
const axios_1 = __importDefault(require("axios"));
const fetchWhatsAppProfile = (cleanPhone) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost1 = process.env.RAPIDAPI_HOST || 'whatsapp-data1.p.rapidapi.com';
    const apiHost2 = process.env.PROFILE_PIC_HOST || 'whatsapp-profile-pic.p.rapidapi.com';
    const apiHost3 = process.env.VALID_WHATSAPP_HOST || 'valid-whatsapp.p.rapidapi.com';
    if (!apiKey || apiKey.trim() === '' || apiKey.startsWith('your_')) {
        throw new Error('WhatsApp intelligence provider is not configured');
    }
    try {
        console.log(`[WhatsApp OSINT] Querying primary Engine 1 (whatsapp-data1) for: ${cleanPhone}`);
        const response = yield axios_1.default.get(`https://${apiHost1}/number/${cleanPhone}`, {
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': apiHost1
            },
            timeout: 25000,
            validateStatus: () => true
        });
        const result = response.data;
        if (result && (result.number || result.exists !== undefined || result.phone)) {
            const isBusiness = !!result.isBusiness || !!result.businessProfile;
            let name = 'N/A';
            if (result.name)
                name = result.name;
            else if ((_a = result.businessProfile) === null || _a === void 0 ? void 0 : _a.localized_display_name)
                name = result.businessProfile.localized_display_name;
            else if (result.verifiedName)
                name = result.verifiedName;
            let status = 'Active WhatsApp User';
            if (result.about)
                status = result.about;
            else if (result.status)
                status = result.status;
            else if (isBusiness)
                status = 'Verified WhatsApp Business Account';
            const image = result.profilePic || result.urlImage || result.image || "";
            return {
                phone: result.phone || `+${cleanPhone}`,
                name: isBusiness && name === 'N/A' ? 'Verified Business' : (name === 'N/A' ? 'Active WhatsApp User' : name),
                status,
                image,
                is_business: isBusiness,
                exists: result.exists !== false,
                source: 'WhatsApp Profile Engine',
                last_updated: new Date().toISOString()
            };
        }
    }
    catch (e) {
        console.warn('[WhatsApp OSINT] Primary Engine 1 failed:', e.message);
    }
    // Engine 2 fallback
    try {
        console.log(`[WhatsApp OSINT] Querying Engine 2 (whatsapp-profile-pic) for: ${cleanPhone}`);
        const response = yield axios_1.default.get(`https://${apiHost2}/isbiz`, {
            headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': apiHost2 },
            params: { phone: cleanPhone },
            timeout: 15000,
            validateStatus: () => true
        });
        const result = response.data;
        if (result && result.isbiz !== undefined) {
            const isBusiness = result.isbiz !== 'Not a Business Account';
            return {
                phone: `+${cleanPhone}`,
                name: isBusiness ? 'Verified WhatsApp Business' : 'Active WhatsApp User',
                status: isBusiness ? 'Verified WhatsApp Business Account' : 'Active WhatsApp User Profile',
                image: '',
                is_business: isBusiness,
                exists: true,
                source: 'WhatsApp Profile Pic Network',
                last_updated: new Date().toISOString()
            };
        }
    }
    catch (e) {
        console.warn('[WhatsApp OSINT] Engine 2 failed:', e.message);
    }
    // Engine 3 fallback
    try {
        console.log(`[WhatsApp OSINT] Querying Engine 3 (valid-whatsapp) for: ${cleanPhone}`);
        const response = yield axios_1.default.get(`https://${apiHost3}/isbiz`, {
            headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': apiHost3 },
            params: { phone: cleanPhone },
            timeout: 15000,
            validateStatus: () => true
        });
        const result = response.data;
        if (result && result.isbiz !== undefined) {
            const isBusiness = result.isbiz !== 'Not a Business Account';
            return {
                phone: `+${cleanPhone}`,
                name: isBusiness ? 'Verified WhatsApp Business' : 'Active WhatsApp User',
                status: isBusiness ? 'Verified WhatsApp Business Account' : 'Active WhatsApp User Profile',
                image: '',
                is_business: isBusiness,
                exists: true,
                source: 'WhatsApp Verification Network',
                last_updated: new Date().toISOString()
            };
        }
    }
    catch (e) {
        console.warn('[WhatsApp OSINT] Engine 3 failed:', e.message);
    }
    throw new Error('WhatsApp intelligence providers did not return usable data');
});
exports.fetchWhatsAppProfile = fetchWhatsAppProfile;
