import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { rateLimiter } from './rateLimiter';
import AdminAuditLog from '../models/AdminAuditLog';
import SystemSettings from '../models/SystemSettings';

// 1. Admin Endpoint Rate Limiter (50 reqs / hour by default)
export const adminRateLimiter = rateLimiter(1000, 60 * 60 * 1000);

// 2. Admin Audit Log Middleware
export const logAdminAccess = async (req: Request, res: Response, next: NextFunction) => {
  // Capture basic request info
  const adminId = (req as any).user?.id;
  if (!adminId) return next();

  const ipAddress = (req.headers['x-forwarded-for'] || req.ip || 'unknown') as string;
  const method = req.method;
  const endpoint = req.originalUrl;
  
  // Clone body to mask passwords
  let changes = { ...req.body };
  if (changes.password) changes.password = '***';
  if (changes.adminPassword) changes.adminPassword = '***';

  const action = method === 'GET' ? 'read' : method === 'POST' ? 'create' : method === 'PUT' || method === 'PATCH' ? 'update' : 'delete';

  // Fire and forget log creation
  AdminAuditLog.create({
    adminId,
    action,
    endpoint,
    method,
    ipAddress,
    changes
  }).catch(err => {
    // Only log error in development to avoid console noise
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to write admin audit log:', err.message);
    }
  });

  return next();
};

// 3. Require Re-Auth (Sudo Mode)
export const requireReauth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await SystemSettings.findOne();
    if (settings && !settings.requireReauthForSensitiveOperations) {
      return next(); // disabled globally
    }

    const token = req.headers['x-sudo-token'] as string;
    if (!token) {
      return res.status(403).json({ success: false, message: 'Re-authentication required. Please enter your password to continue.' });
    }

    try {
      const secret = process.env.JWT_SECRET || 'super_secret_fsociety_key_change_me_in_prod';
      const decoded = jwt.verify(token, secret) as any;
      if (decoded.id !== (req as any).user?.id || decoded.type !== 'sudo') {
        throw new Error('Invalid sudo token');
      }
      next();
    } catch (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired sudo session. Please re-authenticate.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error checking re-auth requirements' });
  }
};

// 4. Custom CSRF Validation
export const validateCSRF = (req: Request, res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // If we had cookie-based sessions, we'd compare cookie to header.
  // Since we use Auth headers, CSRF is naturally mitigated.
  // However, for strict compliance, we enforce an explicit anti-csrf header for state changes.
  const csrfToken = req.headers['x-csrf-token'];
  if (!csrfToken || csrfToken !== 'osint-csrf-protection') {
    return res.status(403).json({ success: false, message: 'CSRF token missing or invalid.' });
  }

  next();
};
