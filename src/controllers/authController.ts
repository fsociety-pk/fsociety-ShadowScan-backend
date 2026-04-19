import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import AdminLog from '../models/AdminLog';
import SystemSettings from '../models/SystemSettings';

const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'super_secret_fsociety_key_change_me_in_prod', {
    expiresIn: '30d',
  });
};

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    const query: any = { $or: [{ username }] };
    if (email) {
      query.$or.push({ email });
    }

    const userExists = await User.findOne(query);
    if (userExists) {
      res.status(400).json({ 
        success: false, 
        message: 'Username already exists' 
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      passwordHash,
      role: 'user' // explicit default
    });

    await AdminLog.create({
      userId: user._id,
      action: 'user_created',
      toolName: 'AuthSystem',
      details: { username: user.username, email: user.email },
      ipAddress: req.ip || req.get('x-forwarded-for') || 'unknown',
      status: 'success'
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        points: user.points,
        token: generateToken(user.id, user.role),
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid user data' 
      });
    }
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ 
        success: false, 
        message: 'Username already exists' 
      });
      return;
    }
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      // Check Admin IP Whitelist
      if (user.role === 'admin') {
        const settings = await SystemSettings.findOne();
        if (settings && settings.enableIPWhitelist && settings.adminIPWhitelist && settings.adminIPWhitelist.length > 0) {
          const clientIp = (req.headers['x-forwarded-for'] || req.ip || 'unknown') as string;
          if (!settings.adminIPWhitelist.includes(clientIp)) {
            await AdminLog.create({
              userId: user._id,
              action: 'login_attempt',
              toolName: 'AuthSystem',
              details: { username: user.username, reason: 'IP Address blocked by Admin IP Whitelist' },
              ipAddress: clientIp,
              status: 'failed'
            });
            res.status(403).json({ success: false, message: 'Access denied from this IP address.' });
            return;
          }
        }
      }

      res.json({
        _id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        points: user.points,
        token: generateToken(user.id, user.role),
      });

      await AdminLog.create({
        userId: user._id,
        action: 'login_attempt',
        toolName: 'AuthSystem',
        details: { username: user.username },
        ipAddress: req.ip || req.get('x-forwarded-for') || 'unknown',
        status: 'success'
      });
    } else {
      if (user) {
        await AdminLog.create({
          userId: user._id,
          action: 'login_attempt',
          toolName: 'AuthSystem',
          details: { username: user.username, reason: 'Invalid password' },
          ipAddress: req.ip || req.get('x-forwarded-for') || 'unknown',
          status: 'failed'
        });
      }
      res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const checkAdmin = async (req: any, res: Response): Promise<void> => {
  try {
    if (req.user && req.user.role === 'admin') {
      const settings = await SystemSettings.findOne();
      // If settings don't exist yet, we default to enabled. If they do, respect the flag.
      if (settings && settings.enableAdminPanel === false) {
         res.json({ isAdmin: false, message: 'Admin panel is currently disabled system-wide.' });
         return;
      }
      res.json({ isAdmin: true });
    } else {
      res.json({ isAdmin: false });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const sudoElevate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
       res.status(401).json({ success: false, message: 'Not authenticated' });
       return;
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'admin' || !(await bcrypt.compare(password, user.passwordHash))) {
       res.status(403).json({ success: false, message: 'Invalid password' });
       return;
    }

    const sudoToken = jwt.sign(
      { id: user.id, type: 'sudo' }, 
      process.env.JWT_SECRET || 'super_secret_fsociety_key_change_me_in_prod', 
      { expiresIn: '15m' }
    );

    res.json({ success: true, sudoToken });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
