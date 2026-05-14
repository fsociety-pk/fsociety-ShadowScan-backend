import mongoose, { Schema, Document } from 'mongoose';

export interface ICase extends Document {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  clues: string[]; // previously hints
  notes: string;
  status: 'Active' | 'Closed' | 'Archived';
  targetProfile?: {
    name?: string;
    email?: string;
    phone?: string;
    organization?: string;
    location?: string;
    socialMedia?: string;
    additionalNotes?: string;
  };
  createdBy: mongoose.Types.ObjectId;
  toolsSuggested: string[];
  findings: mongoose.Types.ObjectId[]; // References to Finding documents
  reportGenerated: boolean;
  reportTemplate?: 'fbi' | 'corporate';
  lastReportId?: mongoose.Types.ObjectId; // Reference to latest Report
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CaseSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium', index: true },
  category: { type: String, required: true, index: true },
  clues: [{ type: String }],
  notes: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Closed', 'Archived'], default: 'Active', index: true },
  targetProfile: {
    name: String,
    email: String,
    phone: String,
    organization: String,
    location: String,
    socialMedia: String,
    additionalNotes: String,
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  toolsSuggested: [{ type: String }],
  findings: [{ type: Schema.Types.ObjectId, ref: 'Finding', index: true }],
  reportGenerated: { type: Boolean, default: false, index: true },
  reportTemplate: { type: String, enum: ['fbi', 'corporate'], sparse: true },
  lastReportId: { type: Schema.Types.ObjectId, ref: 'Report', sparse: true },
  tags: [{ type: String, index: true }],
}, { timestamps: true });

// Text index for personal investigations
CaseSchema.index({ title: 'text', description: 'text', notes: 'text' });
// Combined index for user-specific listing
CaseSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model<ICase>('Case', CaseSchema);
