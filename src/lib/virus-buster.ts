/** Virus Buster — PokéVault site shield (not desktop antivirus). */

export const XSS_SCRIPT_TAG = /<\s*\/?\s*script\b/i;
export const JAVASCRIPT_URL = /javascript\s*:/i;
export const EVENT_HANDLER =
  /\bon(?:error|load|click|mouseover|focus|mouseenter|animationend|focusin|toggle|submit|change|wheel|pointerdown)\s*=/i;
export const SQL_UNION = /\bunion\b[\s/+*-]*\bselect\b/i;
export const SQL_DUMP = /(?:'\s*or\s+'?\d|;\s*drop\s+table|\bdrop\s+table\b|\bxp_cmdshell\b)/i;
export const PATH_TRAVERSAL = /(?:\.\.[/\\]|\.\.%2f|\.\.%5c)/i;
export const NULL_BYTE = /%00|\x00/;
export const PHP_WEBSHELL = /<\?(?:php|=)/i;
export const EVAL_BASE64 = /eval\s*\(\s*base64/i;

export const BLOCK_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: "xss-script", re: XSS_SCRIPT_TAG },
  { name: "javascript-url", re: JAVASCRIPT_URL },
  { name: "event-handler", re: EVENT_HANDLER },
  { name: "sql-union", re: SQL_UNION },
  { name: "sql-dump", re: SQL_DUMP },
  { name: "path-traversal", re: PATH_TRAVERSAL },
  { name: "null-byte", re: NULL_BYTE },
  { name: "php-webshell", re: PHP_WEBSHELL },
  { name: "eval-base64", re: EVAL_BASE64 },
];

const MAX_BODY_BYTES = 1_000_000;

function decodeCandidates(s: string): string[] {
  const out = [s];
  const plus = s.replace(/\+/g, " ");
  if (plus !== s) out.push(plus);
  for (const raw of [...out]) {
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded !== raw) out.push(decoded);
    } catch {
      /* malformed percent-encoding — scan the raw string only */
    }
  }
  return out;
}

export function scanText(s: string): { blocked: boolean; reason?: string } {
  if (!s) return { blocked: false };
  for (const candidate of decodeCandidates(s)) {
    for (const { name, re } of BLOCK_PATTERNS) {
      re.lastIndex = 0;
      if (re.test(candidate)) return { blocked: true, reason: name };
    }
  }
  return { blocked: false };
}

function shouldScanBody(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;

  const lenHeader = req.headers.get("content-length");
  if (lenHeader != null) {
    const len = Number(lenHeader);
    if (!Number.isFinite(len) || len <= 0 || len > MAX_BODY_BYTES) return false;
  }

  const ctype = (req.headers.get("content-type") ?? "").toLowerCase();
  if (
    ctype.startsWith("multipart/") ||
    ctype.startsWith("image/") ||
    ctype.startsWith("audio/") ||
    ctype.startsWith("video/") ||
    ctype.includes("octet-stream")
  ) {
    return false;
  }
  return true;
}

export async function scanRequest(req: Request): Promise<{ blocked: boolean; reason?: string }> {
  const urlHit = scanText(req.url);
  if (urlHit.blocked) return urlHit;

  if (!shouldScanBody(req)) return { blocked: false };

  try {
    const text = await req.clone().text();
    if (!text) return { blocked: false };
    if (text.length > MAX_BODY_BYTES) return { blocked: false };
    return scanText(text);
  } catch {
    return { blocked: false };
  }
}

export function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    // SAMEORIGIN + frame-ancestors self: Adventure iframe + Scan camera need this
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "X-Virus-Buster": "on",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: https://*.supabase.co https://accounts.google.com; frame-src 'self' https://accounts.google.com https://*.google.com https://*.supabase.co; form-action 'self' https://accounts.google.com https://*.supabase.co; media-src 'self' https: blob:; frame-ancestors 'self'",
  };
}

export function applySecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(securityHeaders())) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export function blockedResponse(): Response {
  return applySecurityHeaders(
    new Response(JSON.stringify({ error: "Virus Buster blocked this request", code: "VB_BLOCK" }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
  );
}

export const VIRUS_BUSTER_SHIELDS = [
  "xss-script",
  "javascript-url",
  "event-handler",
  "sql-injection",
  "path-traversal",
  "null-byte",
  "webshell",
  "security-headers",
] as const;
