import type { Config } from "@netlify/functions";

const SB_URL = () => Netlify.env.get("SUPABASE_URL")!;
const SB_KEY = () => Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT    = () => Netlify.env.get("JWT_SECRET")!;

// Allowed file upload types (server-side enforcement)
const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

async function requireAdmin(req: Request): Promise<Record<string, unknown> | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const [h,b,s] = token.split(".");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(JWT()), {name:"HMAC",hash:"SHA-256"}, false, ["verify"]);
    const ok  = await crypto.subtle.verify("HMAC", key, Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0)), new TextEncoder().encode(`${h}.${b}`));
    if (!ok) return null;
    const p = JSON.parse(atob(b));
    if (p.exp < Date.now()/1000 || p.role !== "admin") return null;
    return p;
  } catch { return null; }
}

const sbFetch = (path: string, method = "GET", body?: unknown) =>
  fetch(`${SB_URL()}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey": SB_KEY(), "Authorization": `Bearer ${SB_KEY()}`,
      "Content-Type": "application/json", "Prefer": "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

async function dbGet(path: string)    { return (await sbFetch(path)).json(); }
async function dbPost(p: string, b: unknown)  { return (await sbFetch(p, "POST", b)).json(); }
async function dbPatch(p: string, b: unknown) { return (await sbFetch(p, "PATCH", b)).json(); }
async function dbDelete(p: string)    { return (await sbFetch(p, "DELETE")).json(); }

function sanitize(s: unknown, max = 500) {
  return String(s ?? "").trim().replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").slice(0, max);
}

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: {"Content-Type":"application/json"} });
const err  = (m: string, s = 400) => json({ error: m }, s);

export default async (req: Request) => {
  const admin = await requireAdmin(req);
  if (!admin) return err("Admin access required", 403);

  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const url      = new URL(req.url);
  const segments = url.pathname.replace("/api/admin/", "").split("/");
  const resource = segments[0]; // users | programs | pricing | partners | enquiries | etc
  const id       = segments[1]; // optional ID
  const ip       = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  // ── Audit log helper ────────────────────────────────────────────────
  const audit = async (action: string, meta: Record<string, unknown>) => {
    await sbFetch("audit_logs", "POST", {
      actor_id: admin.userId, actor_email: admin.email,
      action: `admin.${action}`, target_type: resource, target_id: id,
      metadata: meta, ip_address: ip,
    }).catch(()=>{});
  };

  // ── Dashboard stats ──────────────────────────────────────────────────
  if (resource === "dashboard" && req.method === "GET") {
    const [users, businesses, investors, providers, enquiries, requests, payments] = await Promise.all([
      dbGet("users?select=id,role,status&order=created_at.desc"),
      dbGet("business_profiles?select=id,company_name,created_at&limit=5&order=created_at.desc"),
      dbGet("investor_profiles?select=id,fund_name,created_at&limit=5&order=created_at.desc"),
      dbGet("provider_profiles?select=id,company_name,created_at&limit=5&order=created_at.desc"),
      dbGet("enquiries?is_resolved=eq.false&select=id,type,email,full_name,created_at&order=created_at.desc&limit=10"),
      dbGet("access_requests?status=eq.pending&select=id,requester_id,target_type,created_at&order=created_at.desc&limit=10"),
      dbGet("payments?select=id,amount_usd,status,created_at&order=created_at.desc&limit=10"),
    ]);
    const userArr = Array.isArray(users) ? users : [];
    return json({
      stats: {
        totalUsers:     userArr.length,
        pendingApproval: userArr.filter((u: Record<string,string>) => u.status === "pending" || u.status === "vetting").length,
        businesses:     Array.isArray(businesses) ? businesses.length : 0,
        investors:      Array.isArray(investors)  ? investors.length  : 0,
        providers:      Array.isArray(providers)  ? providers.length  : 0,
        openEnquiries:  Array.isArray(enquiries)  ? enquiries.length  : 0,
        pendingRequests: Array.isArray(requests)  ? requests.length   : 0,
      },
      recentEnquiries:      Array.isArray(enquiries) ? enquiries : [],
      pendingAccessRequests: Array.isArray(requests) ? requests  : [],
      recentPayments:        Array.isArray(payments) ? payments  : [],
    });
  }

  // ── Users ────────────────────────────────────────────────────────────
  if (resource === "users") {
    if (req.method === "GET") {
      const status = url.searchParams.get("status") ?? "";
      const role   = url.searchParams.get("role") ?? "";
      let q = "users?order=created_at.desc";
      if (status) q += `&status=eq.${status}`;
      if (role)   q += `&role=eq.${role}`;
      return json(await dbGet(q));
    }
    if (req.method === "PATCH" && id) {
      const body = await req.json();
      // Only allow updating safe fields
      const allowed = ["role", "status", "full_name"];
      const patch: Record<string, unknown> = {};
      allowed.forEach(f => { if (body[f] !== undefined) patch[f] = sanitize(body[f]); });
      if (!Object.keys(patch).length) return err("No valid fields to update");
      const result = await dbPatch(`users?id=eq.${id}`, patch);
      await audit("user.update", { userId: id, patch });
      return json(result);
    }
  }

  // ── Programs ─────────────────────────────────────────────────────────
  if (resource === "programs") {
    if (req.method === "GET") return json(await dbGet(`programs?order=created_at.desc`));
    if (req.method === "POST") {
      const body = await req.json();
      const result = await dbPost("programs", { ...body, id: crypto.randomUUID() });
      await audit("program.create", { title: body.title });
      return json(result, 201);
    }
    if (req.method === "PATCH" && id) {
      const body   = await req.json();
      const result = await dbPatch(`programs?id=eq.${id}`, body);
      await audit("program.update", { programId: id });
      return json(result);
    }
    if (req.method === "DELETE" && id) {
      await dbDelete(`programs?id=eq.${id}`);
      await audit("program.delete", { programId: id });
      return json({ deleted: true });
    }
  }

  // ── Pricing ───────────────────────────────────────────────────────────
  if (resource === "pricing") {
    if (req.method === "GET") return json(await dbGet("pricing_packages?order=sort_order.asc"));
    if (req.method === "PATCH" && id) {
      const body   = await req.json();
      const result = await dbPatch(`pricing_packages?id=eq.${id}`, body);
      await audit("pricing.update", { packageId: id });
      return json(result);
    }
  }

  // ── Partners ──────────────────────────────────────────────────────────
  if (resource === "partners") {
    if (req.method === "GET")  return json(await dbGet("partners?order=sort_order.asc"));
    if (req.method === "POST") { const b = await req.json(); return json(await dbPost("partners", { ...b, id: crypto.randomUUID() }), 201); }
    if (req.method === "PATCH"  && id) { const b = await req.json(); return json(await dbPatch(`partners?id=eq.${id}`, b)); }
    if (req.method === "DELETE" && id) { await dbDelete(`partners?id=eq.${id}`); return json({ deleted: true }); }
  }

  // ── Enquiries ─────────────────────────────────────────────────────────
  if (resource === "enquiries") {
    if (req.method === "GET") {
      const resolved = url.searchParams.get("resolved") ?? "false";
      return json(await dbGet(`enquiries?is_resolved=eq.${resolved}&order=created_at.desc`));
    }
    if (req.method === "PATCH" && id) {
      const { resolved, notes } = await req.json();
      await dbPatch(`enquiries?id=eq.${id}`, { is_resolved: resolved, admin_notes: notes, resolved_by: admin.userId, resolved_at: new Date().toISOString() });
      await audit("enquiry.resolve", { enquiryId: id });
      return json({ resolved: true });
    }
  }

  // ── Page CMS ──────────────────────────────────────────────────────────
  if (resource === "pages") {
    if (req.method === "GET") {
      const page = url.searchParams.get("page") ?? "home";
      return json(await dbGet(`page_content?page=eq.${page}`));
    }
    if (req.method === "PATCH") {
      const { page, section, content } = await req.json();
      if (!page || !section || !content) return err("page, section, and content required");
      // Upsert
      await sbFetch(`page_content?page=eq.${page}&section=eq.${section}`, "PATCH", { content, updated_by: admin.userId, updated_at: new Date().toISOString() });
      await audit("page.update", { page, section });
      return json({ updated: true });
    }
  }

  // ── Access Requests (admin view) ──────────────────────────────────────
  if (resource === "access-requests") {
    if (req.method === "GET") return json(await dbGet("access_requests?order=created_at.desc"));
  }

  // ── Audit Logs ────────────────────────────────────────────────────────
  if (resource === "audit-logs") {
    if (req.method === "GET") {
      const limit = url.searchParams.get("limit") ?? "100";
      return json(await dbGet(`audit_logs?order=created_at.desc&limit=${limit}`));
    }
  }

  // ── File upload validation (headers check — actual upload goes to Supabase Storage) ──
  if (resource === "upload-check" && req.method === "POST") {
    const { mimeType, fileSize } = await req.json();
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) return err(`File type not allowed. Permitted: PDF, JPG, PNG, WEBP, DOCX, XLSX`, 415);
    if (fileSize > 10 * 1024 * 1024) return err("File size must not exceed 10MB", 413);
    return json({ allowed: true });
  }

  return err("Not found", 404);
};

export const config: Config = {
  path: ["/api/admin/:resource", "/api/admin/:resource/:id"],
};
