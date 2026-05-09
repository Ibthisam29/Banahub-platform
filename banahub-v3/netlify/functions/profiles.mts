import type { Config } from "@netlify/functions";

const SB_URL = () => Netlify.env.get("SUPABASE_URL")!;
const SB_KEY = () => Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Allowed MIME types for file uploads (server-side enforcement)
const ALLOWED_TYPES = new Set([
  "image/jpeg","image/png","image/webp","image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

async function verifyToken(req: Request): Promise<Record<string,unknown>|null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ","");
  if (!token) return null;
  try {
    const [h,b,s] = token.split(".");
    const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(Netlify.env.get("JWT_SECRET")!),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    const ok  = await crypto.subtle.verify("HMAC",key,Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0)),new TextEncoder().encode(`${h}.${b}`));
    if (!ok) return null;
    const p = JSON.parse(atob(b));
    return p.exp < Date.now()/1000 ? null : p;
  } catch { return null; }
}

async function dbFetch(path: string, method="GET", body?: unknown) {
  const res = await fetch(`${SB_URL()}/rest/v1/${path}`, {
    method,
    headers: { "apikey":SB_KEY(),"Authorization":`Bearer ${SB_KEY()}`,"Content-Type":"application/json","Prefer":"return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await res.json();
  return Array.isArray(d) ? d : d;
}

function sanitize(s: unknown, max=1000): string {
  return String(s??"").trim().replace(/<[^>]*>/g,"").slice(0,max);
}

async function logAudit(action: string, actorId: string, meta: Record<string,unknown>, ip: string) {
  await dbFetch("audit_logs","POST",{actor_id:actorId,action,metadata:meta,ip_address:ip}).catch(()=>{});
}

const json = (d: unknown, s=200) => new Response(JSON.stringify(d),{status:s,headers:{"Content-Type":"application/json"}});
const err  = (m: string, s=400) => json({error:m},s);

export default async (req: Request) => {
  const url    = new URL(req.url);
  const parts  = url.pathname.replace("/api/profiles","").split("/").filter(Boolean);
  const type   = parts[0]; // 'business' | 'investor' | 'provider'
  const ip     = req.headers.get("x-forwarded-for")?.split(",")[0].trim()??"unknown";

  if (req.method === "OPTIONS") return new Response(null,{status:204});

  const user = await verifyToken(req);
  if (!user) return err("Unauthorised",401);
  if (user.status !== "approved" && user.role !== "admin") return err("Account not yet approved",403);

  const tableMap: Record<string,string> = {
    business: "business_profiles",
    investor: "investor_profiles",
    provider: "provider_profiles",
  };
  const table = tableMap[type];
  if (!table) return err("Invalid profile type",400);

  // ── GET /api/profiles/business ───────────────────────────────────────────
  if (req.method === "GET") {
    // If no ID, return caller's own profile
    const targetId = url.searchParams.get("id");
    if (!targetId) {
      const data = await dbFetch(`${table}?user_id=eq.${user.userId}&limit=1`);
      return json({ profile: Array.isArray(data) ? data[0] ?? null : null });
    }

    // If fetching someone else's profile, check access level
    const profile = await dbFetch(`${table}?id=eq.${targetId}&limit=1`);
    const p = Array.isArray(profile) ? profile[0] : null;
    if (!p) return err("Profile not found",404);

    // Check access
    const isOwner  = p.user_id === user.userId;
    const isAdmin  = user.role === "admin";
    const hasAccess = await checkAccess(String(user.userId), type+"_profile", targetId);

    if (!isOwner && !isAdmin) {
      // Strip private fields based on access level
      if (!hasAccess) {
        // Return only public/member fields
        const pub: Record<string,unknown> = {};
        const publicFields = ["id","company_name","fund_name","tagline","sector","stage","hq_country","website","logo_url","short_description","bio","fund_type","provider_type","services","is_active"];
        publicFields.forEach(f => { if (p[f] !== undefined) pub[f] = p[f]; });
        await logAudit("profile.view.public", String(user.userId), {profileId:targetId, type}, ip);
        return json({ profile: pub, accessLevel: "public" });
      }
      // Has approved access — return all non-admin fields
      const restricted = { ...p };
      delete restricted.created_at; // strip internal fields
      await logAudit("profile.view.restricted", String(user.userId), {profileId:targetId, type}, ip);
      return json({ profile: restricted, accessLevel: "approved" });
    }

    await logAudit("profile.view.full", String(user.userId), {profileId:targetId, type}, ip);
    return json({ profile: p, accessLevel: "full" });
  }

  // ── POST/PATCH /api/profiles/business ───────────────────────────────────
  if (req.method === "POST" || req.method === "PATCH") {
    const body = await req.json();

    // Sanitize all text fields
    const sanitized: Record<string,unknown> = {};
    const textFields = ["company_name","fund_name","tagline","short_description","full_description","bio","expansion_goals","use_of_funds","existing_investors","cap_table_summary","investment_thesis","mandate_detail","credentials","pricing_model","revenue_model","gtm_status"];
    const numFields  = ["raise_amount_usd","pre_money_val_usd","annual_revenue_usd","ticket_min_usd","ticket_max_usd","team_size","rate_min","rate_max","aum_range","founded_year"];

    Object.keys(body).forEach(k => {
      if (textFields.includes(k)) { sanitized[k] = sanitize(body[k]); }
      else if (numFields.includes(k)) { const n = parseInt(body[k]); if (!isNaN(n)) sanitized[k] = n; }
      else if (["sector","target_markets","preferred_sectors","preferred_regions","investment_stages","services","market_expertise","certifications"].includes(k)) {
        if (Array.isArray(body[k])) sanitized[k] = body[k].map((x:unknown)=>sanitize(x,100));
      }
      else if (["raise_active","is_active","is_featured"].includes(k)) { sanitized[k] = !!body[k]; }
      else if (["hq_country","stage","fund_type","provider_type","website","logo_url","raise_type","raise_currency","rate_currency","billing_period","visibility"].includes(k)) {
        sanitized[k] = sanitize(body[k],300);
      }
    });

    // File upload type check
    if (body._uploadMime && !ALLOWED_TYPES.has(body._uploadMime)) return err("File type not permitted",415);

    sanitized.user_id    = user.userId;
    sanitized.updated_at = new Date().toISOString();

    const existing = await dbFetch(`${table}?user_id=eq.${user.userId}&limit=1`);
    const exists   = Array.isArray(existing) && existing.length > 0;

    if (exists) {
      const result = await dbFetch(`${table}?user_id=eq.${user.userId}`, "PATCH", sanitized);
      await logAudit("profile.update", String(user.userId), {type}, ip);
      return json({ profile: Array.isArray(result) ? result[0] : result });
    } else {
      sanitized.id         = crypto.randomUUID();
      sanitized.created_at = new Date().toISOString();
      const result = await dbFetch(table, "POST", sanitized);
      await logAudit("profile.create", String(user.userId), {type}, ip);
      return json({ profile: Array.isArray(result) ? result[0] : result }, 201);
    }
  }

  return err("Not found",404);
};

async function checkAccess(requesterId: string, targetType: string, targetId: string): Promise<boolean> {
  const res = await fetch(
    `${Netlify.env.get("SUPABASE_URL")}/rest/v1/access_requests?requester_id=eq.${requesterId}&target_type=eq.${targetType}&target_id=eq.${targetId}&status=eq.approved&limit=1`,
    { headers: { "apikey": Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")!, "Authorization": `Bearer ${Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` } }
  );
  const d = await res.json();
  return Array.isArray(d) && d.length > 0 && (!d[0].expires_at || new Date(d[0].expires_at) > new Date());
}

export const config: Config = {
  path: ["/api/profiles/:type", "/api/profiles/:type/:id"],
};
