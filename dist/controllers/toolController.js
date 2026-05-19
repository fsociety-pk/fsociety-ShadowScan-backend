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
exports.imageOSINT = exports.pasteSearch = exports.networkRecon = exports.phoneLookupPK = exports.extractMetadata = exports.usernameLookup = exports.emailLookup = exports.nexusOSINTLookup = void 0;
const generative_ai_1 = require("@google/generative-ai");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execPromise = (0, util_1.promisify)(child_process_1.exec);
const platforms_1 = require("../config/platforms");
const usernameUtils_1 = require("../utils/usernameUtils");
const requestManager_1 = require("../utils/requestManager");
const logActivity_1 = require("../utils/logActivity");
const Finding_1 = __importDefault(require("../models/Finding"));
const whatsappService_1 = require("../services/whatsappService");
const phoneInfogaService_1 = require("../services/phoneInfogaService");
/**
 * Extract possible usernames from an email address (Enhanced)
 */
const extractUsernames = (email) => {
    const handle = email.split('@')[0].toLowerCase();
    const usernames = new Set();
    usernames.add(handle); // john.doe
    usernames.add(handle.replace(/[._-]/g, '')); // johndoe
    // Add underscore variation
    if (handle.includes('.'))
        usernames.add(handle.replace(/\./g, '_')); // john_doe
    if (handle.includes('_'))
        usernames.add(handle.replace(/_/g, '.')); // john.doe
    // Add number-less variation (if ends with numbers, targets common naming patterns)
    usernames.add(handle.replace(/\d+$/, ''));
    // Split variations
    const parts = handle.split(/[._-]/);
    if (parts.length > 1) {
        parts.forEach(part => {
            if (part.length > 2)
                usernames.add(part); // john, doe
        });
        // Reversed parts
        if (parts.length === 2) {
            usernames.add(`${parts[1]}.${parts[0]}`);
            usernames.add(`${parts[1]}${parts[0]}`);
        }
    }
    return Array.from(usernames).slice(0, 8); // Expanded to 8 variations
};
/**
 * Detect email type
 */
// Helper to find Python path (venv or system)
const getPythonPath = () => {
    const venvPath = path_1.default.join(__dirname, '../../venv/bin/python');
    if (fs_1.default.existsSync(venvPath))
        return venvPath;
    return 'python3';
};
const getEmailProviderType = (email) => {
    const commonWebmail = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'me.com', 'aol.com'];
    const domain = email.split('@')[1].toLowerCase();
    if (commonWebmail.includes(domain))
        return 'webmail';
    // Simplified disposable list (in real world use a library or extensive list)
    if (['yopmail.com', 'mailinator.com', 'tempmail.com'].includes(domain))
        return 'disposable';
    return 'corporate';
};
/**
 * Calculate match percentage based on signatures
 */
const calculateMatchPercentage = (html, signatures) => {
    if (!signatures || signatures.length === 0)
        return 0;
    let matches = 0;
    signatures.forEach(sig => {
        if (html.toLowerCase().includes(sig.toLowerCase())) {
            matches++;
        }
    });
    return (matches / signatures.length) * 100;
};
/**
 * Enhanced probe using HTML signatures and percentage matching
 */
const probePlatformWithSignatures = (username, platform) => __awaiter(void 0, void 0, void 0, function* () {
    const url = platform.url_pattern.replace('{username}', username);
    const isSpecial = ['github', 'linkedin'].includes(platform.name.toLowerCase());
    // Step 1: Handle strict delays for special platforms
    if (isSpecial) {
        yield (0, requestManager_1.enforceDelay)(platform.name);
    }
    const axiosConfig = isSpecial ? (0, requestManager_1.getRequestConfig)(platform.name) : {
        headers: {
            'User-Agent': (0, requestManager_1.getRandomUA)(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 8000,
        validateStatus: () => true
    };
    let response;
    let retries = 1;
    const performRequest = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const res = yield axios_1.default.get(url, axiosConfig);
            // If blocked (403/429), try one more time with a different UA
            if ((res.status === 403 || res.status === 429) && retries > 0) {
                retries--;
                yield new Promise(resolve => setTimeout(resolve, 2000));
                if (axiosConfig.headers)
                    axiosConfig.headers['User-Agent'] = (0, requestManager_1.getRandomUA)();
                return performRequest();
            }
            return res;
        }
        catch (e) {
            if (retries > 0 && (!e.response || e.response.status >= 500)) {
                retries--;
                yield new Promise(resolve => setTimeout(resolve, 2000));
                return performRequest();
            }
            throw e;
        }
    });
    try {
        response = yield performRequest();
        let html = response.data ? response.data.toString() : '';
        let status = response.status;
        // Trust Status 200 for major platforms
        if (status === 200) {
            // Check for soft 404s just in case
            if (platform.not_found_signatures.some(sig => html.includes(sig))) {
                return { status: 'not_found', url, confidence: 0.9 };
            }
            if (platform.suspended_signatures.some(sig => html.includes(sig))) {
                return { status: 'suspended', url, confidence: 0.9 };
            }
            // Otherwise, it's definitely found
            return { status: 'found', url, confidence: platform.confidence_weight || 0.9 };
        }
        else if (status === 404) {
            return { status: 'not_found', url, confidence: 0.99 };
        }
        else if (status === 403 || status === 429) {
            // Blocked by platform, return unknown
            return { status: 'unknown', url, message: 'Blocked by rate limiting/WAF', confidence: 0 };
        }
        else if (status === 410) {
            return { status: 'suspended', url, confidence: 0.99 };
        }
        return { status: 'not_found', url, confidence: 0.5 };
    }
    catch (e) {
        return { status: 'error', url, message: 'Connection failed', confidence: 0 };
    }
});
/**
 * Legacy probe (Refactored to use signatures internally if platform exists)
 */
const probePlatform = (username, platformName) => __awaiter(void 0, void 0, void 0, function* () {
    const config = platforms_1.platforms.find(p => p.name.toLowerCase() === platformName.toLowerCase());
    if (config) {
        const res = yield probePlatformWithSignatures(username, config);
        return { found: res.status === 'found', url: res.status === 'found' ? res.url : '' };
    }
    // Fallback for undocumented platforms
    const fallbackUrls = {
        facebook: `https://www.facebook.com/${username}`,
        x: `https://x.com/${username}`,
        github_pages: `https://${username}.github.io/`
    };
    const url = fallbackUrls[platformName];
    if (!url)
        return { found: false, url: '' };
    try {
        const response = yield axios_1.default.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 4000,
            validateStatus: (status) => status < 500
        });
        const isFound = response.status === 200 && !response.data.includes('Page Not Found');
        return { found: isFound, url: isFound ? url : '' };
    }
    catch (e) {
        return { found: false, url: '' };
    }
});
/**
 * Holehe: Advanced Email OSINT tool integration
 */
const lookupHolehe = (email) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve) => {
        // Execute holehe --no-color <email> to get ALL platforms checked (confirmed, unused, rate limited, errors)
        const process = (0, child_process_1.spawn)('holehe', ['--no-color', email]);
        let output = '';
        const timeout = setTimeout(() => {
            process.kill();
            resolve(null);
        }, 40000); // 40 seconds timeout for full lookup of all 120+ platforms
        process.stdout.on('data', (data) => {
            output += data.toString();
        });
        process.stderr.on('data', (data) => {
            output += data.toString();
        });
        process.on('close', () => {
            clearTimeout(timeout);
            try {
                const lines = output.split('\n');
                const sites = [];
                for (const line of lines) {
                    let status = null;
                    if (line.includes('[+] '))
                        status = 'found';
                    else if (line.includes('[-] '))
                        status = 'not_found';
                    else if (line.includes('[x] '))
                        status = 'rate_limit';
                    else if (line.includes('[!] '))
                        status = 'error';
                    if (status) {
                        const parts = line.split(/\[\+\]|\[-\]|\[x\]|\[!\]/);
                        if (parts.length >= 2) {
                            let domainPart = parts[1].trim();
                            // strip trailing slash and anything after it (like / •••••••••••90)
                            if (domainPart.includes('/')) {
                                domainPart = domainPart.split('/')[0].trim();
                            }
                            const domain = domainPart.trim();
                            if (domain) {
                                sites.push({ domain, status });
                            }
                        }
                    }
                }
                resolve({
                    raw: output,
                    sites
                });
            }
            catch (e) {
                resolve(null);
            }
        });
    });
});
/**
 * NexusOSINT: WhatsApp OSINT + PhoneInfoga lookup
 */
const nexusOSINTLookup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { phone, caseId } = req.body;
    if (!phone) {
        res.status(400).json({ message: 'Phone number required' });
        return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    try {
        // Run both WhatsApp and PhoneInfoga lookups in parallel
        const [whatsappResult, phoneInfogaResult] = yield Promise.allSettled([
            (0, whatsappService_1.fetchWhatsAppProfile)(cleanPhone),
            (0, phoneInfogaService_1.fetchPhoneInfoga)(phone)
        ]);
        let combinedResult = {
            targetPhone: `+${cleanPhone}`,
            last_updated: new Date().toISOString(),
            source: 'NexusOSINT Engine',
            exists: false
        };
        if (whatsappResult.status === 'fulfilled') {
            combinedResult = Object.assign(Object.assign({}, combinedResult), { whatsapp: whatsappResult.value, exists: true });
        }
        else {
            combinedResult.whatsapp = null;
            combinedResult.whatsappError = whatsappResult.reason.message;
        }
        if (phoneInfogaResult.status === 'fulfilled') {
            combinedResult = Object.assign(Object.assign({}, combinedResult), { phoneinfoga: phoneInfogaResult.value });
        }
        else {
            combinedResult.phoneinfoga = null;
        }
        if (!combinedResult.whatsapp && !((_a = combinedResult.phoneinfoga) === null || _a === void 0 ? void 0 : _a.success)) {
            res.status(502).json({ message: 'NexusOSINT providers did not return usable data', error: combinedResult.whatsappError });
            return;
        }
        (0, logActivity_1.logUserActivity)(req, 'phone_lookup', 'NexusOSINT Intelligence', { phone: cleanPhone });
        if (caseId) {
            try {
                const finding = new Finding_1.default({
                    caseId,
                    findingType: 'phone_lookup',
                    source: 'NexusOSINT',
                    phone: `+${cleanPhone}`,
                    data: combinedResult,
                    confidence: ((_b = combinedResult.whatsapp) === null || _b === void 0 ? void 0 : _b.exists) ? 95 : 70,
                    isVerified: !!((_c = combinedResult.whatsapp) === null || _c === void 0 ? void 0 : _c.exists),
                    tags: ['nexus-osint', 'whatsapp', 'phoneinfoga'],
                });
                yield finding.save();
            }
            catch (fError) {
                console.error('Error saving NexusOSINT finding');
            }
        }
        res.json(combinedResult);
    }
    catch (error) {
        console.error('NexusOSINT Error:', error);
        res.status(500).json({ message: 'Internal server error during phone lookup' });
    }
});
exports.nexusOSINTLookup = nexusOSINTLookup;
/**
 * Aggregate Results and Scoring for Holehe
 */
const aggregateResults = (raw) => {
    var _a, _b, _c;
    const profile = {
        name: ((_a = raw.gravatar) === null || _a === void 0 ? void 0 : _a.aboutMe) || 'Unknown',
        avatar: ((_b = raw.gravatar) === null || _b === void 0 ? void 0 : _b.thumbnailUrl) || null,
        bio: ((_c = raw.gravatar) === null || _c === void 0 ? void 0 : _c.aboutMe) || null,
        location: null,
        sources: [],
        confidence_score: 0
    };
    const professional = {
        company: null,
        title: null,
        domain: raw.email.split('@')[1],
        department: null
    };
    // Social Profiles Deduplication
    const socialMap = new Map();
    // Add from APIs
    const apiSocials = [
        ...raw.discoveredLinks
    ];
    apiSocials.forEach(s => {
        const plat = s.platform.toLowerCase();
        if (!socialMap.has(plat) || s.confidence === 'High') {
            socialMap.set(plat, Object.assign(Object.assign({}, s), { verified: s.confidence === 'High' }));
        }
    });
    // Scoring Logic (Simplified)
    let score = 0;
    if (raw.holehe) {
        score += 0.8;
        profile.sources.push('Holehe Engine');
    }
    if (raw.gravatar) {
        score += 0.1;
        profile.sources.push('Gravatar');
    }
    profile.confidence_score = Math.min(Math.round(score * 100) / 100, 1.0);
    profile.verified = profile.confidence_score > 0.6;
    return {
        profile,
        professional,
        social_profiles: Array.from(socialMap.values()),
        email_type: getEmailProviderType(raw.email)
    };
};
/**
 * Email Lookup OSINT Controller - PROFILE DISCOVERY
 */
const emailLookup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { email, caseId } = req.body;
    if (!email || !email.includes('@')) {
        res.status(400).json({ message: 'Valid email required' });
        return;
    }
    try {
        const rawResults = {
            email,
            timestamp: new Date(),
            gravatar: null,
            holehe: null,
            breaches: [],
            discoveredLinks: []
        };
        const targetUsernames = extractUsernames(email);
        const mainUsername = targetUsernames[0];
        // 1. Parallel Enrichment
        const [gravatar, holehe] = yield Promise.all([
            (() => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                const hash = crypto_1.default.createHash('md5').update(email.toLowerCase()).digest('hex');
                try {
                    const gravRes = yield axios_1.default.get(`https://en.gravatar.com/${hash}.json`, { timeout: 3000 });
                    return (_a = gravRes.data.entry) === null || _a === void 0 ? void 0 : _a[0];
                }
                catch (_b) {
                    return null;
                }
            }))(),
            lookupHolehe(email)
        ]);
        rawResults.gravatar = gravatar;
        rawResults.holehe = holehe;
        // Inject Holehe found domains directly into discoveredLinks
        if (holehe && holehe.sites) {
            holehe.sites.forEach(siteObj => {
                const site = siteObj.domain;
                const platformName = site.split('.')[0];
                const capitalized = platformName.charAt(0).toUpperCase() + platformName.slice(1);
                rawResults.discoveredLinks.push({
                    platform: capitalized,
                    url: `https://${site}`,
                    username: email,
                    status: siteObj.status,
                    confidence: siteObj.status === 'found' ? 'High' : 'Possible'
                });
            });
        }
        // 2. Parallel Social Probing (Enhanced to use ALL platforms)
        const discoveryTasks = [];
        platforms_1.platforms.forEach(platform => {
            targetUsernames.forEach(username => {
                discoveryTasks.push(probePlatformWithSignatures(username, platform).then(res => (Object.assign(Object.assign({}, res), { platform: platform.name, username }))));
            });
        });
        const discoveryResults = yield Promise.all(discoveryTasks);
        const foundPlatforms = new Set();
        discoveryResults.forEach(res => {
            if ((res.status === 'found' || res.status === 'suspended') && !foundPlatforms.has(res.platform)) {
                foundPlatforms.add(res.platform);
                rawResults.discoveredLinks.push({
                    platform: res.platform,
                    url: res.url,
                    username: res.username,
                    status: res.status,
                    confidence: res.username === mainUsername ? 'High' : 'Possible'
                });
            }
        });
        // 3. Breach Check
        const HIBP_KEY = process.env.HIBP_API_KEY;
        if (HIBP_KEY) {
            try {
                const breachRes = yield axios_1.default.get(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
                    headers: { 'hibp-api-key': HIBP_KEY },
                    timeout: 5000
                });
                rawResults.breaches = (breachRes.data || []).map((b) => ({
                    breach_name: b.Name,
                    date: b.BreachDate,
                    exposed_data: b.DataClasses,
                    severity: b.DataClasses.length > 5 ? 'high' : b.DataClasses.length > 2 ? 'medium' : 'low'
                }));
            }
            catch (e) {
                if (((_a = e.response) === null || _a === void 0 ? void 0 : _a.status) === 404)
                    rawResults.breaches = [];
            }
        }
        // 4. Final Aggregation
        const aggregated = aggregateResults(rawResults);
        // LOGGING ACTION
        (0, logActivity_1.logUserActivity)(req, 'email_lookup', 'Email Intelligence', { target: email, foundSources: aggregated.profile.sources });
        // 5. Save Finding if caseId provided
        let findingId = null;
        if (caseId) {
            try {
                const finding = new Finding_1.default({
                    caseId,
                    findingType: 'email_lookup',
                    source: 'Holehe OSINT Engine',
                    email,
                    data: rawResults,
                    confidence: Math.min(100, aggregated.profile.sources.length * 20), // Confidence based on sources found
                    isVerified: !!aggregated.profile.verified,
                    tags: ['email-lookup', aggregated.profile.type || 'webmail'],
                });
                const saved = yield finding.save();
                findingId = saved._id;
            }
            catch (findingError) {
                console.error('Error saving finding:', findingError);
                // Don't fail the request, just log the error
            }
        }
        res.json(Object.assign(Object.assign({ email, status: aggregated.profile.sources.length > 0 ? 'success' : 'partial' }, aggregated), { breaches: rawResults.breaches, holehe: rawResults.holehe, last_updated: new Date().toISOString(), findingId }));
    }
    catch (error) {
        console.error('Advanced Email lookup error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.emailLookup = emailLookup;
/**
 * Username Intelligence Controller
 */
const usernameLookup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, caseId } = req.body;
    if (!username) {
        res.status(400).json({ message: 'Target username required' });
        return;
    }
    try {
        const variations = (0, usernameUtils_1.generateUsernameVariations)(username);
        const results = [];
        // Process in small batches to avoid IP bans and high resource usage
        const batchSize = 5;
        for (let i = 0; i < platforms_1.platforms.length; i += batchSize) {
            const batch = platforms_1.platforms.slice(i, i + batchSize);
            const batchTasks = batch.flatMap(platform => 
            // Only try variations for high-priority platforms or keep it simple
            [username].map((v) => __awaiter(void 0, void 0, void 0, function* () {
                const probeRes = yield probePlatformWithSignatures(v, platform);
                return Object.assign({ platform: platform.name, username: v }, probeRes);
            })));
            const batchResults = yield Promise.all(batchTasks);
            results.push(...batchResults);
            // Short delay between batches
            if (i + batchSize < platforms_1.platforms.length) {
                yield new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        const foundCount = results.filter(r => r.status === 'found').length;
        const suspendedCount = results.filter(r => r.status === 'suspended').length;
        // LOGGING ACTION
        (0, logActivity_1.logUserActivity)(req, 'username_scan', 'Username Intelligence', {
            target: username,
            platformsScanned: platforms_1.platforms.length,
            found: foundCount,
            suspended: suspendedCount
        });
        // Save findings if caseId provided
        let findingIds = [];
        if (caseId) {
            try {
                const foundMatches = results.filter(r => r.status === 'found' || r.status === 'suspended');
                for (const match of foundMatches) {
                    const finding = new Finding_1.default({
                        caseId,
                        findingType: 'username_search',
                        source: match.platform,
                        username: match.username,
                        data: match,
                        confidence: match.status === 'found' ? 95 : 70,
                        isVerified: match.status === 'found',
                        tags: ['username-search', match.platform.toLowerCase()],
                    });
                    const saved = yield finding.save();
                    findingIds.push(saved._id.toString());
                }
            }
            catch (findingError) {
                console.error('Error saving username findings:', findingError);
            }
        }
        res.json({
            target: username,
            timestamp: new Date().toISOString(),
            matches: results.filter(r => r.status === 'found' || r.status === 'suspended'),
            summary: {
                total_scanned: platforms_1.platforms.length,
                found: foundCount,
                suspended: suspendedCount
            },
            findingIds, // Return Finding IDs for frontend reference
        });
    }
    catch (error) {
        console.error('Username intelligence error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.usernameLookup = usernameLookup;
/**
 * Advanced Metadata Forensic Extraction Controller
 */
const extractMetadata = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.file) {
        console.error('[METADATA_OSINT] Error: No file uploaded');
        res.status(400).json({ status: 'error', message: 'No file uploaded' });
        return;
    }
    const { filename, path: filePath, size, mimetype } = req.file;
    const { caseId } = req.body;
    const pythonPath = getPythonPath();
    const scriptPath = path_1.default.join(__dirname, '../scripts/metadata_engine.py');
    console.log(`[METADATA_OSINT] Received upload: ${filename} (${mimetype}, ${size} bytes)`);
    // Helper for cleanup
    const cleanup = () => {
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlink(filePath, (err) => {
                if (err)
                    console.error(`[METADATA_OSINT] Cleanup error for ${filename}:`, err);
                else
                    console.log(`[METADATA_OSINT] Temp file deleted: ${filename}`);
            });
        }
    };
    try {
        const startTime = Date.now();
        console.log(`[METADATA_OSINT] Spawning process: ${pythonPath} ${scriptPath}`);
        const pythonProcess = (0, child_process_1.spawn)(pythonPath, [scriptPath, filePath]);
        let outputData = '';
        let errorData = '';
        let isFinished = false;
        // 30-Second Watchdog Timer
        const timeout = setTimeout(() => {
            if (!isFinished) {
                isFinished = true;
                pythonProcess.kill();
                cleanup();
                console.error(`[METADATA_OSINT] Timeout (30s) reached for: ${filename}`);
                res.status(504).json({
                    status: 'error',
                    message: 'Forensic extraction timed out (30s max)',
                    error: 'TIMEOUT'
                });
            }
        }, 30000);
        pythonProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });
        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });
        pythonProcess.on('close', (code) => __awaiter(void 0, void 0, void 0, function* () {
            if (isFinished)
                return;
            isFinished = true;
            clearTimeout(timeout);
            cleanup();
            const extractionTime = Date.now() - startTime;
            if (code !== 0) {
                console.error(`[METADATA_OSINT] Process crash [Code ${code}]: ${errorData}`);
                res.status(500).json({
                    status: 'error',
                    message: 'Forensic engine crash',
                    error: errorData
                });
                return;
            }
            try {
                const result = JSON.parse(outputData);
                console.log(`[METADATA_OSINT] Success: ${filename} processed in ${extractionTime}ms`);
                // LOGGING ACTION
                (0, logActivity_1.logUserActivity)(req, 'metadata_extraction', 'Metadata Forensic Engine', {
                    filename,
                    size,
                    mimetype,
                    processingTimeMs: extractionTime
                });
                // Save findings if caseId provided
                let findingId = null;
                if (caseId) {
                    try {
                        const finding = new Finding_1.default({
                            caseId,
                            findingType: 'metadata',
                            source: 'Metadata Forensic Engine',
                            data: result,
                            confidence: 95, // Metadata is usually accurate
                            isVerified: true,
                            tags: ['metadata', mimetype.split('/')[0] || 'file'],
                        });
                        const saved = yield finding.save();
                        findingId = saved._id;
                    }
                    catch (findingError) {
                        console.error('Error saving metadata finding:', findingError);
                    }
                }
                res.json(Object.assign(Object.assign({}, result), { findingId }));
            }
            catch (e) {
                console.error(`[METADATA_OSINT] Invalid JSON from engine: ${outputData}`);
                res.status(500).json({
                    status: 'error',
                    message: 'Failed to parse forensic data',
                    error: outputData
                });
            }
        }));
    }
    catch (error) {
        if (fs_1.default.existsSync(filePath))
            fs_1.default.unlinkSync(filePath);
        console.error(`[METADATA_OSINT] Internal Controller Error:`, error);
        res.status(500).json({ status: 'error', message: 'Internal processing error' });
    }
});
exports.extractMetadata = extractMetadata;
/**
 * Specialized Pakistan Phone Lookup Controller
 * Refactored for Step 3 - Robust Process Management
 */
const phoneLookupPK = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phone, caseId } = req.body;
    const startTime = Date.now();
    // Part E: Logging Request
    console.log(`[PHONE_OSINT] Request received: ${phone} at ${new Date().toISOString()}`);
    if (!phone) {
        res.status(400).json({ message: 'Phone number required' });
        return;
    }
    const pythonPath = getPythonPath();
    const scriptPath = path_1.default.join(__dirname, '../scripts/phone_engine_pk.py');
    try {
        // Part B: Process Management
        const pythonProcess = (0, child_process_1.spawn)(pythonPath, [scriptPath, phone]);
        let outputData = '';
        let errorData = '';
        let processFinished = false;
        // Part B: Timeout Implementation (5s)
        const timeoutWatchdog = setTimeout(() => {
            if (!processFinished) {
                pythonProcess.kill();
                const timeoutMsg = `[PHONE_OSINT] Error: Process timed out for ${phone}`;
                console.error(timeoutMsg);
                if (!res.headersSent) {
                    res.status(504).json({
                        status: 'error',
                        error: 'Timeout',
                        message: 'Telephony engine took too long to respond (5s limit)'
                    });
                }
            }
        }, 5000);
        pythonProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });
        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });
        pythonProcess.on('close', (code) => __awaiter(void 0, void 0, void 0, function* () {
            processFinished = true;
            clearTimeout(timeoutWatchdog);
            const duration = Date.now() - startTime;
            // Part C: Error Handling (Crashes)
            if (code !== 0) {
                const errorLog = `[PHONE_OSINT] Engine crashed. Code: ${code}, Stderr: ${errorData}`;
                console.error(errorLog);
                if (!res.headersSent) {
                    res.status(500).json({
                        status: 'error',
                        error: 'Process Error',
                        message: 'Telephony engine failed to execute',
                        details: errorData
                    });
                }
                return;
            }
            // Part D: Response Handling
            try {
                const result = JSON.parse(outputData);
                // Logging Success (Console)
                console.log(`[PHONE_OSINT] Success: ${phone} processed in ${duration}ms`);
                // LOGGING ACTION (Database)
                (0, logActivity_1.logUserActivity)(req, 'phone_lookup', 'PK Phone Intelligence', {
                    phone,
                    processingTimeMs: duration
                });
                // Save findings if caseId provided
                let findingId = null;
                if (caseId) {
                    try {
                        const finding = new Finding_1.default({
                            caseId,
                            findingType: 'phone_lookup',
                            source: 'Pakistan Telephony Engine',
                            phone,
                            data: result,
                            confidence: result.operator ? 85 : 60,
                            isVerified: !!result.operator,
                            tags: ['phone-lookup', 'pakistan'],
                        });
                        const saved = yield finding.save();
                        findingId = saved._id;
                    }
                    catch (findingError) {
                        console.error('Error saving phone finding:', findingError);
                    }
                }
                if (!res.headersSent) {
                    res.json(Object.assign(Object.assign({}, result), { findingId }));
                }
            }
            catch (e) {
                // Part C: Error Handling (Invalid JSON)
                const parseError = `[PHONE_OSINT] JSON Parse Error for ${phone}. Output: ${outputData}`;
                console.error(parseError);
                if (!res.headersSent) {
                    res.status(500).json({
                        status: 'error',
                        error: 'Parse Error',
                        message: 'Invalid engine output format'
                    });
                }
            }
        }));
    }
    catch (error) {
        // Part E: Logging Errors
        console.error(`[PHONE_OSINT] Controller Exception: ${error.message}`);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }
});
exports.phoneLookupPK = phoneLookupPK;
/**
 * Network Recon Intelligence (Shodan, VirusTotal, AbuseIPDB, Censys)
 */
const networkRecon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { target, caseId } = req.body;
    if (!target) {
        res.status(400).json({ message: 'Target (IP or Domain) required' });
        return;
    }
    try {
        const results = {
            target,
            shodan: null,
            virustotal: null,
            abuseipdb: null,
            censys: null,
            timestamp: new Date()
        };
        const SHODAN_KEY = process.env.SHODAN_API_KEY;
        if (SHODAN_KEY) {
            try {
                const shodanRes = yield axios_1.default.get(`https://api.shodan.io/shodan/host/${target}?key=${SHODAN_KEY}`, { timeout: 5000 });
                results.shodan = shodanRes.data;
            }
            catch (e) {
                console.error('Shodan error:', target);
            }
        }
        const VT_KEY = process.env.VIRUSTOTAL_API_KEY;
        if (VT_KEY) {
            try {
                const vtRes = yield axios_1.default.get(`https://www.virustotal.com/api/v3/ip_addresses/${target}`, {
                    headers: { 'x-apikey': VT_KEY },
                    timeout: 5000
                });
                results.virustotal = vtRes.data;
            }
            catch (e) {
                try {
                    const vtDomainRes = yield axios_1.default.get(`https://www.virustotal.com/api/v3/domains/${target}`, {
                        headers: { 'x-apikey': VT_KEY },
                        timeout: 5000
                    });
                    results.virustotal = vtDomainRes.data;
                }
                catch (err) {
                    console.error('VT error:', target);
                }
            }
        }
        const ABUSE_KEY = process.env.ABUSEIPDB_API_KEY;
        if (ABUSE_KEY) {
            try {
                const abuseRes = yield axios_1.default.get(`https://api.abuseipdb.com/api/v2/check`, {
                    params: { ipAddress: target, maxAgeInDays: 90 },
                    headers: { 'Key': ABUSE_KEY, 'Accept': 'application/json' },
                    timeout: 5000
                });
                results.abuseipdb = abuseRes.data;
            }
            catch (e) {
                console.error('AbuseIPDB error:', target);
            }
        }
        const CENSYS_ID = process.env.CENSYS_API_ID;
        const CENSYS_SECRET = process.env.CENSYS_API_SECRET;
        if (CENSYS_ID && CENSYS_SECRET) {
            try {
                const auth = Buffer.from(`${CENSYS_ID}:${CENSYS_SECRET}`).toString('base64');
                const censysRes = yield axios_1.default.get(`https://search.censys.io/api/v2/hosts/${target}`, {
                    headers: { 'Authorization': `Basic ${auth}` },
                    timeout: 5000
                });
                results.censys = censysRes.data;
            }
            catch (e) {
                console.error('Censys error:', target);
            }
        }
        (0, logActivity_1.logUserActivity)(req, 'network_recon', 'Network Intelligence', { target });
        if (caseId) {
            try {
                const finding = new Finding_1.default({
                    caseId,
                    findingType: 'network_recon',
                    source: 'Multi-Source (Shodan, VT, AbuseIPDB, Censys)',
                    data: results,
                    confidence: 90,
                    isVerified: true,
                    tags: ['network', 'recon'],
                });
                yield finding.save();
            }
            catch (fError) {
                console.error('Error saving network finding');
            }
        }
        res.json(results);
    }
    catch (error) {
        console.error('Network recon error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.networkRecon = networkRecon;
/**
 * Pastebin Search (Leaked Data)
 */
const pasteSearch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { query, caseId } = req.body;
    const API_KEY = process.env.PASTEBIN_API_KEY;
    if (!query) {
        res.status(400).json({ message: 'Search query required' });
        return;
    }
    try {
        // Note: Pastebin API often requires scraping or Pro keys for full search.
        // This is a simulated/proxy implementation using common scrapers or their API if allowed.
        const results = {
            query,
            matches: [],
            timestamp: new Date()
        };
        // If a real scraping API or search API is available, use it here.
        // For demonstration with provided key:
        if (API_KEY) {
            // Implementation depends on Pastebin API type (Scraping vs Search)
            // Here we log the attempt
            console.log(`Searching Pastebin for: ${query}`);
        }
        res.json(results);
    }
    catch (error) {
        res.status(500).json({ message: 'Paste search failed' });
    }
});
exports.pasteSearch = pasteSearch;
/**
 * Image OSINT using Google Gemini API
 */
const imageOSINT = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { caseId } = req.body;
    const file = req.file;
    if (!file) {
        res.status(400).json({ message: 'No image file uploaded' });
        return;
    }
    try {
        const apiKey = process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
            res.status(500).json({ message: 'Gemini API Key is not configured in backend environment' });
            return;
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // Use flash for fast and precise visual analysis
        const imagePath = file.path;
        const mimeType = file.mimetype;
        // Convert uploaded local image to Generative Part
        const imagePart = {
            inlineData: {
                data: fs_1.default.readFileSync(imagePath).toString("base64"),
                mimeType
            }
        };
        const userPrompt = `Perform an exhaustive visual forensic analysis on the attached image to extract OSINT and actionable intelligence.
Please provide a highly detailed, professional-grade analysis report covering:

1. **EXECUTIVE GEOLOCATION SUMMARY & ANALYSIS**:
   * Estimate the exact or approximate location where this image was captured.
   * Provide a detailed rationale citing recognizable landmarks, architectural styles, street signs, foliage/vegetation types, license plate formats, or utility pole configurations.
   * Attempt to estimate or guess coordinates (Latitude/Longitude) if possible, with an estimation confidence level (Low/Medium/High).

2. **VISUAL CLUES & SIGNATURE DETECTION**:
   * **Objects & Brands**: Identify specific car makes/models, brand logos on buildings/clothing, unique equipment, or manufactured products.
   * **Text & Typography**: Extract any readable text, street names, billboard advertisements, shop names, or language/script markings.
   * **Culture & Region**: Analyze signs of driving side (left/right hand drive), power plug outlets visible, specific clothing styles, or regional weather/terrain indications.

3. **METADATA & FORENSIC CHECKS**:
   * Identify any apparent visual anomalies or indications of digital tampering, synthetic generation (AI-generated features, blending errors), or double compression artifacts.

4. **INTELLIGENCE CORRELATIONS**:
   * Identify potential threat matrix contexts or other digital footprints that can link this image to a physical location, organization, or operational unit.

Please structure your report in clean, beautiful Markdown format with clear subheadings, and present your findings in a highly technical, investigative manner suitable for a cyber forensic presentation.`;
        const result = yield model.generateContent([userPrompt, imagePart]);
        const responseText = result.response.text();
        // Clean up the uploaded temporary file after processing to maintain server hygiene
        try {
            fs_1.default.unlinkSync(imagePath);
        }
        catch (unlinkErr) {
            console.error('Error unlinking uploaded image file:', unlinkErr);
        }
        // Save finding if caseId is provided
        if (caseId) {
            try {
                const finding = new Finding_1.default({
                    caseId,
                    findingType: 'image_osint',
                    source: 'Gemini AI Vision Engine',
                    data: {
                        analysis: responseText,
                        fileName: file.originalname,
                        mimeType: file.mimetype
                    },
                    confidence: 85,
                    isVerified: true,
                    tags: ['image-osint', 'gemini-vision', 'imint']
                });
                yield finding.save();
            }
            catch (saveErr) {
                console.error('Error saving image osint finding:', saveErr);
            }
        }
        res.json({
            success: true,
            analysis: responseText,
            fileName: file.originalname,
            mimeType: file.mimetype
        });
    }
    catch (error) {
        console.error('Image OSINT error:', error);
        res.status(500).json({
            message: 'Error processing Image OSINT via Gemini API',
            error: error.message
        });
    }
});
exports.imageOSINT = imageOSINT;
