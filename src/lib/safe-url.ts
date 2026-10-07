/**
 * Safe URL helpers — only allow navigable/http(s)/mailto/relative URLs.
 * Blocks javascript:, data: (in navigable contexts), vbscript:, etc.
 */

const DANGEROUS_SCHEME =
  /^(?:javascript|vbscript|data|blob|file|about|chrome|chrome-extension|ms-help)\s*:/i;

/** True if URL is safe for <a href> / window.open / location navigation. */
export function isSafeHref(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s) return false;
  if (DANGEROUS_SCHEME.test(s)) return false;
  // Protocol-relative //evil.com — allow only if we treat as https later; block for safety in href
  // Actually // is common CDN usage — allow if rest looks like host
  if (s.startsWith("//")) {
    return /^\/\/[a-z0-9.-]+/i.test(s) && !DANGEROUS_SCHEME.test(s.slice(2));
  }
  // Relative paths
  if (s.startsWith("/") || s.startsWith("./") || s.startsWith("../") || s.startsWith("#") || s.startsWith("?")) {
    return !s.includes("javascript:");
  }
  try {
    const u = new URL(s, "https://example.invalid");
    const proto = u.protocol.toLowerCase();
    if (proto === "http:" || proto === "https:" || proto === "mailto:") return true;
    return false;
  } catch {
    return false;
  }
}

/** True if URL is safe for <img src> / <video src> (http(s), relative, data:image/*, blob:). */
export function isSafeImageSrc(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s) return false;
  if (/^javascript\s*:/i.test(s) || /^vbscript\s*:/i.test(s)) return false;
  if (s.startsWith("data:")) {
    return /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml|bmp|x-icon);/i.test(s);
  }
  if (s.startsWith("blob:")) return true;
  if (s.startsWith("/") || s.startsWith("./") || s.startsWith("../")) return true;
  if (s.startsWith("//")) return /^\/\/[a-z0-9.-]+/i.test(s);
  try {
    const u = new URL(s, "https://example.invalid");
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Return href if safe, otherwise "#" (or fallback). */
export function safeHref(raw: string | null | undefined, fallback = "#"): string {
  return isSafeHref(raw) ? String(raw).trim() : fallback;
}

/** Return image src if safe, otherwise empty string. */
export function safeImageSrc(raw: string | null | undefined, fallback = ""): string {
  return isSafeImageSrc(raw) ? String(raw).trim() : fallback;
}

/** react-markdown urlTransform — strip non-allowlisted schemes. */
export function markdownUrlTransform(value: string): string {
  const v = String(value || "").trim();
  if (!v) return "";
  if (DANGEROUS_SCHEME.test(v)) return "";
  // react-markdown default allows https? mailto ircs? xmpp — we tighten to https? mailto relative
  const colon = v.indexOf(":");
  const slash = v.indexOf("/");
  const q = v.indexOf("?");
  const hash = v.indexOf("#");
  if (
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (q !== -1 && colon > q) ||
    (hash !== -1 && colon > hash)
  ) {
    return v;
  }
  const proto = v.slice(0, colon).toLowerCase();
  if (proto === "http" || proto === "https" || proto === "mailto") return v;
  return "";
}
