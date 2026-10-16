import { describe, expect, test } from "bun:test";
import {
  classifyRequest,
  checkGate,
  loadPolicy,
  verifyGithubOidc,
  verifyNaviPass,
  verifyOwnerSigned,
  GITHUB_AUDIENCE,
  type GatePolicy,
} from "./bot-gate";

const enc = new TextEncoder();
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const owner = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const ownerPub = await crypto.subtle.exportKey("jwk", owner.publicKey);
const intruder = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);

async function sign(payload: object, key = owner.privateKey) {
  const body = `v2.${b64url(enc.encode(JSON.stringify(payload)))}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(body));
  return `${body}.${b64url(sig)}`;
}
const future = () => Math.floor(Date.now() / 1000) + 3600;
const policy = (p: Partial<GatePolicy> = {}): GatePolicy => ({
  ok: true,
  githubRepos: [],
  crawlers: [],
  revoked: [],
  ...p,
});

const SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const IOS_WEBVIEW =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const req = (headers: Record<string, string>, url = "https://x.test/api/public/tcg") =>
  new Request(url, { headers });

describe("Navi Gate classification", () => {
  test("real browsers and the app WebView are human", () => {
    expect(classifyRequest(req({ "user-agent": SAFARI, "accept-language": "en-US" })).isBot).toBe(
      false,
    );
    expect(
      classifyRequest(req({ "user-agent": IOS_WEBVIEW, "accept-language": "en-US" })).isBot,
    ).toBe(false);
  });
  test("scripts, crawlers, headless tools and header-less clients are bots", () => {
    for (const ua of [
      "curl/8.7.1",
      "python-requests/2.32",
      "Go-http-client/2.0",
      "GPTBot/1.2",
      "Scrapy/2.11",
    ]) {
      expect(classifyRequest(req({ "user-agent": ua, "accept-language": "en" })).isBot).toBe(true);
    }
    expect(
      classifyRequest(
        req({ "user-agent": "Mozilla/5.0 (X11) HeadlessChrome/130.0", "accept-language": "en" }),
      ).isBot,
    ).toBe(true);
    expect(
      classifyRequest(
        req({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)", "accept-language": "en" }),
      ).isBot,
    ).toBe(true);
    expect(classifyRequest(req({ "user-agent": SAFARI })).signals).toContain(
      "missing-browser-headers",
    );
    expect(classifyRequest(req({})).signals).toContain("no-user-agent");
  });
});

describe("Navi Gate owner signatures", () => {
  test("owner-signed pass is accepted", async () => {
    const pass = await sign({ k: "pass", n: "km-qe-check", e: future() });
    expect(await verifyNaviPass(pass, policy(), ownerPub)).toEqual({
      ok: true,
      who: "pass:km-qe-check",
    });
  });
  test("pass signed by any other key is rejected", async () => {
    const pass = await sign({ k: "pass", n: "evil", e: future() }, intruder.privateKey);
    expect((await verifyNaviPass(pass, policy(), ownerPub)).reason).toBe("pass-signature");
  });
  test("tampered payload is rejected", async () => {
    const pass = await sign({ k: "pass", n: "good", e: future() });
    const [v, , s] = pass.split(".");
    const forged = `${v}.${b64url(enc.encode(JSON.stringify({ k: "pass", n: "good", e: future() + 999999 })))}.${s}`;
    expect((await verifyNaviPass(forged, policy(), ownerPub)).reason).toBe("pass-signature");
  });
  test("expired, revoked and wrong-kind passes are rejected", async () => {
    const old = await sign({ k: "pass", n: "x", e: 1000 });
    expect((await verifyNaviPass(old, policy(), ownerPub)).reason).toBe("pass-expired");
    const p = await sign({ k: "pass", n: "x", e: future() });
    expect((await verifyNaviPass(p, policy({ revoked: ["x"] }), ownerPub)).reason).toBe(
      "pass-revoked",
    );
    const pol = await sign({ k: "policy", n: "x", e: future() });
    expect((await verifyNaviPass(pol, policy(), ownerPub)).reason).toBe("pass-wrong-kind");
  });
  test("no owner key installed → everything fails closed", async () => {
    const pass = await sign({ k: "pass", n: "x", e: future() });
    expect((await verifyOwnerSigned(pass, "pass", null)).ok).toBe(false);
  });
  test("policy must be owner-signed", async () => {
    const good = await sign({
      k: "policy",
      e: future(),
      githubRepos: ["KennyGeee123/poke-hub"],
      crawlers: [],
      revoked: [],
    });
    expect((await loadPolicy({ VB_GATE_POLICY: good }, ownerPub)).githubRepos).toEqual([
      "kennygeee123/poke-hub",
    ]);
    const bad = await sign(
      { k: "policy", e: future(), githubRepos: ["attacker/repo"] },
      intruder.privateKey,
    );
    const p = await loadPolicy({ VB_GATE_POLICY: bad }, ownerPub);
    expect(p.ok).toBe(false);
    expect(p.githubRepos).toEqual([]);
    expect((await loadPolicy({}, ownerPub)).ok).toBe(false);
  });
});

describe("Navi Gate GitHub door", async () => {
  const gh = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const ghJwk = { ...(await crypto.subtle.exportKey("jwk", gh.publicKey)), kid: "k1" };
  const jwks = async () => [ghJwk];
  async function oidc(claims: object) {
    const h = b64url(enc.encode(JSON.stringify({ alg: "RS256", kid: "k1" })));
    const c = b64url(enc.encode(JSON.stringify(claims)));
    const s = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", gh.privateKey, enc.encode(`${h}.${c}`));
    return `${h}.${c}.${b64url(s)}`;
  }
  const base = {
    iss: "https://token.actions.githubusercontent.com",
    aud: GITHUB_AUDIENCE,
    exp: future(),
    repository: "KennyGeee123/poke-hub",
  };

  test("approved repo passes", async () => {
    const r = await verifyGithubOidc(
      await oidc(base),
      policy({ githubRepos: ["kennygeee123/poke-hub"] }),
      undefined,
      jwks,
    );
    expect(r).toEqual({ ok: true, who: "github:kennygeee123/poke-hub" });
  });
  test("unapproved repo, wrong audience, expired, or no policy are rejected", async () => {
    const pol = policy({ githubRepos: ["kennygeee123/poke-hub"] });
    expect(
      (
        await verifyGithubOidc(
          await oidc({ ...base, repository: "someone/else" }),
          pol,
          undefined,
          jwks,
        )
      ).reason,
    ).toBe("github-repo-not-approved");
    expect(
      (await verifyGithubOidc(await oidc({ ...base, aud: "other" }), pol, undefined, jwks)).reason,
    ).toBe("github-token-audience");
    expect(
      (await verifyGithubOidc(await oidc({ ...base, exp: 1000 }), pol, undefined, jwks)).reason,
    ).toBe("github-token-expired");
    expect((await verifyGithubOidc(await oidc(base), policy(), undefined, jwks)).reason).toBe(
      "github-no-repos-approved",
    );
  });
});

describe("Navi Gate end to end", () => {
  test("humans pass, bots without approval are blocked", async () => {
    expect(
      (await checkGate(req({ "user-agent": SAFARI, "accept-language": "en-US" }), {})).allow,
    ).toBe(true);
    const v = await checkGate(req({ "user-agent": "curl/8.7.1" }), {});
    expect(v.allow).toBe(false);
  });
  test("a forged pass header does not get a bot in", async () => {
    const v = await checkGate(
      req({ "user-agent": "curl/8.7.1", "x-navi-pass": "v2.AAAAAAAAAA." + "A".repeat(86) }),
      {},
    );
    expect(v.allow).toBe(false);
  });
});

describe("Decoherence delete", () => {
  const feedEnv = {
    VB_GATE_SUPABASE_URL: "https://feed.test",
    VB_GATE_SUPABASE_ANON_KEY: "anon",
    VB_LOG_SECRET: "s".repeat(40),
  };
  const realFetch = globalThis.fetch;
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  test("a deleted IP is stopped even with a real browser; other IPs are not", async () => {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const fn = String(url).split("/rpc/")[1];
      calls.push({ fn, body: JSON.parse(String(init?.body ?? "{}")) });
      if (fn === "vb_gate_banlist") return Response.json({ ok: true, ips: ["203.0.113.5"] });
      return Response.json({ ok: true, banned: false });
    }) as typeof fetch;
    try {
      const browser = { "user-agent": SAFARI, "accept-language": "en-US" };
      const banned = await checkGate(req({ ...browser, "x-real-ip": "203.0.113.5" }), feedEnv);
      expect(banned).toMatchObject({
        allow: false,
        reason: "deleted-by-decoherence",
        deleted: true,
      });
      expect(
        (await checkGate(req({ ...browser, "x-real-ip": "198.51.100.1" }), feedEnv)).allow,
      ).toBe(true);
      const bot = await checkGate(
        req({ "user-agent": "curl/8.7.1", "x-real-ip": "198.51.100.2" }),
        feedEnv,
      );
      expect(bot.allow).toBe(false);
      const logged = calls.find((c) => c.fn === "vb_log_gate_event");
      expect(logged?.body).toMatchObject({
        p_ip: "198.51.100.2",
        p_navi: "Decoherence",
        p_app: "pokedex-hub",
      });
      expect(calls.filter((c) => c.fn === "vb_gate_banlist").length).toBe(1); // cached, not per request
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
