import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { platforms, Platform } from '../config/platforms';
import { generateUsernameVariations } from '../utils/usernameUtils';
import { getRandomUA, getRequestConfig, enforceDelay } from '../utils/requestManager';
import { logUserActivity } from '../utils/logActivity';
import Finding from '../models/Finding';

/**
 * Extract possible usernames from an email address (Enhanced)
 */
const extractUsernames = (email: string): string[] => {
    const handle = email.split('@')[0].toLowerCase();
    const usernames = new Set<string>();
    
    usernames.add(handle); // john.doe
    usernames.add(handle.replace(/[._-]/g, '')); // johndoe
    
    // Add underscore variation
    if (handle.includes('.')) usernames.add(handle.replace(/\./g, '_')); // john_doe
    if (handle.includes('_')) usernames.add(handle.replace(/_/g, '.')); // john.doe
    
    // Add number-less variation (if ends with numbers, targets common naming patterns)
    usernames.add(handle.replace(/\d+$/, ''));

    // Split variations
    const parts = handle.split(/[._-]/);
    if (parts.length > 1) {
        parts.forEach(part => {
            if (part.length > 2) usernames.add(part); // john, doe
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
const getPythonPath = (): string => {
    const venvPath = path.join(__dirname, '../../venv/bin/python');
    if (fs.existsSync(venvPath)) return venvPath;
    return 'python3';
};

const getEmailProviderType = (email: string): 'corporate' | 'webmail' | 'disposable' => {
    const commonWebmail = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'me.com', 'aol.com'];
    const domain = email.split('@')[1].toLowerCase();
    
    if (commonWebmail.includes(domain)) return 'webmail';
    // Simplified disposable list (in real world use a library or extensive list)
    if (['yopmail.com', 'mailinator.com', 'tempmail.com'].includes(domain)) return 'disposable';
    
    return 'corporate';
};

/**
 * Calculate match percentage based on signatures
 */
const calculateMatchPercentage = (html: string, signatures: string[]): number => {
    if (!signatures || signatures.length === 0) return 0;
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
const probePlatformWithSignatures = async (username: string, platform: Platform): Promise<any> => {
    const url = platform.url_pattern.replace('{username}', username);
    const isSpecial = ['github', 'linkedin'].includes(platform.name.toLowerCase());
    
    // Step 1: Handle strict delays for special platforms
    if (isSpecial) {
        await enforceDelay(platform.name);
    }

    const axiosConfig = isSpecial ? getRequestConfig(platform.name) : {
        headers: {
            'User-Agent': getRandomUA(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 8000,
        validateStatus: () => true
    };

    let response;
    let retries = 1;

    const performRequest = async (): Promise<any> => {
        try {
            const res = await axios.get(url, axiosConfig);
            // If blocked (403/429), try one more time with a different UA
            if ((res.status === 403 || res.status === 429) && retries > 0) {
                retries--;
                await new Promise(resolve => setTimeout(resolve, 2000));
                if (axiosConfig.headers) axiosConfig.headers['User-Agent'] = getRandomUA();
                return performRequest();
            }
            return res;
        } catch (e: any) {
            if (retries > 0 && (!e.response || e.response.status >= 500)) {
                retries--;
                await new Promise(resolve => setTimeout(resolve, 2000));
                return performRequest();
            }
            throw e;
        }
    };

    try {
        response = await performRequest();
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
        } else if (status === 404) {
            return { status: 'not_found', url, confidence: 0.99 };
        } else if (status === 403 || status === 429) {
            // Blocked by platform, return unknown
            return { status: 'unknown', url, message: 'Blocked by rate limiting/WAF', confidence: 0 };
        } else if (status === 410) {
            return { status: 'suspended', url, confidence: 0.99 };
        }
        
        return { status: 'not_found', url, confidence: 0.5 };
    } catch (e) {
        return { status: 'error', url, message: 'Connection failed', confidence: 0 };
    }
};

/**
 * Legacy probe (Refactored to use signatures internally if platform exists)
 */
const probePlatform = async (username: string, platformName: string): Promise<{ found: boolean, url: string }> => {
    const config = platforms.find(p => p.name.toLowerCase() === platformName.toLowerCase());
    if (config) {
        const res = await probePlatformWithSignatures(username, config);
        return { found: res.status === 'found', url: res.status === 'found' ? res.url : '' };
    }
    
    // Fallback for undocumented platforms
    const fallbackUrls: Record<string, string> = {
        facebook: `https://www.facebook.com/${username}`,
        x: `https://x.com/${username}`,
        github_pages: `https://${username}.github.io/`
    };

    const url = fallbackUrls[platformName];
    if (!url) return { found: false, url: '' };

    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 4000,
            validateStatus: (status) => status < 500
        });
        const isFound = response.status === 200 && !response.data.includes('Page Not Found');
        return { found: isFound, url: isFound ? url : '' };
    } catch (e) {
        return { found: false, url: '' };
    }
};

/**
 * Helper: Fetch with retry and exponential backoff
 */
const fetchWithRetry = async (fn: () => Promise<any>, retries = 2, delay = 1000): Promise<any> => {
    try {
        return await fn();
    } catch (error: any) {
        if (retries <= 0 || (error.response && error.response.status < 500)) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(fn, retries - 1, delay * 2);
    }
};

/**
 * Hunter.io: Email Verification & Corporate Data
 */
const verifyEmailHunter = async (email: string) => {
    const API_KEY = process.env.HUNTER_API_KEY || process.env.EMAILVALIDATOR_API_KEY;
    if (!API_KEY) return null;
    try {
        const res = await fetchWithRetry(() => axios.get(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${API_KEY}`, { timeout: 8000 }));
        return res.data?.data;
    } catch (e) { return null; }
};

/**
 * RocketReach: Professional Profile & Socials
 */
const lookupRocketReach = async (email: string) => {
    const API_KEY = process.env.ROCKETREACH_API_KEY;
    if (!API_KEY) return null;
    try {
        const res = await fetchWithRetry(() => axios.get(`https://api.rocketreach.co/v2/person/lookup?email=${encodeURIComponent(email)}`, {
            headers: { 'Api-Key': API_KEY },
            timeout: 8000
        }));
        return res.data;
    } catch (e) { return null; }
};

/**
 * Clearbit: Identity Enrichment (Person & Company)
 */
const enrichClearbit = async (email: string) => {
    const API_KEY = process.env.CLEARBIT_API_KEY;
    if (!API_KEY) return null;
    try {
        const res = await fetchWithRetry(() => axios.get(`https://person.clearbit.com/v2/combined/find?email=${encodeURIComponent(email)}`, {
            auth: { username: API_KEY, password: '' },
            timeout: 8000
        }));
        return res.data;
    } catch (e) { return null; }
};

/**
 * FullContact: Identity & Social Profiles
 */
const enrichFullContact = async (email: string) => {
    const API_KEY = process.env.FULLCONTACT_API_KEY;
    if (!API_KEY) return null;
    try {
        const res = await fetchWithRetry(() => axios.post(`https://api.fullcontact.com/v3/person.enrich`, { email }, {
            headers: { 'Authorization': `Bearer ${API_KEY}` },
            timeout: 8000
        }));
        return res.data;
    } catch (e) { return null; }
};

/**
 * Aggregate Results and Scoring
 */
const aggregateResults = (raw: any) => {
    const profile: any = {
        name: raw.clearbit?.person?.name?.fullName || raw.fullcontact?.fullName || raw.rocketreach?.name || 'Unknown',
        avatar: raw.clearbit?.person?.avatar || raw.fullcontact?.avatar || raw.gravatar?.thumbnailUrl || null,
        bio: raw.fullcontact?.bio || raw.clearbit?.person?.bio || raw.gravatar?.aboutMe || null,
        location: raw.clearbit?.person?.location || raw.fullcontact?.location || raw.rocketreach?.location || null,
        sources: [],
        confidence_score: 0
    };

    const professional: any = {
        company: raw.clearbit?.company?.legalName || raw.rocketreach?.current_title || raw.hunter?.company || null,
        title: raw.clearbit?.person?.employment?.title || raw.rocketreach?.job_title || null,
        domain: raw.clearbit?.company?.domain || (raw.hunter?.webmail ? null : raw.email.split('@')[1]),
        department: raw.hunter?.department || null
    };

    // Social Profiles Deduplication
    const socialMap = new Map();
    
    // Add from APIs
    const apiSocials = [
        ...(raw.clearbit?.person?.linkedin ? [{ platform: 'LinkedIn', url: `https://linkedin.com/${raw.clearbit.person.linkedin.handle}` }] : []),
        ...(raw.clearbit?.person?.twitter ? [{ platform: 'X', url: `https://x.com/${raw.clearbit.person.twitter.handle}` }] : []),
        ...(raw.fullcontact?.socialProfiles || []).map((p: any) => ({ platform: p.type, url: p.url, username: p.username })),
        ...raw.discoveredLinks
    ];

    apiSocials.forEach(s => {
        const plat = s.platform.toLowerCase();
        if (!socialMap.has(plat) || s.confidence === 'High') {
            socialMap.set(plat, { ...s, verified: s.confidence === 'High' || !!raw.clearbit || !!raw.fullcontact });
        }
    });

    // Scoring Logic (Simplified)
    let score = 0;
    if (raw.hunter?.status === 'valid') score += 0.3;
    if (raw.clearbit) { score += 0.4; profile.sources.push('Clearbit'); }
    if (raw.fullcontact) { score += 0.4; profile.sources.push('FullContact'); }
    if (raw.rocketreach) { score += 0.3; profile.sources.push('RocketReach'); }
    if (raw.gravatar) { score += 0.1; profile.sources.push('Gravatar'); }
    
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
export const emailLookup = async (req: Request, res: Response): Promise<void> => {
    const { email, caseId } = req.body;

    if (!email || !email.includes('@')) {
        res.status(400).json({ message: 'Valid email required' });
        return;
    }

    try {
        const rawResults: any = {
            email,
            timestamp: new Date(),
            gravatar: null,
            hunter: null,
            rocketreach: null,
            clearbit: null,
            fullcontact: null,
            breaches: [],
            discoveredLinks: []
        };

        const targetUsernames = extractUsernames(email);
        const mainUsername = targetUsernames[0];

        // 1. Parallel Enrichment
        const [hunter, rocket, clearbit, fullcontact, gravatar] = await Promise.all([
            verifyEmailHunter(email),
            lookupRocketReach(email),
            enrichClearbit(email),
            enrichFullContact(email),
            (async () => {
                const hash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
                try {
                    const gravRes = await axios.get(`https://en.gravatar.com/${hash}.json`, { timeout: 3000 });
                    return gravRes.data.entry?.[0];
                } catch { return null; }
            })()
        ]);

        rawResults.hunter = hunter;
        rawResults.rocketreach = rocket;
        rawResults.clearbit = clearbit;
        rawResults.fullcontact = fullcontact;
        rawResults.gravatar = gravatar;

        // 2. Parallel Social Probing (Enhanced to use ALL platforms)
        const discoveryTasks: Promise<any>[] = [];

        platforms.forEach(platform => {
            targetUsernames.forEach(username => {
                discoveryTasks.push(probePlatformWithSignatures(username, platform).then(res => ({ ...res, platform: platform.name, username })));
            });
        });

        const discoveryResults = await Promise.all(discoveryTasks);
        
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
                const breachRes = await axios.get(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
                    headers: { 'hibp-api-key': HIBP_KEY },
                    timeout: 5000
                });
                rawResults.breaches = (breachRes.data || []).map((b: any) => ({
                    breach_name: b.Name,
                    date: b.BreachDate,
                    exposed_data: b.DataClasses,
                    severity: b.DataClasses.length > 5 ? 'high' : b.DataClasses.length > 2 ? 'medium' : 'low'
                }));
            } catch (e: any) {
                if (e.response?.status === 404) rawResults.breaches = [];
            }
        }

        // 4. Final Aggregation
        const aggregated = aggregateResults(rawResults);

        // LOGGING ACTION
        logUserActivity(req, 'email_lookup', 'Email Intelligence', { target: email, foundSources: aggregated.profile.sources });

        // 5. Save Finding if caseId provided
        let findingId = null;
        if (caseId) {
            try {
                const finding = new Finding({
                    caseId,
                    findingType: 'email_lookup',
                    source: 'Multi-Source (Hunter, RocketReach, Clearbit, FullContact, HIBP)',
                    email,
                    data: rawResults,
                    confidence: Math.min(100, aggregated.profile.sources.length * 20), // Confidence based on sources found
                    isVerified: !!aggregated.profile.verified,
                    tags: ['email-lookup', aggregated.profile.type || 'webmail'],
                });
                const saved = await finding.save();
                findingId = saved._id;
            } catch (findingError) {
                console.error('Error saving finding:', findingError);
                // Don't fail the request, just log the error
            }
        }

        res.json({
            email,
            status: aggregated.profile.sources.length > 0 ? 'success' : 'partial',
            ...aggregated,
            breaches: rawResults.breaches,
            last_updated: new Date().toISOString(),
            findingId, // Return Finding ID for frontend reference
        });

    } catch (error) {
        console.error('Advanced Email lookup error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Username Intelligence Controller
 */
export const usernameLookup = async (req: Request, res: Response): Promise<void> => {
    const { username, caseId } = req.body;

    if (!username) {
        res.status(400).json({ message: 'Target username required' });
        return;
    }

    try {
        const variations = generateUsernameVariations(username);
        const results: any[] = [];
        
        // Process in small batches to avoid IP bans and high resource usage
        const batchSize = 5;
        for (let i = 0; i < platforms.length; i += batchSize) {
            const batch = platforms.slice(i, i + batchSize);
            const batchTasks = batch.flatMap(platform => 
                // Only try variations for high-priority platforms or keep it simple
                [username].map(async (v) => {
                    const probeRes = await probePlatformWithSignatures(v, platform);
                    return {
                        platform: platform.name,
                        username: v,
                        ...probeRes
                    };
                })
            );
            
            const batchResults = await Promise.all(batchTasks);
            results.push(...batchResults);
            
            // Short delay between batches
            if (i + batchSize < platforms.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        const foundCount = results.filter(r => r.status === 'found').length;
        const suspendedCount = results.filter(r => r.status === 'suspended').length;

        // LOGGING ACTION
        logUserActivity(req, 'username_scan', 'Username Intelligence', { 
            target: username, 
            platformsScanned: platforms.length,
            found: foundCount,
            suspended: suspendedCount
        });

        // Save findings if caseId provided
        let findingIds: string[] = [];
        if (caseId) {
            try {
                const foundMatches = results.filter(r => r.status === 'found' || r.status === 'suspended');
                for (const match of foundMatches) {
                    const finding = new Finding({
                        caseId,
                        findingType: 'username_search',
                        source: match.platform,
                        username: match.username,
                        data: match,
                        confidence: match.status === 'found' ? 95 : 70,
                        isVerified: match.status === 'found',
                        tags: ['username-search', match.platform.toLowerCase()],
                    });
                    const saved = await finding.save();
                    findingIds.push(saved._id.toString());
                }
            } catch (findingError) {
                console.error('Error saving username findings:', findingError);
            }
        }

        res.json({
            target: username,
            timestamp: new Date().toISOString(),
            matches: results.filter(r => r.status === 'found' || r.status === 'suspended'),
            summary: {
                total_scanned: platforms.length,
                found: foundCount,
                suspended: suspendedCount
            },
            findingIds, // Return Finding IDs for frontend reference
        });

    } catch (error) {
        console.error('Username intelligence error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Advanced Metadata Forensic Extraction Controller
 */
export const extractMetadata = async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
        console.error('[METADATA_OSINT] Error: No file uploaded');
        res.status(400).json({ status: 'error', message: 'No file uploaded' });
        return;
    }

    const { filename, path: filePath, size, mimetype } = req.file;
    const { caseId } = req.body;
    const pythonPath = getPythonPath();
    const scriptPath = path.join(__dirname, '../scripts/metadata_engine.py');

    console.log(`[METADATA_OSINT] Received upload: ${filename} (${mimetype}, ${size} bytes)`);

    // Helper for cleanup
    const cleanup = () => {
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) console.error(`[METADATA_OSINT] Cleanup error for ${filename}:`, err);
                else console.log(`[METADATA_OSINT] Temp file deleted: ${filename}`);
            });
        }
    };

    try {
        const startTime = Date.now();
        console.log(`[METADATA_OSINT] Spawning process: ${pythonPath} ${scriptPath}`);
        const pythonProcess = spawn(pythonPath, [scriptPath, filePath]);
        
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

        pythonProcess.on('close', async (code) => {
            if (isFinished) return;
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
                logUserActivity(req, 'metadata_extraction', 'Metadata Forensic Engine', {
                    filename,
                    size,
                    mimetype,
                    processingTimeMs: extractionTime
                });

                // Save findings if caseId provided
                let findingId = null;
                if (caseId) {
                    try {
                        const finding = new Finding({
                            caseId,
                            findingType: 'metadata',
                            source: 'Metadata Forensic Engine',
                            data: result,
                            confidence: 95, // Metadata is usually accurate
                            isVerified: true,
                            tags: ['metadata', mimetype.split('/')[0] || 'file'],
                        });
                        const saved = await finding.save();
                        findingId = saved._id;
                    } catch (findingError) {
                        console.error('Error saving metadata finding:', findingError);
                    }
                }

                res.json({ ...result, findingId });
            } catch (e) {
                console.error(`[METADATA_OSINT] Invalid JSON from engine: ${outputData}`);
                res.status(500).json({ 
                    status: 'error', 
                    message: 'Failed to parse forensic data', 
                    error: outputData 
                });
            }
        });

    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error(`[METADATA_OSINT] Internal Controller Error:`, error);
        res.status(500).json({ status: 'error', message: 'Internal processing error' });
    }
};

/**
 * Specialized Pakistan Phone Lookup Controller
 * Refactored for Step 3 - Robust Process Management
 */
export const phoneLookupPK = async (req: Request, res: Response): Promise<void> => {
    const { phone, caseId } = req.body;
    const startTime = Date.now();

    // Part E: Logging Request
    console.log(`[PHONE_OSINT] Request received: ${phone} at ${new Date().toISOString()}`);

    if (!phone) {
        res.status(400).json({ message: 'Phone number required' });
        return;
    }

    const pythonPath = getPythonPath();
    const scriptPath = path.join(__dirname, '../scripts/phone_engine_pk.py');

    try {
        // Part B: Process Management
        const pythonProcess = spawn(pythonPath, [scriptPath, phone]);
        
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

        pythonProcess.on('close', async (code) => {
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
                logUserActivity(req, 'phone_lookup', 'PK Phone Intelligence', { 
                    phone,
                    processingTimeMs: duration
                });

                // Save findings if caseId provided
                let findingId = null;
                if (caseId) {
                    try {
                        const finding = new Finding({
                            caseId,
                            findingType: 'phone_lookup',
                            source: 'Pakistan Telephony Engine',
                            phone,
                            data: result,
                            confidence: result.operator ? 85 : 60,
                            isVerified: !!result.operator,
                            tags: ['phone-lookup', 'pakistan'],
                        });
                        const saved = await finding.save();
                        findingId = saved._id;
                    } catch (findingError) {
                        console.error('Error saving phone finding:', findingError);
                    }
                }

                if (!res.headersSent) {
                    res.json({ ...result, findingId });
                }
            } catch (e) {
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
        });

    } catch (error: any) {
        // Part E: Logging Errors
        console.error(`[PHONE_OSINT] Controller Exception: ${error.message}`);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }
};

/**
 * Network Recon Intelligence (Shodan, VirusTotal, AbuseIPDB, Censys)
 */
export const networkRecon = async (req: Request, res: Response): Promise<void> => {
    const { target, caseId } = req.body; 

    if (!target) {
        res.status(400).json({ message: 'Target (IP or Domain) required' });
        return;
    }

    try {
        const results: any = {
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
                const shodanRes = await axios.get(`https://api.shodan.io/shodan/host/${target}?key=${SHODAN_KEY}`, { timeout: 5000 });
                results.shodan = shodanRes.data;
            } catch (e) { console.error('Shodan error:', target); }
        }

        const VT_KEY = process.env.VIRUSTOTAL_API_KEY;
        if (VT_KEY) {
            try {
                const vtRes = await axios.get(`https://www.virustotal.com/api/v3/ip_addresses/${target}`, {
                    headers: { 'x-apikey': VT_KEY },
                    timeout: 5000
                });
                results.virustotal = vtRes.data;
            } catch (e) {
                try {
                    const vtDomainRes = await axios.get(`https://www.virustotal.com/api/v3/domains/${target}`, {
                        headers: { 'x-apikey': VT_KEY },
                        timeout: 5000
                    });
                    results.virustotal = vtDomainRes.data;
                } catch (err) { console.error('VT error:', target); }
            }
        }

        const ABUSE_KEY = process.env.ABUSEIPDB_API_KEY;
        if (ABUSE_KEY) {
            try {
                const abuseRes = await axios.get(`https://api.abuseipdb.com/api/v2/check`, {
                    params: { ipAddress: target, maxAgeInDays: 90 },
                    headers: { 'Key': ABUSE_KEY, 'Accept': 'application/json' },
                    timeout: 5000
                });
                results.abuseipdb = abuseRes.data;
            } catch (e) { console.error('AbuseIPDB error:', target); }
        }

        const CENSYS_ID = process.env.CENSYS_API_ID;
        const CENSYS_SECRET = process.env.CENSYS_API_SECRET; 
        if (CENSYS_ID && CENSYS_SECRET) {
            try {
                const auth = Buffer.from(`${CENSYS_ID}:${CENSYS_SECRET}`).toString('base64');
                const censysRes = await axios.get(`https://search.censys.io/api/v2/hosts/${target}`, {
                    headers: { 'Authorization': `Basic ${auth}` },
                    timeout: 5000
                });
                results.censys = censysRes.data;
            } catch (e) { console.error('Censys error:', target); }
        }

        logUserActivity(req, 'network_recon', 'Network Intelligence', { target });

        if (caseId) {
            try {
                const finding = new Finding({
                    caseId,
                    findingType: 'network_recon',
                    source: 'Multi-Source (Shodan, VT, AbuseIPDB, Censys)',
                    data: results,
                    confidence: 90,
                    isVerified: true,
                    tags: ['network', 'recon'],
                });
                await finding.save();
            } catch (fError) { console.error('Error saving network finding'); }
        }

        res.json(results);
    } catch (error) {
        console.error('Network recon error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Global Phone Lookup (Twilio)
 */
export const phoneLookupGlobal = async (req: Request, res: Response): Promise<void> => {
    const { phone, caseId } = req.body;
    const SID = process.env.TWILIO_ACCOUNT_SID;
    const TOKEN = process.env.TWILIO_AUTH_TOKEN;

    if (!phone) {
        res.status(400).json({ message: 'Phone number required' });
        return;
    }

    if (!SID || !TOKEN) {
        res.status(500).json({ message: 'Twilio credentials not configured' });
        return;
    }

    try {
        const auth = Buffer.from(`${SID}:${TOKEN}`).toString('base64');
        const response = await axios.get(`https://lookups.twilio.com/v2/PhoneNumbers/${phone}?Fields=caller_name,sim_swap,line_type_intelligence`, {
            headers: { 'Authorization': `Basic ${auth}` },
            timeout: 8000
        });

        const result = response.data;
        logUserActivity(req, 'phone_lookup_global', 'Global Phone Intelligence', { phone });

        if (caseId) {
            try {
                const finding = new Finding({
                    caseId,
                    findingType: 'phone_lookup',
                    source: 'Twilio Global Lookup',
                    phone,
                    data: result,
                    confidence: 95,
                    isVerified: true,
                    tags: ['phone', 'global'],
                });
                await finding.save();
            } catch (fError) { console.error('Error saving phone finding'); }
        }

        res.json(result);
    } catch (error: any) {
        console.error('Twilio lookup error:', error.response?.data || error.message);
        res.status(500).json({ message: 'Twilio lookup failed', error: error.response?.data });
    }
};

/**
 * Pastebin Search (Leaked Data)
 */
export const pasteSearch = async (req: Request, res: Response): Promise<void> => {
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
    } catch (error) {
        res.status(500).json({ message: 'Paste search failed' });
    }
};
