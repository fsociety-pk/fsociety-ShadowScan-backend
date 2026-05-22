import { Request, Response } from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { logUserActivity } from '../utils/logActivity';
import Finding from '../models/Finding';

const execPromise = promisify(exec);

interface SherlockExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

interface AuthRequest extends Request {
  user?: any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Check if a Kali/system tool is installed and on PATH
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
 * Normalize a raw platform entry from any sherlock output format into a
 * consistent shape. Handles JSON file output, stdout JSON blobs, and
 * line-by-line text output.
 */
const normalizeStatus = (item: any): 'found' | 'not_found' | 'rate_limit' | 'error' => {
  const status = String(item?.status || '').toLowerCase();
  const message = String(item?.message || item?.detail || item?.output || '').toLowerCase();

  if (status === 'found' || item?.found === true) return 'found';
  if (status === 'rate_limit' || message.includes('rate limit') || message.includes('429')) return 'rate_limit';
  if (status === 'error' || item?.error || message.includes('error')) return 'error';
  return 'not_found';
};

const normalizePlatform = (item: any) => {
  const status = normalizeStatus(item);
  return {
    platform: item?.platform || item?.site || item?.name || item?.title || 'Unknown Platform',
    url: item?.url || item?.link || item?.profile || '',
    status,
    statusCode: typeof item?.statusCode === 'number'
      ? item.statusCode
      : status === 'found' ? 200 : status === 'rate_limit' ? 429 : status === 'error' ? 500 : 404,
    message: item?.message || item?.detail || item?.note || '',
  };
};

const runSherlockCommand = (args: string[], timeoutMs: number): Promise<SherlockExecResult> => {
  return new Promise((resolve) => {
    const proc = spawn('sherlock', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const watchdog = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill('SIGKILL');
      } catch (_) {
        // no-op
      }
    }, timeoutMs);

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      clearTimeout(watchdog);
      resolve({ stdout, stderr: `${stderr}\n${err.message}`.trim(), exitCode: 127, timedOut });
    });

    proc.on('close', (code) => {
      clearTimeout(watchdog);
      resolve({ stdout, stderr, exitCode: code ?? 1, timedOut });
    });
  });
};

// ── Sherlock ──────────────────────────────────────────────────────────────────

/**
 * Sherlock — Username OSINT across 350+ social platforms.
 *
 * FIX: The `--json` flag requires a FILE PATH argument, not a boolean switch.
 *      We write JSON output to a temp file, parse it, then clean up.
 *
 * Priority order:
 *   1. Local Sherlock → JSON file output  (most complete, 350+ sites)
 *   2. Local Sherlock → text output parse (fallback if JSON file unreadable)
 *   3. Direct HTTP HEAD checks            (fallback when Sherlock not installed)
 */
export const sherlockSearch = async (req: AuthRequest, res: Response) => {
  const { username, caseId } = req.body;

  if (!username || username.trim().length === 0) {
    return res.status(400).json({ message: 'Username required' });
  }

  // Basic sanitisation — strip shell-special chars, cap length
  const cleanUsername = username.trim().replace(/[^a-zA-Z0-9_.\-]/g, '').substring(0, 50);

  if (!cleanUsername) {
    return res.status(400).json({ message: 'Username contains no valid characters' });
  }

  const results: any = {
    tool: 'Sherlock',
    username: cleanUsername,
    timestamp: new Date(),
    platforms: [],
    method: 'Unknown',
  };

  try {
    const hasSherlock = await toolExists('sherlock');

    if (!hasSherlock) {
      // ── Fallback: direct HTTP HEAD probes ──────────────────────────────────
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
        { name: 'GitLab', pattern: `https://gitlab.com/${cleanUsername}` },
        { name: 'HackerNews', pattern: `https://news.ycombinator.com/user?id=${cleanUsername}` },
        { name: 'Replit', pattern: `https://replit.com/@${cleanUsername}` },
        { name: 'Codepen', pattern: `https://codepen.io/${cleanUsername}` },
        { name: 'NPM', pattern: `https://npmjs.com/~${cleanUsername}` },
      ];

      const probeResults = await Promise.allSettled(
        FALLBACK_PLATFORMS.map(async (p) => {
          try {
            const response = await axios.head(p.pattern, {
              timeout: 5000,
              headers: { 'User-Agent': 'Mozilla/5.0' },
              maxRedirects: 2,
              validateStatus: (s) => s < 500,
            });
            const found = response.status === 200 || response.status === 301 || response.status === 302;
            return {
              platform: p.name,
              url: p.pattern,
              status: found ? 'found' : 'not_found',
              statusCode: response.status,
              message: found ? 'Profile found' : 'No profile found',
            };
          } catch {
            return {
              platform: p.name,
              url: p.pattern,
              status: 'not_found',
              statusCode: 404,
              message: 'No profile found',
            };
          }
        })
      );

      results.platforms = probeResults.map((r) =>
        r.status === 'fulfilled' ? r.value : {
          platform: 'Unknown',
          url: '',
          status: 'error',
          statusCode: 500,
          message: 'Probe failed',
        }
      );
      results.method = 'API-Fallback';

    } else {
      // ── Primary: local Sherlock tool ───────────────────────────────────────
      //
      // IMPORTANT — Sherlock flag reference:
      //   --json <FILE>         = INPUT custom sites-data file (NOT output!)
      //   --folderoutput <DIR>  = write all output files (txt + json) into DIR
      //
      // Strategy:
      //   1. Run sherlock with --folderoutput /tmp/<tmpdir>
      //      Sherlock writes <tmpdir>/<username>.json automatically.
      //   2. Parse that JSON file.
      //   3. If file missing/unreadable, fall back to parsing stdout text lines.
      //   4. Always clean up the tmp folder.
      //
      // NOTE: Sherlock exits with code 1 when it finds ≥1 "not found" result —
      //       that is NORMAL. We must parse stdout/files even on code 1.
      //

      const tmpDir = `/tmp/sherlock_${cleanUsername}_${Date.now()}`;
      const jsonOutFile = path.join(tmpDir, `${cleanUsername}.json`);

      // Create a dedicated tmp folder so we never collide across concurrent requests
      try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (_) { /* ignore */ }

      // stdout captured from both success and code-1 exits
      let stdout = '';
      let stderr = '';

      const perSiteTimeoutSec = parseInt(process.env.SHERLOCK_SITE_TIMEOUT_SEC || '', 10) || 8;
      const commandTimeoutMs = parseInt(process.env.SHERLOCK_COMMAND_TIMEOUT_MS || '', 10) || 90000;

      const sherlockVariants: string[][] = [
        [cleanUsername, '--print-all', '--folderoutput', tmpDir, '--no-color', '--timeout', String(perSiteTimeoutSec)],
        [cleanUsername, '--print-all', '--folderoutput', tmpDir, '--timeout', String(perSiteTimeoutSec)],
        [cleanUsername, '--print-found', '--folderoutput', tmpDir, '--no-color', '--timeout', String(perSiteTimeoutSec)],
      ];

      let ranVariant = false;
      for (const args of sherlockVariants) {
        const run = await runSherlockCommand(args, commandTimeoutMs);
        stdout = run.stdout;
        stderr = run.stderr;

        // 0 => success, 1 => normal Sherlock partial/not-found exits
        if (!run.timedOut && (run.exitCode === 0 || run.exitCode === 1)) {
          ranVariant = true;
          break;
        }

        // Stop retrying variants if command timed out; this is operational, not syntax.
        if (run.timedOut) {
          results.method = 'Failed';
          results.error = `Sherlock timed out after ${commandTimeoutMs}ms. Try increasing SHERLOCK_COMMAND_TIMEOUT_MS.`;
          results.platforms = [];
          break;
        }

        // If we still got useful stdout, continue parsing it instead of failing hard.
        if (stdout.trim().length > 0) {
          ranVariant = true;
          break;
        }
      }

      if (!results.error && !ranVariant && !stdout.trim()) {
        console.error('[Sherlock] failed to execute any variant', { stderr: stderr.substring(0, 400) });
        results.method = 'Failed';
        results.error = `Sherlock execution failed. ${stderr.substring(0, 220) || 'No output from command.'}`;
        results.platforms = [];
      }

      // Only attempt to parse if we don't already have a hard failure
      if (!results.error) {
        const platformMap = new Map<string, any>();

        // ── Strategy 1: parse the JSON output file ─────────────────────────
        let parsedFromFile = false;
        if (fs.existsSync(jsonOutFile)) {
          try {
            const jsonContent = fs.readFileSync(jsonOutFile, 'utf8');
            const jsonData = JSON.parse(jsonContent);

            // Sherlock ≥0.14 JSON shape:
            // {
            //   "Instagram": {
            //     "url_main": "https://www.instagram.com/",
            //     "url_user": "https://www.instagram.com/thehusnain/",
            //     "status":   { "status": "Claimed", "message": "...", "query_time": 0.5 },
            //     "http_status": 200,
            //     "response_text_len": 12345
            //   }, ...
            // }
            for (const [platformName, data] of Object.entries(jsonData)) {
              if (!data || typeof data !== 'object') continue;
              const item = data as any;
              const statusObj = typeof item.status === 'object' ? item.status : item;
              const statusStr = String(statusObj?.status ?? item?.status ?? '').toLowerCase();
              const msgStr = String(statusObj?.message ?? '').toLowerCase();

              const found = statusStr === 'claimed' || statusStr === 'found';
              const rateLimit = !found && (statusStr === 'unknown' && msgStr.includes('429'));
              const isError = !found && !rateLimit && statusStr === 'unknown' && msgStr.includes('error');

              platformMap.set(platformName.toLowerCase(), {
                platform: platformName,
                found,
                status: found ? 'found' : rateLimit ? 'rate_limit' : isError ? 'error' : 'not_found',
                url: item?.url_user || item?.url || '',
                statusCode: item?.http_status ?? (found ? 200 : rateLimit ? 429 : isError ? 500 : 404),
                message: statusObj?.message ?? (found ? 'Profile found' : 'No profile found'),
              });
            }
            parsedFromFile = platformMap.size > 0;
          } catch (jsonErr) {
            console.warn('[Sherlock] JSON file parse failed, falling back to stdout:', jsonErr);
          }
        }

        // ── Strategy 2: parse stdout text lines (fallback) ─────────────────
        if (!parsedFromFile && stdout) {
          const lines = stdout.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Format: [+] Platform: https://site.com/user
            //         [-] Platform: Not Found!
            //         [!] Platform: <rate-limit message>
            //         [*] Platform: <error>
            const match = trimmed.match(/^\[([+\-!*])\]\s*(.*?):\s*(.*)$/);
            if (!match) continue;

            const flag = match[1].trim();
            const platform = match[2].trim();
            const detail = match[3].trim();
            if (!platform) continue;

            const status =
              flag === '+' ? 'found'
                : flag === '!' ? 'rate_limit'
                  : flag === '*' ? 'error'
                    : 'not_found';

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

        results.platforms = Array.from(platformMap.values()).map(normalizePlatform);
        results.method = parsedFromFile ? 'Local-Sherlock-JSON' : 'Local-Sherlock-Text';
      }

      // ── Clean up tmp folder ────────────────────────────────────────────────
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }

      // Also remove any stray files Sherlock may have dropped in cwd
      for (const ext of ['.txt', '.csv']) {
        const stray = path.join(process.cwd(), `${cleanUsername}${ext}`);
        if (fs.existsSync(stray)) try { fs.unlinkSync(stray); } catch (_) { /* ignore */ }
      }
    }

    // ── Logging & persistence ──────────────────────────────────────────────
    logUserActivity(req, 'sherlock_search', 'Sherlock Username Search', { target: cleanUsername });

    if (caseId) {
      try {
        const foundCount = results.platforms.filter((p: any) => p.status === 'found').length;
        const finding = new Finding({
          caseId,
          findingType: 'sherlock_search',
          source: 'Sherlock (OSINT)',
          username: cleanUsername,
          data: results,
          confidence: foundCount > 0 ? 85 : 20,
          isVerified: false,
          tags: ['sherlock', 'username-search', 'osint'],
        });
        await finding.save();
      } catch (findingError) {
        console.error('[Sherlock] Error saving finding:', findingError);
      }
    }

    // ── Response ───────────────────────────────────────────────────────────
    const foundCount = results.platforms.filter((p: any) => p.status === 'found').length;
    const totalChecked = results.platforms.length;

    return res.json({
      ...results,
      summary: {
        totalPlatformsChecked: totalChecked,
        platformsFound: foundCount,
        successRate: totalChecked > 0
          ? `${((foundCount / totalChecked) * 100).toFixed(2)}%`
          : '0%',
        status: foundCount > 0 ? 'success' : 'no_results',
      },
    });

  } catch (error: any) {
    console.error('[Sherlock] Unhandled error:', error);
    return res.status(200).json({
      tool: 'Sherlock',
      username: cleanUsername,
      platforms: [],
      summary: {
        totalPlatformsChecked: 0,
        platformsFound: 0,
        successRate: '0%',
        status: 'error',
      },
      error: error.message || 'Sherlock search encountered an error',
    });
  }
};

// ── Sherlock SSE Stream ───────────────────────────────────────────────────────

/**
 * Sherlock Stream — Server-Sent Events live output for username search.
 * Streams each platform result as it comes in for real-time UI updates.
 */
export const sherlockStream = async (req: Request, res: Response) => {
  const { username, caseId } = req.query as { username?: string; caseId?: string };

  if (!username) {
    res.status(400).json({ message: 'Username required' });
    return;
  }

  const cleanUsername = username.trim().replace(/[^a-zA-Z0-9_.\-]/g, '').substring(0, 50);

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ type: 'status', message: `[*] Starting username scan for: ${cleanUsername}` });

  try {
    const hasSherlock = await toolExists('sherlock');

    if (!hasSherlock) {
      // ── Fallback: probe known platforms one by one (SSE) ──────────────────
      const PLATFORMS = [
        { name: 'GitHub', url: `https://github.com/${cleanUsername}` },
        { name: 'Twitter', url: `https://twitter.com/${cleanUsername}` },
        { name: 'Instagram', url: `https://instagram.com/${cleanUsername}` },
        { name: 'Reddit', url: `https://reddit.com/user/${cleanUsername}` },
        { name: 'LinkedIn', url: `https://linkedin.com/in/${cleanUsername}` },
        { name: 'TikTok', url: `https://tiktok.com/@${cleanUsername}` },
        { name: 'Pinterest', url: `https://pinterest.com/${cleanUsername}` },
        { name: 'Twitch', url: `https://twitch.tv/${cleanUsername}` },
        { name: 'YouTube', url: `https://youtube.com/@${cleanUsername}` },
        { name: 'DeviantArt', url: `https://deviantart.com/${cleanUsername}` },
        { name: 'Keybase', url: `https://keybase.io/${cleanUsername}` },
        { name: 'Medium', url: `https://medium.com/@${cleanUsername}` },
        { name: 'Telegram', url: `https://t.me/${cleanUsername}` },
        { name: 'Steam', url: `https://steamcommunity.com/id/${cleanUsername}` },
        { name: 'Fiverr', url: `https://fiverr.com/${cleanUsername}` },
        { name: 'Replit', url: `https://replit.com/@${cleanUsername}` },
        { name: 'HackerNews', url: `https://news.ycombinator.com/user?id=${cleanUsername}` },
        { name: 'GitLab', url: `https://gitlab.com/${cleanUsername}` },
        { name: 'Codepen', url: `https://codepen.io/${cleanUsername}` },
        { name: 'Flickr', url: `https://flickr.com/people/${cleanUsername}` },
        { name: 'Pastebin', url: `https://pastebin.com/u/${cleanUsername}` },
        { name: 'NPM', url: `https://npmjs.com/~${cleanUsername}` },
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
          if (httpResp.status === 200) {
            foundPlatforms.push({ platform: platform.name, found: true, url: platform.url, statusCode: 200 });
            send({ type: 'found', platform: platform.name, url: platform.url, statusCode: 200 });
          } else {
            send({ type: 'not_found', platform: platform.name });
          }
        } catch {
          send({ type: 'not_found', platform: platform.name });
        }
      }

      if (caseId && foundPlatforms.length > 0) {
        try {
          await new Finding({
            caseId,
            findingType: 'username_search',
            source: 'Username OSINT',
            username: cleanUsername,
            data: { platforms: foundPlatforms, username: cleanUsername },
            confidence: 80,
            isVerified: false,
            tags: ['username-search', 'osint'],
          }).save();
        } catch { /* non-fatal */ }
      }

      send({ type: 'done', summary: { totalChecked: PLATFORMS.length, found: foundPlatforms.length } });

    } else {
      // ── Primary: local Sherlock with live stdout streaming ─────────────────
      const siteTimeoutSec = parseInt(process.env.SHERLOCK_SITE_TIMEOUT_SEC || '', 10) || 8;
      const proc = spawn('sherlock', [cleanUsername, '--timeout', String(siteTimeoutSec), '--print-found', '--no-color'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const foundPlatforms: any[] = [];

      proc.on('error', (err) => {
        console.error('[Sherlock Stream] Spawn error:', err);
        send({ type: 'error', message: `Failed to start Sherlock: ${err.message}` });
      });

      proc.stdout.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('[+]')) {
            const match = trimmed.match(/\[\+\]\s+(.*?):\s+(https?:\/\/\S+)/);
            if (match) {
              const platform = match[1].trim();
              const url = match[2].trim();
              foundPlatforms.push({ platform, found: true, url, statusCode: 200 });
              send({ type: 'found', platform, url, statusCode: 200 });
            } else {
              send({ type: 'log', message: trimmed });
            }
          } else if (trimmed.startsWith('[-]')) {
            const match = trimmed.match(/\[-\]\s+(.*?):/);
            if (match) send({ type: 'not_found', platform: match[1].trim() });
          } else if (trimmed.startsWith('[!]')) {
            const match = trimmed.match(/\[!\]\s+(.*?):\s*(.*)/);
            if (match) send({ type: 'rate_limit', platform: match[1].trim(), message: match[2].trim() });
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
          await new Finding({
            caseId,
            findingType: 'username_search',
            source: 'Username OSINT (Stream)',
            username: cleanUsername,
            data: { platforms: foundPlatforms, username: cleanUsername },
            confidence: 90,
            isVerified: false,
            tags: ['username-search', 'sherlock', 'stream'],
          }).save();
        } catch { /* non-fatal */ }
      }

      send({ type: 'done', summary: { totalChecked: foundPlatforms.length, found: foundPlatforms.length } });
    }
  } catch (err: any) {
    send({ type: 'error', message: err.message || 'Stream failed' });
  }

  res.end();
};

// ── ExifTool ──────────────────────────────────────────────────────────────────

/**
 * ExifTool — Metadata extraction from uploaded files.
 */
export const exiftoolMetadata = async (req: AuthRequest, res: Response) => {
  const { caseId } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: 'File upload required' });
  }

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
      deviceId: null,
    },
  };

  try {
    const hasExiftool = await toolExists('exiftool');

    if (!hasExiftool) {
      try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
      return res.status(200).json({
        ...results,
        method: 'Unavailable',
        message: 'ExifTool not installed. Install with: apt-get install exiftool',
      });
    }

    try {
      const { stdout } = await execPromise(
        `exiftool -json "${filePath}" 2>&1`,
        { maxBuffer: 5 * 1024 * 1024 }
      );

      const parsed = JSON.parse(stdout);
      results.metadata = parsed[0] || {};
      results.method = 'ExifTool';

      if (parsed[0]) {
        const d = parsed[0];
        results.sensitiveData = {
          gps: d.GPSLatitude
            ? { latitude: d.GPSLatitude, longitude: d.GPSLongitude, altitude: d.GPSAltitude }
            : null,
          creator: d.Creator || null,
          copyright: d.Copyright || null,
          software: d.Software || null,
          cameraModel: d.Model || null,
          dateTime: d.DateTime || d.DateTimeOriginal || null,
          deviceId: d.DeviceID || null,
        };
      }
    } catch (execError: any) {
      console.error('[ExifTool] exec error:', execError);
      results.method = 'Failed';
      results.error = 'ExifTool extraction failed';
    }

    logUserActivity(req, 'exiftool_metadata', 'ExifTool Metadata Extraction', {
      filename: req.file.originalname,
    });

    if (caseId) {
      try {
        const hasSensitive = Object.values(results.sensitiveData).some((v) => v !== null);
        await new Finding({
          caseId,
          findingType: 'metadata_extraction',
          source: 'ExifTool (OSINT)',
          data: results,
          confidence: hasSensitive ? 90 : 40,
          isVerified: true,
          tags: ['exiftool', 'metadata', req.file.mimetype.split('/')[0]],
        }).save();
      } catch (e) {
        console.error('[ExifTool] Error saving finding:', e);
      }
    }

    return res.json({ status: 'success', ...results });
  } catch (error: any) {
    console.error('[ExifTool] Unhandled error:', error);
    return res.status(200).json({
      message: 'Metadata extraction encountered an issue',
      tool: 'ExifTool',
      status: 'error',
      error: error.message,
    });
  } finally {
    // Always clean up the uploaded temp file
    try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
  }
};

// ── Whois ─────────────────────────────────────────────────────────────────────

/**
 * Whois — Domain and IP ownership information.
 */
export const whoisLookup = async (req: AuthRequest, res: Response) => {
  const { target, caseId } = req.body;

  if (!target || target.trim().length === 0) {
    return res.status(400).json({ message: 'Target domain or IP required' });
  }

  const cleanTarget = target.trim().substring(0, 255);

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
      phone: null,
    },
  };

  try {
    const hasWhois = await toolExists('whois');

    if (!hasWhois) {
      return res.status(200).json({
        ...results,
        method: 'Unavailable',
        message: 'Whois not installed. Install with: apt-get install whois',
      });
    }

    try {
      const { stdout } = await execPromise(
        `whois "${cleanTarget}" 2>&1`,
        { maxBuffer: 5 * 1024 * 1024, timeout: 15000 }
      );

      const data: Record<string, string> = {};
      for (const line of stdout.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (key && value && !key.startsWith('%') && !key.startsWith('#')) {
          data[key] = value;
        }
      }

      results.data = data;
      results.method = 'Local-Whois';

      const lines = stdout.split('\n');
      results.summary = {
        registrar: data['Registrar'] || data['registrar'] || data['Sponsoring Registrar'] || null,
        registrationDate: data['Creation Date'] || data['created'] || data['Created Date'] || null,
        expirationDate: data['Registry Expiry Date'] || data['expiry_date'] || data['Expiration Date'] || null,
        nameServers: lines
          .filter((l) => /name\s*server/i.test(l))
          .map((l) => l.split(':')[1]?.trim())
          .filter(Boolean),
        organization: data['Organization'] || data['organisation'] || data['Org'] || null,
        address: data['Address'] || data['address'] || null,
        email: data['Email'] || data['email'] || data['admin-email'] || null,
        phone: data['Phone'] || data['phone'] || data['admin-phone'] || null,
      };
    } catch (execError: any) {
      console.error('[Whois] exec error:', execError);
      results.method = 'Failed';
      results.error = 'Whois lookup failed';
    }

    logUserActivity(req, 'whois_lookup', 'Whois Domain/IP Lookup', { target: cleanTarget });

    if (caseId) {
      try {
        await new Finding({
          caseId,
          findingType: 'whois_lookup',
          source: 'Whois (OSINT)',
          domain: cleanTarget,
          data: results,
          confidence: results.summary.registrar ? 85 : 40,
          isVerified: true,
          tags: ['whois', 'domain-info', 'osint'],
        }).save();
      } catch (e) {
        console.error('[Whois] Error saving finding:', e);
      }
    }

    return res.json({ status: 'success', ...results });
  } catch (error: any) {
    console.error('[Whois] Unhandled error:', error);
    return res.status(200).json({
      tool: 'Whois',
      target: cleanTarget,
      status: 'error',
      message: error.message || 'Whois lookup encountered an issue',
    });
  }
};

// ── Nmap (deprecated) ─────────────────────────────────────────────────────────

/**
 * @deprecated Removed due to security concerns.
 */
export const nmapScan = async (_req: AuthRequest, res: Response) => {
  return res.status(410).json({
    message: 'Nmap has been deprecated and removed. Use DNS reconnaissance or API-based scanning instead.',
  });
};

// ── Tool Availability ─────────────────────────────────────────────────────────

/**
 * Returns which Kali tools are installed and ready to use.
 */
export const checkToolsAvailability = async (_req: Request, res: Response) => {
  const tools = ['sherlock', 'exiftool', 'whois', 'dnsrecon', 'recon-ng'];

  try {
    const availability: Record<string, boolean> = {};
    await Promise.all(tools.map(async (t) => { availability[t] = await toolExists(t); }));

    const installed = Object.values(availability).filter(Boolean).length;

    return res.json({
      status: 'success',
      timestamp: new Date(),
      tools: availability,
      installed,
      total: tools.length,
      recommendation: installed < 3
        ? 'Install Kali tools for enhanced OSINT: sudo apt-get install sherlock exiftool whois'
        : 'Major tools are available',
      deprecated: {
        nmap: 'Removed — use DNS reconnaissance or API-based scanning',
        theharvester: 'Removed — use email OSINT tools instead',
      },
    });
  } catch (error) {
    console.error('[ToolCheck] Error:', error);
    return res.status(500).json({ message: 'Failed to check tool availability' });
  }
};