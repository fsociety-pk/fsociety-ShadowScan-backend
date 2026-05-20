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
const getFallbackDetails = (cleanPhone) => {
    let cc = 0;
    let carrier = 'Unknown';
    let line_type = 'Mobile';
    let international = '+' + cleanPhone;
    if (cleanPhone.startsWith('92')) {
        cc = 92;
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
        carrier = 'US / Canada Carrier';
        international = `+1 (${cleanPhone.substring(1, 4)}) ${cleanPhone.substring(4, 7)}-${cleanPhone.substring(7)}`;
    }
    else if (cleanPhone.startsWith('44')) {
        cc = 44;
        carrier = 'UK Network';
        international = `+44 ${cleanPhone.substring(2, 6)} ${cleanPhone.substring(6)}`;
    }
    return {
        country_code: cc,
        international,
        e164: '+' + cleanPhone,
        carrier,
        line_type,
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
            return {
                country_code: data.result.country_code || 0,
                international: data.result.international || '',
                e164: data.result.e164 || '',
                carrier: data.result.carrier || 'Unknown (requires numverify)',
                line_type: data.result.line_type || 'Unknown',
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
