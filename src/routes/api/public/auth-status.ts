// Server-side health probe for the Supabase auth service. The browser asks our
// origin instead of the auth host directly, so a paused/unreachable project never
// produces DNS console errors and the login screen can switch to guest-first mode.
import { createFileRoute } from "@tanstack/react-router";

function authBase(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  return String(process.env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
}

function authKey(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  return String(process.env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
}

export const Route = createFileRoute("/api/public/auth-status")({
  server: {
    handlers: {
      GET: async () => {
        const base = authBase();
        const headers = {
          "content-type": "application/json",
          "cache-control": "public, s-maxage=30, stale-while-revalidate=60",
        };
        if (!base) {
          return new Response(JSON.stringify({ ok: false, reason: "unconfigured" }), { headers });
        }
        try {
          const r = await fetch(`${base}/auth/v1/health`, {
            headers: { apikey: authKey() },
            signal: AbortSignal.timeout(4000),
          });
          const ok = r.status < 500;
          return new Response(JSON.stringify({ ok, reason: ok ? null : `status_${r.status}` }), {
            headers,
          });
        } catch {
          return new Response(JSON.stringify({ ok: false, reason: "unreachable" }), { headers });
        }
      },
    },
  },
});
