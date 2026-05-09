import type { Config } from "@netlify/functions";

// ── In-memory rate limiter (per IP, resets on cold start) ────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxReqs = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }
  if (record.count >= maxReqs) return false; // blocked
  record.count++;
  return true;
}

// ── CAPTCHA verification (Cloudflare Turnstile) ───────────────────────────────
async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = Netlify.env.get("TURNSTILE_SECRET_KEY");
  if (!secret || secret === "skip") return true; // skip in dev
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
  });
  const data = await res.json() as { success: boolean };
  return data.success;
}

// ── Supabase REST helper ──────────────────────────────────────────────────────
const supabase = {
  url:  () => Netlify.env.get("SUPABASE_URL")!,
  key:  () => Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")!,

  async from(table: string) {
    const base = `${this.url()}/rest/v1/${table}`;
    const headers = {
      "apikey":        this.key(),
      "Authorization": `Bearer ${this.key()}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=representation",
    };
    return { base, headers };
  },

  async select(table: string, filter: Record<string, string>) {
    const { base, headers } = await this.from(table);
    const q = new URLSearchParams(filter).toString();
    const res = await fetch(`${base}?${q}&limit=1`, { headers: { ...headers, "Accept": "application/json" } });
    const data = await res.json();
    return Array.isArray(data) ? data[0] : null;
  },

  async insert(table: string, doc: Record<string, unknown>) {
    const { base, headers } = await this.from(table);
    const res = await fetch(base, { method: "POST", headers, body: JSON.stringify(doc) });
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  },

  async update(table: string, filter: Record<string, string>, patch: Record<string, unknown>) {
    const { base, headers } = await this.from(table);
    const q = new URLSearchParams(filter).toString();
    const res = await fetch(`${base}?${q}`, { method: "PATCH", headers, body: JSON.stringify(patch) });
    return res.json();
  },
};

// ── JWT (zero-dependency, Web Crypto) ────────────────────────────────────────
async function signJWT(payload: Record<string, unknown>, secret: string, expSec = 900) {
  const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const h = enc({ alg:"HS256", typ:"JWT" });
  const b = enc({ ...payload, iat:Math.floor(Date.now()/1000), exp:Math.floor(Date.now()/1000)+expSec });
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${h}.${b}`));
  return `${h}.${b}.${btoa(String.fromCharCode(...new Uint8Array(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}`;
}

async function verifyJWT(token: string, secret: string) {
  const [h,b,s] = token.split(".");
  if (!h||!b||!s) throw new Error("Malformed token");
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["verify"]);
  const ok = await crypto.subtle.verify("HMAC", k, Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0)), new TextEncoder().encode(`${h}.${b}`));
  if (!ok) throw new Error("Invalid signature");
  const p = JSON.parse(atob(b));
  if (p.exp < Math.floor(Date.now()/1000)) throw new Error("Token expired");
  return p;
}

async function sha256hex(s: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,"0")).join("");
}

// ── Input sanitization ───────────────────────────────────────────────────────
function sanitize(s: string, maxLen = 255): string {
  return String(s).trim().replace(/[<>'"]/g, "").slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// ── Audit log helper ─────────────────────────────────────────────────────────
async function logAudit(action: string, actorId: string | null, meta: Record<string, unknown>, ip: string) {
  await supabase.insert("audit_logs", { actor_id: actorId, actor_email: meta.email, action, metadata: meta, ip_address: ip }).catch(()=>{});
}

// ── Issue tokens ─────────────────────────────────────────────────────────────
async function issueTokens(payload: Record<string, unknown>) {
  const JWT = Netlify.env.get("JWT_SECRET")!;
  const REF = Netlify.env.get("JWT_REFRESH_SECRET")!;
  const [accessToken, refreshToken] = await Promise.all([signJWT(payload, JWT, 900), signJWT(payload, REF, 604800)]);
  return { accessToken, refreshToken };
}

// ── Response helpers ──────────────────────────────────────────────────────────
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: {"Content-Type":"application/json"} });
const err  = (msg: string, status = 400)  => json({ error: msg }, status);

// ─────────────────────────────────────────────────────────────────────────────
export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const url    = new URL(req.url);
  const action = url.pathname.split("/").pop() ?? "";
  const ip     = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  // ── GET /api/auth/me ─────────────────────────────────────────────────────
  if (action === "me" && req.method === "GET") {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return err("No token", 401);
    try {
      const payload = await verifyJWT(token, Netlify.env.get("JWT_SECRET")!);
      return json({ user: payload });
    } catch { return err("Invalid token", 401); }
  }

  if (req.method !== "POST") return err("Method not allowed", 405);

  const body = await req.json().catch(() => ({})) as Record<string, string>;

  // ── POST /api/auth/google ────────────────────────────────────────────────
  if (action === "google") {
    if (!checkRateLimit(`google:${ip}`, 10, 60_000)) return err("Too many requests", 429);

    const { credential } = body;
    if (!credential) return err("Google credential required");

    // Verify token via Google
    const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    const gData = await gRes.json() as Record<string, string>;
    if (!gRes.ok || gData.error) return err("Invalid Google token", 401);
    if (gData.aud !== Netlify.env.get("GOOGLE_CLIENT_ID")) return err("Token audience mismatch", 401);

    const { email, name, picture, sub } = gData;

    // Upsert in Supabase users table
    let user = await supabase.select("users", { email: `eq.${email}` });
    if (!user) {
      user = await supabase.insert("users", {
        id: crypto.randomUUID(),
        email, full_name: name, avatar_url: picture,
        google_sub: sub, auth_method: "google", role: "pending", status: "pending",
      });
    }

    const payload = { userId: user.id, role: user.role, email, status: user.status };
    const tokens  = await issueTokens(payload);
    await logAudit("auth.google.login", user.id, { email }, ip);
    await supabase.update("users", { id: `eq.${user.id}` }, { last_login_at: new Date().toISOString() });

    return json({ ...tokens, member: user });
  }

  // ── POST /api/auth/login ─────────────────────────────────────────────────
  if (action === "login") {
    if (!checkRateLimit(`login:${ip}`, 5, 60_000)) return err("Too many login attempts. Wait 60 seconds.", 429);

    const { email, password, captchaToken } = body;
    if (!email || !password)     return err("Email and password required");
    if (!isValidEmail(email))    return err("Invalid email format");
    if (password.length < 8)     return err("Invalid credentials", 401);

    // Verify CAPTCHA on login
    if (captchaToken) {
      const valid = await verifyCaptcha(captchaToken);
      if (!valid) return err("CAPTCHA verification failed", 403);
    }

    // Admin env var check (works without DB)
    const adminEmail = Netlify.env.get("ADMIN_EMAIL") ?? "admin@banahub.com";
    const adminHash  = Netlify.env.get("ADMIN_PASSWORD_HASH");
    const pwHash     = await sha256hex(sanitize(password));

    if (sanitize(email) === adminEmail && adminHash && pwHash === adminHash) {
      const payload = { userId: "admin-001", role: "admin", email: adminEmail, status: "approved" };
      const tokens  = await issueTokens(payload);
      await logAudit("auth.admin.login", "admin-001", { email: adminEmail }, ip);
      return json({ ...tokens, member: { id:"admin-001", email:adminEmail, role:"admin", profile:{ fullName:"Platform Admin" } } });
    }

    // Supabase lookup
    const user = await supabase.select("users", { email: `eq.${sanitize(email)}` });
    if (!user) return err("Invalid credentials", 401);
    if (user.auth_method === "google") return err("Please sign in with Google", 401);

    // Compare password hash
    const storedHash = user.password_hash;
    if (!storedHash || storedHash !== pwHash) return err("Invalid credentials", 401);

    const payload = { userId: user.id, role: user.role, email: user.email, status: user.status };
    const tokens  = await issueTokens(payload);
    await logAudit("auth.login", user.id, { email: user.email }, ip);
    await supabase.update("users", { id: `eq.${user.id}` }, { last_login_at: new Date().toISOString() });

    return json({ ...tokens, member: user });
  }

  // ── POST /api/auth/register ──────────────────────────────────────────────
  if (action === "register") {
    if (!checkRateLimit(`register:${ip}`, 3, 300_000)) return err("Too many registration attempts", 429);

    const { email, password, fullName, institution, region, captchaToken } = body;

    // Server-side validation
    if (!email || !password || !fullName) return err("Name, email, and password are required");
    if (!isValidEmail(email))             return err("Invalid email format");
    if (password.length < 8)             return err("Password must be at least 8 characters");
    if (fullName.length < 2)             return err("Full name is required");

    // CAPTCHA required for registration
    const captchaValid = await verifyCaptcha(captchaToken ?? "");
    if (!captchaValid) return err("Please complete the CAPTCHA verification", 403);

    const existing = await supabase.select("users", { email: `eq.${sanitize(email)}` });
    if (existing) return err("Email already registered", 409);

    const userId = crypto.randomUUID();
    const newUser = {
      id:            userId,
      email:         sanitize(email),
      full_name:     sanitize(fullName, 100),
      password_hash: await sha256hex(password),
      auth_method:   "email",
      role:          "pending",
      status:        "pending",
    };
    await supabase.insert("users", newUser);
    await logAudit("auth.register", userId, { email: newUser.email, institution: sanitize(institution ?? "") }, ip);

    const payload = { userId, role: "pending", email: newUser.email, status: "pending" };
    const tokens  = await issueTokens(payload);
    return json({ ...tokens, member: newUser }, 201);
  }

  // ── POST /api/auth/refresh ───────────────────────────────────────────────
  if (action === "refresh") {
    const { refreshToken } = body;
    if (!refreshToken) return err("refreshToken required");
    try {
      const { exp: _e, iat: _i, ...rest } = await verifyJWT(refreshToken, Netlify.env.get("JWT_REFRESH_SECRET")!);
      const tokens = await issueTokens(rest);
      return json(tokens);
    } catch { return err("Invalid refresh token", 401); }
  }

  return err("Not found", 404);
};

export const config: Config = {
  path: ["/api/auth/:action"],
};
