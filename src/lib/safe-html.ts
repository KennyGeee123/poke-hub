/**
 * Safe HTML helpers — escape untrusted strings before any HTML sink.
 * Prefer React text children. Use these only when building HTML strings
 * (e.g. adventure.html / legacy DOM).
 */

/** Escape for HTML text / attribute contexts (not for URLs — use safe-url). */
export function escapeHtml(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Allow only safe CSS color tokens (hex, rgb/rgba/hsl, named basic). */
export function sanitizeCssColor(raw: string | null | undefined, fallback = "transparent"): string {
  if (raw == null) return fallback;
  const s = String(raw).trim();
  if (!s || s.length > 64) return fallback;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
  if (/^rgba?\(\s*[\d.%\s,]+\s*\)$/i.test(s)) return s;
  if (/^hsla?\(\s*[\d.%\s,/]+\s*\)$/i.test(s)) return s;
  if (/^[a-z]{1,20}$/i.test(s)) return s;
  return fallback;
}

/** Strip tags and decode common entities — for API/title display as plain text. */
export function stripTags(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/**
 * Returns true if inserting raw via innerHTML (unescaped) would run attacker code.
 * Escaped output from escapeHtml() must return false.
 */
export function wouldExecuteAsHtml(raw: string): boolean {
  const s = String(raw);
  if (/<\s*script\b/i.test(s)) return true;
  if (/<[^>]*\bon(?:error|load|click|mouseover|focus|mouseenter)\s*=/i.test(s)) return true;
  if (/<\s*(?:svg|iframe|object|embed|img|math)\b/i.test(s)) return true;
  if (/\b(?:href|src|action|formaction)\s*=\s*["']?\s*javascript\s*:/i.test(s)) return true;
  if (/^\s*javascript\s*:/i.test(s)) return true;
  return false;
}

/** Escape so that even if wrongly set via innerHTML, payloads do not execute. */
export function escapeForInnerHTML(raw: string | null | undefined): string {
  return escapeHtml(raw);
}
