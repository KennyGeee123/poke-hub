// Navi Deploy Gate — runs before every build ("prebuild"). A PRODUCTION build stops
// unless it carries a deploy ticket that Kenneth signed with Touch ID for this exact code.
// Preview and local builds are not affected.
//
// Sign one (on Kenneth's Mac):
//   node ~/kmcommand2/netnavi-core/ops/navi-gate-pass.mjs deploy-ticket <this app dir>
// then deploy within the ticket's window. Decoherence (KM Command) also watches the live
// site and rolls back any production deploy that got out without a valid ticket.
import { createPublicKey, verify } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deployHash, TICKET_PATH } from "./navi-deploy-hash.mjs";

// Same owner key as the Navi Gate (src/lib/bot-gate.ts OWNER_PUBLIC_KEY_JWK).
const OWNER_PUBLIC_KEY_JWK = {
  kty: "EC",
  crv: "P-256",
  x: "yZwTLQ62-hcdVyVnKdzIA8xFQm8cbqBEaSHeAZQB7wE",
  y: "rS3EpGzQJkns8sOhRcBNdLKz8uv_IMSOEXYDD9zsNLc",
};
const PROJECT = "pokedex-hub";

export function checkTicket(token, hash, now = Math.floor(Date.now() / 1000)) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== "v2") return { ok: false, reason: "not a v2 ticket" };
  const body = `${parts[0]}.${parts[1]}`;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch {
    return { ok: false, reason: "unreadable ticket" };
  }
  const key = createPublicKey({ key: OWNER_PUBLIC_KEY_JWK, format: "jwk" });
  const good = verify("sha256", Buffer.from(body), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(parts[2], "base64url"));
  if (!good) return { ok: false, reason: "signature is not Kenneth's owner key" };
  if (payload.k !== "deploy") return { ok: false, reason: "not a deploy ticket" };
  if (payload.p !== PROJECT) return { ok: false, reason: `ticket is for project ${payload.p}` };
  if (!(payload.e > now)) return { ok: false, reason: "ticket expired" };
  if (hash && payload.h !== hash) return { ok: false, reason: "ticket was signed for different code" };
  return { ok: true, payload };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = process.env.VERCEL_ENV;
  const appDir = process.cwd();
  if (env !== "production") {
    const d = deployHash(appDir);
    console.log(`[navi-deploy-gate] ${env || "local"} build: no ticket needed. code ${d.hash.slice(0, 12)} groups ${JSON.stringify(d.groups)}`);
    process.exit(0);
  }
  let ticket = null;
  try {
    ticket = JSON.parse(fs.readFileSync(path.join(appDir, TICKET_PATH), "utf8"));
  } catch {
    /* no ticket */
  }
  const { hash, files, groups } = deployHash(appDir);
  const r = ticket ? checkTicket(ticket.ticket, hash) : { ok: false, reason: "no deploy ticket" };
  if (!r.ok) {
    console.error(`\n[navi-deploy-gate] PRODUCTION DEPLOY BLOCKED by Decoherence: ${r.reason}.`);
    console.error("[navi-deploy-gate] Production needs Kenneth's Touch ID. On his Mac run:");
    console.error("[navi-deploy-gate]   node ~/kmcommand2/netnavi-core/ops/navi-gate-pass.mjs deploy-ticket <app dir>");
    console.error(`[navi-deploy-gate] code fingerprint ${hash.slice(0, 12)} over ${files} files`);
    if (ticket && ticket.groups) {
      const diff = Object.keys({ ...groups, ...ticket.groups }).filter((k) => groups[k] !== ticket.groups[k]);
      console.error(`[navi-deploy-gate] differs from the signed code in: ${diff.join(", ") || "(none)"}`);
    }
    console.error("");
    process.exit(1);
  }
  console.log(`[navi-deploy-gate] Touch ID ticket OK (signed ${new Date(r.payload.i * 1000).toISOString()}, code ${hash.slice(0, 12)}).`);
}
