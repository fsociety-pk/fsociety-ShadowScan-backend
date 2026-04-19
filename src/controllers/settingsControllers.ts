import { Request, Response } from 'express';
import SystemSettings from '../models/SystemSettings';
import AdminLog from '../models/AdminLog';
import { encryptAPIKey } from '../utils/encryption';

/**
 * 1. Get System Settings
 */
export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      // Initialize full default settings if none exist
      settings = await SystemSettings.create({
        enableAdminPanel: true,
        rateLimitPerHour: 100,
        enableEmailLookup: true,
        enableUsernameScan: true,
        enablePhoneLookup: true,
        enableMetadataExtraction: true,
        maintenanceMode: false,
        maxFileUploadSize: 5,
        adminEmail: 'admin@shadowscan.local',
        sendActivityAlerts: false,
        alertFrequency: 'daily',
        apiIntegrations: [
          { name: 'HaveIBeenPwned', id: 'hibp', isActive: true },
          { name: 'Gravatar', id: 'gravatar', isActive: true },
          { name: 'Microsoft Credential API', id: 'ms_cred', isActive: false }
        ],
        adminIPWhitelist: [],
        enableIPWhitelist: false,
        requireReauthForSensitiveOperations: true
      });
    }
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Update System Settings
 */
export const updateSettings = async (req: Request, res: Response) => {
  try {
    // 1. Sanitize Payload (Remove immutable/read-only fields that cause DB errors)
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Prevent accidental wipe of API integrations if not provided in this specific save block
    if (!updateData.apiIntegrations || updateData.apiIntegrations.length === 0) {
        delete updateData.apiIntegrations;
    }

    // 2. Prevent locking yourself out if you try to enable IP whitelist with empty list
    if (updateData.enableIPWhitelist === true && (!updateData.adminIPWhitelist || updateData.adminIPWhitelist.length === 0)) {
       const clientIp = (req.headers['x-forwarded-for'] || req.ip || 'unknown') as string;
       updateData.adminIPWhitelist = [clientIp]; // Auto-add current IP to prevent lockout
    }

    const settings = await SystemSettings.findOneAndUpdate({}, updateData, { returnDocument: 'after', upsert: true });
    
    await AdminLog.create({
      userId: (req as any).user.id,
      action: 'admin_action',
      toolName: 'AdminPanel',
      details: { action: 'update_settings', changes: updateData },
      status: 'success'
    });

    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('SYSTEM_SETTINGS_SAVE_FAILURE:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Get API Integrations (Filter out sensitive data)
 */
export const getAPIIntegrations = async (req: Request, res: Response) => {
  try {
    const settings = await SystemSettings.findOne();
    const integrations = settings?.apiIntegrations.map(api => ({
      name: api.name,
      id: api.id,
      isActive: api.isActive,
      lastChecked: api.lastChecked,
      hasKey: !!api.apiKey
    })) || [];

    res.json({ success: true, data: integrations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Toggle API Integration
 */
export const toggleAPIIntegration = async (req: Request, res: Response) => {
  try {
    const { apiId, status } = req.body;
    
    const settings = await SystemSettings.findOneAndUpdate(
      { "apiIntegrations.id": apiId },
      { "$set": { "apiIntegrations.$.isActive": status, "apiIntegrations.$.lastChecked": new Date() } },
      { returnDocument: 'after' }
    );

    if (!settings) return res.status(404).json({ success: false, message: 'API integration not found' });

    await AdminLog.create({
      userId: (req as any).user.id,
      action: 'admin_action',
      toolName: 'AdminPanel',
      details: { action: 'toggle_api', apiId, status },
      status: 'success'
    });

    res.json({ success: true, message: `API ${apiId} ${status ? 'enabled' : 'disabled'}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. Rotate API Keys
 */
export const rotateAPIKeys = async (req: Request, res: Response) => {
  try {
    const { apiId } = req.body;
    // Mock logic for key rotation
    const newRawKey = `rotated_${Math.random().toString(36).slice(-16)}`;
    const encryptedKey = encryptAPIKey(newRawKey);

    await SystemSettings.findOneAndUpdate(
      { "apiIntegrations.id": apiId },
      { "$set": { "apiIntegrations.$.apiKey": encryptedKey, "apiIntegrations.$.lastChecked": new Date() } }
    );

    await AdminLog.create({
      userId: (req as any).user.id,
      action: 'admin_action',
      toolName: 'AdminPanel',
      details: { action: 'rotate_api_key', apiId },
      status: 'success'
    });

    res.json({ 
      success: true, 
      message: `API Key for ${apiId} rotated successfully.`,
      newKey: newRawKey // Returning once as requested
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
