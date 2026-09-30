// Lazy accessor so the Supabase SDK (~50 kB gz) stays out of the first-paint bundle.
// Guests never need it until they sign in or a signed-in feature runs.
import type { supabase as SupabaseClient } from "./client";

let p: Promise<typeof SupabaseClient> | null = null;

export function loadSupabase(): Promise<typeof SupabaseClient> {
  if (!p) p = import("./client").then((m) => m.supabase);
  return p;
}
