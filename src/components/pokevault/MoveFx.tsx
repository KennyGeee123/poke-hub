import { useEffect, useState } from "react";

/** Visual FX overlay for a Pokémon attack. Rendered absolutely over the target. */
export type MoveFxData = {
  type: string;           // attacker's primary type (Fire/Water/...)
  name: string;           // attack name (drives the chosen FX kit)
  side: "player" | "ai";  // who is attacking (drives travel direction)
};

/* ─────────────── MOVE KIT REGISTRY ───────────────
   Each kit is a named visual recipe. We match against the move name first
   (with synonyms), then fall back to the attacker's type kit.
*/
type Kit = {
  glyphs: string[];
  hue: string;
  pattern: "beam" | "spray" | "burst" | "rain" | "slash" | "wave" | "smash" | "orbit" | "swarm";
};

const TYPE_KIT: Record<string, Kit> = {
  Fire:      { glyphs: ["🔥","💥","🔥","✨","🔥"], hue: "#ff5722", pattern: "spray" },
  Water:     { glyphs: ["💧","🌊","💦","💧","💦"], hue: "#38bdf8", pattern: "wave" },
  Grass:     { glyphs: ["🌿","🍃","🌱","🍃","✨"], hue: "#22c55e", pattern: "swarm" },
  Lightning: { glyphs: ["⚡","⚡","✨","⚡","💥"], hue: "#facc15", pattern: "beam" },
  Psychic:   { glyphs: ["🔮","✨","🌀","💫","🔮"], hue: "#c084fc", pattern: "orbit" },
  Fighting:  { glyphs: ["👊","💥","💢","👊","💥"], hue: "#fb923c", pattern: "smash" },
  Darkness:  { glyphs: ["🌑","💀","🟣","✦","🌑"], hue: "#7c3aed", pattern: "burst" },
  Metal:     { glyphs: ["⚙️","🔩","✦","⚙️","💥"], hue: "#cbd5e1", pattern: "slash" },
  Fairy:     { glyphs: ["✨","💖","🌟","✨","💫"], hue: "#f9a8d4", pattern: "orbit" },
  Dragon:    { glyphs: ["🐉","💥","🔥","✨","🐉"], hue: "#fbbf24", pattern: "beam" },
  Colorless: { glyphs: ["✦","✨","★","✦","✨"], hue: "#e2e8f0", pattern: "burst" },
};

/* Name → kit. Patterns matched case-insensitive in order. */
const NAME_RULES: { test: RegExp; kit: Kit }[] = [
  // ── Electric ──
  { test: /thunder(bolt|shock|punch|wave)|shock|zap|volt|electro|spark|discharge/i,
    kit: { glyphs: ["⚡","⚡","🌩️","⚡","✨"], hue: "#fde047", pattern: "beam" } },
  { test: /thunder\b|thunderstorm/i,
    kit: { glyphs: ["⚡","🌩️","⚡","🌩️","⚡"], hue: "#facc15", pattern: "rain" } },

  // ── Fire ──
  { test: /flamethrower|fire blast|inferno|incinerate|fire spin|heat wave|magma|eruption|overheat/i,
    kit: { glyphs: ["🔥","🔥","💥","🔥","🔥"], hue: "#ff4500", pattern: "spray" } },
  { test: /ember|flame|burn|blaze|fire/i,
    kit: { glyphs: ["🔥","✨","🔥","✨","🔥"], hue: "#ff6b35", pattern: "burst" } },

  // ── Water ──
  { test: /hydro pump|surf|whirlpool|aqua jet|water (gun|pulse|spout)|liquidation|crabhammer|waterfall/i,
    kit: { glyphs: ["💧","🌊","💦","🌊","💧"], hue: "#0ea5e9", pattern: "wave" } },
  { test: /bubble|soak|splash|rain|drench/i,
    kit: { glyphs: ["💧","💦","💧","💦","💧"], hue: "#60a5fa", pattern: "rain" } },
  { test: /ice|frost|freeze|blizzard|icicle|hail|aurora/i,
    kit: { glyphs: ["❄️","🧊","❄️","✨","❄️"], hue: "#a5f3fc", pattern: "rain" } },

  // ── Grass ──
  { test: /vine whip|leaf blade|razor leaf|cut|slash|x-scissor|night slash/i,
    kit: { glyphs: ["🌿","🗡️","🍃","🌿","✦"], hue: "#16a34a", pattern: "slash" } },
  { test: /solar beam|seed flare|grass|leaf|petal|bloom|bullet seed|magical leaf|frenzy plant/i,
    kit: { glyphs: ["🌿","🍃","🌱","🌸","🍃"], hue: "#22c55e", pattern: "swarm" } },

  // ── Psychic / Fairy ──
  { test: /psybeam|psychic|psyshock|future sight|zen headbutt|mirror coat|confusion|hypnosis|dream|extrasensory|stored power/i,
    kit: { glyphs: ["🔮","💫","🌀","✨","🔮"], hue: "#c084fc", pattern: "orbit" } },
  { test: /moon|fairy|dazzling|draining kiss|play rough|charm|sweet kiss|disarming/i,
    kit: { glyphs: ["💖","✨","🌟","💕","✨"], hue: "#f472b6", pattern: "orbit" } },

  // ── Dark / Ghost ──
  { test: /shadow ball|shadow punch|shadow sneak|hex|night shade|phantom|ominous|astonish|spite|curse/i,
    kit: { glyphs: ["👻","🌑","💜","🌑","✦"], hue: "#7c3aed", pattern: "orbit" } },
  { test: /dark pulse|crunch|bite|foul play|knock off|sucker punch|nasty plot|payback/i,
    kit: { glyphs: ["🌑","🦷","💀","🌑","✦"], hue: "#6b21a8", pattern: "burst" } },

  // ── Fighting / Normal smash ──
  { test: /punch|chop|kick|smash|stomp|tackle|slam|pound|strike|throw|body slam|takedown|brick break|close combat|cross chop|seismic toss|drain punch/i,
    kit: { glyphs: ["👊","💥","💢","💢","💥"], hue: "#f97316", pattern: "smash" } },
  { test: /earthquake|magnitude|fissure|bulldoze|earth power|dig|sand/i,
    kit: { glyphs: ["💥","🌋","💢","🪨","💥"], hue: "#a16207", pattern: "smash" } },
  { test: /rock|stone|boulder|avalanche|rollout/i,
    kit: { glyphs: ["🪨","🪨","💥","🪨","✨"], hue: "#a8a29e", pattern: "rain" } },

  // ── Beams ──
  { test: /hyper beam|giga impact|signal beam|aurora beam|ice beam|solar beam|tri attack/i,
    kit: { glyphs: ["✨","💥","✨","💥","✨"], hue: "#fde68a", pattern: "beam" } },

  // ── Poison / Steel / Dragon / Bug / Flying ──
  { test: /poison|toxic|sludge|venom|acid|smog/i,
    kit: { glyphs: ["☠️","🟣","💜","☠️","✨"], hue: "#a855f7", pattern: "spray" } },
  { test: /steel|iron|metal claw|flash cannon|gyro ball|bullet punch/i,
    kit: { glyphs: ["⚙️","🔩","✦","⚙️","💥"], hue: "#94a3b8", pattern: "slash" } },
  { test: /dragon (claw|rage|breath|pulse|rush|rage|dance|tail)|outrage|draco meteor|roar of time/i,
    kit: { glyphs: ["🐉","🔥","💥","🐉","✨"], hue: "#f59e0b", pattern: "beam" } },
  { test: /bug|pin missile|fury cutter|silver wind|bug buzz|attack order|signal/i,
    kit: { glyphs: ["🐛","🪲","✨","🐝","✨"], hue: "#84cc16", pattern: "swarm" } },
  { test: /wing|aerial|sky|fly|peck|drill peck|hurricane|air slash|gust/i,
    kit: { glyphs: ["💨","🪶","💨","🪶","✨"], hue: "#bae6fd", pattern: "wave" } },

  // ── Status-ish fallback (still needs a visual) ──
  { test: /growl|leer|tail whip|sing|harden|defense|protect|safeguard|reflect|barrier/i,
    kit: { glyphs: ["🛡️","✨","🛡️","✨","🛡️"], hue: "#e2e8f0", pattern: "burst" } },
];

function pickKit(name: string, type: string): Kit {
  for (const r of NAME_RULES) if (r.test.test(name)) return r.kit;
  return TYPE_KIT[type] || TYPE_KIT.Colorless;
}

export function MoveFx({ fx, onDone }: { fx: MoveFxData; onDone: () => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(onDone, 1150);
    setTick(x => x + 1);
    return () => clearTimeout(t);
  }, [fx, onDone]);

  const kit = pickKit(fx.name, fx.type);
  const dirClass = fx.side === "player" ? "pv-fx-from-bot" : "pv-fx-from-top";

  return (
    <div
      className={`pv-movefx pv-fx-${kit.pattern} ${dirClass}`}
      style={{ "--fx-hue": kit.hue } as React.CSSProperties}
      aria-hidden
    >
      <div className="pv-fx-burst" />
      <div className="pv-fx-ring" />
      <ParticleField kit={kit} />
      <div className="pv-fx-label" style={{ color: kit.hue, textShadow: `0 0 12px ${kit.hue}` }}>
        {fx.name.toUpperCase()}
      </div>
    </div>
  );
}

function ParticleField({ kit }: { kit: Kit }) {
  // Each pattern arranges glyphs along a different motion path
  const count = kit.pattern === "rain" || kit.pattern === "swarm" ? 9 : 5;
  const parts = Array.from({ length: count }).map((_, i) => kit.glyphs[i % kit.glyphs.length]);

  return (
    <div className={`pv-fx-particles pv-fx-particles-${kit.pattern}`}>
      {parts.map((g, i) => {
        const n = parts.length;
        const t = i / Math.max(1, n - 1); // 0..1
        let dx = 0, dy = 0, rot = 0, delay = i * 50;

        switch (kit.pattern) {
          case "beam":
            dx = 0; dy = -180; rot = 0; delay = i * 35;
            break;
          case "spray":
            dx = (t - 0.5) * 180; dy = -120 - Math.abs(t - 0.5) * 40; rot = (t - 0.5) * 80;
            break;
          case "burst":
            { const a = (i / n) * Math.PI * 2; dx = Math.cos(a) * 110; dy = Math.sin(a) * 110; rot = (i % 2 ? 1 : -1) * 180; }
            break;
          case "rain":
            dx = (i - n / 2) * 22; dy = 140; rot = 0; delay = i * 60;
            break;
          case "slash":
            dx = (t - 0.5) * 220; dy = (t - 0.5) * 60; rot = 45; delay = i * 30;
            break;
          case "wave":
            dx = (t - 0.5) * 200; dy = Math.sin(t * Math.PI * 2) * 40 - 40; rot = (t - 0.5) * 30;
            break;
          case "smash":
            dx = (i % 2 ? 1 : -1) * (40 + i * 8); dy = -20 + (i % 2) * 30; rot = (i % 2 ? 1 : -1) * 25; delay = i * 25;
            break;
          case "orbit":
            { const a = (i / n) * Math.PI * 2; dx = Math.cos(a) * 70; dy = Math.sin(a) * 70; rot = a * (180 / Math.PI); }
            break;
          case "swarm":
            dx = (Math.random() - 0.5) * 180; dy = -40 - Math.random() * 120; rot = (Math.random() - 0.5) * 90; delay = i * 40;
            break;
        }

        return (
          <span
            key={i}
            className={`pv-fx-p pv-fx-p-${kit.pattern}`}
            style={{
              ["--dx" as any]: `${dx}px`,
              ["--dy" as any]: `${dy}px`,
              ["--rot" as any]: `${rot}deg`,
              animationDelay: `${delay}ms`,
            }}
          >
            {g}
          </span>
        );
      })}
    </div>
  );
}
