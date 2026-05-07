import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IMember extends Document {
  email: string;
  password: string;
  role: 'member' | 'admin' | 'advisor';
  profile: {
    fullName: string;
    institution: string;
    title: string;
    region: 'SEA' | 'Gulf Region' | 'North Asia' | 'Global';
    phone?: string;
    avatar?: string;
  };
  membership: {
    tier: 'founding' | 'standard';
    status: 'pending' | 'manual_vetting' | 'compliance_flag' | 'verified' | 'active' | 'suspended';
    onboardingStep: number;
    onboardingComplete: boolean;
    feeStatus: 'pending' | 'paid' | 'overdue';
    annualFee: number;
    joinedAt?: Date;
  };
  compliance: {
    kycStatus: 'not_started' | 'in_progress' | 'approved' | 'rejected';
    sanctionsCheck: boolean;
    amlVerified: boolean;
    lastReviewDate?: Date;
  };
  comparePassword(password: string): Promise<boolean>;
}

const MemberSchema = new Schema<IMember>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8 },
  role: { type: String, enum: ['member', 'admin', 'advisor'], default: 'member' },
  profile: {
    fullName: { type: String, required: true },
    institution: { type: String, required: true },
    title: { type: String },
    region: { type: String, enum: ['SEA', 'Gulf Region', 'North Asia', 'Global'], default: 'SEA' },
    phone: String,
    avatar: String,
  },
  membership: {
    tier: { type: String, enum: ['founding', 'standard'], default: 'standard' },
    status: {
      type: String,
      enum: ['pending', 'manual_vetting', 'compliance_flag', 'verified', 'active', 'suspended'],
      default: 'pending',
    },
    onboardingStep: { type: Number, default: 0 },
    onboardingComplete: { type: Boolean, default: false },
    feeStatus: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' },
    annualFee: { type: Number, default: 0 },
    joinedAt: Date,
  },
  compliance: {
    kycStatus: { type: String, enum: ['not_started', 'in_progress', 'approved', 'rejected'], default: 'not_started' },
    sanctionsCheck: { type: Boolean, default: false },
    amlVerified: { type: Boolean, default: false },
    lastReviewDate: Date,
  },
}, { timestamps: true });

MemberSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

MemberSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

MemberSchema.index({ email: 1 });
MemberSchema.index({ 'profile.region': 1 });
MemberSchema.index({ 'membership.status': 1 });

export const Member = mongoose.model<IMember>('Member', MemberSchema);
