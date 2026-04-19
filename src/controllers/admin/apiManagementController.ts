import { Request, Response } from 'express';

export const getApiIntegrations = async (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    data: [
      { id: 'virustotal', name: 'VirusTotal', status: 'connected', usage: '45%' },
      { id: 'shodan', name: 'Shodan', status: 'connected', usage: '12%' },
      { id: 'hunterio', name: 'Hunter.io', status: 'disconnected', usage: '0' }
    ] 
  });
};

export const updateApiIntegration = async (req: Request, res: Response) => {
  res.json({ success: true, message: `Integration ${req.params.id} updated (mock)` });
};
