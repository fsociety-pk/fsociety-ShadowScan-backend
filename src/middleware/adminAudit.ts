import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import AdminLog from '../models/AdminLog';

/**
 * Middleware to audit every admin request.
 * Logs user ID, action, timestamp, IP, and status to AdminLog.
 */
export const adminAudit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Intercept response finish event to log status and details
  res.on('finish', async () => {
    try {
      if (!req.user) return; // Only log if authenticated

      const actionMapping: { [key: string]: any } = {
        'GET': 'viewed',
        'POST': 'created/performed',
        'PATCH': 'updated',
        'PUT': 'updated',
        'DELETE': 'deleted'
      };

      // Extract specific action from req.path or body if needed
      // This is a simplified version; in production, you might want more granular mapping
      let action: any = 'admin_action';
      if (req.path.includes('block')) action = 'user_blocked';
      else if (req.path.includes('unblock')) action = 'user_blocked'; // Enum: user_blocked used for both block/unblock in schema? 
      // Wait, let's check the schema again. 
      // actions: 'email_lookup', 'username_scan', 'phone_lookup', 'metadata_extraction', 'user_created', 'user_deleted', 'user_blocked'
      
      if (req.path.includes('user')) {
          if (req.method === 'POST') action = 'user_created';
          else if (req.method === 'DELETE') action = 'user_deleted';
          else if (req.path.includes('block')) action = 'user_blocked';
      }

      await AdminLog.create({
        userId: req.user.id,
        action: action,
        timestamp: new Date(),
        toolName: 'AdminPanel',
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.method !== 'GET' ? req.body : {},
          status: res.statusCode,
          duration: `${Date.now() - start}ms`
        },
        ipAddress: req.ip || req.get('x-forwarded-for') || 'unknown',
        status: res.statusCode < 400 ? 'success' : 'failed'
      });
    } catch (error) {
      console.error('Audit Log Error:', error);
    }
  });

  next();
};
