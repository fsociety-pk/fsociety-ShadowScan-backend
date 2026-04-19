import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemMetrics extends Document {
  date: Date;
  totalScans: number;
  totalUsers: number;
  activeUsers: number;
  toolUsageBreakdown: {
    email: number;
    username: number;
    phone: number;
    metadata: number;
  };
  topUsers: Array<{
    userId: mongoose.Types.ObjectId;
    scanCount: number;
  }>;
}

const SystemMetricsSchema: Schema = new Schema({
  date: { type: Date, required: true, unique: true },
  totalScans: { type: Number, default: 0 },
  totalUsers: { type: Number, default: 0 },
  activeUsers: { type: Number, default: 0 },
  toolUsageBreakdown: {
    email: { type: Number, default: 0 },
    username: { type: Number, default: 0 },
    phone: { type: Number, default: 0 },
    metadata: { type: Number, default: 0 }
  },
  topUsers: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    scanCount: { type: Number, default: 0 }
  }]
});

export default mongoose.model<ISystemMetrics>('SystemMetrics', SystemMetricsSchema);
