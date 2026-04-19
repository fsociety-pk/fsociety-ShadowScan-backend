import { Request } from 'express';
import AdminLog from '../models/AdminLog';
import User from '../models/User';
import SystemMetrics from '../models/SystemMetrics';

type ActionType = 'email_lookup' | 'username_scan' | 'phone_lookup' | 'metadata_extraction';

/**
 * Logs user activity for OSINT tools without blocking request execution.
 * Also increments relevant user and system metrics.
 */
export const logUserActivity = async (
  req: Request,
  action: ActionType,
  toolName: string,
  metadata: any
) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      console.warn(`[logActivity] Non-authenticated request attempted action: ${action}`);
      return;
    }

    const ipAddress = (req.headers['x-forwarded-for'] || req.ip || 'unknown') as string;

    // 1. Create the Audit Log Entry
    await AdminLog.create({
      userId,
      action,
      toolName,
      details: metadata,
      ipAddress,
      status: 'success'
    });

    // 2. Increment User Total Scans
    await User.findByIdAndUpdate(userId, { $inc: { totalScans: 1 } });

    // 3. Update Daily System Metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Determine which nested field to increment based on the action
    const metricField = action === 'email_lookup' ? 'email' 
                      : action === 'username_scan' ? 'username' 
                      : action === 'phone_lookup' ? 'phone' 
                      : 'metadata';

    const updateQuery: any = {
      $inc: {
        totalScans: 1,
        [`toolUsageBreakdown.${metricField}`]: 1
      }
    };

    // Use upsert to atomically create the document if it doesn't exist for today,
    // otherwise increment existing fields.
    await SystemMetrics.findOneAndUpdate(
      { date: today },
      updateQuery,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

  } catch (error) {
    // Non-blocking catch: just print the error and let the parent process continue safely.
    console.error(`[logActivity] Failed to log activity or update metrics for action ${action}:`, error);
  }
};
