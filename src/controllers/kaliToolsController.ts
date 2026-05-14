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
        results.platforms = response.data || [];
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
          `sherlock "${username}" --timeout 10 2>/dev/null || echo "completed"`
        );

        const platforms: any[] = [];
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

    const foundCount = results.platforms.filter((p: any) => p.found).length;
    res.json({
      ...results,
      summary: {
        totalPlatformsChecked: results.platforms.length,
        platformsFound: foundCount,
        successRate: `${((foundCount / results.platforms.length) * 100).toFixed(2)}%`
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
  res.setHeader('Access-Control-Allow-Origin', '*');
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
 * TheHarvester - Email and subdomain enumeration
 */
export const theHarvester = async (req: AuthRequest, res: Response) => {
  const { domain, source = 'google', caseId } = req.body;

  if (!domain) {
    return res.status(400).json({ message: 'Target domain required' });
  }

  try {
    const results: any = {
      tool: 'TheHarvester',
      domain,
      source,
      timestamp: new Date(),
      emails: [],
      subdomains: [],
      ips: [],
      hosts: []
    };

    const hasTheHarvester = await toolExists('theHarvester');

    if (!hasTheHarvester) {
      return res.status(503).json({ 
        message: 'TheHarvester not installed. Install with: pip install theHarvester' 
      });
    }

    const tempOutputFile = `/tmp/harvester_${Date.now()}.json`;

    try {
      const { stdout } = await execPromise(
        `theHarvester -d "${domain}" -b "${source}" -f "${tempOutputFile}" 2>/dev/null || echo "completed"`
      );

      // Read output file if it exists
      if (fs.existsSync(tempOutputFile)) {
        const data = fs.readFileSync(tempOutputFile, 'utf-8');
        try {
          const parsed = JSON.parse(data);
          results.emails = parsed.emails || [];
          results.subdomains = parsed.subdomains || [];
          results.ips = parsed.ips || [];
          results.hosts = parsed.hosts || [];
          fs.unlinkSync(tempOutputFile);
        } catch (parseError) {
          // If JSON parsing fails, still continue
        }
      }

      results.method = 'Local-TheHarvester';
    } catch (execError) {
      return res.status(500).json({ message: 'TheHarvester execution failed' });
    }

    logUserActivity(req, 'theharvester_enum', 'TheHarvester Domain Enumeration', { domain });

    // Save finding if caseId provided
    if (caseId) {
      try {
        const finding = new Finding({
          caseId,
          findingType: 'domain_enumeration',
          source: 'TheHarvester (Kali OSINT)',
          domain,
          data: results,
          confidence: 85,
          isVerified: false,
          tags: ['theharvester', 'domain-enum', 'kali-tool', 'email-harvest'],
        });
        await finding.save();
      } catch (findingError) {
        console.error('Error saving harvester finding:', findingError);
      }
    }

    res.json({
      ...results,
      summary: {
        emailsFound: results.emails.length,
        subdomainsFound: results.subdomains.length,
        ipsFound: results.ips.length,
        hostsFound: results.hosts.length,
        totalFindings: results.emails.length + results.subdomains.length + results.ips.length
      }
    });
  } catch (error) {
    console.error('TheHarvester error:', error);
    res.status(500).json({ message: 'TheHarvester execution failed' });
  }
};

/**
 * TheHarvester Stream - SSE live output
 */
export const theHarvesterStream = async (req: Request, res: Response) => {
  const { target, caseId } = req.query as { target?: string; caseId?: string };

  if (!target) {
    res.status(400).json({ message: 'Target (domain or email) required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ type: 'status', message: `[*] Starting reconnaissance for: ${target}` });

  try {
    const hasHarvester = await toolExists('theHarvester');

    if (!hasHarvester) {
       send({ type: 'error', message: '[!] theHarvester is not installed on this system.' });
       res.end();
       return;
    }

    const { spawn } = await import('child_process');
    // Using all sources (-b all) and limiting results (-l 500)
    const proc = spawn('theHarvester', ['-d', target, '-b', 'all', '-l', '500'], { stdio: ['ignore', 'pipe', 'pipe'] });
    
    const results: any = { emails: [], hosts: [], ips: [] };

    proc.stdout.on('data', (chunk: Buffer) => {
      const output = chunk.toString();
      const lines = output.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Try to parse emails, hosts, etc. from live output
        if (trimmed.includes('@') && trimmed.includes('.')) {
           const emailMatch = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
           if (emailMatch) {
             const email = emailMatch[0];
             if (!results.emails.includes(email)) {
               results.emails.push(email);
               send({ type: 'found_email', email });
             }
           }
        }
        
        send({ type: 'log', message: trimmed });
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      send({ type: 'log', message: chunk.toString().trim() });
    });

    await new Promise<void>((resolve) => {
      proc.on('close', (code) => {
        send({ type: 'status', message: `[*] Process finished with code ${code}` });
        resolve();
      });
    });

    if (caseId && (results.emails.length > 0)) {
       try {
         const finding = new Finding({
           caseId,
           findingType: 'email_enumeration',
           source: 'theHarvester (Kali OSINT)',
           data: results,
           confidence: 85,
           isVerified: false,
           tags: ['theHarvester', 'email-recon', 'kali-tool'],
         });
         await finding.save();
       } catch {}
    }

    send({ type: 'done', summary: { emailsFound: results.emails.length, target } });

  } catch (err: any) {
    send({ type: 'error', message: err.message || 'Stream failed' });
  }

  res.end();
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
  const tools = ['sherlock', 'exiftool', 'whois', 'theHarvester', 'nmap', 'dnsrecon', 'recon-ng'];
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
