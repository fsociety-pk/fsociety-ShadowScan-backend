import { Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    // Only allow users to view their own dossier (private workspace)
    const userId = req.user?.id;
    const user = await User.findById(userId).select('-passwordHash');
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      user,
      stats: {
        // Logic for personal stats can be added here
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
