import { Response } from 'express';
import Case from '../models/Case';
import { AuthRequest } from '../middleware/authMiddleware';

export const globalSearch = async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    const userId = req.user?.id;
    
    if (!q) {
      return res.status(400).json({ message: 'Missing search query' });
    }

    const query = q as string;

    // Search cases restricted to the owner
    const cases = await Case.find({ 
      $text: { $search: query },
      createdBy: userId 
    }).limit(20);

    res.json({
      cases,
      entities: [] // Return empty array to maintain frontend compatibility if needed
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
