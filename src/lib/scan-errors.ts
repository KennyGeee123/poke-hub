/** identifyCard requires a signed-in Supabase session; turn raw auth errors into a usable hint. */
export function friendlyScanError(msg: string | undefined | null, fallback: string): string {
  const m = String(msg || "");
  if (m === "GUEST_LIMIT") return "Sign in for more scans. Free guest scans are used up on this device.";
  if (m === "GUEST_LIMIT_IP") return "Sign in for more scans. The free guest limit for this network is used up today.";
  if (m === "SCAN_SERVICE_DOWN") return "Card reader is temporarily unavailable (your scan was not used). Try again or Find the card by name.";
  if (m === "SCAN_BUSY") return "Card reader is busy right now (your scan was not used). Try again in a moment.";
  if (m === "SCAN_UNREADABLE") return "Couldn't read that card. Fill the frame with the card, avoid glare, and try again.";
  if (/Unauthorized|authorization header|Invalid token/i.test(m)) {
    return "Sign in to use the card camera (AI scan needs an account). You can still Find the card by name.";
  }
  return m || fallback;
}
