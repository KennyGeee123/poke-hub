/**
 * Navi Gate — Virus Buster's bot check-in gate (2026-10-16).
 *
 * Every request is classified human vs bot. Humans (real browsers, the iOS /
 * Android Capacitor WebViews) pass. Every bot is BLOCKED unless the owner
 * approved it with Touch ID. All bot entry doors need an owner signature:
 *   1. x-navi-pass: a Navi Pass for one named bot, with an expiry.
 *   2. x-github-oidc: a GitHub Actions OIDC JWT (RS256, verified against
 *      GitHub's JWKS) from a repo listed in the signed gate policy.
 *   3. Search crawlers listed in the signed policy, proven by reverse +
 *      forward DNS — never by user agent alone. None are listed by default.
 *
 * Passes and the policy (VB_GATE_POLICY env) are ECDSA P-256 signatures by the
 * owner's private key, which lives only in the owner's macOS keychain and is
 * released only after a Touch ID approval (KM Command
 * netnavi-core/ops/navi-gate-pass.mjs). This site holds only the PUBLIC key,
 * in source (OWNER_PUBLIC_KEY_JWK), so nobody with Vercel or env access can
 * mint a pass, approve a repo, or switch the gate off. Missing / invalid
 * policy → no repo or crawler is approved (fail-closed). There is no off switch.
 *
 * Each block is reported to KM Command's Supabase (vb_log_gate_event) so the
 * local Virus Buster pulls it into its threat feed. Logging never blocks or
 * fails the gate.
 *
 * Bot detection is header/user-agent based: it stops scrapers, scripts, AI
 * crawlers and headless tools that identify themselves or skip browser headers.
 * A bot that fully impersonates a browser is not caught here — that needs a
 * JS challenge (Vercel BotID / Firewall Bot Protection) on top.
 */

export const GATE_NAVI = "Decoherence";
export const GATE_NAME = "Navi Gate";

// Owner's Touch ID-held signing key (public half only). Rotating it is a code
// change, which means a commit to the owner's GitHub repo.
export const OWNER_PUBLIC_KEY_JWK: JsonWebKey | null = {
  kty: "EC",
  crv: "P-256",
  x: "yZwTLQ62-hcdVyVnKdzIA8xFQm8cbqBEaSHeAZQB7wE",
  y: "rS3EpGzQJkns8sOhRcBNdLKz8uv_IMSOEXYDD9zsNLc",
};

type Env = Record<string, string | undefined>;
function env(): Env {
  return (typeof process !== "undefined" && process.env) || {};
}

// ── classification ─────────────────────────────────────────────────────────
const AUTOMATION_UA =
  /\b(curl|wget|python-requests|python-urllib|aiohttp|httpx|go-http-client|okhttp|java\/|apache-httpclient|libwww-perl|node-fetch|axios|undici|got\/|httpie|postman|insomnia|headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|scrapy|colly|mechanize|guzzlehttp|powershell|deno\/|bun\/)/i;
const CRAWLER_UA =
  /(bot\b|bot\/|crawler|spider|crawl|slurp|scraper|fetcher|preview|facebookexternalhit|gptbot|chatgpt-user|claudebot|anthropic-ai|ccbot|bytespider|perplexity|google-extended|applebot|diffbot|cohere-ai|meta-externalagent|youbot|omgili|imagesift|petalbot|dataforseo|awario|seekport|semrush|ahrefs|mj12|dotbot|amazonbot)/i;

export type BotSignals = { isBot: boolean; signals: string[] };

export function classifyRequest(req: Request): BotSignals {
  const ua = req.headers.get("user-agent") ?? "";
  const signals: string[] = [];
  if (!ua.trim()) signals.push("no-user-agent");
  else {
    if (AUTOMATION_UA.test(ua)) signals.push("automation-tool");
    if (CRAWLER_UA.test(ua)) signals.push("crawler");
    if (!/^Mozilla\/5\.0 /.test(ua)) signals.push("not-a-browser");
  }
  // Real browsers (and WebViews) always send at least one of these.
  const hasBrowserHeaders = req.headers.has("accept-language") || req.headers.has("sec-fetch-mode");
  if (!hasBrowserHeaders) signals.push("missing-browser-headers");
  return { isBot: signals.length > 0, signals };
}

// ── helpers ────────────────────────────────────────────────────────────────
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function lower(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
}

// ── owner signatures (ECDSA P-256, verify-only) ────────────────────────────
type Signed = { k: string; e: number; [field: string]: unknown };

let ownerKeyPromise: Promise<CryptoKey | null> | null = null;
function ownerKey(jwk: JsonWebKey | null): Promise<CryptoKey | null> {
  if (jwk !== OWNER_PUBLIC_KEY_JWK) return importOwnerKey(jwk); // tests pass their own key
  ownerKeyPromise ??= importOwnerKey(jwk);
  return ownerKeyPromise;
}
async function importOwnerKey(jwk: JsonWebKey | null): Promise<CryptoKey | null> {
  if (!jwk) return null;
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}

/** v2.<payload b64url JSON>.<sig b64url, 64-byte r||s> → payload, or null. */
export async function verifyOwnerSigned(
  token: string,
  kind: string,
  jwk: JsonWebKey | null = OWNER_PUBLIC_KEY_JWK,
  now = Date.now() / 1000,
): Promise<{ ok: true; payload: Signed } | { ok: false; reason: string }> {
  const key = await ownerKey(jwk);
  if (!key) return { ok: false, reason: "owner-key-not-installed" };
  const m = /^v2\.([A-Za-z0-9_-]{8,4000})\.([A-Za-z0-9_-]{86})$/.exec(token.trim());
  if (!m) return { ok: false, reason: `${kind}-malformed` };
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    b64urlToBytes(m[2]),
    enc.encode(`v2.${m[1]}`),
  );
  if (!ok) return { ok: false, reason: `${kind}-signature` };
  let payload: Signed;
  try {
    payload = JSON.parse(dec.decode(b64urlToBytes(m[1])));
  } catch {
    return { ok: false, reason: `${kind}-malformed` };
  }
  if (payload.k !== kind) return { ok: false, reason: `${kind}-wrong-kind` };
  if (typeof payload.e !== "number" || payload.e < now)
    return { ok: false, reason: `${kind}-expired` };
  return { ok: true, payload };
}

export type GatePolicy = {
  githubRepos: string[];
  crawlers: string[];
  revoked: string[];
  ok: boolean;
  reason?: string;
};
const EMPTY_POLICY: GatePolicy = { githubRepos: [], crawlers: [], revoked: [], ok: false };
let policyCache: { raw: string; at: number; p: GatePolicy } | null = null;

export async function loadPolicy(
  e: Env,
  jwk: JsonWebKey | null = OWNER_PUBLIC_KEY_JWK,
): Promise<GatePolicy> {
  const raw = e.VB_GATE_POLICY ?? "";
  if (!raw) return { ...EMPTY_POLICY, reason: "policy-missing" };
  if (
    policyCache &&
    policyCache.raw === raw &&
    Date.now() - policyCache.at < 60_000 &&
    jwk === OWNER_PUBLIC_KEY_JWK
  )
    return policyCache.p;
  const r = await verifyOwnerSigned(raw, "policy", jwk);
  const p: GatePolicy = r.ok
    ? {
        ok: true,
        githubRepos: lower(r.payload.githubRepos),
        crawlers: lower(r.payload.crawlers),
        revoked: lower(r.payload.revoked),
      }
    : { ...EMPTY_POLICY, reason: r.reason };
  if (jwk === OWNER_PUBLIC_KEY_JWK) policyCache = { raw, at: Date.now(), p };
  return p;
}

// ── door 1: Navi Pass ──────────────────────────────────────────────────────
export async function verifyNaviPass(
  pass: string,
  policy: GatePolicy,
  jwk: JsonWebKey | null = OWNER_PUBLIC_KEY_JWK,
): Promise<{ ok: boolean; who?: string; reason?: string }> {
  const r = await verifyOwnerSigned(pass, "pass", jwk);
  if (!r.ok) return { ok: false, reason: r.reason };
  const name = String(r.payload.n ?? "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(name)) return { ok: false, reason: "pass-malformed" };
  if (policy.revoked.includes(name)) return { ok: false, reason: "pass-revoked" };
  return { ok: true, who: `pass:${name}` };
}

// ── door 2: GitHub Actions OIDC, repo must be in the signed policy ─────────
const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
export const GITHUB_AUDIENCE = "pokedex-hub-navi-gate";
let jwksCache: { at: number; keys: JsonWebKey[] } | null = null;

async function githubJwks(force = false): Promise<JsonWebKey[]> {
  if (!force && jwksCache && Date.now() - jwksCache.at < 10 * 60_000) return jwksCache.keys;
  const res = await fetch(`${GITHUB_ISSUER}/.well-known/jwks`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const body = (await res.json()) as { keys: JsonWebKey[] };
  jwksCache = { at: Date.now(), keys: body.keys ?? [] };
  return jwksCache.keys;
}

export async function verifyGithubOidc(
  token: string,
  policy: GatePolicy,
  now = Date.now() / 1000,
  jwks: (force: boolean) => Promise<JsonWebKey[]> = githubJwks,
): Promise<{ ok: boolean; who?: string; reason?: string }> {
  if (!policy.githubRepos.length) return { ok: false, reason: "github-no-repos-approved" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "github-token-malformed" };
  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(dec.decode(b64urlToBytes(parts[0])));
    claims = JSON.parse(dec.decode(b64urlToBytes(parts[1])));
  } catch {
    return { ok: false, reason: "github-token-malformed" };
  }
  if (header.alg !== "RS256") return { ok: false, reason: "github-token-alg" };
  const byKid = (keys: JsonWebKey[]) =>
    keys.find((k) => (k as { kid?: string }).kid === header.kid);
  const jwk = byKid(await jwks(false)) ?? byKid(await jwks(true));
  if (!jwk) return { ok: false, reason: "github-token-unknown-key" };
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    enc.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) return { ok: false, reason: "github-token-signature" };
  if (claims.iss !== GITHUB_ISSUER) return { ok: false, reason: "github-token-issuer" };
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!auds.includes(GITHUB_AUDIENCE)) return { ok: false, reason: "github-token-audience" };
  if (typeof claims.exp !== "number" || claims.exp < now)
    return { ok: false, reason: "github-token-expired" };
  if (typeof claims.nbf === "number" && claims.nbf > now + 60)
    return { ok: false, reason: "github-token-not-yet-valid" };
  const repo = String(claims.repository ?? "").toLowerCase();
  if (!policy.githubRepos.includes(repo)) return { ok: false, reason: "github-repo-not-approved" };
  return { ok: true, who: `github:${repo}` };
}

// ── door 3: crawler in the signed policy, proven by reverse + forward DNS ──
const CRAWLERS: Record<string, { ua: RegExp; hosts: RegExp }> = {
  google: {
    ua: /Googlebot|Google-InspectionTool|GoogleOther/i,
    hosts: /\.(googlebot|google)\.com$/i,
  },
  bing: { ua: /bingbot|BingPreview/i, hosts: /\.search\.msn\.com$/i },
  apple: { ua: /Applebot/i, hosts: /\.applebot\.apple\.com$/i },
};

async function doh(name: string, type: "PTR" | "A"): Promise<string[]> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(2500),
    },
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { Answer?: { data: string }[] };
  return (body.Answer ?? []).map((a) => a.data.replace(/\.$/, ""));
}

async function verifyCrawler(
  req: Request,
  ip: string,
  policy: GatePolicy,
): Promise<{ ok: boolean; who?: string }> {
  if (!policy.crawlers.length || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return { ok: false };
  const ua = req.headers.get("user-agent") ?? "";
  const id = policy.crawlers.find((c) => CRAWLERS[c]?.ua.test(ua));
  if (!id) return { ok: false };
  const rev = ip.split(".").reverse().join(".") + ".in-addr.arpa";
  for (const host of (await doh(rev, "PTR")).filter((h) => CRAWLERS[id].hosts.test(h))) {
    if ((await doh(host, "A")).includes(ip)) return { ok: true, who: `crawler:${id}` };
  }
  return { ok: false };
}

// ── KM Command Virus Buster feed + Decoherence ban list ────────────────────
const recentLogs = new Map<string, number>();

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    ""
  );
}

function feedConfig(e: Env) {
  const url = e.VB_GATE_SUPABASE_URL || e.QUOTA_SUPABASE_URL;
  const anon = e.VB_GATE_SUPABASE_ANON_KEY || e.QUOTA_SUPABASE_ANON_KEY;
  const secret = e.VB_LOG_SECRET;
  return url && anon && secret ? { url, anon, secret } : null;
}

async function rpc(
  e: Env,
  fn: string,
  body: object,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  const c = feedConfig(e);
  if (!c) return null;
  const res = await fetch(`${c.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: c.anon,
      authorization: `Bearer ${c.anon}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_secret: c.secret, ...body }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
}

// Decoherence's ban list is shared by every gated app. Cached 60s per instance.
// If the list can't be fetched the gate keeps its last copy (or none) — an
// outage at the feed never takes the site down for humans.
let bans: { at: number; ips: Set<string> } = { at: 0, ips: new Set() };
let bansInflight: Promise<void> | null = null;

async function isDeleted(ip: string, e: Env): Promise<boolean> {
  if (!ip || !feedConfig(e)) return false;
  if (Date.now() - bans.at > 60_000) {
    bansInflight ??= rpc(e, "vb_gate_banlist", {}, 1200)
      .then((r) => {
        if (r?.ok && Array.isArray(r.ips))
          bans = { at: Date.now(), ips: new Set(r.ips.map(String)) };
        else bans.at = Date.now() - 45_000; // retry in ~15s
      })
      .catch(() => {
        bans.at = Date.now() - 45_000;
      })
      .finally(() => {
        bansInflight = null;
      });
    await bansInflight;
  }
  return bans.ips.has(ip);
}

/** Report a block. Decoherence answers with a ban when the IP earned one. */
export async function reportBlock(
  req: Request,
  reason: string,
  signals: string[] = [],
  e: Env = env(),
): Promise<void> {
  const ip = clientIp(req);
  if (!ip) return;
  const path = new URL(req.url).pathname;
  // Same bot hammering the same path: one row per minute per instance, not thousands.
  const dedupe = `${ip}|${path}|${reason}`;
  if (Date.now() - (recentLogs.get(dedupe) ?? 0) < 60_000) return;
  if (recentLogs.size > 2000) recentLogs.clear();
  recentLogs.set(dedupe, Date.now());
  try {
    const r = await rpc(
      e,
      "vb_log_gate_event",
      {
        p_app: "pokedex-hub",
        p_navi: GATE_NAVI,
        p_ip: ip,
        p_method: req.method,
        p_path: path,
        p_user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
        p_reason: reason,
        p_signals: signals,
      },
      1500,
    );
    if (r?.banned) bans.ips.add(ip);
  } catch {
    /* the feed is best-effort; the block already happened */
  }
}

// ── the gate ───────────────────────────────────────────────────────────────
export type GateVerdict =
  | { allow: true; who: string }
  | { allow: false; reason: string; signals: string[]; deleted?: boolean };

const verdicts = new WeakMap<Request, Promise<GateVerdict>>();

export function checkGate(req: Request, e: Env = env()): Promise<GateVerdict> {
  // server.ts and the start middleware can both see the same Request — check it once.
  let v = verdicts.get(req);
  if (!v) {
    v = runGate(req, e);
    verdicts.set(req, v);
  }
  return v;
}

async function runGate(req: Request, e: Env): Promise<GateVerdict> {
  if (req.method === "OPTIONS") return { allow: true, who: "preflight" };
  const ip = clientIp(req);
  const pass = req.headers.get("x-navi-pass");
  let policy: GatePolicy | null = null;
  const getPolicy = async () =>
    (policy ??= await loadPolicy(e).catch(() => ({ ...EMPTY_POLICY, reason: "policy-error" })));
  const passCheck = async () =>
    pass
      ? verifyNaviPass(pass, await getPolicy()).catch(
          () => ({ ok: false, reason: "pass-verify-error" }) as const,
        )
      : null;

  // Deleted by Decoherence: nobody from this IP gets in, browser or not —
  // except the owner's own Touch ID-signed pass.
  if (await isDeleted(ip, e)) {
    const r = await passCheck();
    if (r?.ok) return { allow: true, who: r.who! };
    return { allow: false, reason: "deleted-by-decoherence", signals: [], deleted: true };
  }

  const { isBot, signals } = classifyRequest(req);
  if (!isBot) return { allow: true, who: "human" };

  let reason = "bot-without-owner-approval";
  const r1 = await passCheck();
  if (r1?.ok) return { allow: true, who: r1.who! };
  if (r1) reason = r1.reason ?? reason;

  const gh = req.headers.get("x-github-oidc");
  if (gh) {
    const r = await verifyGithubOidc(gh, await getPolicy()).catch(
      () => ({ ok: false, reason: "github-verify-error" }) as const,
    );
    if (r.ok) return { allow: true, who: r.who! };
    reason = r.reason ?? reason;
  }
  const crawler = await verifyCrawler(req, ip, await getPolicy()).catch(
    () => ({ ok: false }) as { ok: boolean; who?: string },
  );
  if (crawler.ok) return { allow: true, who: crawler.who! };

  await reportBlock(req, reason, signals, e);
  return { allow: false, reason, signals };
}
