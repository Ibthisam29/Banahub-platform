-- ═══════════════════════════════════════════════════════════════════════
-- BANAHub Database Schema — Supabase / PostgreSQL
-- Row Level Security enabled on all private tables
-- ═══════════════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM Types ────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'business', 'investor', 'provider', 'pending');
CREATE TYPE member_status AS ENUM ('pending', 'vetting', 'approved', 'suspended', 'rejected');
CREATE TYPE access_level AS ENUM ('public', 'member', 'request_only', 'admin_only');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'revoked');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled', 'refunded');
CREATE TYPE raise_type AS ENUM ('seed', 'series_a', 'series_b', 'series_c', 'growth', 'debt', 'other');
CREATE TYPE doc_type AS ENUM ('nda', 'mou', 'pitch_deck', 'financial_model', 'term_sheet', 'agreement', 'kyc', 'other');

-- ═══════════════════════════════════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════════════════════════════════

-- ── Users (extends Supabase auth.users) ──────────────────────────────
CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT,
  role          user_role NOT NULL DEFAULT 'pending',
  status        member_status NOT NULL DEFAULT 'pending',
  avatar_url    TEXT,
  phone         TEXT,
  linkedin_url  TEXT,
  google_sub    TEXT,
  auth_method   TEXT DEFAULT 'email',   -- 'email' | 'google'
  onboarding_step INT DEFAULT 0,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Roles (granular permissions) ──────────────────────────────────────
CREATE TABLE public.roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        user_role NOT NULL,
  granted_by  UUID REFERENCES public.users(id),
  granted_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  UNIQUE(user_id, role)
);

-- ── Organisations ─────────────────────────────────────────────────────
CREATE TABLE public.organizations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID NOT NULL REFERENCES public.users(id),
  legal_name        TEXT NOT NULL,
  trading_name      TEXT,
  registration_no   TEXT,
  country           TEXT NOT NULL,
  website           TEXT,
  logo_url          TEXT,
  org_type          TEXT, -- 'company' | 'fund' | 'provider'
  description       TEXT,
  founded_year      INT,
  employee_count    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- BUSINESS PROFILES
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.business_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  org_id              UUID REFERENCES public.organizations(id),

  -- Public fields
  company_name        TEXT NOT NULL,
  tagline             TEXT,
  sector              TEXT[],
  stage               TEXT,           -- 'pre-seed' | 'seed' | 'series_a' | etc
  founded_year        INT,
  hq_country          TEXT,
  website             TEXT,
  logo_url            TEXT,
  short_description   TEXT,           -- public

  -- Member-level fields
  full_description    TEXT,
  target_markets      TEXT[],
  expansion_goals     TEXT,
  gtm_status          TEXT,
  team_size           INT,
  revenue_model       TEXT,
  annual_revenue_usd  BIGINT,

  -- Request-only / private fields
  raise_active        BOOLEAN DEFAULT FALSE,
  raise_type          raise_type,
  raise_amount_usd    BIGINT,
  raise_currency      TEXT DEFAULT 'USD',
  pre_money_val_usd   BIGINT,
  use_of_funds        TEXT,
  existing_investors  TEXT,
  cap_table_summary   TEXT,
  milestones          JSONB DEFAULT '[]',

  -- Visibility
  visibility          access_level DEFAULT 'member',
  is_featured         BOOLEAN DEFAULT FALSE,
  profile_complete    BOOLEAN DEFAULT FALSE,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- INVESTOR PROFILES
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.investor_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  org_id              UUID REFERENCES public.organizations(id),

  -- Public
  fund_name           TEXT NOT NULL,
  fund_type           TEXT,           -- 'family_office' | 'vc' | 'sovereign' | 'pe' | 'corporate'
  hq_country          TEXT,
  logo_url            TEXT,
  bio                 TEXT,

  -- Member
  preferred_sectors   TEXT[],
  preferred_regions   TEXT[],
  investment_stages   TEXT[],
  ticket_min_usd      BIGINT,
  ticket_max_usd      BIGINT,
  aum_range           TEXT,
  investment_thesis   TEXT,

  -- Private (request_only)
  mandate_detail      TEXT,
  portfolio_companies TEXT[],
  contact_partner     TEXT,
  direct_email        TEXT,

  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- SOLUTION PROVIDER PROFILES
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.provider_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  org_id              UUID REFERENCES public.organizations(id),

  company_name        TEXT NOT NULL,
  provider_type       TEXT,           -- 'legal' | 'finance' | 'tech' | 'hr' | 'compliance' | 'other'
  services            TEXT[],
  market_expertise    TEXT[],
  credentials         TEXT,
  certifications      TEXT[],
  pricing_model       TEXT,
  rate_min            INT,
  rate_max            INT,
  rate_currency       TEXT DEFAULT 'USD',
  website             TEXT,
  logo_url            TEXT,
  is_verified         BOOLEAN DEFAULT FALSE,
  is_active           BOOLEAN DEFAULT TRUE,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- CMS TABLES (editable by admin)
-- ═══════════════════════════════════════════════════════════════════════

-- ── Programs ──────────────────────────────────────────────────────────
CREATE TABLE public.programs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  type            TEXT,               -- 'cohort' | 'summit' | 'roundtable' | 'forum'
  status          TEXT DEFAULT 'draft',  -- 'draft' | 'active' | 'upcoming' | 'closed'
  region          TEXT[],
  description     TEXT,
  features        JSONB DEFAULT '[]',
  start_date      DATE,
  end_date        DATE,
  next_intake     TEXT,
  location        TEXT,
  image_url       TEXT,
  partners        JSONB DEFAULT '[]',  -- [{name, logo_url}]
  cta_label       TEXT DEFAULT 'Register Interest',
  cta_url         TEXT,
  limited_spots   BOOLEAN DEFAULT FALSE,
  spots_remaining INT,
  is_published    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Services / Solutions ──────────────────────────────────────────────
CREATE TABLE public.services (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  page_url    TEXT,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Pricing Packages ──────────────────────────────────────────────────
CREATE TABLE public.pricing_packages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT UNIQUE NOT NULL,
  tier_name       TEXT NOT NULL,
  price_usd       INT,                -- null = custom
  billing_period  TEXT DEFAULT 'month',
  min_commitment  INT DEFAULT 3,      -- months
  description     TEXT,
  features        JSONB DEFAULT '[]',
  is_featured     BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  stripe_price_id TEXT,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Partners & Sponsors ───────────────────────────────────────────────
CREATE TABLE public.partners (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  type        TEXT,                   -- 'ecosystem' | 'sponsor' | 'co-host' | 'media'
  logo_url    TEXT,
  website     TEXT,
  tier        TEXT DEFAULT 'standard',  -- 'platinum' | 'gold' | 'standard'
  description TEXT,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Portfolio Companies ────────────────────────────────────────────────
CREATE TABLE public.portfolio_companies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  logo_url        TEXT,
  sector          TEXT[],
  stage           TEXT,
  hq_country      TEXT,
  description     TEXT,              -- public description
  private_notes   TEXT,              -- admin only
  commitment_usd  BIGINT,
  moic            DECIMAL(6,2),
  status          TEXT DEFAULT 'active',
  added_at        DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Page CMS (hero, sections per page) ───────────────────────────────
CREATE TABLE public.page_content (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page        TEXT NOT NULL,         -- 'home' | 'about' | 'platform' etc
  section     TEXT NOT NULL,         -- 'hero' | 'features' | etc
  content     JSONB NOT NULL DEFAULT '{}',
  updated_by  UUID REFERENCES public.users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page, section)
);

-- ═══════════════════════════════════════════════════════════════════════
-- ACCESS REQUEST WORKFLOW
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.access_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id    UUID NOT NULL REFERENCES public.users(id),
  target_type     TEXT NOT NULL,      -- 'business_profile' | 'investor_profile'
  target_id       UUID NOT NULL,
  reason          TEXT,
  status          request_status DEFAULT 'pending',
  reviewed_by     UUID REFERENCES public.users(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  expires_at      TIMESTAMPTZ,        -- access auto-revokes
  nda_signed      BOOLEAN DEFAULT FALSE,
  nda_signed_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, target_type, target_id)
);

-- ── Watchlist (investor) ──────────────────────────────────────────────
CREATE TABLE public.watchlist (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id),
  target_type TEXT NOT NULL,
  target_id   UUID NOT NULL,
  notes       TEXT,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

-- ═══════════════════════════════════════════════════════════════════════
-- PAYMENTS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES public.users(id),
  package_id        UUID REFERENCES public.pricing_packages(id),
  amount_usd        INT NOT NULL,
  currency          TEXT DEFAULT 'USD',
  status            payment_status DEFAULT 'pending',
  stripe_session_id TEXT,
  stripe_invoice_id TEXT,
  stripe_customer_id TEXT,
  description       TEXT,
  paid_at           TIMESTAMPTZ,
  due_date          DATE,
  billing_period_start DATE,
  billing_period_end   DATE,
  receipt_url       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Subscriptions ──────────────────────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL UNIQUE REFERENCES public.users(id),
  package_id            UUID REFERENCES public.pricing_packages(id),
  stripe_subscription_id TEXT,
  stripe_customer_id    TEXT,
  status                TEXT DEFAULT 'active',  -- 'active' | 'paused' | 'cancelled'
  current_period_start  DATE,
  current_period_end    DATE,
  cancel_at             DATE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- DOCUMENTS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES public.users(id),
  target_id     UUID,               -- profile or access_request this doc is for
  doc_type      doc_type NOT NULL,
  file_name     TEXT NOT NULL,
  file_url      TEXT NOT NULL,      -- Supabase Storage URL
  file_size     INT,                -- bytes
  mime_type     TEXT,
  access_level  access_level DEFAULT 'request_only',
  is_signed     BOOLEAN DEFAULT FALSE,
  signed_at     TIMESTAMPTZ,
  signed_by     UUID REFERENCES public.users(id),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- ENQUIRIES
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.enquiries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES public.users(id),   -- null if not logged in
  type          TEXT,               -- 'contact' | 'briefing' | 'partner' | 'sponsor'
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  company       TEXT,
  message       TEXT,
  source        TEXT,               -- which page/form
  ip_address    INET,               -- for rate limiting reference
  is_resolved   BOOLEAN DEFAULT FALSE,
  resolved_by   UUID REFERENCES public.users(id),
  resolved_at   TIMESTAMPTZ,
  admin_notes   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- ADMIN NOTES
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.admin_notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type TEXT NOT NULL,
  target_id   UUID NOT NULL,
  note        TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- AUDIT LOGS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES public.users(id),
  actor_email TEXT,
  action      TEXT NOT NULL,        -- 'access.request' | 'access.approve' | 'admin.login' | etc
  target_type TEXT,
  target_id   UUID,
  metadata    JSONB DEFAULT '{}',
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════
CREATE INDEX idx_users_role        ON public.users(role);
CREATE INDEX idx_users_status      ON public.users(status);
CREATE INDEX idx_users_email       ON public.users(email);
CREATE INDEX idx_business_sector   ON public.business_profiles USING GIN(sector);
CREATE INDEX idx_investor_sectors  ON public.investor_profiles USING GIN(preferred_sectors);
CREATE INDEX idx_access_status     ON public.access_requests(status);
CREATE INDEX idx_access_requester  ON public.access_requests(requester_id);
CREATE INDEX idx_payments_user     ON public.payments(user_id);
CREATE INDEX idx_payments_status   ON public.payments(status);
CREATE INDEX idx_audit_actor       ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_action      ON public.audit_logs(action);
CREATE INDEX idx_audit_created     ON public.audit_logs(created_at DESC);
CREATE INDEX idx_enquiries_email   ON public.enquiries(email);
CREATE INDEX idx_enquiries_created ON public.enquiries(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_packages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_content        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- ── Helper: is_admin ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── Helper: is_approved ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND status = 'approved'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── Helper: has_access_to ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_access_to(target_type TEXT, target_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.access_requests
    WHERE requester_id = auth.uid()
      AND access_requests.target_type = has_access_to.target_type
      AND access_requests.target_id   = has_access_to.target_id
      AND status = 'approved'
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── Users RLS ─────────────────────────────────────────────────────────
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update all users"
  ON public.users FOR UPDATE USING (public.is_admin());
CREATE POLICY "Service role can insert users"
  ON public.users FOR INSERT WITH CHECK (TRUE);

-- ── Business Profiles RLS ─────────────────────────────────────────────
-- Public fields visible to approved members; private fields only with access
CREATE POLICY "Approved members can view public business fields"
  ON public.business_profiles FOR SELECT
  USING (public.is_approved() AND visibility IN ('public', 'member'));
CREATE POLICY "Owners can view own profile"
  ON public.business_profiles FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users with approved access can view request-only fields"
  ON public.business_profiles FOR SELECT
  USING (public.has_access_to('business_profile', id));
CREATE POLICY "Admins can view all business profiles"
  ON public.business_profiles FOR SELECT
  USING (public.is_admin());
CREATE POLICY "Owners can update own profile"
  ON public.business_profiles FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can update all profiles"
  ON public.business_profiles FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "Owners can insert own profile"
  ON public.business_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── Investor Profiles RLS ─────────────────────────────────────────────
CREATE POLICY "Approved members can view investor profiles"
  ON public.investor_profiles FOR SELECT
  USING (public.is_approved());
CREATE POLICY "Owners can view own investor profile"
  ON public.investor_profiles FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all investor profiles"
  ON public.investor_profiles FOR SELECT
  USING (public.is_admin());
CREATE POLICY "Owners can modify own investor profile"
  ON public.investor_profiles FOR ALL
  USING (auth.uid() = user_id OR public.is_admin());

-- ── Provider Profiles RLS ─────────────────────────────────────────────
CREATE POLICY "Approved members can view providers"
  ON public.provider_profiles FOR SELECT
  USING (public.is_approved());
CREATE POLICY "Owners can modify own provider profile"
  ON public.provider_profiles FOR ALL
  USING (auth.uid() = user_id OR public.is_admin());

-- ── Programs, Services, Pricing, Partners (public read) ───────────────
CREATE POLICY "Anyone can view published programs"
  ON public.programs FOR SELECT USING (is_published = TRUE);
CREATE POLICY "Admins can manage programs"
  ON public.programs FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can view active services"
  ON public.services FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage services"
  ON public.services FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can view active pricing"
  ON public.pricing_packages FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage pricing"
  ON public.pricing_packages FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can view active partners"
  ON public.partners FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage partners"
  ON public.partners FOR ALL USING (public.is_admin());

-- ── Access Requests RLS ───────────────────────────────────────────────
CREATE POLICY "Users can view own access requests"
  ON public.access_requests FOR SELECT
  USING (auth.uid() = requester_id OR public.is_admin());
CREATE POLICY "Users can create access requests"
  ON public.access_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id AND public.is_approved());
CREATE POLICY "Admins can update access requests"
  ON public.access_requests FOR UPDATE
  USING (public.is_admin());

-- ── Payments RLS ──────────────────────────────────────────────────────
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins can manage payments"
  ON public.payments FOR ALL USING (public.is_admin());

-- ── Documents RLS ─────────────────────────────────────────────────────
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = owner_id);
CREATE POLICY "Users with access can view request-only docs"
  ON public.documents FOR SELECT
  USING (
    access_level = 'member' AND public.is_approved()
    OR (access_level = 'request_only' AND public.has_access_to('document', id))
    OR public.is_admin()
  );
CREATE POLICY "Owners can upload documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins can manage all documents"
  ON public.documents FOR ALL USING (public.is_admin());

-- ── Audit Logs RLS ────────────────────────────────────────────────────
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT WITH CHECK (TRUE);

-- ── Admin Notes RLS ───────────────────────────────────────────────────
CREATE POLICY "Admins only"
  ON public.admin_notes FOR ALL USING (public.is_admin());

-- ── Page Content RLS ──────────────────────────────────────────────────
CREATE POLICY "Anyone can view page content"
  ON public.page_content FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage page content"
  ON public.page_content FOR ALL USING (public.is_admin());

-- ── Enquiries RLS ─────────────────────────────────────────────────────
CREATE POLICY "Users can view own enquiries"
  ON public.enquiries FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Anyone can submit enquiry"
  ON public.enquiries FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admins can manage enquiries"
  ON public.enquiries FOR ALL USING (public.is_admin());

-- ── Watchlist RLS ─────────────────────────────────────────────────────
CREATE POLICY "Users can manage own watchlist"
  ON public.watchlist FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.investor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Audit trigger for access_requests
CREATE OR REPLACE FUNCTION public.audit_access_request()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    NEW.reviewed_by,
    'access_request.' || NEW.status,
    'access_request',
    NEW.id,
    jsonb_build_object('requester_id', NEW.requester_id, 'target_type', NEW.target_type, 'target_id', NEW.target_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_access_status_change
  AFTER UPDATE OF status ON public.access_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.audit_access_request();

-- Auto-create user record on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO public.services (slug, title, description, icon, page_url, sort_order) VALUES
  ('cross-border-expansion', 'Cross-Border Expansion', 'End-to-end market entry strategy across Asia and the Gulf', 'public', '/cross-border', 1),
  ('gtm-market-entry',       'GTM & Market Entry',    'Go-to-market strategy and channel partner activation',       'rocket_launch', '/gtm', 2),
  ('capital-readiness',      'Capital Readiness',     'Fundraising preparation and investor narrative',              'account_balance', '/capital', 3),
  ('investor-access',        'Investor Access',       'Curated introductions to aligned capital partners',          'currency_exchange', '/investors', 4),
  ('portfolio-advisory',     'Portfolio Advisory',    'Strategic support for portfolio companies post-investment',   'pie_chart', '/portfolio', 5),
  ('incubation-programs',    'Incubation & Programs', 'Structured cohorts, summits, and acceleration programs',     'hub', '/incubation', 6),
  ('solution-providers',     'Solution Provider Network', 'Curated legal, finance, and technology partners',       'settings_suggest', '/providers', 7),
  ('partnerships-sponsors',  'Partnership & Sponsors','Strategic alliances and co-investment mandates',             'handshake', '/partnerships', 8);

INSERT INTO public.pricing_packages (slug, tier_name, price_usd, billing_period, min_commitment, description, features, is_featured, stripe_price_id, sort_order) VALUES
  ('starter', 'Starter', 4500, 'month', 3, 'Market entry advisory and investor readiness preparation',
   '["GTM strategy session","Investor deck review","2 curated intros/month","Platform access"]'::jsonb, FALSE, NULL, 1),
  ('growth',  'Growth',  9500, 'month', 6, 'Full cross-border expansion with active investor introductions',
   '["Everything in Starter","Market entry execution","5 curated intros/month","Capital mandate matching","Program cohort access","Quarterly board briefing"]'::jsonb, TRUE, NULL, 2),
  ('enterprise', 'Enterprise', NULL, 'custom', 12, 'Bespoke full-service institutional advisory',
   '["Everything in Growth","Dedicated RM","Portfolio advisory","Incubation access","White-label programs"]'::jsonb, FALSE, NULL, 3);

-- Page content seed (home hero — editable by admin)
INSERT INTO public.page_content (page, section, content) VALUES
  ('home', 'hero', '{
    "eyebrow": "Cross-Border Business Ecosystem",
    "title": "Scale Beyond Borders. Capital. Markets. Momentum.",
    "subtitle": "BANAHub connects institutional-grade companies with the capital, markets, and strategic partners they need to expand across Southeast Asia, the Gulf, and North Asia.",
    "cta_primary": {"label": "Apply Now", "url": "/apply"},
    "cta_secondary": {"label": "Schedule a Call", "url": "/contact"},
    "bg_image": null
  }'::jsonb);
