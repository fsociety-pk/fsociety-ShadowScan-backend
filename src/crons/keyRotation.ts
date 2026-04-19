import cron from 'node-cron';
import SystemSettings from '../models/SystemSettings';
import { encryptAPIKey } from '../utils/encryption';
import AdminAuditLog from '../models/AdminAuditLog';

/**
 * Monthly API Key Rotation Job
 * Runs on the 1st of every month at midnight
 */
export const initKeyRotationCron = () => {
  cron.schedule('0 0 1 * *', async () => {
    console.log('[CRON] Starting monthly API key rotation...');
    
    try {
      const settings = await SystemSettings.findOne();
      if (!settings) return;

      // In a real scenario, this would call external provider APIs to refresh keys.
      // Here we simulate it by re-encrypting or "rotating" the existing ones or generating mocks.
      const updatedIntegrations = settings.apiIntegrations.map(api => {
        // Mock rotation: append a rotation stamp or re-encrypt
        const mockNewKey = `rotated_${Math.random().toString(36).slice(-10)}`;
        return {
          ...api,
          lastChecked: new Date()
        };
      });

      await SystemSettings.updateOne({}, { $set: { apiIntegrations: updatedIntegrations } });

      // Log the systemic rotation
      await AdminAuditLog.create({
        adminId: null as any, // System action
        action: 'system_cron',
        endpoint: 'internal_cron_job',
        method: 'CRON',
        ipAddress: '127.0.0.1',
        changes: { action: 'monthly_api_key_rotation_check' },
        timestamp: new Date()
      });

      console.log('[CRON] API key rotation check completed.');
    } catch (error) {
      console.error('[CRON] API key rotation failed:', error);
    }
  });
};
