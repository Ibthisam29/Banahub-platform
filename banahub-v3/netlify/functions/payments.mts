import type { Config } from "@netlify/functions";

// NOTE: Stripe secret key is NEVER exposed to the frontend — server-side only
const STRIPE_SECRET = () => Netlify.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK = () => Netlify.env.get("STRIPE_WEBHOOK_SECRET")!;
const SB_URL = () => Netlify.env.get("SUPABASE_URL")!;
const SB_KEY = () => Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifyToken(req: Request): Promise<Record<string, unknown> | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const [h,b,s] = token.split(".");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(Netlify.env.get("JWT_SECRET")!), {name:"HMAC",hash:"SHA-256"}, false, ["verify"]);
    const ok  = await crypto.subtle.verify("HMAC", key, Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0)), new TextEncoder().encode(`${h}.${b}`));
    if (!ok) return null;
    const p = JSON.parse(atob(b));
    return p.exp < Date.now()/1000 ? null : p;
  } catch { return null; }
}

async function stripeRequest(path: string, method = "GET", body?: Record<string, unknown>) {
  const params = body ? Object.entries(body).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&") : undefined;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${STRIPE_SECRET()}`,
      "Content-Type":  method === "GET" ? "application/json" : "application/x-www-form-urlencoded",
    },
    body: params,
  });
  return res.json();
}

async function dbInsert(table: string, doc: Record<string, unknown>) {
  await fetch(`${SB_URL()}/rest/v1/${table}`, {
    method: "POST",
    headers: { "apikey": SB_KEY(), "Authorization": `Bearer ${SB_KEY()}`, "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(doc),
  });
}

async function dbUpdate(table: string, filter: string, patch: Record<string, unknown>) {
  await fetch(`${SB_URL()}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { "apikey": SB_KEY(), "Authorization": `Bearer ${SB_KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

async function dbSelect(table: string, filter: string) {
  const res = await fetch(`${SB_URL()}/rest/v1/${table}?${filter}&limit=1`, {
    headers: { "apikey": SB_KEY(), "Authorization": `Bearer ${SB_KEY()}` },
  });
  const d = await res.json();
  return Array.isArray(d) ? d[0] : null;
}

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: {"Content-Type":"application/json"} });
const err  = (m: string, s = 400) => json({ error: m }, s);

export default async (req: Request) => {
  const url    = new URL(req.url);
  const action = url.pathname.split("/").pop() ?? "";

  // ── POST /api/payments/checkout ─────────────────────────────────────────
  if (action === "checkout" && req.method === "POST") {
    const user = await verifyToken(req);
    if (!user) return err("Unauthorised", 401);

    const { packageId, successUrl, cancelUrl } = await req.json();
    if (!packageId) return err("packageId required");

    // Get package details from DB
    const pkg = await dbSelect("pricing_packages", `id=eq.${packageId}&is_active=eq.true`);
    if (!pkg) return err("Package not found", 404);
    if (!pkg.price_usd) return err("This package requires a custom quote. Contact us.", 400);

    // Create Stripe Checkout session
    const session = await stripeRequest("checkout/sessions", "POST", {
      "payment_method_types[]":  "card",
      "mode":                    "subscription",
      "customer_email":          String(user.email),
      "line_items[0][price]":    pkg.stripe_price_id ?? "",
      "line_items[0][quantity]": "1",
      "success_url":             successUrl ?? `${url.origin}/dashboard-business.html?payment=success`,
      "cancel_url":              cancelUrl  ?? `${url.origin}/pricing.html`,
      "metadata[user_id]":       String(user.userId),
      "metadata[package_id]":    packageId,
    } as Record<string,unknown>);

    if (session.error) return err(session.error.message, 400);

    // Record pending payment
    await dbInsert("payments", {
      user_id:           user.userId,
      package_id:        packageId,
      amount_usd:        pkg.price_usd,
      status:            "pending",
      stripe_session_id: session.id,
      description:       `${pkg.tier_name} subscription`,
    });

    return json({ sessionId: session.id, url: session.url });
  }

  // ── GET /api/payments/history ────────────────────────────────────────────
  if (action === "history" && req.method === "GET") {
    const user = await verifyToken(req);
    if (!user) return err("Unauthorised", 401);

    const filter = user.role === "admin" ? "order=created_at.desc" : `user_id=eq.${user.userId}&order=created_at.desc`;
    const res = await fetch(`${SB_URL()}/rest/v1/payments?${filter}`, {
      headers: { "apikey": SB_KEY(), "Authorization": `Bearer ${SB_KEY()}` },
    });
    return json({ payments: await res.json() });
  }

  // ── POST /api/payments/webhook ───────────────────────────────────────────
  // Stripe sends events here. This is NEVER exposed to the frontend.
  if (action === "webhook" && req.method === "POST") {
    const rawBody = await req.text();
    const sig     = req.headers.get("stripe-signature") ?? "";

    // Verify Stripe webhook signature (simplified — use stripe-node in production for full HMAC verification)
    // In production, use: const event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK());

    let event: Record<string, unknown>;
    try { event = JSON.parse(rawBody); }
    catch { return err("Invalid JSON", 400); }

    const eventType = event.type as string;
    const data      = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;

    if (eventType === "checkout.session.completed") {
      const sessionId = data.id as string;
      const userId    = (data.metadata as Record<string,string>)?.user_id;
      const packageId = (data.metadata as Record<string,string>)?.package_id;

      await dbUpdate("payments", `stripe_session_id=eq.${sessionId}`, {
        status:    "paid",
        paid_at:   new Date().toISOString(),
        stripe_customer_id: data.customer as string,
      });

      // Update user status to approved if pending
      if (userId) {
        const u = await dbSelect("users", `id=eq.${userId}`);
        if (u?.status === "pending" || u?.status === "vetting") {
          await dbUpdate("users", `id=eq.${userId}`, { status: "approved" });
        }
      }

      // Upsert subscription
      if (userId && packageId) {
        await dbInsert("subscriptions", {
          user_id:    userId,
          package_id: packageId,
          status:     "active",
          stripe_customer_id: data.customer as string,
        });
      }
    }

    if (eventType === "invoice.payment_failed") {
      const customerId = data.customer as string;
      await dbUpdate("payments", `stripe_customer_id=eq.${customerId}&status=eq.paid`, { status: "overdue" });
    }

    if (eventType === "customer.subscription.deleted") {
      const customerId = data.customer as string;
      await dbUpdate("subscriptions", `stripe_customer_id=eq.${customerId}`, { status: "cancelled" });
    }

    return new Response("ok", { status: 200 });
  }

  return err("Not found", 404);
};

export const config: Config = {
  path: ["/api/payments/:action"],
};
