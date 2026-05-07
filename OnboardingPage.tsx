// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  role: 'member' | 'admin' | 'advisor';
  profile: {
    fullName: string;
    institution: string;
    title: string;
    region: Region;
    phone?: string;
    avatar?: string;
  };
  membership: {
    tier: 'founding' | 'standard';
    status: MemberStatus;
    onboardingStep: number;
    onboardingComplete: boolean;
    feeStatus: 'pending' | 'paid' | 'overdue';
    annualFee: number;
  };
}

export type Region = 'SEA' | 'Gulf Region' | 'North Asia' | 'Global';
export type MemberStatus = 'pending' | 'manual_vetting' | 'compliance_flag' | 'verified' | 'active' | 'suspended';

// ─── Mandate ──────────────────────────────────────────────────────────────────
export interface Mandate {
  _id: string;
  title: string;
  description: string;
  status: 'open' | 'closing_soon' | 'pending_final_docs' | 'closed';
  region: Region;
  sector: string;
  assetClass: string;
  projectedIRR: number;
  ticketSizeMin: number;
  ticketSizeMax: number;
  sovereignBacked: boolean;
  vettingRequired: boolean;
  daysLeft?: number;
  imageUrl?: string;
}

// ─── Program ──────────────────────────────────────────────────────────────────
export interface Program {
  _id: string;
  title: string;
  type: 'cohort' | 'summit' | 'roundtable' | 'forum';
  status: 'active' | 'upcoming' | 'closed';
  region: string;
  description: string;
  features: string[];
  startDate: string;
  nextIntake?: string;
  location?: string;
  partners: { name: string; logo?: string }[];
  ctaLabel: string;
  limitedSpots: boolean;
  spotsRemaining?: number;
}

// ─── Portfolio ────────────────────────────────────────────────────────────────
export interface PortfolioOverview {
  totalValue: number;
  netIRR: number;
  dpi: number;
  distributed: number;
  contributed: number;
  geoReach: number;
  allocation: { label: string; pct: number }[];
  mandates: PortfolioMandate[];
}

export interface PortfolioMandate {
  _id: string;
  name: string;
  location: string;
  stage: string;
  commitment: number;
  called: number;
  moic: number;
  moicTrend: 'up' | 'down' | 'flat';
  vettingStatus: 'Vetted' | 'In Progress' | 'Pending';
  imageUrl?: string;
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export interface AdminStats {
  total: number;
  pendingVerifications: number;
  founding: number;
  standard: number;
}

export interface MemberRow {
  _id: string;
  profile: { fullName: string; institution: string; region: Region };
  membership: { tier: 'founding' | 'standard'; status: MemberStatus; feeStatus: string };
}

// ─── API ──────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
