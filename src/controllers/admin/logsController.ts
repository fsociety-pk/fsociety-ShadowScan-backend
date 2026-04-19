import { Request, Response } from 'express';
import AdminLog from '../../models/AdminLog';

export const getLogs = async (req: Request, res: Response) => {
  try {
    const logs = await AdminLog.find().populate('userId', 'username').sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getFilteredLogs = async (req: Request, res: Response) => {
  try {
    const { action, status, userId } = req.query;
    const query: any = {};
    if (action) query.action = action;
    if (status) query.status = status;
    if (userId) query.userId = userId;

    const logs = await AdminLog.find(query).populate('userId', 'username').sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
