// Owner account: Kenneth Mitchell. Signed-in match = full unpaid Elite/admin.
// Server still confirms via owner.functions.ts; client match is instant so
// Strike and scans never flash locked while the RPC runs.
export const FREE_SUBMISSION_LIMIT = 2;

const OWNER_EMAILS = new Set(
  [
    "kmitchjr7@gmail.com",
    ...(typeof import.meta !== "undefined" && import.meta.env?.VITE_OWNER_EMAIL
      ? String(import.meta.env.VITE_OWNER_EMAIL).split(",")
      : []),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return OWNER_EMAILS.has(email.trim().toLowerCase());
}
