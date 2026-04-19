import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from './authMiddleware';
import { isAdmin } from '../utils/roleCheck';

export const adminAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET as string
      ) as { id: string; role: string };

      if (!isAdmin(decoded)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied: Admin privileges required' 
        });
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized: Invalid or expired token' 
      });
    }
  }

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized: No token provided' 
    });
  }
};
