import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemSettings extends Document {
  enableAdminPanel: boolean;
  rateLimitPerHour: number;
  enableEmailLookup: boolean;
  enableUsernameScan: boolean;
  enablePhoneLookup: boolean;
  enableMetadataExtraction: boolean;
  maintenanceMode: boolean;
  maxFileUploadSize: number;
  adminEmail: string;
  sendActivityAlerts: boolean;
  alertFrequency: 'real-time' | 'daily' | 'weekly';
  apiIntegrations: Array<{
    name: string;
    id: string;
    isActive: boolean;
    lastChecked: Date;
    apiKey?: string;
  }>;
  adminIPWhitelist: string[];
  enableIPWhitelist: boolean;
  requireReauthForSensitiveOperations: boolean;
}

const SystemSettingsSchema: Schema = new Schema({
  enableAdminPanel: { type: Boolean, default: true },
  rateLimitPerHour: { type: Number, default: 100 },
  enableEmailLookup: { type: Boolean, default: true },
  enableUsernameScan: { type: Boolean, default: true },
  enablePhoneLookup: { type: Boolean, default: true },
  enableMetadataExtraction: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  maxFileUploadSize: { type: Number, default: 5 }, // 5MB
  adminEmail: { type: String, default: 'admin@shadowscan.local' },
  sendActivityAlerts: { type: Boolean, default: false },
  alertFrequency: { 
    type: String, 
    enum: ['real-time', 'daily', 'weekly'], 
    default: 'daily' 
  },
  apiIntegrations: [{
    name: { type: String, required: true },
    id: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    lastChecked: { type: Date, default: Date.now },
    apiKey: { type: String }
  }],
  adminIPWhitelist: { type: [String], default: [] },
  enableIPWhitelist: { type: Boolean, default: false },
  requireReauthForSensitiveOperations: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);
