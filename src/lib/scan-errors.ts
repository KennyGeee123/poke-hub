/** identifyCard requires a signed-in Supabase session; turn raw auth errors into a usable hint. */
export function friendlyScanError(msg: string | undefined | null, fallback: string): string {
  const m = String(msg || "");
  if (m === "GUEST_LIMIT") return "Sign in for more scans. Free guest scans are used up on this device.";
  if (/Unauthorized|authorization header|Invalid token/i.test(m)) {
    return "Sign in to use the card camera (AI scan needs an account). You can still Find the card by name.";
  }
  return m || fallback;
}
