#!/usr/bin/env node
/**
 * Top up an upcoming (pre-release) set in src/lib/upcoming-sets.json.
 *
 *   node scripts/upcoming-topup.mjs                 # all upcoming sets, writes JSON + art
 *   node scripts/upcoming-topup.mjs --set me06 --dry-run   # report only (add --json for details)
 *
 * Sources, in order of trust:
 *   1. Bulbapedia "<Set> (TCG)" set list = the revealed English checklist (number/103, name,
 *      type, rarity) + each card page (illustrator, scan). Bulbapedia only lists a card once an
 *      English number is confirmed, so the Japanese list is never mapped onto English numbers.
 *   2. scripts/upcoming-topup.overrides.json = hand-verified English scans / credits.
 *   3. PokeBeach reveal articles: images whose file name says EN + number (ME06_EN_44, me06-en-012).
 * Bulbapedia scans whose upload comment points at a Japanese source (Storm Emeralda, ex Starter
 * Set, M-P Promo, pokemon-card.com) are kept as stand-ins and flagged artLang "ja".
 *
 * Never removes cards, never adds prices, never overwrites an English scan already shipped.
 * Also probes TCGdex English: once the set is live there, the app switches over by itself and
 * this script only reports it.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = join(ROOT, "src/lib/upcoming-sets.json");
const OVERRIDES_PATH = join(ROOT, "scripts/upcoming-topup.overrides.json");
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) PokeVaultTopup/1.0 (+https://pokedex-hub-lime.vercel.app)";
const BULBA = "https://bulbapedia.bulbagarden.net/w/api.php";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const onlySet = args.includes("--set") ? args[args.indexOf("--set") + 1] : null;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

const POKEMON_TYPES = new Set([
  "Grass",
  "Fire",
  "Water",
  "Lightning",
  "Psychic",
  "Fighting",
  "Darkness",
  "Metal",
  "Dragon",
  "Colorless",
  "Fairy",
]);
const TRAINER_KINDS = new Set(["Supporter", "Item", "Stadium", "Pokémon Tool", "Tool"]);
const JA_NOTE = "Japanese print scan (same illustration; English scan not posted yet)";
const JA_HINT =
  /storm emeralda|ex starter set|m-p promo|pokemon-card\.com|pokemon-infomation|japanese/i;

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, as = "text", tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Referer: new URL(url).origin + "/" },
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return as === "json"
        ? await r.json()
        : as === "buf"
          ? Buffer.from(await r.arrayBuffer())
          : await r.text();
    } catch (e) {
      if (i === tries - 1) {
        log(`  ! ${url}: ${e.message}`);
        return null;
      }
      await sleep(800 * (i + 1));
    }
  }
}

const bulba = (params) =>
  get(`${BULBA}?${new URLSearchParams({ format: "json", ...params })}`, "json");

function clean(s) {
  return (s || "")
    .replace(/\{\{OBP\|([^|}]+)\|[^}]*\}\}/g, "$1")
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** Bulbapedia set list rows: {{Setlist/entry|003/103|J|{{TCG ID|Delta Reign|Masquerain|3}}|Grass||Common}} */
function parseSetList(wikitext, title, printed) {
  const rows = [];
  const re =
    /\{\{Setlist\/entry\|([^|]+)\|[^|]*\|\{\{TCG ID\|([^|}]+)\|([^|}]+)\|(\d+)(?:\|[^}]*)?\}\}(?:\{\{[^}]*\}\})?\|([^|]*)\|\|([^}|]+)\}\}/g;
  for (const m of wikitext.matchAll(re)) {
    const [, numCell, setName, name, n, type, rarity] = m;
    if (setName.trim() !== title) continue;
    const num = (numCell.match(/^(\d+)\s*\/\s*(\d+)/) || [])[1];
    if (!num) continue;
    if (printed && !numCell.includes(`/${printed}`)) continue;
    rows.push({
      number: String(Number(num)).padStart(3, "0"),
      name: clean(name),
      type: type.trim(),
      rarity: rarity.trim(),
      page: `${clean(name)} (${title} ${Number(n)})`,
    });
  }
  return rows;
}

function field(w, k) {
  const m = w.match(new RegExp(`\\n\\|${k}=([^\\n]*)`));
  return m ? m[1].trim() : null;
}

/** Pick the scan + artist for this rarity from a Bulbapedia card page. */
function pickScan(w, rarity) {
  const cand = [[field(w, "image"), field(w, "caption") || ""]];
  for (let i = 1; i <= 6; i++) {
    const f = field(w, `reprint${i}`);
    if (f) cand.push([f, field(w, `recaption${i}`) || ""]);
  }
  const r = rarity.toLowerCase();
  let pick;
  if (r.includes("special illustration"))
    pick = cand.find((c) => /special illustration rare/i.test(c[1]));
  else if (r.includes("illustration rare"))
    pick = cand.find((c) => /illustration rare/i.test(c[1]) && !/special/i.test(c[1]));
  else if (r.includes("ultra rare")) pick = cand.find((c) => /ultra rare|full art/i.test(c[1]));
  else pick = cand[0];
  if (!pick || !pick[0]) return { file: null, artist: null };
  const am = pick[1].match(/Illus\.\s*(.*)$/);
  return { file: pick[0], artist: am ? clean(am[1]) : null };
}

function classify(type) {
  if (POKEMON_TYPES.has(type)) return { supertype: "Pokémon", types: [type] };
  if (TRAINER_KINDS.has(type))
    return { supertype: "Trainer", subtypes: [type === "Tool" ? "Pokémon Tool" : type] };
  if (/energy/i.test(type)) return { supertype: "Energy", subtypes: [type] };
  return { supertype: "Pokémon", types: type ? [type] : undefined };
}

async function fileInfo(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 40) {
    const chunk = files.slice(i, i + 40);
    const d = await bulba({
      action: "query",
      titles: chunk.map((f) => `File:${f}`).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|comment",
    });
    if (!d?.query) continue;
    const norm = new Map((d.query.normalized || []).map((n) => [n.to, n.from]));
    for (const p of Object.values(d.query.pages)) {
      const ii = p.imageinfo?.[0];
      const name = (norm.get(p.title) || p.title).replace(/^File:/, "");
      if (ii) out.set(name, { url: ii.url, w: ii.width, h: ii.height, comment: ii.comment || "" });
    }
  }
  return out;
}

/** EN scans on PokeBeach reveal posts, keyed by card number (file name must say EN). */
async function pokebeachEn(cfg, setId) {
  const found = new Map();
  const urls = new Set(cfg.pokebeachArticles || []);
  const home = await get("https://www.pokebeach.com/");
  if (home && cfg.pokebeachSlugMatch) {
    for (const m of home.matchAll(/https:\/\/www\.pokebeach\.com\/\d{4}\/\d{2}\/[a-z0-9-]+/g))
      if (m[0].includes(cfg.pokebeachSlugMatch)) urls.add(m[0]);
  }
  const code = setId.replace(/^([a-z]+)0?(\d+)$/i, "$1").toLowerCase();
  const num = setId.replace(/^[a-z]+/i, "");
  const re = new RegExp(
    `https://www\\.pokebeach\\.com/news/[^"' ]+/${code}0?${Number(num)}[_-]en[_-]0*(\\d{1,3})(?:[_-][^"'/ ]*)?\\.(?:png|jpe?g|webp|avif)`,
    "gi",
  );
  for (const u of urls) {
    const html = await get(u);
    if (!html) continue;
    for (const m of html.matchAll(re)) {
      if (/-\d{2,4}x\d{2,4}\.(png|jpe?g|webp|avif)$/i.test(m[0])) continue; // WordPress thumbnails
      const n = String(Number(m[1])).padStart(3, "0");
      if (!found.has(n)) found.set(n, { url: m[0], src: u });
    }
  }
  return { found, articles: [...urls] };
}

async function writeArt(setId, number, buf, { half } = {}) {
  let img = sharp(buf, { failOn: "none" });
  const meta = await img.metadata();
  if (half && meta.width > meta.height) {
    const w = Math.floor(meta.width / 2);
    img = sharp(buf).extract({
      left: half === "right" ? meta.width - w : 0,
      top: 0,
      width: w,
      height: meta.height,
    });
  }
  const dir = join(ROOT, "public/card-art", setId);
  mkdirSync(dir, { recursive: true });
  const base = await img.toBuffer();
  await sharp(base)
    .resize({ width: 245 })
    .webp({ quality: 80 })
    .toFile(join(dir, `${number}.webp`));
  await sharp(base)
    .resize({ width: 600 })
    .webp({ quality: 82 })
    .toFile(join(dir, `${number}_hires.webp`));
}

function summary(cards) {
  const art = cards.filter((c) => c.art);
  const ja = art.filter((c) => c.artLang === "ja").length;
  return { revealed: cards.length, en: art.length - ja, ja, pending: cards.length - art.length };
}

async function topUp(set, cfg) {
  log(`\n== ${set.fullName || set.name} (${set.id})`);
  const report = {
    set: set.id,
    before: summary(set.cards),
    added: [],
    artUpgraded: [],
    filled: [],
    notOnBulbapedia: [],
  };

  const live = await get(`https://api.tcgdex.net/v2/en/sets/${set.liveIds?.[0] || set.id}`, "json");
  report.tcgdexLive = !!(live && Array.isArray(live.cards) && live.cards.length);
  log(
    `TCGdex en /sets/${set.liveIds?.[0] || set.id}: ${report.tcgdexLive ? `LIVE (${live.cards.length} cards) — the app now uses it` : "not published"}`,
  );

  const page = await bulba({
    action: "parse",
    page: cfg.bulbapediaPage,
    prop: "wikitext|revid",
    redirects: 1,
  });
  if (!page?.parse) throw new Error(`Bulbapedia page ${cfg.bulbapediaPage} unavailable`);
  const rows = parseSetList(
    page.parse.wikitext["*"],
    cfg.bulbapediaTitle || set.name,
    set.printedTotal,
  );
  report.bulbapediaRevid = page.parse.revid;
  log(`Bulbapedia ${cfg.bulbapediaPage} rev ${page.parse.revid}: ${rows.length} revealed rows`);
  if (rows.length === 0)
    throw new Error("set list parse returned 0 rows — refusing to touch the JSON");

  const byNum = new Map(set.cards.map((c) => [c.number, c]));
  const rowNums = new Set(rows.map((r) => r.number));
  report.notOnBulbapedia = set.cards
    .filter((c) => !rowNums.has(c.number))
    .map((c) => `${c.number} ${c.name}`);

  // Card pages for every row we may need (new card, missing artist, or art not yet English).
  const need = rows.filter((r) => {
    const c = byNum.get(r.number);
    return !c || !c.artist || !c.art || c.artLang === "ja";
  });
  const pages = new Map();
  for (const r of need) {
    const d = await bulba({ action: "parse", page: r.page, prop: "wikitext", redirects: 1 });
    pages.set(
      r.number,
      d?.parse ? pickScan(d.parse.wikitext["*"], r.rarity) : { file: null, artist: null },
    );
  }
  const files = await fileInfo([
    ...new Set([...pages.values()].map((p) => p.file).filter(Boolean)),
  ]);
  const pb = await pokebeachEn(cfg, set.id);
  log(
    `PokeBeach: EN-named scans for ${[...pb.found.keys()].join(", ") || "none"} (${pb.articles.length} article(s))`,
  );
  const over = cfg.cards || {};

  for (const r of rows) {
    const existing = byNum.get(r.number);
    const p = pages.get(r.number) || {};
    const o = over[r.number] || {};
    const card = existing || {
      number: r.number,
      name: r.name,
      rarity: r.rarity,
      ...classify(r.type),
      artist: undefined,
      art: false,
    };
    if (!existing) report.added.push(`${r.number} ${r.name} (${r.rarity})`);
    const artist = o.artist || p.artist;
    if (!card.artist && artist) {
      card.artist = artist;
      if (existing) report.filled.push(`${r.number} artist=${artist}`);
    }

    // Best available art source for this card.
    const pair = /^Legendary /.test(r.name)
      ? rows.find((x) => x.name === r.name && x.number !== r.number) || null
      : null;
    const half = pair ? (Number(r.number) < Number(pair.number) ? "left" : "right") : null;
    const bf = p.file ? files.get(p.file) : null;
    const candidates = [];
    if (o.art) candidates.push({ url: o.art, lang: o.artLang || "en", why: "override" });
    if (pb.found.has(r.number))
      candidates.push({ url: pb.found.get(r.number).url, lang: "en", why: "pokebeach" });
    if (bf)
      candidates.push({
        url: bf.url,
        lang: JA_HINT.test(bf.comment) ? "ja" : "en",
        why: "bulbapedia",
        combined: bf.w > bf.h,
      });
    const best = candidates.find((c) => c.lang === "en") || candidates[0];
    const wants = best && (!card.art || (card.artLang === "ja" && best.lang === "en"));
    if (wants) {
      const buf = DRY ? Buffer.alloc(0) : await get(best.url, "buf");
      if (DRY || buf?.length) {
        if (!DRY) await writeArt(set.id, r.number, buf, { half }); // only crops 2-card-wide images
        const was = card.art ? `ja→${best.lang}` : `pending→${best.lang}`;
        card.art = true;
        const notes = (card.artNote || "").split("; ").filter((n) => n && n !== JA_NOTE);
        if (best.lang === "ja") {
          card.artLang = "ja";
          notes.unshift(JA_NOTE);
        } else delete card.artLang;
        if (best.combined && half) {
          const hn = `${half === "left" ? "Left" : "Right"} half of the combined Legendary Stadium illustration`;
          if (!notes.includes(hn)) notes.push(hn);
        }
        if (notes.length) card.artNote = notes.join("; ");
        else delete card.artNote;
        if (existing) report.artUpgraded.push(`${r.number} ${r.name} ${was} (${best.why})`);
      }
    }
    if (!existing) byNum.set(r.number, card);
  }

  const order = (c) => ({
    number: c.number,
    name: c.name,
    rarity: c.rarity,
    supertype: c.supertype,
    ...(c.subtypes ? { subtypes: c.subtypes } : {}),
    ...(c.types ? { types: c.types } : {}),
    ...(c.artist ? { artist: c.artist } : {}),
    art: !!c.art,
    ...(c.artNote ? { artNote: c.artNote } : {}),
    ...(c.artLang ? { artLang: c.artLang } : {}),
  });
  set.cards = [...byNum.values()].sort((a, b) => Number(a.number) - Number(b.number)).map(order);
  set.revealedAsOf = today;
  for (const src of [
    `https://bulbapedia.bulbagarden.net/wiki/${cfg.bulbapediaPage}`,
    ...(report.artUpgraded.some((x) => /pokebeach|override/.test(x))
      ? cfg.pokebeachArticles || []
      : []),
  ])
    if (!set.sources.includes(src)) set.sources.push(src);
  report.after = summary(set.cards);
  return report;
}

const data = JSON.parse(readFileSync(JSON_PATH, "utf8"));
const overrides = existsSync(OVERRIDES_PATH)
  ? JSON.parse(readFileSync(OVERRIDES_PATH, "utf8"))
  : {};
const reports = [];
for (const set of data.sets) {
  if (onlySet && set.id !== onlySet) continue;
  const cfg = overrides[set.id] || {
    bulbapediaPage: `${set.name.replace(/ /g, "_")}_(TCG)`,
    bulbapediaTitle: set.name,
  };
  reports.push(await topUp(set, cfg));
}
if (!DRY) {
  writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + "\n");
  const prettier = join(ROOT, "node_modules/.bin/prettier");
  if (existsSync(prettier)) execFileSync(prettier, ["--write", JSON_PATH], { stdio: "ignore" });
}
for (const r of reports) {
  const f = (s) =>
    `${s.revealed} revealed · ${s.en} EN art · ${s.ja} JP art · ${s.pending} pending`;
  log(`\n${r.set}: before ${f(r.before)}`);
  log(`${r.set}: after  ${f(r.after)}${DRY ? "  (dry run, nothing written)" : ""}`);
  for (const k of ["added", "artUpgraded", "filled", "notOnBulbapedia"])
    if (r[k].length) log(`  ${k}: ${r[k].join(", ")}`);
  if (r.tcgdexLive)
    log(
      "  NOTE: TCGdex English has the set — delete this entry + public/card-art after confirming.",
    );
}
if (args.includes("--json")) log(JSON.stringify({ reports }, null, 2));
