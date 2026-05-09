import type { Config } from "@netlify/functions";

const SB_URL = () => Netlify.env.get("SUPABASE_URL")!;
const SB_KEY = () => Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT    = () => Netlify.env.get("JWT_SECRET")!;

async function verifyToken(req: Request): Promise<Record<string, unknown> | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const [,b,s] = token.split(".");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(JWT()), {name:"HMAC",hash:"SHA-256"}, false, ["verify"]);
    const ok  = await crypto.subtle.verify("HMAC", key, Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0)), new TextEncoder().encode(`${token.split(".")[0]}.${b}`));
    if (!ok) return null;
    const p = JSON.parse(atob(b));
    if (p.exp < Date.now()/1000) return null;
    return p;
  } catch { return null; }
}

const headers = () => ({
  "apikey": SB_KEY(), "Authorization": `Bearer ${SB_KEY()}`,
  "Content-Type": "application/json", "Prefer": "return=representation",
});

async function dbQuery(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${SB_URL()}/rest/v1/${path}`, {
    method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function logAudit(action: string, actorId: string, meta: Record<string, unknown>, ip: string) {
  await dbQuery("audit_logs", "POST", { actor_id: actorId, action, metadata: meta, ip_address: ip }).catch(()=>{});
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: {"Content-Type":"application/json"} });
const err  = (msg: string, status = 400)  => json({ error: msg }, status);

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const ip   = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const user = await verifyToken(req);
  if (!user) return err("Unauthorised", 401);

  const url    = new URL(req.url);
  const parts  = url.pathname.split("/").filter(Boolean);
  const action = parts[parts.length - 1]; // 'requests' | 'approve' | 'reject'

  // ── POST /api/access/request ─────────────────────────────────────────────
  if (req.method === "POST" && action === "request") {
    if (user.status !== "approved") return err("Your account must be approved to request access", 403);

    const { targetType, targetId, reason, ndaSigned } = await req.json();
    if (!targetType || !targetId) return err("targetType and targetId required");
    if (!["business_profile", "investor_profile"].includes(targetType)) return err("Invalid target type");

    const existing = await dbQuery(`access_requests?requester_id=eq.${user.userId}&target_type=eq.${targetType}&target_id=eq.${targetId}&limit=1`);
    if (Array.isArray(existing) && existing.length) return err("Access request already submitted", 409);

    const record = {
      requester_id: user.userId,
      target_type:  targetType,
      target_id:    targetId,
      reason:       (reason ?? "").toString().trim().slice(0, 1000),
      status:       "pending",
      nda_signed:   ndaSigned === true,
      nda_signed_at: ndaSigned ? new Date().toISOString() : null,
    };

    const result = await dbQuery("access_requests", "POST", record);
    await logAudit("access.request.submitted", String(user.userId), { targetType, targetId }, ip);

    return json({ request: Array.isArray(result) ? result[0] : result }, 201);
  }

  // ── GET /api/access/requests ─────────────────────────────────────────────
  if (req.method === "GET" && action === "requests") {
    if (user.role === "admin") {
      // Admin sees all pending requests
      const status  = url.searchParams.get("status") ?? "pending";
      const results = await dbQuery(`access_requests?status=eq.${status}&order=created_at.desc`);
      return json({ requests: results });
    }
    // User sees own requests
    const results = await dbQuery(`access_requests?requester_id=eq.${user.userId}&order=created_at.desc`);
    return json({ requests: results });
  }

  // ── POST /api/access/approve ─────────────────────────────────────────────
  if (req.method === "POST" && action === "approve") {
    if (user.role !== "admin") return err("Admin only", 403);

    const { requestId, notes, expiresDays } = await req.json();
    if (!requestId) return err("requestId required");

    const expiresAt = expiresDays
      ? new Date(Date.now() + expiresDays * 86400_000).toISOString()
      : null;

    await dbQuery(`access_requests?id=eq.${requestId}`, "PATCH", {
      status: "approved", reviewed_by: user.userId,
      reviewed_at: new Date().toISOString(), review_notes: notes ?? null, expires_at: expiresAt,
    });

    await logAudit("access.request.approved", String(user.userId), { requestId, notes }, ip);
    return json({ approved: true });
  }

  // ── POST /api/access/reject ──────────────────────────────────────────────
  if (req.method === "POST" && action === "reject") {
    if (user.role !== "admin") return err("Admin only", 403);

    const { requestId, notes } = await req.json();
    if (!requestId) return err("requestId required");

    await dbQuery(`access_requests?id=eq.${requestId}`, "PATCH", {
      status: "rejected", reviewed_by: user.userId,
      reviewed_at: new Date().toISOString(), review_notes: notes ?? null,
    });

    await logAudit("access.request.rejected", String(user.userId), { requestId, notes }, ip);
    return json({ rejected: true });
  }

  // ── POST /api/access/revoke ──────────────────────────────────────────────
  if (req.method === "POST" && action === "revoke") {
    if (user.role !== "admin") return err("Admin only", 403);

    const { requestId } = await req.json();
    await dbQuery(`access_requests?id=eq.${requestId}`, "PATCH", {
      status: "revoked", reviewed_by: user.userId, reviewed_at: new Date().toISOString(),
    });

    await logAudit("access.request.revoked", String(user.userId), { requestId }, ip);
    return json({ revoked: true });
  }

  return err("Not found", 404);
};

export const config: Config = {
  path: ["/api/access/:action"],
};
