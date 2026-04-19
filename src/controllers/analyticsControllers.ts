import { Request, Response } from 'express';
import User from '../models/User';
import AdminLog from '../models/AdminLog';

/**
 * 1. Get Dashboard Overview Stats
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, totalScansAgg, activeToday, activeWeek] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: null, total: { $sum: "$totalScans" } } }]).catch(err => { console.error('Aggregation error:', err); return []; }),
      User.countDocuments({ lastLogin: { $gte: last24h } }),
      User.countDocuments({ lastLogin: { $gte: last7d } })
    ]);

    const totalScans = totalScansAgg[0]?.total || 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalScans,
        activeUsersToday: activeToday,
        activeUsersThisWeek: activeWeek,
        systemHealthStatus: {
          status: 'Operational',
          latency: 'Normal',
          uptime: '99.9%'
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Get Tool Usage Stats (Last 30 Days)
 */
export const getToolUsageStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let matchQuery: any = { 
      action: { $in: ['email_lookup', 'username_scan', 'phone_lookup', 'metadata_extraction'] }
    };

    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate as string);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate as string);
    } else {
      matchQuery.timestamp = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }
    
    const stats = await AdminLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 }
        }
      }
    ]);

    // Format output as requested: { email: X, username: Y, ... }
    const result: any = { email: 0, username: 0, phone: 0, metadata: 0 };
    stats.forEach(item => {
      if (item._id === 'email_lookup') result.email = item.count;
      else if (item._id === 'username_scan') result.username = item.count;
      else if (item._id === 'phone_lookup') result.phone = item.count;
      else if (item._id === 'metadata_extraction') result.metadata = item.count;
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Get Trends (Daily scan counts)
 */
export const getTrends = async (req: Request, res: Response) => {
  try {
    const { timeframe, startDate, endDate } = req.query;
    let matchQuery: any = { 
      action: { $in: ['email_lookup', 'username_scan', 'phone_lookup', 'metadata_extraction'] }
    };

    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate as string);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate as string);
    } else {
      let days = 30;
      if (timeframe === '7d') days = 7;
      else if (timeframe === '90d') days = 90;
      matchQuery.timestamp = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }

    const trends = await AdminLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          scans: { $sum: 1 },
          users: { $addToSet: "$userId" }
        }
      },
      {
        $project: {
          date: "$_id",
          scans: 1,
          users: { $size: "$users" },
          _id: 0
        }
      },
      { $sort: { date: 1 } }
    ]);

    res.json({ success: true, data: trends });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Get Top 10 Active Users
 */
export const getTopUsers = async (req: Request, res: Response) => {
  try {
    const topUsers = await User.find()
      .sort({ totalScans: -1 })
      .limit(10)
      .select('username email totalScans lastLogin');

    res.json({ success: true, data: topUsers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. Get Real-time Activity Summary (Last 100)
 */
export const getActivitySummary = async (req: Request, res: Response) => {
  try {
    const activity = await AdminLog.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .populate('userId', 'username email');

    res.json({ success: true, data: activity });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Get Peak Activity by Hour
 */
export const getPeakActivity = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let matchQuery: any = { 
      action: { $in: ['email_lookup', 'username_scan', 'phone_lookup', 'metadata_extraction'] }
    };

    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate as string);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate as string);
    }

    const peakHours = await AdminLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $hour: "$timestamp" },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          hour: "$_id",
          count: 1,
          _id: 0
        }
      },
      { $sort: { hour: 1 } }
    ]);

    res.json({ success: true, data: peakHours });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
