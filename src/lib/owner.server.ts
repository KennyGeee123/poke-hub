// Server-only owner identification. This file is stripped from the client
// bundle (filename ends in .server.ts), so the email is never shipped to
// browsers. To rotate, edit here or replace with process.env.OWNER_EMAIL.
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "kmitchjr7@gmail.com";

export function isOwnerEmailServer(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}
