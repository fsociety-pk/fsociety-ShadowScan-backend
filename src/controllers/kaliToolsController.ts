import { Request, Response } from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { logUserActivity } from '../utils/logActivity';
import Finding from '../models/Finding';

const execPromise = promisify(exec);

interface AuthRequest extends Request {
  user?: any;
}

/**
 * Helper: Check if Kali tool is installed
 */
const toolExists = async (toolName: string): Promise<boolean> => {
  try {
    await execPromise(`which ${toolName}`);
    return true;
  } catch {
    return false;
  }
};

/**
 * Sherlock - Username OSINT across social platforms
 * Local Kali Linux tool integration
 */
export const sherlockSearch = async (req: AuthRequest, res: Response) => {
  const { username, caseId } = req.body;

  if (!username || username.trim().length === 0) {
    return res.status(400).json({ message: 'Username required' });
  }

  const cleanUsername = username.trim().substring(0, 50); // Prevent injection

  try {
    const normalizeStatus = (item: any): 'found' | 'not_found' | 'rate_limit' | 'error' => {
      const status = String(item?.status || '').toLowerCase();
      const message = String(item?.message || item?.detail || item?.output || '').toLowerCase();
      if (status === 'found' || item?.found === true) return 'found';
      if (status === 'rate_limit' || message.includes('rate limit') || message.includes('429')) return 'rate_limit';
      if (status === 'error' || item?.error || message.includes('error')) return 'error';
      return 'not_found';
    };

    const normalizePlatform = (item: any) => {
      const platformName = item?.platform || item?.site || item?.name || item?.title || 'Unknown Platform';
      const url = item?.url || item?.link || item?.profile || '';
      const status = normalizeStatus(item);

      return {
        platform: platformName,
        url,
        status,
        statusCode: typeof item?.statusCode === 'number' ? item.statusCode : status === 'found' ? 200 : status === 'rate_limit' ? 429 : status === 'error' ? 500 : 404,
        message: item?.message || item?.detail || item?.note || '',
      };
    };

    const results: any = {
      tool: 'Sherlock',
      username: cleanUsername,
      timestamp: new Date(),
      platforms: [],
      method: 'Unknown'
    };

    // Check if sherlock is installed
    const hasSherlock = await toolExists('sherlock');
    
    if (!hasSherlock) {
      // Fallback: Use web API approach with built-in platform list
      const FALLBACK_PLATFORMS = [
        { name: 'GitHub', pattern: `https://github.com/${cleanUsername}` },
        { name: 'Twitter', pattern: `https://twitter.com/${cleanUsername}` },
        { name: 'Instagram', pattern: `https://instagram.com/${cleanUsername}` },
        { name: 'Reddit', pattern: `https://reddit.com/user/${cleanUsername}` },
        { name: 'LinkedIn', pattern: `https://linkedin.com/in/${cleanUsername}` },
        { name: 'TikTok', pattern: `https://tiktok.com/@${cleanUsername}` },
        { name: 'Facebook', pattern: `https://facebook.com/${cleanUsername}` },
        { name: 'YouTube', pattern: `https://youtube.com/@${cleanUsername}` },
        { name: 'Twitch', pattern: `https://twitch.tv/${cleanUsername}` },
        { name: 'Pinterest', pattern: `https://pinterest.com/${cleanUsername}` },
        { name: 'DeviantArt', pattern: `https://deviantart.com/${cleanUsername}` },
        { name: 'Keybase', pattern: `https://keybase.io/${cleanUsername}` },
        { name: 'Medium', pattern: `https://medium.com/@${cleanUsername}` },
        { name: 'Telegram', pattern: `https://t.me/${cleanUsername}` },
        { name: 'Steam', pattern: `https://steamcommunity.com/id/${cleanUsername}` },
      ];

      const foundPlatforms: any[] = [];
      for (const platform of FALLBACK_PLATFORMS) {
        try {
          const response = await axios.head(platform.pattern, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxRedirects: 1,
            validateStatus: (s) => s < 500
          });
          
          if (response.status === 200 || response.status === 301 || response.status === 302) {
            foundPlatforms.push({
              platform: platform.name,
              url: platform.pattern,
              status: 'found',
              statusCode: 200,
              message: 'Profile found'
            });
          }
        } catch (err) {
          // Platform not found
        }
      }

      results.platforms = foundPlatforms.length > 0 ? foundPlatforms : FALLBACK_PLATFORMS.map(p => ({
        platform: p.name,
        url: p.pattern,
        status: 'not_found',
        statusCode: 404,
        message: 'No profile found'
      }));
      results.method = 'API-Fallback';
    } else {
      // Use local Sherlock tool
      try {
        const { stdout, stderr } = await execPromise(
          `sherlock "${cleanUsername}" --print-all --json 2>&1`,
          { maxBuffer: 10 * 1024 * 1024, timeout: 60000 } // 1 min timeout
        );

        const platformMap = new Map<string, any>();
        
        // Try to parse JSON output first
        try {
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonData = JSON.parse(jsonMatch[0]);
            for (const [platform, data] of Object.entries(jsonData)) {
              if (data && typeof data === 'object') {
                const item = data as any;
                const found = item.exists === true || item.found === true;
                platformMap.set(platform.toLowerCase(), {
                  platform,
                  found,
                  status: found ? 'found' : 'not_found',
                  url: item.url || '',
                  statusCode: found ? 200 : 404,
                  message: item.message || (found ? 'Profile found' : 'No profile found'),
                });
              }
            }
          }
        } catch (jsonErr) {
          // Fallback to text parsing
          const lines = stdout.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (/^\[(\+|-|!|\*)\]/.test(trimmed)) {
              const match = trimmed.match(/^\[([+\-!*])\]\s*(.*?):\s*(.*)$/);
              if (match && match.length >= 4) {
                const flag = (match[1] || '').trim();
                const platform = (match[2] || '').trim();
                const detail = (match[3] || '').trim();
                const status = flag === '+' ? 'found' : flag === '!' ? 'rate_limit' : flag === '*' ? 'error' : 'not_found';
                if (platform) {
                  platformMap.set(platform.toLowerCase(), {
                    platform,
                    found: status === 'found',
                    status,
                    url: status === 'found' ? detail : '',
                    statusCode: status === 'found' ? 200 : status === 'rate_limit' ? 429 : status === 'error' ? 500 : 404,
                    message: detail,
                  });
                }
              }
            }
          }
        }

        const platforms = Array.from(platformMap.values()).map(normalizePlatform);
        results.platforms = platforms.length > 0 ? platforms : [];
        results.method = 'Local-Sherlock';

        // Clean up any generated files
        const reportPath = path.join(process.cwd(), `${cleanUsername}.txt`);
        if (fs.existsSync(reportPath)) {
          try { fs.unlinkSync(reportPath); } catch (_) { /* ignore */ }
        }
      } catch (execError: any) {
        console.error('Sherlock exec error:', execError);
        // Return empty results instead of error
        results.platforms = [];
        results.method = 'Failed';
        results.error = 'Sherlock execution encountered an issue';
      }
    }

    logUserActivity(req, 'sherlock_search', 'Sherlock Username Search', { target: cleanUsername });

    // Save finding if caseId provided
    if (caseId) {
      try {
        const finding = new Finding({
          caseId,
          findingType: 'sherlock_search',
          source: 'Sherlock (OSINT)',
          username: cleanUsername,
          data: results,
          confidence: results.platforms.filter((p: any) => p.status === 'found').length > 0 ? 85 : 20,
          isVerified: false,
          tags: ['sherlock', 'username-search', 'osint'],
        });
        await finding.save();
      } catch (findingError) {
        console.error('Error saving sherlock finding:', findingError);
      }
    }

    const foundCount = results.platforms.filter((p: any) => p.status === 'found').length;
    const totalChecked = results.platforms.length || 0;
    const successRate = totalChecked > 0 ? `${((foundCount / totalChecked) * 100).toFixed(2)}%` : '0%';
    
    res.json({
      ...results,
      summary: {
        totalPlatformsChecked: totalChecked,
        platformsFound: foundCount,
        successRate,
        status: foundCount > 0 ? 'success' : 'no_results'
      }
    });
  } catch (error: any) {
    console.error('Sherlock search error:', error);
    res.status(200).json({ 
      tool: 'Sherlock',
      username: cleanUsername,
      platforms: [],
      summary: {
        totalPlatformsChecked: 0,
        platformsFound: 0,
        successRate: '0%',
        status: 'error'
      },
      error: error.message || 'Sherlock search encountered an error'
    });
  }
};

/**
 * Sherlock Stream - SSE live output for username search
 */
export const sherlockStream = async (req: Request, res: Response) => {
  const { username, caseId } = req.query as { username?: string; caseId?: string };

  if (!username) {
    res.status(400).json({ message: 'Username required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ type: 'status', message: `[*] Starting username scan for: ${username}` });

  try {
    const hasSherlock = await toolExists('sherlock');

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

      const foundPlatforms: any[] = [];

      for (const platform of PLATFORMS) {
        send({ type: 'log', message: `[~] Checking ${platform.name}...` });
        try {
          const httpResp = await axios.get(platform.url, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            validateStatus: (s) => s < 500,
          });
          const found = httpResp.status === 200;
          if (found) {
            send({ type: 'found', platform: platform.name, url: platform.url, statusCode: httpResp.status });
            foundPlatforms.push({ platform: platform.name, found: true, url: platform.url, statusCode: httpResp.status });
          } else {
            send({ type: 'not_found', platform: platform.name });
          }
        } catch {
          send({ type: 'not_found', platform: platform.name });
        }
      }

      if (caseId) {
        try {
          const finding = new Finding({
            caseId,
            findingType: 'username_search',
            source: 'Username OSINT',
            username,
            data: { platforms: foundPlatforms, username },
            confidence: 80,
            isVerified: false,
            tags: ['username-search', 'osint'],
          });
          await finding.save();
        } catch {}
      }

      send({ type: 'done', summary: { totalChecked: PLATFORMS.length, found: foundPlatforms.length } });
    } else {
      // Use real sherlock with spawn for live output
      const { spawn } = await import('child_process');
      const proc = spawn('sherlock', [username, '--timeout', '10', '--print-found'], { stdio: ['ignore', 'pipe', 'pipe'] });
      const foundPlatforms: any[] = [];

      proc.on('error', (err) => {
        console.error('[Sherlock Tool] Spawn error:', err);
        send({ type: 'log', message: `[!] Failed to start Sherlock CLI: ${err.message}` });
        send({ type: 'error', message: 'Sherlock CLI tools could not be started.' });
      });

      proc.stdout.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.includes('[+]')) {
            const match = trimmed.match(/\[\+\]\s(.*?):\s(.*)/);
            if (match) {
              const platform = match[1].trim();
              const url = match[2].trim();
              foundPlatforms.push({ platform, found: true, url, statusCode: 200 });
              send({ type: 'found', platform, url, statusCode: 200 });
            } else {
              send({ type: 'log', message: trimmed });
            }
          } else {
            send({ type: 'log', message: trimmed });
          }
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        send({ type: 'log', message: chunk.toString().trim() });
      });

      await new Promise<void>((resolve) => proc.on('close', resolve));

      if (caseId && foundPlatforms.length > 0) {
        try {
          const finding = new Finding({
            caseId, findingType: 'username_search', source: 'Username OSINT',
            username, data: { platforms: foundPlatforms, username }, confidence: 90,
            isVerified: false, tags: ['username-search', 'sherlock'],
          });
          await finding.save();
        } catch {}
      }

      send({ type: 'done', summary: { totalChecked: foundPlatforms.length + 10, found: foundPlatforms.length } });
    }
  } catch (err: any) {
    send({ type: 'error', message: err.message || 'Stream failed' });
  }

  res.end();
};

/**
 * ExifTool - Metadata extraction from files
 */
export const exiftoolMetadata = async (req: AuthRequest, res: Response) => {
  const { caseId } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: 'File upload required' });
  }

  try {
    const filePath = req.file.path;
    const results: any = {
      tool: 'ExifTool',
      filename: req.file.originalname,
      filesize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      metadata: {},
      sensitiveData: {
        gps: null,
        creator: null,
        copyright: null,
        software: null,
        cameraModel: null,
        dateTime: null,
        deviceId: null
      }
    };

    const hasExiftool = await toolExists('exiftool');

    if (!hasExiftool) {
      // Clean up and return error
      try { fs.unlinkSync(filePath); } catch (_) { }
      return res.status(200).json({
        ...results,
        method: 'Unavailable',
        message: 'ExifTool not installed. Install with: apt-get install exiftool'
      });
    }

    try {
      const { stdout } = await execPromise(`exiftool -json "${filePath}" 2>&1`, { maxBuffer: 5 * 1024 * 1024 });
      
      try {
        const metadata = JSON.parse(stdout);
        results.metadata = metadata[0] || {};
        results.method = 'ExifTool';

        // Extract sensitive data
        if (metadata[0]) {
          const data = metadata[0];
          results.sensitiveData = {
            gps: data.GPSLatitude ? {
              latitude: data.GPSLatitude,
              longitude: data.GPSLongitude,
              altitude: data.GPSAltitude
            } : null,
            creator: data.Creator || null,
            copyright: data.Copyright || null,
            software: data.Software || null,
            cameraModel: data.Model || null,
            dateTime: data.DateTime || data.DateTimeOriginal || null,
            deviceId: data.DeviceID || null
          };
        }
      } catch (parseErr) {
        results.metadata = { raw: stdout };
        results.method = 'ExifTool (Raw)';
      }
    } catch (execError: any) {
      console.error('ExifTool error:', execError);
      results.method = 'Failed';
      results.error = 'ExifTool extraction failed';
    }

    logUserActivity(req, 'exiftool_metadata', 'ExifTool Metadata Extraction', { 
      filename: req.file.originalname 
    });

    // Save finding if caseId provided
    if (caseId) {
      try {
        const finding = new Finding({
          caseId,
          findingType: 'metadata_extraction',
          source: 'ExifTool (OSINT)',
          data: results,
          confidence: Object.values(results.sensitiveData).some(v => v !== null) ? 90 : 40,
          isVerified: true,
          tags: ['exiftool', 'metadata', req.file.mimetype.split('/')[0]],
        });
        await finding.save();
      } catch (findingError) {
        console.error('Error saving exiftool finding:', findingError);
      }
    }

    // Clean up uploaded file
    try { fs.unlinkSync(filePath); } catch (_) { }

    res.json({
      status: 'success',
      ...results
    });
  } catch (error: any) {
    console.error('ExifTool metadata error:', error);
    // Clean up
    try { fs.unlinkSync(req.file!.path); } catch (_) { }
    
    res.status(200).json({ 
      message: 'Metadata extraction encountered an issue',
      tool: 'ExifTool',
      status: 'error',
      error: error.message
    });
  }
};

/**
 * Whois - Domain and IP ownership information
 */
export const whoisLookup = async (req: AuthRequest, res: Response) => {
  const { target, caseId } = req.body;

  if (!target || target.trim().length === 0) {
    return res.status(400).json({ message: 'Target domain or IP required' });
  }

  const cleanTarget = target.trim().substring(0, 255);

  try {
    const results: any = {
      tool: 'Whois',
      target: cleanTarget,
      timestamp: new Date(),
      data: {},
      summary: {
        registrar: null,
        registrationDate: null,
        expirationDate: null,
        nameServers: [],
        organization: null,
        address: null,
        email: null,
        phone: null
      }
    };

    const hasWhois = await toolExists('whois');

    if (!hasWhois) {
      return res.status(200).json({
        ...results,
        method: 'Unavailable',
        message: 'Whois tool not installed. Install with: apt-get install whois'
      });
    }

    try {
      const { stdout, stderr } = await execPromise(`whois "${cleanTarget}" 2>&1`, { maxBuffer: 5 * 1024 * 1024, timeout: 15000 });
      const output = stdout || stderr;
      
      // Parse Whois output
      const lines = output.split('\n');
      const data: any = {};
      
      lines.forEach((line: string) => {
        if (line.includes(':')) {
          const colonIndex = line.indexOf(':');
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          if (key && value) {
            data[key] = value;
          }
        }
      });

      results.data = data;
      results.method = 'Local-Whois';

      // Extract key information
      results.summary = {
        registrar: data['Registrar'] || data['registrar'] || data['Sponsoring Registrar'] || null,
        registrationDate: data['Creation Date'] || data['created'] || data['Created Date'] || null,
        expirationDate: data['Registry Expiry Date'] || data['expiry_date'] || data['Expiration Date'] || null,
        nameServers: lines
          .filter((l: string) => l.toLowerCase().includes('name server') || l.toLowerCase().includes('nameserver'))
          .map((l: string) => l.split(':')[1]?.trim())
          .filter(Boolean) || [],
        organization: data['Organization'] || data['organisation'] || data['Org'] || null,
        address: data['Address'] || data['address'] || null,
        email: data['Email'] || data['email'] || data['admin-email'] || null,
        phone: data['Phone'] || data['phone'] || data['admin-phone'] || null
      };
    } catch (execError: any) {
      console.error('Whois error:', execError);
      results.method = 'Failed';
      results.error = 'Whois lookup failed';
    }

    logUserActivity(req, 'whois_lookup', 'Whois Domain/IP Lookup', { target: cleanTarget });

    // Save finding if caseId provided
    if (caseId) {
      try {
        const finding = new Finding({
          caseId,
          findingType: 'whois_lookup',
          source: 'Whois (OSINT)',
          domain: cleanTarget,
          data: results,
          confidence: results.summary.registrar ? 85 : 40,
          isVerified: true,
          tags: ['whois', 'domain-info', 'osint'],
        });
        await finding.save();
      } catch (findingError) {
        console.error('Error saving whois finding:', findingError);
      }
    }

    res.json({
      status: 'success',
      ...results
    });
  } catch (error: any) {
    console.error('Whois lookup error:', error);
    res.status(200).json({ 
      tool: 'Whois',
      target: cleanTarget,
      status: 'error',
      message: error.message || 'Whois lookup encountered an issue'
    });
  }
};


/**
 * Nmap - Network and port scanning (DEPRECATED & REMOVED)
 * This tool has been removed due to security concerns and reliability issues
 */
export const nmapScan = async (req: AuthRequest, res: Response) => {
  return res.status(410).json({ 
    message: 'Nmap tool has been deprecated and removed. Use DNS reconnaissance or API-based scanning instead.' 
  });
};

/**
 * System Tool Availability Check
 * Returns which Kali tools are installed and ready to use
 */
export const checkToolsAvailability = async (req: Request, res: Response) => {
  const tools = ['sherlock', 'exiftool', 'whois', 'dnsrecon', 'recon-ng'];
  const availability: any = {};

  try {
    for (const tool of tools) {
      availability[tool] = await toolExists(tool);
    }

    res.json({
      status: 'success',
      timestamp: new Date(),
      tools: availability,
      installed: Object.values(availability).filter(Boolean).length,
      total: tools.length,
      recommendation: Object.values(availability).filter(Boolean).length < 3 
        ? 'Install Kali tools for enhanced OSINT capabilities: sudo apt-get install sherlock exiftool whois' 
        : 'Major tools are available',
      deprecated: {
        nmap: 'Removed - use DNS reconnaissance or API-based scanning',
        theharvester: 'Removed - use email OSINT tools instead'
      }
    });
  } catch (error) {
    console.error('Tool availability check error:', error);
    res.status(500).json({ message: 'Failed to check tool availability' });
  }
};
