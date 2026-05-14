import { Response } from 'express';
import Case from '../models/Case';
import Finding from '../models/Finding';
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

// New: Search across all findings (emails, phones, usernames, domains, etc.)
export const searchFindings = async (req: AuthRequest, res: Response) => {
  try {
    const { q, type, caseId, source } = req.query;
    const userId = req.user?.id;

    if (!q) {
      return res.status(400).json({ message: 'Missing search query' });
    }

    const query = q as string;
    const searchFilter: any = {};

    // Search by email, username, phone, or domain
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9\-\s\(\)]{7,}$/;

    if (emailRegex.test(query)) {
      searchFilter.email = { $regex: query, $options: 'i' };
    } else if (phoneRegex.test(query)) {
      searchFilter.phone = { $regex: query, $options: 'i' };
    } else {
      // Search in email, username, phone, domain
      searchFilter.$or = [
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
        { domain: { $regex: query, $options: 'i' } },
      ];
    }

    // Add optional filters
    if (type) {
      searchFilter.findingType = type;
    }
    if (source) {
      searchFilter.source = source;
    }

    // If caseId provided, search only that case's findings
    let caseFilter: any = {};
    if (caseId) {
      searchFilter.caseId = caseId;
    } else {
      // Otherwise, find cases owned by user and get their findings
      const userCases = await Case.find({ createdBy: userId }).select('_id');
      const caseIds = userCases.map((c) => c._id);
      searchFilter.caseId = { $in: caseIds };
    }

    // Execute search
    const findings = await Finding.find(searchFilter)
      .populate('caseId', 'title')
      .sort({ createdAt: -1 })
      .limit(50);

    // Group findings by type
    const groupedFindings = findings.reduce((acc: any, finding: any) => {
      if (!acc[finding.findingType]) {
        acc[finding.findingType] = [];
      }
      acc[finding.findingType].push(finding);
      return acc;
    }, {});

    res.json({
      success: true,
      query,
      totalResults: findings.length,
      findings,
      grouped: groupedFindings,
      summary: {
        total: findings.length,
        byType: Object.entries(groupedFindings).reduce(
          (acc: any, [type, items]: any) => {
            acc[type] = items.length;
            return acc;
          },
          {}
        ),
        bySource: findings.reduce((acc: any, f: any) => {
          acc[f.source] = (acc[f.source] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get findings for a specific case
export const getCaseFindings = async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const { type, source } = req.query;

    const filter: any = { caseId };

    if (type) {
      filter.findingType = type;
    }
    if (source) {
      filter.source = source;
    }

    const findings = await Finding.find(filter).sort({ createdAt: -1 });

    // Calculate statistics
    const stats = {
      total: findings.length,
      byType: {} as any,
      bySource: {} as any,
      highConfidence: findings.filter((f) => f.confidence >= 80).length,
      verified: findings.filter((f) => f.isVerified).length,
    };

    findings.forEach((f) => {
      stats.byType[f.findingType] = (stats.byType[f.findingType] || 0) + 1;
      stats.bySource[f.source] = (stats.bySource[f.source] || 0) + 1;
    });

    res.json({
      success: true,
      caseId,
      findings,
      stats,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
