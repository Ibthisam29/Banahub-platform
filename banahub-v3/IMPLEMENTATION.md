# BANAHub — Implementation & Deployment Plan
## Full-Stack Institutional Platform · Netlify + Supabase + Stripe

---

## Architecture Overview

```
banahub.com (GoDaddy DNS → Netlify CDN)
├── /public          → Static HTML pages (Netlify CDN)
├── /api/*           → Netlify Serverless Functions (Node.js)
└── Supabase         → PostgreSQL + Auth + Storage + RLS
    Stripe           → Payments (server-side only)
    Cloudflare       → Turnstile CAPTCHA
    Google           → OAuth 2.0
    Resend           → Transactional email
```

---

## Environment Variables

### Netlify → Site Configuration → Environment Variables

| Variable | Description | Where to get |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (NEVER in frontend) | Supabase → Settings → API |
| `JWT_SECRET` | Min 32-char random string | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Different 32-char string | `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | OAuth Client ID | Google Cloud Console |
| `TURNSTILE_SECRET_KEY` | Cloudflare CAPTCHA secret | Cloudflare Dashboard |
| `STRIPE_SECRET_KEY` | `sk_live_...` (NEVER public) | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe → Webhooks |
| `ADMIN_EMAIL` | `admin@banahub.com` | Your choice |
| `ADMIN_PASSWORD_HASH` | SHA-256 of admin password | See below |
| `MONGO_APP_ID` | *(optional, if using Atlas Data API)* | MongoDB Atlas |
| `NOTIFY_EMAIL` | Email for enquiry notifications | Your choice |
| `RESEND_API_KEY` | Transactional email | resend.com |
| `NODE_ENV` | `production` | Fixed value |

**Generate admin password hash:**
```bash
python3 -c "import hashlib; print(hashlib.sha256('YourPassword'.encode()).hexdigest())"
```

---

## Step-by-Step Deployment

### Step 1 — Supabase Setup

1. Create project at **supabase.com**
2. Go to **SQL Editor** → paste contents of `schema.sql` → Run
3. Go to **Settings → API** → copy `Project URL` and `service_role` key
4. Go to **Storage** → Create bucket `documents` (private) and `logos` (public)
5. Go to **Authentication → Providers** → Enable Email and Google
6. For Google: enter your Google Client ID and Secret

### Step 2 — Google OAuth

1. **console.cloud.google.com** → New Project
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorized JS origins: `https://www.banahub.com`, `https://banahub.com`
5. Authorized redirect URIs: `https://xxxx.supabase.co/auth/v1/callback`
6. Copy Client ID → set as `GOOGLE_CLIENT_ID` env var

### Step 3 — Cloudflare Turnstile CAPTCHA

1. **cloudflare.com** → Turnstile → Add Site
2. Domain: `banahub.com`
3. Widget type: **Managed** (auto)
4. Copy **Site Key** → add to your HTML forms as `data-sitekey`
5. Copy **Secret Key** → set as `TURNSTILE_SECRET_KEY` env var

**Add to forms in login.html, apply.html, contact.html:**
```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY"></div>
```

### Step 4 — Stripe Setup

1. **dashboard.stripe.com** → Create account
2. Products → Add products for each pricing tier:
   - Starter: $4,500/month recurring
   - Growth: $9,500/month recurring
3. Copy each Price ID → update `stripe_price_id` in `pricing_packages` table
4. Copy **Secret Key** (starts with `sk_live_`) → `STRIPE_SECRET_KEY` env var
5. Webhooks → Add endpoint: `https://www.banahub.com/api/payments/webhook`
   - Events: `checkout.session.completed`, `invoice.payment_failed`, `customer.subscription.deleted`
6. Copy **Webhook Secret** → `STRIPE_WEBHOOK_SECRET` env var

**⚠️ NEVER put Stripe secret key in frontend code. Ever.**

### Step 5 — Netlify Deploy

1. Go to **app.netlify.com/projects/banahubplatform**
2. Drag the `banahub-v3` folder onto the deploy drop zone
3. Add all environment variables (see table above)
4. Trigger deploy → Deploy site
5. Connect GitHub for auto-deploy (optional)

### Step 6 — Custom Domain & HTTPS

1. Netlify → Domain Management → Add `banahub.com` and `www.banahub.com`
2. GoDaddy DNS:
   - A record: `@` → `75.2.60.5`
   - CNAME: `www` → `banahubplatform.netlify.app`
3. Netlify auto-provisions SSL (Let's Encrypt)
4. **HTTPS is enforced via `Strict-Transport-Security` header** in `netlify.toml`

---

## Security Model

### 1. Authentication & Authorization
- JWT access tokens (15 min expiry) + refresh tokens (7 days)
- Google OAuth via Google Identity Services
- Role-based access: `admin` | `business` | `investor` | `provider` | `pending`
- All routes protected by JWT verification server-side

### 2. Database Security (Supabase RLS)
- Row Level Security enabled on ALL tables
- Public data: anyone can read published programs, services, pricing
- Member data: requires `status = 'approved'`
- Private/request-only data: requires approved `access_requests` record
- Admin data: requires `role = 'admin'`
- Service role key: NEVER exposed to frontend, only used in serverless functions

### 3. API Security
- Rate limiting: 5 login attempts/min, 3 registrations/5min, 3 enquiries/hr
- CAPTCHA (Cloudflare Turnstile) on all public forms
- Server-side input validation and sanitization on every endpoint
- File upload type restrictions: PDF, JPG, PNG, WEBP, DOCX, XLSX (max 10MB)
- Audit logs for all admin actions and data access

### 4. Payment Security
- Stripe secret key: server-side functions ONLY
- Payment links generated server-side
- No card data stored — Stripe handles PCI compliance
- Webhook signature verification prevents fake events

### 5. Content Security Policy
- CSP headers block inline scripts except declared sources
- All external resources whitelisted explicitly
- `X-Frame-Options: DENY` prevents clickjacking
- HSTS forces HTTPS across all subdomains

---

## Role-Based Access Flow

```
User registers → status: 'pending'
     ↓
Admin reviews KYC → approve → status: 'approved' → role assigned
     ↓                reject → status: 'rejected'
Approved user browses platform
     ↓
Investor sees business profile (public fields only)
     ↓
Investor clicks "Request Access"
     ↓
Admin reviews access request → approve → investor sees private fields
                             → reject → investor sees rejection reason
     ↓
Access auto-expires (configurable, default 90 days)
```

---

## Access Request Workflow

### Business Profile Fields

| Field | Access Level | Who Can See |
|---|---|---|
| Company name, tagline, sector, stage | public | Anyone |
| Full description, target markets, team size | member | Approved members |
| Raise amount, cap table, investors, financials | request_only | Admin-approved requesters |
| Private notes, admin flags | admin_only | Admins only |

### API Endpoints

```
POST /api/access/request    → Submit access request (approved members only)
GET  /api/access/requests   → List own requests (or all if admin)
POST /api/access/approve    → Admin approves request
POST /api/access/reject     → Admin rejects request
POST /api/access/revoke     → Admin revokes approved access
```

---

## Payment Workflow

```
User selects plan → POST /api/payments/checkout (server creates session)
     ↓
Redirect to Stripe Checkout (hosted, PCI compliant)
     ↓
Payment success → Stripe sends webhook to /api/payments/webhook
     ↓
Webhook handler:
  - Marks payment as 'paid' in DB
  - Updates user status to 'approved'
  - Creates subscription record
     ↓
User dashboard shows updated plan and payment history
```

---

## Page Structure

### Public Pages (19)
```
index.html          → Homepage (all sections)
about.html          → About BANAHub
platform.html       → Platform overview
cross-border.html   → Cross-Border Expansion service
gtm.html            → GTM & Market Entry
capital.html        → Capital Readiness
investors.html      → Investor Access
portfolio.html      → Portfolio Advisory
incubation.html     → Incubation & Programs
enablement.html     → Industry Enablement
providers.html      → Solution Provider Network
partnerships.html   → Partnership & Sponsors
pricing.html        → Pricing / Engagement Models
apply.html          → Apply / Join (3-step form)
contact.html        → Contact
login.html          → Login (Google OAuth + email)
privacy.html        → Privacy Policy
terms.html          → Terms of Use ✓ (built)
disclaimer.html     → Disclaimer / Risk Notice
404.html            → 404
```

### Protected Dashboards (4)
```
dashboard-business.html   → Business dashboard
dashboard-investor.html   → Investor dashboard
dashboard-provider.html   → Solution provider dashboard
admin.html                → Admin CMS + governance
```

---

## Admin CMS Endpoints

```
GET  /api/admin/dashboard           → Stats overview
GET  /api/admin/users               → All users (filterable)
PATCH /api/admin/users/:id          → Update user role/status
GET  /api/admin/programs            → All programs
POST /api/admin/programs            → Create program
PATCH /api/admin/programs/:id       → Update program
DELETE /api/admin/programs/:id      → Delete program
GET  /api/admin/pricing             → All packages
PATCH /api/admin/pricing/:id        → Update pricing
GET  /api/admin/partners            → All partners
POST /api/admin/partners            → Add partner
PATCH /api/admin/partners/:id       → Update partner
DELETE /api/admin/partners/:id      → Remove partner
GET  /api/admin/enquiries           → Open enquiries
PATCH /api/admin/enquiries/:id      → Resolve enquiry
GET  /api/admin/pages?page=home     → Get page CMS content
PATCH /api/admin/pages              → Update page content
GET  /api/admin/access-requests     → All access requests
GET  /api/admin/audit-logs          → Full audit log
POST /api/admin/upload-check        → Validate file type before upload
```

---

## Database Table Summary

| Table | Purpose | RLS |
|---|---|---|
| users | All registered users | Self + Admin |
| roles | Granular permissions | Admin |
| organizations | Legal entity records | Owner + Admin |
| business_profiles | Company profiles with tiered visibility | Public/Member/Request/Admin |
| investor_profiles | Investor mandates | Member/Request/Admin |
| provider_profiles | Solution provider listings | Member + Admin |
| programs | Events and cohorts | Public (published) |
| services | Platform service definitions | Public |
| pricing_packages | Subscription tiers | Public |
| partners | Partners and sponsors | Public |
| portfolio_companies | Portfolio roster | Admin |
| page_content | CMS content per page | Public read, Admin write |
| access_requests | Request/approve workflow | Owner + Admin |
| watchlist | Investor saved items | Owner |
| payments | Payment records | Owner + Admin |
| subscriptions | Active subscriptions | Owner + Admin |
| documents | KYC/NDA/decks | Owner + Access |
| enquiries | Contact form submissions | Admin |
| admin_notes | Internal notes | Admin |
| audit_logs | All admin/access actions | Admin |

---

## Maintenance Checklist

- [ ] Rotate JWT secrets quarterly
- [ ] Review audit logs weekly
- [ ] Monitor Stripe webhook failures
- [ ] Review pending access requests daily
- [ ] Update RLS policies when new data fields are added
- [ ] Keep CAPTCHA site key current
- [ ] Review rate limit thresholds monthly
- [ ] Backup Supabase database weekly
