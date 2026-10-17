// Navi Deploy Gate — content fingerprint of what a production deploy ships.
// The SAME function runs on Kenneth's Mac when he signs a deploy ticket with Touch ID
// (kmcommand2/netnavi-core/ops/navi-gate-pass.mjs deploy-ticket) and on Vercel's build
// machine (scripts/navi-deploy-guard.mjs), so a ticket only fits the exact code it was
// signed for. Generated files and the ticket itself are left out.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const TICKET_PATH = "public/.well-known/navi-deploy-ticket.json";
const ROOTS = ["src", "public", "scripts"];
const TOP_FILES = ["package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "vercel.json"];
// mirrors .vercelignore + files a build regenerates
const SKIP = [/(^|\/)node_modules(\/|$)/, /(^|\/)\.DS_Store$/, /\.log$/, /^public\/fx(\/|$)/, /^src\/routeTree\.gen\.ts$/];

function walk(dir, root, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (rel === TICKET_PATH || SKIP.some((re) => re.test(rel))) continue;
    if (ent.isDirectory()) walk(abs, root, out);
    else if (ent.isFile()) out.push(rel);
  }
}

// vercel.json is fingerprinted by its parsed meaning (sorted keys, minus the "name"/"version"
// the Vercel CLI injects on upload); whitespace/key order must not void a ticket, any real change does.
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v;
}
function contentFor(appDir, f) {
  const buf = fs.readFileSync(path.join(appDir, f));
  if (f !== "vercel.json") return buf;
  try {
    const j = JSON.parse(buf.toString("utf8"));
    // keys the Vercel CLI injects on upload (seen 2026-10-16: "name": project, "version": 2)
    delete j.name;
    delete j.version;
    return Buffer.from(JSON.stringify(canonical(j)));
  } catch {
    return buf;
  }
}

/** sha256 over sorted "path\0sha256(file)\n" lines. */
export function deployHash(appDir) {
  const files = [];
  for (const r of ROOTS) if (fs.existsSync(path.join(appDir, r))) walk(path.join(appDir, r), appDir, files);
  for (const f of TOP_FILES) if (fs.existsSync(path.join(appDir, f))) files.push(f);
  files.sort();
  const h = createHash("sha256");
  const g = {}; // per-group fingerprints, for diagnosing a mismatch (never trusted for approval)
  for (const f of files) {
    const fh = createHash("sha256").update(contentFor(appDir, f)).digest("hex");
    h.update(`${f}\0${fh}\n`);
    const group = ROOTS.includes(f.split("/")[0]) ? f.split("/").slice(0, 2).join("/") : f;
    (g[group] ||= createHash("sha256")).update(`${f}\0${fh}\n`);
  }
  const groups = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.digest("hex").slice(0, 12)]));
  return { hash: h.digest("hex"), files: files.length, groups };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(deployHash(process.argv[2] || process.cwd())));
}
