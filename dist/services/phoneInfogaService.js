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
const fetchPhoneInfoga = (phone) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cleanPhone = phone.replace(/[^0-9+]/g, '').replace('+', '%2B');
        console.log(`[PhoneInfoga OSINT] Querying PhoneInfoga local scan for: ${cleanPhone}`);
        const response = yield axios_1.default.get(`http://localhost:5050/api/numbers/${cleanPhone}/scan/local`, {
            timeout: 10000,
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
        return {
            country_code: 0,
            international: '',
            e164: '',
            carrier: 'Unknown',
            line_type: 'Unknown',
            success: false
        };
    }
    catch (e) {
        console.warn('[PhoneInfoga OSINT] Failed:', e.message);
        return {
            country_code: 0,
            international: '',
            e164: '',
            carrier: 'Unknown',
            line_type: 'Unknown',
            success: false
        };
    }
});
exports.fetchPhoneInfoga = fetchPhoneInfoga;
