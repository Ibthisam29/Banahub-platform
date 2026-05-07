import mongoose, { Schema, Document } from 'mongoose';

export interface IProgram extends Document {
  title: string;
  type: 'cohort' | 'summit' | 'roundtable' | 'forum';
  status: 'active' | 'upcoming' | 'closed';
  region: string;
  description: string;
  features: string[];
  startDate: Date;
  nextIntake?: string;
  location?: string;
  partners: { name: string; logo?: string }[];
  ctaLabel: string;
  limitedSpots: boolean;
  spotsRemaining?: number;
}

const ProgramSchema = new Schema<IProgram>({
  title: { type: String, required: true },
  type: { type: String, enum: ['cohort', 'summit', 'roundtable', 'forum'], required: true },
  status: { type: String, enum: ['active', 'upcoming', 'closed'], default: 'upcoming' },
  region: { type: String, required: true },
  description: { type: String, required: true },
  features: [String],
  startDate: { type: Date, required: true },
  nextIntake: String,
  location: String,
  partners: [{ name: String, logo: String }],
  ctaLabel: { type: String, default: 'Register Interest' },
  limitedSpots: { type: Boolean, default: false },
  spotsRemaining: Number,
}, { timestamps: true });

export const Program = mongoose.model<IProgram>('Program', ProgramSchema);
