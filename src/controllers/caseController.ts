import { Request, Response } from 'express';
import Case from '../models/Case';
import { AuthRequest } from '../middleware/authMiddleware';

export const getCases = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    // Strictly filter by the owner (createdBy)
    const cases = await Case.find({ createdBy: userId }).sort({ createdAt: -1 });
    res.json(cases);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getCaseById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const investigation = await Case.findOne({ _id: req.params.id, createdBy: userId });
    
    if (!investigation) {
      return res.status(404).json({ message: 'Investigation case not found or access denied.' });
    }
    res.json(investigation);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createCase = async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      rawFindings,
      category,
      priority,
      clues,
      toolsSuggested,
      notes,
      targetProfile,
      images
    } = req.body;

    const normalizedDescription = typeof description === 'string' && description.trim()
      ? description.trim()
      : typeof rawFindings === 'string'
        ? rawFindings.trim()
        : '';

    if (!title || !category || !normalizedDescription) {
      return res.status(400).json({
        message: 'title, category, and description/rawFindings are required.'
      });
    }

    const inferredClues = Array.isArray(clues)
      ? clues
      : typeof rawFindings === 'string'
        ? rawFindings
            .split('\n')
            .map((line: string) => line.trim())
            .filter(Boolean)
        : [];

    const imageSummary = Array.isArray(images) && images.length > 0
      ? `\n\nAttached images:\n${images
          .map((img: { label?: string; fileName?: string }, index: number) => `- ${img.label || img.fileName || `image-${index + 1}`}`)
          .join('\n')}`
      : '';
    
    const newCase = await Case.create({
      title,
      description: normalizedDescription,
      category,
      priority,
      clues: inferredClues,
      notes: `${notes || ''}${imageSummary}`.trim(),
      createdBy: req.user?.id,
      toolsSuggested: toolsSuggested || [],
      targetProfile: targetProfile || {},
      status: 'Active'
    });

    res.status(201).json({ message: 'Investigation case created', id: newCase._id });
  } catch (error: any) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

export const updateCase = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const updatedCase = await Case.findOneAndUpdate(
      { _id: req.params.id, createdBy: userId },
      req.body,
      { returnDocument: 'after' }
    );

    if (!updatedCase) {
      return res.status(404).json({ message: 'Investigation case not found or access denied.' });
    }

    res.json(updatedCase);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCase = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const deletedCase = await Case.findOneAndDelete({ _id: req.params.id, createdBy: userId });

    if (!deletedCase) {
      return res.status(404).json({ message: 'Investigation case not found or access denied.' });
    }

    res.json({ message: 'Investigation case archived/deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
