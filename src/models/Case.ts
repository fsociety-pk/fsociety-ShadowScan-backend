import mongoose, { Schema, Document } from 'mongoose';

export interface ICase extends Document {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  clues: string[]; // previously hints
  notes: string;
  status: 'Active' | 'Closed' | 'Archived';
  createdBy: mongoose.Types.ObjectId;
  toolsSuggested: string[];
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
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  toolsSuggested: [{ type: String }],
}, { timestamps: true });

// Text index for personal investigations
CaseSchema.index({ title: 'text', description: 'text', notes: 'text' });
// Combined index for user-specific listing
CaseSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model<ICase>('Case', CaseSchema);
