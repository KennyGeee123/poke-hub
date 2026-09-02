#!/usr/bin/env node
// Re-hash the launch-ready tree against WORKING-STATE.json.
// Exit 0 = clean (logical |0⟩). Exit 2 = drift / hacky edit (logical |1⟩).
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const statePath = path.join(here, "WORKING-STATE.json");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

const rebaseline = process.argv.includes("--rebaseline");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const mismatches = [];
const missing = [];
for (const f of state.files) {
  const abs = path.join(root, f.path);
  if (!fs.existsSync(abs)) {
    missing.push(f.path);
    continue;
  }
  const hash = sha256(fs.readFileSync(abs));
  if (hash !== f.sha256) mismatches.push({ path: f.path, expected: f.sha256, actual: hash });
}

if (rebaseline) {
  console.error("Refusing silent rebaseline. Rebuild WORKING-STATE.json from a verified live launch, then git tag.");
  process.exit(3);
}

const ok = mismatches.length === 0 && missing.length === 0;
const report = {
  ok,
  id: state.id,
  liveUrl: state.liveUrl,
  frozenAt: state.frozenAt,
  rootSha256: state.rootSha256,
  checked: state.files.length,
  mismatches,
  missing,
  logical: ok ? 0 : 1,
};
console.log(JSON.stringify(report, null, 2));
process.exit(ok ? 0 : 2);
