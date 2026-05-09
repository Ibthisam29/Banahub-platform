import type { Config } from "@netlify/functions";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRL(key: string, max = 3, windowMs = 3_600_000): boolean {
  const now = Date.now();
  const r   = rateLimitMap.get(key);
  if (!r || now > r.resetAt) { rateLimitMap.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (r.count >= max) return false;
  r.count++; return true;
}

async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = Netlify.env.get("TURNSTILE_SECRET_KEY");
  if (!secret || secret === "skip") return true;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
  });
  const d = await res.json() as { success: boolean };
  return d.success;
}

function sanitize(s: unknown, max = 255): string {
  return String(s ?? "").trim().replace(/<[^>]*>/g, "").replace(/[<>'"]/g, "").slice(0, max);
}
function isEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }

const SB_URL = () => Netlify.env.get("SUPABASE_URL")!;
const SB_KEY = () => Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function dbInsert(table: string, doc: Record<string, unknown>) {
  await fetch(`${SB_URL()}/rest/v1/${table}`, {
    method: "POST",
    headers: { "apikey": SB_KEY(), "Authorization": `Bearer ${SB_KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
}

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: {"Content-Type":"application/json"} });
const err  = (m: string, s = 400) => json({ error: m }, s);

export default async (req: Request) => {
  if (req.method !== "POST") return err("Method not allowed", 405);

  const ip   = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const body = await req.json().catch(() => ({})) as Record<string, string>;
  const type = sanitize(body.type ?? "contact");

  // Rate limit: 3 submissions per IP per hour
  if (!checkRL(`enquiry:${ip}`, 3, 3_600_000)) return err("Too many submissions. Please try again later.", 429);

  // CAPTCHA verification (required)
  const captchaValid = await verifyCaptcha(body.captchaToken ?? "");
  if (!captchaValid) return err("CAPTCHA verification failed. Please complete the verification.", 403);

  // Validate required fields
  const fullName = sanitize(body.fullName, 100);
  const email    = sanitize(body.email, 254);
  const message  = sanitize(body.message, 5000);
  const company  = sanitize(body.company, 200);

  if (!fullName || fullName.length < 2) return err("Full name is required");
  if (!email || !isEmail(email))        return err("A valid institutional email is required");
  if (!message && type === "contact")   return err("Message is required");

  const record = {
    type,
    full_name: fullName,
    email,
    company,
    message,
    source:     sanitize(body.source ?? req.headers.get("referer") ?? "", 255),
    ip_address: ip,
  };

  await dbInsert("enquiries", record);

  // Optionally notify via email (Resend / SendGrid)
  const notifyEmail = Netlify.env.get("NOTIFY_EMAIL");
  if (notifyEmail) {
    // Fire-and-forget email notification
    const emailKey = Netlify.env.get("RESEND_API_KEY");
    if (emailKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${emailKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from:    "BANAHub <noreply@banahub.com>",
          to:      [notifyEmail],
          subject: `New ${type} enquiry from ${fullName}`,
          html:    `<p><strong>Name:</strong> ${fullName}</p><p><strong>Email:</strong> ${email}</p><p><strong>Company:</strong> ${company}</p><p><strong>Message:</strong><br>${message.replace(/\n/g,"<br>")}</p>`,
        }),
      }).catch(() => {});
    }
  }

  return json({ success: true, message: "Your enquiry has been received. We will respond within 2 business days." }, 201);
};

export const config: Config = {
  path: "/api/enquiries",
};
