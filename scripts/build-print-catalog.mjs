#!/usr/bin/env node
// Build public/asia-catalog.json from a local tcgdex/cards-database checkout.
// Source: TCGDEX_DATA (default /tmp/tcgdex-cards)
import fs from "node:fs";
import path from "node:path";

const SRC = process.env.TCGDEX_DATA || "/tmp/tcgdex-cards";
const OUT = path.resolve("public/asia-catalog.json");
const NAME_LANGS = new Set(["en", "fr", "es", "de", "it", "pt", "ja", "ko", "zh-tw", "zh-cn", "th", "id"]);

const ASIA_SERIES = [
  ["data-asia/SV", "SV", "asia"],
  ["data-asia/S", "S", "asia"],
  ["data-asia/SM", "SM", "asia"],
];
const INTL_SERIES = [
  ["data/Scarlet & Violet", "Scarlet & Violet", "intl"],
];

function read(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

function parseObj(block) {
  const out = {};
  if (!block) return out;
  for (const m of block.matchAll(/['"]?([a-z][a-z0-9-]*)['"]?\s*:\s*['"]([^'"]+)['"]/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

function firstBrace(ts, key) {
  const re = new RegExp(`${key}\\s*:\\s*\\{`);
  const m = ts.match(re);
  if (!m || m.index == null) return "";
  const start = ts.indexOf("{", m.index);
  let depth = 0;
  for (let i = start; i < ts.length; i++) {
    const ch = ts[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return ts.slice(start + 1, i);
    }
  }
  return "";
}

function pickLangs(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (NAME_LANGS.has(k) && v) out[k] = v;
  }
  return out;
}

function parseSet(ts, fallbackId, serie, region) {
  const id = (ts.match(/id:\s*['"]([^'"]+)['"]/) || [])[1] || fallbackId;
  const official = Number((ts.match(/official:\s*(\d+)/) || [])[1] || 0) || 0;
  const names = pickLangs(parseObj(firstBrace(ts, "name")));
  let releaseDate = "";
  const rd = ts.match(/releaseDate:\s*['"](\d{4}-\d{2}-\d{2})['"]/);
  if (rd) releaseDate = rd[1];
  else {
    const rdo = parseObj(firstBrace(ts, "releaseDate"));
    releaseDate = rdo.ja || rdo.en || rdo["zh-tw"] || Object.values(rdo)[0] || "";
  }
  return { id, official, names, serie, region, releaseDate };
}

function parseCard(ts) {
  const names = pickLangs(parseObj(firstBrace(ts, "name")));
  const rarity = (ts.match(/rarity:\s*['"]([^'"]+)['"]/) || [])[1] || "";
  const hpM = ts.match(/\bhp:\s*(\d+)/);
  const dex = [...ts.matchAll(/dexId:\s*\[([^\]]+)\]/g)].flatMap((m) =>
    m[1].split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0),
  );
  const typesM = ts.match(/types:\s*\[([^\]]+)\]/);
  const types = typesM ? [...typesM[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]) : [];
  const illustrator = (ts.match(/illustrator:\s*['"]([^'"]+)['"]/) || [])[1] || "";
  const ids = [...ts.matchAll(/tcgplayer:\s*(\d+)/g)].map((m) => Number(m[1]));
  const cms = [...ts.matchAll(/cardmarket:\s*(\d+)/g)].map((m) => Number(m[1]));
  const category = (ts.match(/category:\s*['"]([^'"]+)['"]/) || [])[1] || "";
  return {
    names,
    rarity,
    hp: hpM ? Number(hpM[1]) : null,
    dex,
    types,
    illustrator,
    tcgplayer: ids[0] || null,
    cardmarket: cms[0] || null,
    category,
  };
}

function walkSeries(rel, serie, region, sets, cards) {
  const dir = path.join(SRC, rel);
  if (!fs.existsSync(dir)) {
    console.log("missing", dir);
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));
  for (const f of files) {
    const fallbackId = f.replace(/\.ts$/, "");
    const ts = read(path.join(dir, f));
    if (!ts.includes("id:")) continue;
    const s = parseSet(ts, fallbackId, serie, region);
    sets.push(s);
    const cardDir = path.join(dir, fallbackId);
    if (!fs.existsSync(cardDir) || !fs.statSync(cardDir).isDirectory()) continue;
    for (const cf of fs.readdirSync(cardDir)) {
      if (!/^\d/.test(cf) || !cf.endsWith(".ts")) continue;
      const cts = read(path.join(cardDir, cf));
      if (!cts) continue;
      const c = parseCard(cts);
      const localId = cf.replace(/\.ts$/, "");
      cards.push({ id: `${s.id}-${localId}`, localId, setId: s.id, serie, region, ...c });
    }
  }
}

if (!fs.existsSync(path.join(SRC, "data-asia"))) {
  console.error("No tcgdex checkout at", SRC);
  process.exit(1);
}

const sets = [];
const cards = [];
for (const [rel, serie, region] of [...ASIA_SERIES, ...INTL_SERIES]) {
  const before = cards.length;
  walkSeries(rel, serie, region, sets, cards);
  console.log(rel, "sets", sets.filter((s) => s.serie === serie && s.region === region).length, "cards", cards.length - before);
}

const vote = new Map();
for (const c of cards) {
  const d = c.dex?.[0];
  if (!d) continue;
  let langs = vote.get(d);
  if (!langs) { langs = new Map(); vote.set(d, langs); }
  for (const [k, v] of Object.entries(c.names || {})) {
    if (!v || /ex$/i.test(String(v).replace(/\s/g, "")) || /[&+]/.test(v) || /(?:^|\s)(V|GX|VMAX|VSTAR|ex)\b/i.test(v)) continue;
    let counts = langs.get(k);
    if (!counts) { counts = new Map(); langs.set(k, counts); }
    counts.set(v, (counts.get(v) || 0) + 1);
  }
}
const dexNames = {};
for (const [d, langs] of vote) {
  const names = {};
  for (const [lang, counts] of langs) {
    let best = "", n = 0;
    for (const [name, c] of counts) {
      if (c > n) { best = name; n = c; }
    }
    if (best) names[lang] = best;
  }
  if (Object.keys(names).length) dexNames[d] = names;
}

const compact = cards.map((c) => {
  const o = {
    id: c.id,
    localId: c.localId,
    setId: c.setId,
    serie: c.serie,
    region: c.region,
    names: c.names,
  };
  if (c.rarity) o.rarity = c.rarity;
  if (c.hp) o.hp = c.hp;
  if (c.dex?.length) o.dex = c.dex;
  if (c.types?.length) o.types = c.types;
  if (c.illustrator) o.illustrator = c.illustrator;
  if (c.tcgplayer) o.tcgplayer = c.tcgplayer;
  if (c.cardmarket) o.cardmarket = c.cardmarket;
  if (c.category) o.category = c.category;
  return o;
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  sets,
  dexNames,
  cards: compact,
}));
const bytes = fs.statSync(OUT).size;
const withTp = compact.filter((c) => c.tcgplayer).length;
console.log("WROTE", OUT);
console.log("sets", sets.length, "cards", compact.length, "with tcgplayer", withTp, "dex", Object.keys(dexNames).length);
console.log("bytes", bytes, "mb", (bytes / 1024 / 1024).toFixed(2));
