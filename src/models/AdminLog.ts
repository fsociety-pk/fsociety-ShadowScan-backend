import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminLog extends Document {
  userId: mongoose.Types.ObjectId;
  action: 
    'email_lookup' | 'username_scan' | 'phone_lookup' | 'metadata_extraction' | 
    'user_created' | 'user_deleted' | 'user_blocked' | 'login_attempt' | 
    'password_reset_request' | 'admin_action' | 'admin_promotion' | 
    'api_toggle' | 'api_rotate' | 'settings_update' | 'maintenance_toggle';
  timestamp: Date;
  toolName: string;
  details: mongoose.Schema.Types.Mixed;
  ipAddress: string;
  status: 'success' | 'failed';
}

const AdminLogSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { 
    type: String, 
    enum: [
      'email_lookup', 
      'username_scan', 
      'phone_lookup', 
      'metadata_extraction', 
      'user_created', 
      'user_deleted', 
      'user_blocked',
      'login_attempt',
      'password_reset_request',
      'admin_action',
      'admin_promotion',
      'api_toggle',
      'api_rotate',
      'settings_update',
      'maintenance_toggle'
    ], 
    required: true 
  },
  timestamp: { type: Date, default: Date.now },
  toolName: { type: String, required: true },
  details: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  status: { type: String, enum: ['success', 'failed'], required: true }
});

export default mongoose.model<IAdminLog>('AdminLog', AdminLogSchema);
