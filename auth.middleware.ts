import mongoose, { Schema, Document } from 'mongoose';

export interface IMandate extends Document {
  title: string;
  description: string;
  status: 'open' | 'closing_soon' | 'pending_final_docs' | 'closed';
  region: 'SEA' | 'Gulf Region' | 'North Asia' | 'Global';
  sector: string;
  assetClass: string;
  projectedIRR: number;
  ticketSizeMin: number;
  ticketSizeMax: number;
  sovereignBacked: boolean;
  vettingRequired: boolean;
  daysLeft?: number;
  imageUrl?: string;
  publishedAt: Date;
}

const MandateSchema = new Schema<IMandate>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'closing_soon', 'pending_final_docs', 'closed'], default: 'open' },
  region: { type: String, enum: ['SEA', 'Gulf Region', 'North Asia', 'Global'], required: true },
  sector: { type: String, required: true },
  assetClass: { type: String, required: true },
  projectedIRR: { type: Number, required: true },
  ticketSizeMin: { type: Number, required: true },
  ticketSizeMax: { type: Number, required: true },
  sovereignBacked: { type: Boolean, default: false },
  vettingRequired: { type: Boolean, default: true },
  daysLeft: Number,
  imageUrl: String,
  publishedAt: { type: Date, default: Date.now },
}, { timestamps: true });

MandateSchema.index({ region: 1, status: 1 });
MandateSchema.index({ sector: 1 });

export const Mandate = mongoose.model<IMandate>('Mandate', MandateSchema);
