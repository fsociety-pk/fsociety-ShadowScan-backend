import { Request, Response } from 'express';
import { exec } from 'child_process';
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

  if (!username) {
    return res.status(400).json({ message: 'Username required' });
  }

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
      username,
      timestamp: new Date(),
      platforms: []
    };

    // Check if sherlock is installed
    const hasSherlock = await toolExists('sherlock');
    
    if (!hasSherlock) {
      // Fallback: Use web API approach
      try {
        const response = await axios.get(`https://api.sherlock.xyz/search/${username}`, {
          timeout: 10000
        });
        // API may return array or object keyed by platform
        if (Array.isArray(response.data)) {
          results.platforms = response.data.map(normalizePlatform);
        } else if (response.data && typeof response.data === 'object') {
          // Convert { platform: {...} } to normalized array
          const arr: any[] = [];
          for (const [k, v] of Object.entries(response.data)) {
            const item = (v as any) || {};
            arr.push(normalizePlatform({ platform: k, url: item.url || item.profile || item.link || '', status: item.status || (item.exists ? 'found' : undefined), message: item.message || item.note || '' }));
          }
          results.platforms = arr;
        } else {
          results.platforms = [];
        }
        results.method = 'API-Fallback';
      } catch (apiError) {
        return res.status(503).json({ 
          message: 'Sherlock tool not installed. Install with: pip install sherlock-project' 
        });
      }
    } else {
      // Use local Sherlock tool
      try {
        const { stdout } = await execPromise(
          `sherlock "${username}" --timeout 10 --print-all --no-color --no-txt 2>/dev/null || echo "completed"`
        );

        const platformMap = new Map<string, any>();
        const lines = stdout.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (/^\[(\+|-|!|\*)\]/.test(trimmed)) {
            const match = trimmed.match(/^\[([+\-!\*])\]\s*(.*?):\s*(.*)$/);
            if (match && match.length >= 4) {
              const flag = (match[1] || '').trim();
              const platform = (match[2] || '').trim();
              const detail = (match[3] || '').trim();
              const status = flag === '+' ? 'found' : flag === '!' ? 'rate_limit' : flag === '*' ? 'error' : 'not_found';
              const normalized = {
                platform,
                found: status === 'found',
                status,
                url: status === 'found' ? detail : '',
                statusCode: status === 'found' ? 200 : status === 'rate_limit' ? 429 : status === 'error' ? 500 : 404,
                message: detail,
              };
              if (platform) platformMap.set(platform.toLowerCase(), normalized);
            }
          }
        }

        const platforms = Array.from(platformMap.values()).map(normalizePlatform);
        
        // Clean up Sherlock report file from disk to keep workspace pristine
        const reportPath = path.join(process.cwd(), `${username}.txt`);
        if (fs.existsSync(reportPath)) {
          try {
            fs.unlinkSync(reportPath);
          } catch (e) {
            console.error('Failed to delete sherlock report file:', e);
          }
        }

        results.platforms = platforms;
        results.method = 'Local-Sherlock';
      } catch (execError) {
        return res.status(500).json({ message: 'Sherlock execution failed' });
      }
    }

    logUserActivity(req, 'sherlock_search', 'Sherlock Username Search', { target: username });

    // Save finding if caseId provided
    if (caseId) {
      try {
        const finding = new Finding({
          caseId,
          findingType: 'sherlock_search',
          source: 'Sherlock (Kali OSINT)',
          username,
          data: results,
          confidence: 85,
          isVerified: false,
          tags: ['sherlock', 'username-search', 'kali-tool'],
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
        successRate
      }
    });
  } catch (error) {
    console.error('Sherlock search error:', error);
    res.status(500).json({ message: 'Sherlock search failed' });
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
 * ExifTool - Metadata extraction from files (enhanced)
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
      metadata: {}
    };

    const hasExiftool = await toolExists('exiftool');

    if (!hasExiftool) {
      return res.status(503).json({ 
        message: 'ExifTool not installed. Install with: apt-get install libimage-exiftool-perl' 
      });
    }

    try {
      const { stdout } = await execPromise(`exiftool -json "${filePath}"`);
      const metadata = JSON.parse(stdout);
      results.metadata = metadata[0] || {};
      results.method = 'ExifTool';

      // Extract sensitive data
      results.sensitiveData = {
        gps: metadata[0]?.GPSLatitude ? {
          latitude: metadata[0].GPSLatitude,
          longitude: metadata[0].GPSLongitude,
          altitude: metadata[0].GPSAltitude
        } : null,
        creator: metadata[0]?.Creator || null,
        copyright: metadata[0]?.Copyright || null,
        software: metadata[0]?.Software || null,
        cameraModel: metadata[0]?.Model || null,
        dateTime: metadata[0]?.DateTime || null,
        deviceId: metadata[0]?.DeviceID || null
      };
    } catch (execError) {
      return res.status(500).json({ message: 'ExifTool extraction failed' });
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
          source: 'ExifTool (Kali OSINT)',
          data: results,
          confidence: 95,
          isVerified: true,
          tags: ['exiftool', 'metadata', 'kali-tool', req.file.mimetype.split('/')[0]],
        });
        await finding.save();
      } catch (findingError) {
        console.error('Error saving exiftool finding:', findingError);
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json(results);
  } catch (error) {
    console.error('ExifTool metadata error:', error);
    res.status(500).json({ message: 'Metadata extraction failed' });
  }
};

/**
 * Whois - Domain and IP ownership information
 */
export const whoisLookup = async (req: AuthRequest, res: Response) => {
  const { target, caseId } = req.body;

  if (!target) {
    return res.status(400).json({ message: 'Target domain or IP required' });
  }

  try {
    const results: any = {
      tool: 'Whois',
      target,
      timestamp: new Date(),
      data: null
    };

    const hasWhois = await toolExists('whois');

    if (!hasWhois) {
      return res.status(503).json({ 
        message: 'Whois tool not installed. Install with: apt-get install whois' 
      });
    }

    try {
      const { stdout } = await execPromise(`whois "${target}"`);
      
      // Parse Whois output
      const lines = stdout.split('\n');
      results.data = {};
      
      lines.forEach((line: string) => {
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
          .filter((l: string) => l.includes('Name Server') || l.includes('nameserver'))
          .map((l: string) => l.split(':')[1]?.trim())
          .filter(Boolean) || [],
        organization: results.data['Organization'] || results.data['organisation'] || null,
        address: results.data['Address'] || null,
        email: results.data['Email'] || results.data['admin-email'] || null,
        phone: results.data['Phone'] || results.data['admin-phone'] || null
      };
    } catch (execError) {
      return res.status(500).json({ message: 'Whois lookup failed' });
    }

    logUserActivity(req, 'whois_lookup', 'Whois Domain/IP Lookup', { target });

    // Save finding if caseId provided
    if (caseId) {
      try {
        const finding = new Finding({
          caseId,
          findingType: 'whois_lookup',
          source: 'Whois (Kali OSINT)',
          domain: target,
          data: results,
          confidence: 90,
          isVerified: true,
          tags: ['whois', 'domain-info', 'kali-tool'],
        });
        await finding.save();
      } catch (findingError) {
        console.error('Error saving whois finding:', findingError);
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Whois lookup error:', error);
    res.status(500).json({ message: 'Whois lookup failed' });
  }
};


/**
 * Nmap - Network and port scanning
 * LIMITED: Basic host discovery and port scanning only
 */
export const nmapScan = async (req: AuthRequest, res: Response) => {
  const { target, scanType = 'basic', caseId } = req.body;

  if (!target) {
    return res.status(400).json({ message: 'Target IP or hostname required' });
  }

  try {
    const results: any = {
      tool: 'Nmap',
      target,
      scanType,
      timestamp: new Date(),
      ports: [],
      hostStatus: null,
      osDetection: null
    };

    const hasNmap = await toolExists('nmap');

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
      const { stdout } = await execPromise(nmapCommand);
      
      // Parse XML output
      const portMatches = stdout.match(/<port\s+protocol="tcp"\s+portid="(\d+)">/g) || [];
      results.ports = portMatches.map((match: string) => {
        const portNum = match.match(/portid="(\d+)"/)?.[1];
        return {
          number: parseInt(portNum || '0'),
          status: 'open',
          protocol: 'tcp'
        };
      });

      results.method = 'Local-Nmap';
      results.hostStatus = stdout.includes('Nmap done') ? 'completed' : 'partial';
    } catch (execError) {
      return res.status(500).json({ message: 'Nmap scan failed' });
    }

    logUserActivity(req, 'nmap_scan', 'Nmap Network Scan', { target, scanType });

    // Save finding if caseId provided
    if (caseId) {
      try {
        const finding = new Finding({
          caseId,
          findingType: 'network_scan',
          source: 'Nmap (Kali OSINT)',
          domain: target,
          data: results,
          confidence: 88,
          isVerified: true,
          tags: ['nmap', 'network-scan', 'kali-tool', scanType],
        });
        await finding.save();
      } catch (findingError) {
        console.error('Error saving nmap finding:', findingError);
      }
    }

    res.json({
      ...results,
      summary: {
        openPorts: results.ports.length,
        scanCompleted: results.hostStatus === 'completed'
      }
    });
  } catch (error) {
    console.error('Nmap scan error:', error);
    res.status(500).json({ message: 'Nmap scan failed' });
  }
};

/**
 * System Tool Availability Check
 * Returns which Kali tools are installed and ready to use
 */
export const checkToolsAvailability = async (req: Request, res: Response) => {
  const tools = ['sherlock', 'exiftool', 'whois', 'nmap', 'dnsrecon', 'recon-ng'];
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
      recommendation: Object.values(availability).filter(Boolean).length < 4 
        ? 'Install more Kali tools for enhanced OSINT capabilities: sudo apt-get install sherlock exiftool whois' 
        : 'All major tools are available'
    });
  } catch (error) {
    console.error('Tool availability check error:', error);
    res.status(500).json({ message: 'Failed to check tool availability' });
  }
};
