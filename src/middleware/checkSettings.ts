import { Request, Response, NextFunction } from 'express';
import SystemSettings from '../models/SystemSettings';

let cachedSettings: any = null;
let lastFetch = 0;
const CACHE_TTL = 30000; // 30 seconds

const getSettings = async () => {
  const now = Date.now();
  if (!cachedSettings || (now - lastFetch) > CACHE_TTL) {
    cachedSettings = await SystemSettings.findOne();
    lastFetch = now;
  }
  return cachedSettings;
};

/**
 * Middleware to enforce global system settings.
 * Checks for maintenance mode and tool enablement.
 */
export const checkSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await getSettings();
    if (!settings) return next();

    // 1. Maintenance Mode
    // Skip for admins so they can turn it off
    const isAdmin = (req as any).user?.role === 'admin';
    
    if (settings.maintenanceMode && !isAdmin) {
      return res.status(503).json({
        success: false,
        message: 'PLATFORM_UNDER_MAINTENANCE: The ShadowScan grid is currently undergoing scheduled optimization. Access is restricted.',
        retryAfter: 3600
      });
    }

    // 2. Tool Enablement
    const path = req.path;
    if (path.includes('/api/tools/email-lookup') && !settings.enableEmailLookup) {
      return res.status(403).json({ success: false, message: 'INTELLIGENCE_DENIED: Email lookup capability is currently offline.' });
    }
    if (path.includes('/api/tools/username-lookup') && !settings.enableUsernameScan) {
      return res.status(403).json({ success: false, message: 'INTELLIGENCE_DENIED: Username intelligence node is currently offline.' });
    }
    if (path.includes('/api/tools/phone-lookup-pk') && !settings.enablePhoneLookup) {
      return res.status(403).json({ success: false, message: 'INTELLIGENCE_DENIED: Pakistan Phone Intelligence grid is currently offline.' });
    }
    if (path.includes('/api/tools/extract-metadata') && !settings.enableMetadataExtraction) {
      return res.status(403).json({ success: false, message: 'INTELLIGENCE_DENIED: Metadata forensic extraction is currently offline.' });
    }

    next();
  } catch (error) {
    console.error('Settings Check Error:', error);
    next(); // Pro-fail: allow request if settings check fails
  }
};
