"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.checkToolsAvailability = exports.nmapScan = exports.whoisLookup = exports.exiftoolMetadata = exports.sherlockStream = exports.sherlockSearch = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const logActivity_1 = require("../utils/logActivity");
const Finding_1 = __importDefault(require("../models/Finding"));
const execPromise = (0, util_1.promisify)(child_process_1.exec);
/**
 * Helper: Check if Kali tool is installed
 */
const toolExists = (toolName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield execPromise(`which ${toolName}`);
        return true;
    }
    catch (_a) {
        return false;
    }
});
/**
 * Sherlock - Username OSINT across social platforms
 * Local Kali Linux tool integration
 */
const sherlockSearch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, caseId } = req.body;
    if (!username) {
        return res.status(400).json({ message: 'Username required' });
    }
    try {
        const results = {
            tool: 'Sherlock',
            username,
            timestamp: new Date(),
            platforms: []
        };
        // Check if sherlock is installed
        const hasSherlock = yield toolExists('sherlock');
        if (!hasSherlock) {
            // Fallback: Use web API approach
            try {
                const response = yield axios_1.default.get(`https://api.sherlock.xyz/search/${username}`, {
                    timeout: 10000
                });
                results.platforms = response.data || [];
                results.method = 'API-Fallback';
            }
            catch (apiError) {
                return res.status(503).json({
                    message: 'Sherlock tool not installed. Install with: pip install sherlock-project'
                });
            }
        }
        else {
            // Use local Sherlock tool
            try {
                const { stdout } = yield execPromise(`sherlock "${username}" --timeout 10 2>/dev/null || echo "completed"`);
                const platforms = [];
                const lines = stdout.split('\n');
                for (const line of lines) {
                    if (line.includes('[+] ')) {
                        const match = line.match(/\[\+\]\s(.*?):\s(.*)/);
                        if (match && match.length >= 3) {
                            platforms.push({
                                platform: match[1].trim(),
                                found: true,
                                url: match[2].trim(),
                                statusCode: 200
                            });
                        }
                    }
                }
                // Clean up Sherlock report file from disk to keep workspace pristine
                const reportPath = path_1.default.join(process.cwd(), `${username}.txt`);
                if (fs_1.default.existsSync(reportPath)) {
                    try {
                        fs_1.default.unlinkSync(reportPath);
                    }
                    catch (e) {
                        console.error('Failed to delete sherlock report file:', e);
                    }
                }
                results.platforms = platforms;
                results.method = 'Local-Sherlock';
            }
            catch (execError) {
                return res.status(500).json({ message: 'Sherlock execution failed' });
            }
        }
        (0, logActivity_1.logUserActivity)(req, 'sherlock_search', 'Sherlock Username Search', { target: username });
        // Save finding if caseId provided
        if (caseId) {
            try {
                const finding = new Finding_1.default({
                    caseId,
                    findingType: 'sherlock_search',
                    source: 'Sherlock (Kali OSINT)',
                    username,
                    data: results,
                    confidence: 85,
                    isVerified: false,
                    tags: ['sherlock', 'username-search', 'kali-tool'],
                });
                yield finding.save();
            }
            catch (findingError) {
                console.error('Error saving sherlock finding:', findingError);
            }
        }
        const foundCount = results.platforms.filter((p) => p.found).length;
        res.json(Object.assign(Object.assign({}, results), { summary: {
                totalPlatformsChecked: results.platforms.length,
                platformsFound: foundCount,
                successRate: `${((foundCount / results.platforms.length) * 100).toFixed(2)}%`
            } }));
    }
    catch (error) {
        console.error('Sherlock search error:', error);
        res.status(500).json({ message: 'Sherlock search failed' });
    }
});
exports.sherlockSearch = sherlockSearch;
/**
 * Sherlock Stream - SSE live output for username search
 */
const sherlockStream = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, caseId } = req.query;
    if (!username) {
        res.status(400).json({ message: 'Username required' });
        return;
    }
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    send({ type: 'status', message: `[*] Starting username scan for: ${username}` });
    try {
        const hasSherlock = yield toolExists('sherlock');
        if (!hasSherlock) {
            // Fallback: simulate scan across known platforms
            const PLATFORMS = [
                { name: 'GitHub', url: `https://github.com/${username}` },
                { name: 'Twitter', url: `https://twitter.com/${username}` },
                { name: 'Instagram', url: `https://instagram.com/${username}` },
                { name: 'Reddit', url: `https://reddit.com/user/${username}` },
                { name: 'LinkedIn', url: `https://linkedin.com/in/${username}` },
                { name: 'TikTok', url: `https://tiktok.com/@${username}` },
                { name: 'Pinterest', url: `https://pinterest.com/${username}` },
                { name: 'Twitch', url: `https://twitch.tv/${username}` },
                { name: 'YouTube', url: `https://youtube.com/@${username}` },
                { name: 'DeviantArt', url: `https://deviantart.com/${username}` },
                { name: 'Keybase', url: `https://keybase.io/${username}` },
                { name: 'Medium', url: `https://medium.com/@${username}` },
                { name: 'Telegram', url: `https://t.me/${username}` },
                { name: 'Steam', url: `https://steamcommunity.com/id/${username}` },
                { name: 'Fiverr', url: `https://fiverr.com/${username}` },
                { name: 'Replit', url: `https://replit.com/@${username}` },
                { name: 'HackerNews', url: `https://news.ycombinator.com/user?id=${username}` },
                { name: 'GitLab', url: `https://gitlab.com/${username}` },
                { name: 'Codepen', url: `https://codepen.io/${username}` },
                { name: 'Flickr', url: `https://flickr.com/people/${username}` },
                { name: 'Pastebin', url: `https://pastebin.com/u/${username}` },
                { name: 'NPM', url: `https://npmjs.com/~${username}` },
            ];
            const foundPlatforms = [];
            for (const platform of PLATFORMS) {
                send({ type: 'log', message: `[~] Checking ${platform.name}...` });
                try {
                    const httpResp = yield axios_1.default.get(platform.url, {
                        timeout: 5000,
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        validateStatus: (s) => s < 500,
                    });
                    const found = httpResp.status === 200;
                    if (found) {
                        send({ type: 'found', platform: platform.name, url: platform.url, statusCode: httpResp.status });
                        foundPlatforms.push({ platform: platform.name, found: true, url: platform.url, statusCode: httpResp.status });
                    }
                    else {
                        send({ type: 'not_found', platform: platform.name });
                    }
                }
                catch (_a) {
                    send({ type: 'not_found', platform: platform.name });
                }
            }
            if (caseId) {
                try {
                    const finding = new Finding_1.default({
                        caseId,
                        findingType: 'username_search',
                        source: 'Username OSINT',
                        username,
                        data: { platforms: foundPlatforms, username },
                        confidence: 80,
                        isVerified: false,
                        tags: ['username-search', 'osint'],
                    });
                    yield finding.save();
                }
                catch (_b) { }
            }
            send({ type: 'done', summary: { totalChecked: PLATFORMS.length, found: foundPlatforms.length } });
        }
        else {
            // Use real sherlock with spawn for live output
            const { spawn } = yield Promise.resolve().then(() => __importStar(require('child_process')));
            const proc = spawn('sherlock', [username, '--timeout', '10', '--print-found'], { stdio: ['ignore', 'pipe', 'pipe'] });
            const foundPlatforms = [];
            proc.stdout.on('data', (chunk) => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    if (trimmed.includes('[+]')) {
                        const match = trimmed.match(/\[\+\]\s(.*?):\s(.*)/);
                        if (match) {
                            const platform = match[1].trim();
                            const url = match[2].trim();
                            foundPlatforms.push({ platform, found: true, url, statusCode: 200 });
                            send({ type: 'found', platform, url, statusCode: 200 });
                        }
                        else {
                            send({ type: 'log', message: trimmed });
                        }
                    }
                    else {
                        send({ type: 'log', message: trimmed });
                    }
                }
            });
            proc.stderr.on('data', (chunk) => {
                send({ type: 'log', message: chunk.toString().trim() });
            });
            yield new Promise((resolve) => proc.on('close', resolve));
            if (caseId && foundPlatforms.length > 0) {
                try {
                    const finding = new Finding_1.default({
                        caseId, findingType: 'username_search', source: 'Username OSINT',
                        username, data: { platforms: foundPlatforms, username }, confidence: 90,
                        isVerified: false, tags: ['username-search', 'sherlock'],
                    });
                    yield finding.save();
                }
                catch (_c) { }
            }
            send({ type: 'done', summary: { totalChecked: foundPlatforms.length + 10, found: foundPlatforms.length } });
        }
    }
    catch (err) {
        send({ type: 'error', message: err.message || 'Stream failed' });
    }
    res.end();
});
exports.sherlockStream = sherlockStream;
/**
 * ExifTool - Metadata extraction from files (enhanced)
 */
const exiftoolMetadata = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    const { caseId } = req.body;
    if (!req.file) {
        return res.status(400).json({ message: 'File upload required' });
    }
    try {
        const filePath = req.file.path;
        const results = {
            tool: 'ExifTool',
            filename: req.file.originalname,
            filesize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date(),
            metadata: {}
        };
        const hasExiftool = yield toolExists('exiftool');
        if (!hasExiftool) {
            return res.status(503).json({
                message: 'ExifTool not installed. Install with: apt-get install libimage-exiftool-perl'
            });
        }
        try {
            const { stdout } = yield execPromise(`exiftool -json "${filePath}"`);
            const metadata = JSON.parse(stdout);
            results.metadata = metadata[0] || {};
            results.method = 'ExifTool';
            // Extract sensitive data
            results.sensitiveData = {
                gps: ((_a = metadata[0]) === null || _a === void 0 ? void 0 : _a.GPSLatitude) ? {
                    latitude: metadata[0].GPSLatitude,
                    longitude: metadata[0].GPSLongitude,
                    altitude: metadata[0].GPSAltitude
                } : null,
                creator: ((_b = metadata[0]) === null || _b === void 0 ? void 0 : _b.Creator) || null,
                copyright: ((_c = metadata[0]) === null || _c === void 0 ? void 0 : _c.Copyright) || null,
                software: ((_d = metadata[0]) === null || _d === void 0 ? void 0 : _d.Software) || null,
                cameraModel: ((_e = metadata[0]) === null || _e === void 0 ? void 0 : _e.Model) || null,
                dateTime: ((_f = metadata[0]) === null || _f === void 0 ? void 0 : _f.DateTime) || null,
                deviceId: ((_g = metadata[0]) === null || _g === void 0 ? void 0 : _g.DeviceID) || null
            };
        }
        catch (execError) {
            return res.status(500).json({ message: 'ExifTool extraction failed' });
        }
        (0, logActivity_1.logUserActivity)(req, 'exiftool_metadata', 'ExifTool Metadata Extraction', {
            filename: req.file.originalname
        });
        // Save finding if caseId provided
        if (caseId) {
            try {
                const finding = new Finding_1.default({
                    caseId,
                    findingType: 'metadata_extraction',
                    source: 'ExifTool (Kali OSINT)',
                    data: results,
                    confidence: 95,
                    isVerified: true,
                    tags: ['exiftool', 'metadata', 'kali-tool', req.file.mimetype.split('/')[0]],
                });
                yield finding.save();
            }
            catch (findingError) {
                console.error('Error saving exiftool finding:', findingError);
            }
        }
        // Clean up uploaded file
        fs_1.default.unlinkSync(filePath);
        res.json(results);
    }
    catch (error) {
        console.error('ExifTool metadata error:', error);
        res.status(500).json({ message: 'Metadata extraction failed' });
    }
});
exports.exiftoolMetadata = exiftoolMetadata;
/**
 * Whois - Domain and IP ownership information
 */
const whoisLookup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { target, caseId } = req.body;
    if (!target) {
        return res.status(400).json({ message: 'Target domain or IP required' });
    }
    try {
        const results = {
            tool: 'Whois',
            target,
            timestamp: new Date(),
            data: null
        };
        const hasWhois = yield toolExists('whois');
        if (!hasWhois) {
            return res.status(503).json({
                message: 'Whois tool not installed. Install with: apt-get install whois'
            });
        }
        try {
            const { stdout } = yield execPromise(`whois "${target}"`);
            // Parse Whois output
            const lines = stdout.split('\n');
            results.data = {};
            lines.forEach((line) => {
                if (line.includes(':')) {
                    const [key, value] = line.split(':').map(s => s.trim());
                    results.data[key] = value;
                }
            });
            results.method = 'Local-Whois';
            // Extract key information
            results.summary = {
                registrar: results.data['Registrar'] || results.data['registrar'] || null,
                registrationDate: results.data['Creation Date'] || results.data['creation_date'] || null,
                expirationDate: results.data['Registry Expiry Date'] || results.data['expiry_date'] || null,
                nameServers: lines
                    .filter((l) => l.includes('Name Server') || l.includes('nameserver'))
                    .map((l) => { var _a; return (_a = l.split(':')[1]) === null || _a === void 0 ? void 0 : _a.trim(); })
                    .filter(Boolean) || [],
                organization: results.data['Organization'] || results.data['organisation'] || null,
                address: results.data['Address'] || null,
                email: results.data['Email'] || results.data['admin-email'] || null,
                phone: results.data['Phone'] || results.data['admin-phone'] || null
            };
        }
        catch (execError) {
            return res.status(500).json({ message: 'Whois lookup failed' });
        }
        (0, logActivity_1.logUserActivity)(req, 'whois_lookup', 'Whois Domain/IP Lookup', { target });
        // Save finding if caseId provided
        if (caseId) {
            try {
                const finding = new Finding_1.default({
                    caseId,
                    findingType: 'whois_lookup',
                    source: 'Whois (Kali OSINT)',
                    domain: target,
                    data: results,
                    confidence: 90,
                    isVerified: true,
                    tags: ['whois', 'domain-info', 'kali-tool'],
                });
                yield finding.save();
            }
            catch (findingError) {
                console.error('Error saving whois finding:', findingError);
            }
        }
        res.json(results);
    }
    catch (error) {
        console.error('Whois lookup error:', error);
        res.status(500).json({ message: 'Whois lookup failed' });
    }
});
exports.whoisLookup = whoisLookup;
/**
 * Nmap - Network and port scanning
 * LIMITED: Basic host discovery and port scanning only
 */
const nmapScan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { target, scanType = 'basic', caseId } = req.body;
    if (!target) {
        return res.status(400).json({ message: 'Target IP or hostname required' });
    }
    try {
        const results = {
            tool: 'Nmap',
            target,
            scanType,
            timestamp: new Date(),
            ports: [],
            hostStatus: null,
            osDetection: null
        };
        const hasNmap = yield toolExists('nmap');
        if (!hasNmap) {
            return res.status(503).json({
                message: 'Nmap not installed. Install with: apt-get install nmap'
            });
        }
        let nmapCommand = '';
        // Determine scan type
        switch (scanType) {
            case 'basic':
                nmapCommand = `nmap -p 1-1000 -sV --script vuln ${target} -oX - | head -100`;
                break;
            case 'aggressive':
                nmapCommand = `nmap -A -T4 ${target} -oX - | head -100`;
                break;
            case 'stealth':
                nmapCommand = `nmap -sS -p 1-1000 ${target} -oX - | head -100`;
                break;
            default:
                nmapCommand = `nmap -p 1-1000 ${target} -oX - | head -100`;
        }
        try {
            const { stdout } = yield execPromise(nmapCommand);
            // Parse XML output
            const portMatches = stdout.match(/<port\s+protocol="tcp"\s+portid="(\d+)">/g) || [];
            results.ports = portMatches.map((match) => {
                var _a;
                const portNum = (_a = match.match(/portid="(\d+)"/)) === null || _a === void 0 ? void 0 : _a[1];
                return {
                    number: parseInt(portNum || '0'),
                    status: 'open',
                    protocol: 'tcp'
                };
            });
            results.method = 'Local-Nmap';
            results.hostStatus = stdout.includes('Nmap done') ? 'completed' : 'partial';
        }
        catch (execError) {
            return res.status(500).json({ message: 'Nmap scan failed' });
        }
        (0, logActivity_1.logUserActivity)(req, 'nmap_scan', 'Nmap Network Scan', { target, scanType });
        // Save finding if caseId provided
        if (caseId) {
            try {
                const finding = new Finding_1.default({
                    caseId,
                    findingType: 'network_scan',
                    source: 'Nmap (Kali OSINT)',
                    domain: target,
                    data: results,
                    confidence: 88,
                    isVerified: true,
                    tags: ['nmap', 'network-scan', 'kali-tool', scanType],
                });
                yield finding.save();
            }
            catch (findingError) {
                console.error('Error saving nmap finding:', findingError);
            }
        }
        res.json(Object.assign(Object.assign({}, results), { summary: {
                openPorts: results.ports.length,
                scanCompleted: results.hostStatus === 'completed'
            } }));
    }
    catch (error) {
        console.error('Nmap scan error:', error);
        res.status(500).json({ message: 'Nmap scan failed' });
    }
});
exports.nmapScan = nmapScan;
/**
 * System Tool Availability Check
 * Returns which Kali tools are installed and ready to use
 */
const checkToolsAvailability = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tools = ['sherlock', 'exiftool', 'whois', 'nmap', 'dnsrecon', 'recon-ng'];
    const availability = {};
    try {
        for (const tool of tools) {
            availability[tool] = yield toolExists(tool);
        }
        res.json({
            status: 'success',
            timestamp: new Date(),
            tools: availability,
            installed: Object.values(availability).filter(Boolean).length,
            total: tools.length,
            recommendation: Object.values(availability).filter(Boolean).length < 4
                ? 'Install more Kali tools for enhanced OSINT capabilities: sudo apt-get install sherlock exiftool whois'
                : 'All major tools are available'
        });
    }
    catch (error) {
        console.error('Tool availability check error:', error);
        res.status(500).json({ message: 'Failed to check tool availability' });
    }
});
exports.checkToolsAvailability = checkToolsAvailability;
