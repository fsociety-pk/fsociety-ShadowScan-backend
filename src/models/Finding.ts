import mongoose, { Schema, Document } from 'mongoose';

export interface IFinding extends Document {
  caseId: mongoose.Types.ObjectId;
  findingType: 'email_lookup' | 'username_search' | 'phone_lookup' | 'breach' | 'metadata' | 'other';
  source: string; // e.g., 'Hunter.io', 'HIBP', 'Clearbit', 'RocketReach', 'FullContact'
  email?: string;
  username?: string;
  phone?: string;
  domain?: string;
  data: Record<string, any>; // Raw JSON result from API
  confidence: number; // 0-100
  isVerified: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const FindingSchema: Schema = new Schema({
  caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  findingType: {
    type: String,
    enum: ['email_lookup', 'username_search', 'phone_lookup', 'breach', 'metadata', 'other'],
    required: true,
    index: true,
  },
  source: { type: String, required: true, index: true },
  email: { type: String, index: true, sparse: true },
  username: { type: String, index: true, sparse: true },
  phone: { type: String, index: true, sparse: true },
  domain: { type: String, index: true, sparse: true },
  data: { type: Schema.Types.Mixed, required: true },
  confidence: { type: Number, min: 0, max: 100, default: 75 },
  isVerified: { type: Boolean, default: false },
  tags: [{ type: String }],
}, { timestamps: true });

// Composite index for efficient queries
FindingSchema.index({ caseId: 1, findingType: 1 });
FindingSchema.index({ caseId: 1, createdAt: -1 });
FindingSchema.index({ email: 1, phone: 1, username: 1 });

export default mongoose.model<IFinding>('Finding', FindingSchema);
