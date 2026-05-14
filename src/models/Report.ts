import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
  caseId: mongoose.Types.ObjectId;
  template: 'fbi' | 'corporate';
  title: string;
  content: string; // Markdown content from OpenAI
  summary: string; // Short summary
  generatedAt: Date;
  generatedBy: mongoose.Types.ObjectId;
  entities: Array<{
    type: 'email' | 'phone' | 'username' | 'domain' | 'person' | 'organization';
    value: string;
    confidence: number;
  }>;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  findings_count: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema: Schema = new Schema({
  caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  template: { type: String, enum: ['fbi', 'corporate'], required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  entities: [
    {
      type: { type: String, enum: ['email', 'phone', 'username', 'domain', 'person', 'organization'] },
      value: String,
      confidence: { type: Number, min: 0, max: 100 },
    },
  ],
  riskLevel: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  findings_count: { type: Number, default: 0 },
}, { timestamps: true });

// Index for efficient lookups
ReportSchema.index({ caseId: 1, createdAt: -1 });
ReportSchema.index({ generatedBy: 1, createdAt: -1 });

export default mongoose.model<IReport>('Report', ReportSchema);
