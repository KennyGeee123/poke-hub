// Client helper: is account sign-in reachable right now? Cached for the session.
export type AuthServiceStatus = "checking" | "online" | "offline";

let cached: { ok: boolean; at: number } | null = null;
let inflight: Promise<boolean> | null = null;

export function checkAuthService(force = false): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  if (!force && cached && Date.now() - cached.at < 60_000) return Promise.resolve(cached.ok);
  if (inflight && !force) return inflight;
  inflight = fetch("/api/public/auth-status", { signal: AbortSignal.timeout(6000) })
    .then((r) => (r.ok ? r.json() : { ok: true }))
    .then((j: { ok?: boolean }) => j?.ok !== false)
    // If our own origin can't answer, don't block sign-in on a guess.
    .catch(() => true)
    .then((ok) => {
      cached = { ok, at: Date.now() };
      inflight = null;
      return ok;
    });
  return inflight;
}

/** Map raw network/auth errors to something a trainer can act on. */
export function friendlyAuthError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? "");
  if (/failed to fetch|networkerror|load failed|fetch failed|timed? ?out|ERR_NAME/i.test(msg)) {
    return "Accounts are offline right now. Continue as a guest — your vault stays saved on this device.";
  }
  if (/invalid login credentials/i.test(msg)) return "That email and password don’t match.";
  if (/email not confirmed/i.test(msg)) return "Check your inbox to confirm your email first.";
  if (/rate limit|too many/i.test(msg)) return "Too many attempts. Wait a minute and try again.";
  return msg || "Something went wrong. Please try again.";
}
