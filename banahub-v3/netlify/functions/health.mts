import type { Config } from "@netlify/functions";

export default async (_req: Request) => {
  const checks = {
    status:    "ok",
    timestamp: new Date().toISOString(),
    version:   "1.0.0",
    supabase:  "unchecked",
  };

  // Quick Supabase connectivity check
  try {
    const res = await fetch(`${Netlify.env.get("SUPABASE_URL")}/rest/v1/`, {
      headers: { "apikey": Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" }
    });
    checks.supabase = res.ok ? "ok" : "degraded";
  } catch {
    checks.supabase = "error";
  }

  return new Response(JSON.stringify(checks), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/health",
};
