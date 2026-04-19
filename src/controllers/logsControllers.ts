import { Request, Response } from 'express';
import AdminLog from '../models/AdminLog';
import User from '../models/User';

/**
 * 1. Get All Logs with pagination
 */
export const getAllLogs = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const logs = await AdminLog.find()
      .populate('userId', 'username email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AdminLog.countDocuments();

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Filter Logs
 */
export const filterLogs = async (req: Request, res: Response) => {
  try {
    const { userId, action, dateFrom, dateTo, status, toolName, search } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (status) query.status = status;
    if (toolName) query.toolName = toolName;
    
    if (search) {
      // Create an array of conditions for $or
      const orConditions: any[] = [
        { ipAddress: { $regex: search, $options: 'i' } }
      ];
      
      // For username we need a separate check or aggregation but for now 
      // let's stick to IP regex in query and we can handle username in frontend or a more complex aggregation
      query.$or = orConditions;
    }

    if (dateFrom || dateTo) {
      query.timestamp = {};
      if (dateFrom) query.timestamp.$gte = new Date(dateFrom as string);
      if (dateTo) query.timestamp.$lte = new Date(dateTo as string);
    }

    const logs = await AdminLog.find(query)
      .populate('userId', 'username email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AdminLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Detect Anomalies
 */
export const detectAnomalies = async (req: Request, res: Response) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const anomalies: any[] = [];
    let alertLevel = 'low';

    // 1. Detect Burst Activity (> 50 scans in 1h)
    const burstActivity = await AdminLog.aggregate([
      { 
        $match: { 
          timestamp: { $gte: oneHourAgo },
          action: { $in: ['email_lookup', 'username_scan', 'phone_lookup', 'metadata_extraction'] }
        }
      },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 50 } } }
    ]);

    for (const activity of burstActivity) {
        const user = await User.findById(activity._id).select('username');
        anomalies.push({
            type: 'Burst Activity',
            userId: activity._id,
            username: user?.username || 'Unknown',
            details: `Performed ${activity.count} scans in the last hour.`,
            severity: 'high'
        });
        alertLevel = 'high';
    }

    // 2. Detect Multiple Failed Logins (> 5 in 1h)
    const failedLogins = await AdminLog.aggregate([
      { 
        $match: { 
          timestamp: { $gte: oneHourAgo },
          action: 'login_attempt',
          status: 'failed'
        }
      },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 5 } } }
    ]);

    for (const fail of failedLogins) {
        const user = await User.findById(fail._id).select('username');
        anomalies.push({
            type: 'Multiple Failed Logins',
            userId: fail._id,
            username: user?.username || 'Unknown',
            details: `${fail.count} failed login attempts in the last hour.`,
            severity: 'medium'
        });
        if (alertLevel !== 'high') alertLevel = 'medium';
    }

    res.json({ success: true, data: { anomalies, alertLevel } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Export Logs to CSV
 */
export const exportLogs = async (req: Request, res: Response) => {
  try {
    const { userId, action, dateFrom, dateTo, status } = req.query;
    
    const query: any = {};
    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.timestamp = {};
      if (dateFrom) query.timestamp.$gte = new Date(dateFrom as string);
      if (dateTo) query.timestamp.$lte = new Date(dateTo as string);
    }

    const logs = await AdminLog.find(query)
      .populate('userId', 'username email')
      .sort({ timestamp: -1 });

    // Build CSV string
    let csv = 'Timestamp,User,Email,Action,Tool,Status,IP,Details\n';
    
    logs.forEach((log: any) => {
      const timestamp = log.timestamp.toISOString();
      const username = log.userId?.username || 'N/A';
      const email = log.userId?.email || 'N/A';
      const details = JSON.stringify(log.details).replace(/"/g, '""');
      
      csv += `${timestamp},${username},${email},${log.action},${log.toolName},${log.status},${log.ipAddress || ''},"${details}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=logs_export_${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
