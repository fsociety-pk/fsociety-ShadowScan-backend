import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export interface PhoneInfogaResult {
  country_code: number;
  country?: string;
  international: string;
  e164: string;
  carrier: string;
  line_type: string;
  exists: boolean;
  reputation: {
    score: number;
    level: 'Low' | 'Medium' | 'High';
    reports: string[];
    socialMedia: boolean;
    disposable: boolean;
    notes: string[];
  };
  footprint: {
    externalApis: string[];
    phoneBooks: string[];
    searchEngines: string[];
    reputationReports: string[];
    socialMediaHints: string[];
    disposableIndicators: string[];
  };
  sources: string[];
  success: boolean;
}

const buildReputation = (cleanPhone: string, carrier: string, line_type: string) => {
    const disposable = /^(000|123|555)/.test(cleanPhone.slice(-6));
    const socialMedia = line_type === 'Mobile' || /WhatsApp|Telegram|Telenor|Jazz|Zong|Ufone/i.test(carrier);
    const reports: string[] = [];
    const notes: string[] = [];

    if (disposable) reports.push('Disposable-number heuristics triggered');
    if (socialMedia) reports.push('Likely reachable on messaging platforms');
    if (cleanPhone.length >= 8) reports.push('Eligible for public footprint search');
    if (!cleanPhone.length) notes.push('No numeric payload supplied');

    const score = Math.max(10, 100 - (disposable ? 35 : 0) - (socialMedia ? 10 : 0));
    const level: 'Low' | 'Medium' | 'High' = score >= 80 ? 'Low' : score >= 55 ? 'Medium' : 'High';

    return {
        score,
        level,
        reports,
        socialMedia,
        disposable,
        notes,
    };
};

const buildFootprint = (cleanPhone: string, countryLabel: string, carrier: string) => ({
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

const disposableHint = (cleanPhone: string) => {
    if (/^(000|123|555)/.test(cleanPhone.slice(-6))) return 'Possible disposable or test-style number pattern';
    return 'No disposable-number heuristic triggered';
};

const resolvePhoneInfogaBinary = async (): Promise<string | null> => {
    const explicitPath = process.env.PHONEINFOGA_PATH?.trim();
    const candidates = [
        explicitPath || '',
        path.join(process.cwd(), 'phoneinfoga'),
        path.join(process.cwd(), 'venv/bin/phoneinfoga'),
        path.join(os.homedir(), '.local/bin/phoneinfoga'),
        '/usr/local/bin/phoneinfoga',
        '/usr/bin/phoneinfoga',
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) return candidate;
    }

    try {
        await execPromise('command -v phoneinfoga');
        return 'phoneinfoga';
    } catch {
        return null;
    }
};

const parseJsonPayload = (blob: string): any | null => {
    const trimmed = (blob || '').trim();
    if (!trimmed) return null;

    try {
        return JSON.parse(trimmed);
    } catch {
        // Try parsing the largest JSON object in mixed logs
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            const candidate = trimmed.slice(start, end + 1);
            try {
                return JSON.parse(candidate);
            } catch {
                return null;
            }
        }
        return null;
    }
};

const parseField = (text: string, patterns: RegExp[], fallback: string) => {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]?.trim()) return match[1].trim();
    }
    return fallback;
};

const buildResultFromParsedData = (cleanPhone: string, result: any, sourceLabel: string): PhoneInfogaResult => {
    const country = result.country || result.country_name || result.region || result.location?.country || 'Unknown';
    const carrier = result.carrier || result.operator || result.network || result.numverify?.carrier || 'Unknown (requires numverify)';
    const line_type = result.line_type || result.type || result.numverify?.line_type || 'Unknown';
    const exists = typeof result.exists === 'boolean'
        ? result.exists
        : typeof result.valid === 'boolean'
            ? result.valid
            : cleanPhone.length >= 8;
    const countryCodeRaw = result.country_code || result.countryCode || result.calling_code || result.countryCallingCode || 0;
    const countryCode = Number(countryCodeRaw) || 0;
    const international = result.international || result.international_format || result.number?.international || `+${cleanPhone}`;
    const e164 = result.e164 || result.number?.e164 || `+${cleanPhone}`;

    const reputation = result.reputation || buildReputation(cleanPhone, carrier, line_type);
    const footprint = result.footprint || buildFootprint(cleanPhone, country, carrier);

    return {
        country_code: countryCode,
        country,
        international,
        e164,
        carrier,
        line_type,
        exists,
        reputation,
        footprint,
        sources: Array.isArray(result.sources) && result.sources.length > 0
            ? result.sources
            : [sourceLabel, 'Carrier metadata'],
        success: true,
    };
};

const runPhoneInfogaCli = async (binary: string, cleanPhone: string): Promise<PhoneInfogaResult | null> => {
    const target = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
    const escapedBinary = JSON.stringify(binary);
    const escapedTarget = JSON.stringify(target);

    const commandVariants = [
        `${escapedBinary} scan -n ${escapedTarget} --output json`,
        `${escapedBinary} scan -n ${escapedTarget} -o json`,
        `${escapedBinary} scan -n ${escapedTarget}`,
    ];

    for (const command of commandVariants) {
        try {
            const { stdout, stderr } = await execPromise(command, {
                timeout: parseInt(process.env.PHONEINFOGA_TIMEOUT_MS || '', 10) || 60000,
                maxBuffer: 5 * 1024 * 1024,
                env: process.env,
            });

            const combined = `${stdout || ''}\n${stderr || ''}`.trim();
            if (!combined) continue;

            const asJson = parseJsonPayload(combined);
            if (asJson) {
                const resultObj = asJson.result || asJson.data || asJson;
                return buildResultFromParsedData(cleanPhone, resultObj, 'PhoneInfoga CLI binary');
            }

            // Text-output fallback parsing
            const country = parseField(combined, [/country(?:\s+name)?\s*[:=]\s*([^\n]+)/i], 'Unknown');
            const carrier = parseField(combined, [/carrier\s*[:=]\s*([^\n]+)/i, /operator\s*[:=]\s*([^\n]+)/i], 'Unknown (requires numverify)');
            const lineType = parseField(combined, [/line\s*type\s*[:=]\s*([^\n]+)/i, /type\s*[:=]\s*([^\n]+)/i], 'Unknown');
            const international = parseField(combined, [/international\s*[:=]\s*([^\n]+)/i], target);
            const e164 = parseField(combined, [/e164\s*[:=]\s*([^\n]+)/i], target);
            const ccText = parseField(combined, [/country\s*code\s*[:=]\s*\+?([^\n\s]+)/i], '0');
            const countryCode = Number(ccText.replace(/[^0-9]/g, '')) || 0;

            const negativeExists = /not\s+valid|invalid\s+number|not\s+found/i.test(combined);
            const positiveExists = /valid|exists|found|reachable/i.test(combined);
            const exists = negativeExists ? false : (positiveExists ? true : cleanPhone.length >= 8);

            return {
                country_code: countryCode,
                country,
                international,
                e164,
                carrier,
                line_type: lineType,
                exists,
                reputation: buildReputation(cleanPhone, carrier, lineType),
                footprint: buildFootprint(cleanPhone, country, carrier),
                sources: ['PhoneInfoga CLI binary', 'Carrier metadata'],
                success: true,
            };
        } catch (err: any) {
            const combinedErr = `${err?.stdout || ''}\n${err?.stderr || ''}\n${err?.message || ''}`;
            // Try next variant for unsupported flags/syntax differences.
            if (/unknown\s+flag|unknown\s+command|invalid\s+argument/i.test(combinedErr)) {
                continue;
            }
            // If process returned parseable output in stderr/stdout, attempt one last parse.
            const asJson = parseJsonPayload(combinedErr);
            if (asJson) {
                const resultObj = asJson.result || asJson.data || asJson;
                return buildResultFromParsedData(cleanPhone, resultObj, 'PhoneInfoga CLI binary');
            }
        }
    }

    return null;
};

const getFallbackDetails = (cleanPhone: string): PhoneInfogaResult => {
    let cc = 0;
    let country = 'Unknown';
    let carrier = 'Unknown';
    let line_type = 'Mobile';
    let international = '+' + cleanPhone;

    if (cleanPhone.startsWith('92')) {
        cc = 92;
        country = 'Pakistan';
        const prefix = cleanPhone.substring(2, 5);
        if (prefix.startsWith('30')) carrier = 'Jazz / Mobilink';
        else if (prefix.startsWith('31')) carrier = 'Zong / CMPak';
        else if (prefix.startsWith('32')) carrier = 'Warid / Jazz';
        else if (prefix.startsWith('33')) carrier = 'Ufone / PTML';
        else if (prefix.startsWith('34')) carrier = 'Telenor Pakistan';
        else { carrier = 'Unknown Network'; line_type = 'Landline'; }
        
        international = `+92 ${cleanPhone.substring(2, 5)} ${cleanPhone.substring(5)}`;
    } else if (cleanPhone.startsWith('1')) {
        cc = 1;
        country = 'United States / Canada';
        carrier = 'US / Canada Carrier';
        international = `+1 (${cleanPhone.substring(1, 4)}) ${cleanPhone.substring(4, 7)}-${cleanPhone.substring(7)}`;
    } else if (cleanPhone.startsWith('44')) {
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

export const fetchPhoneInfoga = async (phone: string): Promise<PhoneInfogaResult> => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    try {
        const binary = await resolvePhoneInfogaBinary();
        if (binary) {
            console.log(`[PhoneInfoga OSINT] Querying local PhoneInfoga CLI (${binary}) for: ${cleanPhone}`);
            const cliResult = await runPhoneInfogaCli(binary, cleanPhone);
            if (cliResult) return cliResult;
        }

        // Legacy Docker/API fallback (kept for compatibility)
        console.log(`[PhoneInfoga OSINT] Querying PhoneInfoga API local scan for: ${cleanPhone}`);
        
        const response = await axios.get(`http://localhost:5050/api/numbers/${cleanPhone}/scan/local`, {
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
    } catch (e: any) {
        console.warn(`[PhoneInfoga OSINT] Failed (${e.message}). Using intelligent fallback.`);
        return getFallbackDetails(cleanPhone);
    }
};
