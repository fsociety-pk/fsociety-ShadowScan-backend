import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminAuditLog extends Document {
  adminId: mongoose.Types.ObjectId;
  action: string;
  endpoint: string;
  method: string;
  ipAddress: string;
  changes?: mongoose.Schema.Types.Mixed;
  timestamp: Date;
}

const AdminAuditLogSchema: Schema = new Schema({
  adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  endpoint: { type: String, required: true },
  method: { type: String, required: true },
  ipAddress: { type: String, required: true },
  changes: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
}, { 
  // Make collection strictly immutable
  capped: { size: 1024 * 1024 * 50, max: 100000, autoIndexId: true } 
});

export default mongoose.model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);
