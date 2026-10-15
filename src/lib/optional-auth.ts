// Like requireSupabaseAuth, but lets signed-out callers through as guests.
// A present-but-invalid token is still rejected.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

export const GUEST_SCAN_LIMIT = 2;
export const GUEST_IP_DAILY_LIMIT = 4;

function anonClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// Guest quota lives in a separate Supabase project (km-command); anon key only,
// access is limited to the SECURITY DEFINER RPCs.
function quotaClient() {
  const url = process.env.QUOTA_SUPABASE_URL;
  const key = process.env.QUOTA_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing QUOTA_SUPABASE_URL / QUOTA_SUPABASE_ANON_KEY");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export function guestIdentity(request: Request | undefined) {
  const h = request?.headers;
  const device = (h?.get("x-pv-device") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  const ip =
    (h?.get("x-real-ip") || h?.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 64);
  return { device, ip };
}

export async function claimGuestScan(device: string, ip: string) {
  let client;
  try {
    client = quotaClient();
  } catch (e: any) {
    return { ok: false as const, reason: "store" as const, used: 0, limit: GUEST_SCAN_LIMIT, error: e?.message };
  }
  const { data, error } = await client.rpc("claim_guest_scan" as never, {
    p_device: device,
    p_ip: ip,
    p_device_limit: GUEST_SCAN_LIMIT,
    p_ip_limit: GUEST_IP_DAILY_LIMIT,
  } as never);
  if (error) return { ok: false as const, reason: "store" as const, used: 0, limit: GUEST_SCAN_LIMIT, error: error.message };
  const d = data as { ok: boolean; reason?: string; used: number; limit: number };
  return { ...d, limit: GUEST_SCAN_LIMIT };
}

export async function guestScanStatus(device: string) {
  if (device.length < 16) return { used: 0, limit: GUEST_SCAN_LIMIT };
  let client;
  try {
    client = quotaClient();
  } catch {
    return { used: 0, limit: GUEST_SCAN_LIMIT };
  }
  const { data, error } = await client.rpc("guest_scan_status" as never, { p_device: device } as never);
  return { used: error ? 0 : Number(data) || 0, limit: GUEST_SCAN_LIMIT };
}

export const optionalSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader) return next({ context: { userId: null as string | null, request } });
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");
  const token = authHeader.slice(7);
  const { data, error } = await anonClient().auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");
  return next({ context: { userId: data.claims.sub as string | null, request } });
});
