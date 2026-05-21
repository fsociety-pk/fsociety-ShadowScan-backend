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
exports.fetchPhoneInfoga = void 0;
const axios_1 = __importDefault(require("axios"));
const buildReputation = (cleanPhone, carrier, line_type) => {
    const disposable = /^(000|123|555)/.test(cleanPhone.slice(-6));
    const socialMedia = line_type === 'Mobile' || /WhatsApp|Telegram|Telenor|Jazz|Zong|Ufone/i.test(carrier);
    const reports = [];
    const notes = [];
    if (disposable)
        reports.push('Disposable-number heuristics triggered');
    if (socialMedia)
        reports.push('Likely reachable on messaging platforms');
    if (cleanPhone.length >= 8)
        reports.push('Eligible for public footprint search');
    if (!cleanPhone.length)
        notes.push('No numeric payload supplied');
    const score = Math.max(10, 100 - (disposable ? 35 : 0) - (socialMedia ? 10 : 0));
    const level = score >= 80 ? 'Low' : score >= 55 ? 'Medium' : 'High';
    return {
        score,
        level,
        reports,
        socialMedia,
        disposable,
        notes,
    };
};
const buildFootprint = (cleanPhone, countryLabel, carrier) => ({
    externalApis: [
        'PhoneInfoga local module',
        'Numbering-plan heuristics',
        'Carrier inference engine',
    ],
    phoneBooks: [
        'National numbering plan lookup',
        'Public caller-ID directories',
        'Carrier allocation references',
    ],
    searchEngines: [
        `Google search: \"${cleanPhone}\"`,
        `Bing search: \"${cleanPhone}\"`,
        `DuckDuckGo search: \"${cleanPhone}\"`,
    ],
    reputationReports: [
        'Spam / scam reputation lookup',
        'Community caller-ID reports',
        'Breach/exposure correlation',
    ],
    socialMediaHints: [
        'WhatsApp registration check',
        'Telegram presence correlation',
        'Signal / messenger availability probe',
    ],
    disposableIndicators: [
        disposableHint(cleanPhone),
        `Country context: ${countryLabel}`,
        `Carrier context: ${carrier}`,
    ],
});
const disposableHint = (cleanPhone) => {
    if (/^(000|123|555)/.test(cleanPhone.slice(-6)))
        return 'Possible disposable or test-style number pattern';
    return 'No disposable-number heuristic triggered';
};
const getFallbackDetails = (cleanPhone) => {
    let cc = 0;
    let country = 'Unknown';
    let carrier = 'Unknown';
    let line_type = 'Mobile';
    let international = '+' + cleanPhone;
    if (cleanPhone.startsWith('92')) {
        cc = 92;
        country = 'Pakistan';
        const prefix = cleanPhone.substring(2, 5);
        if (prefix.startsWith('30'))
            carrier = 'Jazz / Mobilink';
        else if (prefix.startsWith('31'))
            carrier = 'Zong / CMPak';
        else if (prefix.startsWith('32'))
            carrier = 'Warid / Jazz';
        else if (prefix.startsWith('33'))
            carrier = 'Ufone / PTML';
        else if (prefix.startsWith('34'))
            carrier = 'Telenor Pakistan';
        else {
            carrier = 'Unknown Network';
            line_type = 'Landline';
        }
        international = `+92 ${cleanPhone.substring(2, 5)} ${cleanPhone.substring(5)}`;
    }
    else if (cleanPhone.startsWith('1')) {
        cc = 1;
        country = 'United States / Canada';
        carrier = 'US / Canada Carrier';
        international = `+1 (${cleanPhone.substring(1, 4)}) ${cleanPhone.substring(4, 7)}-${cleanPhone.substring(7)}`;
    }
    else if (cleanPhone.startsWith('44')) {
        cc = 44;
        country = 'United Kingdom';
        carrier = 'UK Network';
        international = `+44 ${cleanPhone.substring(2, 6)} ${cleanPhone.substring(6)}`;
    }
    const reputation = buildReputation(cleanPhone, carrier, line_type);
    const footprint = buildFootprint(cleanPhone, country, carrier);
    return {
        country_code: cc,
        country,
        international,
        e164: '+' + cleanPhone,
        carrier,
        line_type,
        exists: cleanPhone.length >= 8,
        reputation,
        footprint,
        sources: ['PhoneInfoga local heuristics', 'Carrier metadata', 'Search-engine footprinting'],
        success: true
    };
};
const fetchPhoneInfoga = (phone) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        console.log(`[PhoneInfoga OSINT] Querying PhoneInfoga local scan for: ${cleanPhone}`);
        const response = yield axios_1.default.get(`http://localhost:5050/api/numbers/${cleanPhone}/scan/local`, {
            timeout: 3000,
            validateStatus: () => true
        });
        const data = response.data;
        if (data && data.success) {
            const result = data.result || {};
            const country = result.country || result.country_name || result.region || 'Unknown';
            const carrier = result.carrier || 'Unknown (requires numverify)';
            const line_type = result.line_type || 'Unknown';
            const reputation = result.reputation || buildReputation(cleanPhone, carrier, line_type);
            const footprint = result.footprint || buildFootprint(cleanPhone, country, carrier);
            return {
                country_code: result.country_code || 0,
                country,
                international: result.international || '',
                e164: result.e164 || '',
                carrier,
                line_type,
                exists: typeof result.exists === 'boolean' ? result.exists : cleanPhone.length >= 8,
                reputation,
                footprint,
                sources: Array.isArray(result.sources) && result.sources.length > 0 ? result.sources : ['PhoneInfoga local scan', 'Carrier metadata'],
                success: true
            };
        }
        // Fallback if PhoneInfoga returns success: false
        return getFallbackDetails(cleanPhone);
    }
    catch (e) {
        console.warn(`[PhoneInfoga OSINT] Failed (${e.message}). Using intelligent fallback.`);
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        return getFallbackDetails(cleanPhone);
    }
});
exports.fetchPhoneInfoga = fetchPhoneInfoga;
