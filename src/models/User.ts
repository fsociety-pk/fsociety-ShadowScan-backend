import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email?: string;
  passwordHash: string;
  role: 'user' | 'admin';
  points?: number; // Added points since it's used in authController
  lastLogin?: Date;
  isActive: boolean;
  totalScans: number;
  riskScore: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: false, unique: true, index: true, sparse: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  points: { type: Number, default: 0 },
  lastLogin: { type: Date },
  isActive: { type: Boolean, default: true },
  totalScans: { type: Number, default: 0 },
  riskScore: { type: Number, default: 0 },
  notes: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model<IUser>('User', UserSchema);
