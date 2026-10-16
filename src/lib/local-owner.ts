/**
 * Owner session for this Mac only. Loopback hostnames never match a public deploy.
 * This does not create a Supabase token and does not run on any other host.
 */
export const LOCAL_OWNER_KEY = "pv.local.owner.v1";

export function isLoopbackHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

/** Missing key on this Mac means sign in once. "0" stays signed out. */
export function localOwnerEnabled(seed = true): boolean {
  if (!isLoopbackHost()) return false;
  try {
    const value = localStorage.getItem(LOCAL_OWNER_KEY);
    if (value === "1") return true;
    if (value === "0") return false;
    if (!seed) return false;
    localStorage.setItem(LOCAL_OWNER_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function setLocalOwnerFlag(on: boolean): void {
  if (!isLoopbackHost()) return;
  try {
    localStorage.setItem(LOCAL_OWNER_KEY, on ? "1" : "0");
  } catch {
    return;
  }
  window.dispatchEvent(new Event("pv-local-owner"));
}
