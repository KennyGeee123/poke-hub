import React, { useEffect, useMemo, useRef, useState } from "react";
import { hdImg } from "@/lib/card-images";
import type { TCGCard } from "@/lib/pokemon-api";
import { searchCards } from "@/lib/pokemon-api";
import { useVault } from "@/lib/vault";
import {
  type GameState, type Era, ERAS, eraSeriesQuery,
  applyAttack, applyEnergy, applyTrainer, bestAttackIdx, calcDamage,
  isPlayableInHand, isPlayablePokemon, makeBattleCard, makePlayerState, shuffle, tc, hpPct,
} from "@/lib/battle";
import { animatedSpriteUrl, staticSpriteUrl, spriteSlug } from "@/lib/sprites";
import { MoveFx, type MoveFxData } from "./MoveFx";


/** Animated Pokémon sprite that floats above a TCG card. */
function PokeSprite({ name, size = 96, flip = false, attacking = false, hit = false, ko = false, side = "player" }: { name: string; size?: number; flip?: boolean; attacking?: boolean; hit?: boolean; ko?: boolean; side?: "player" | "ai" }) {
  const slug = spriteSlug(name);
  if (!slug) return null;
  const [src, setSrc] = useState(animatedSpriteUrl(name));
  const [hide, setHide] = useState(false);
  useEffect(() => { setSrc(animatedSpriteUrl(name)); setHide(false); }, [name]);
  if (hide) return null;
  const cls = [
    "pv-sprite",
    attacking ? (side === "player" ? "atk-up" : "atk-down") : "",
    hit ? "hit" : "",
    ko ? "ko" : "",
  ].filter(Boolean).join(" ");
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      onError={() => {
        if (src.endsWith(".gif")) setSrc(staticSpriteUrl(name));
        else setHide(true);
      }}
      className={cls}
      style={{
        position: "absolute",
        bottom: "55%",
        left: "50%",
        width: size,
        height: "auto",
        imageRendering: "pixelated",
        pointerEvents: "none",
        filter: "drop-shadow(0 6px 10px rgba(0,0,0,.7)) drop-shadow(0 0 6px rgba(255,222,0,.25))",
        zIndex: 5,
        ["--pv-flip" as any]: flip ? -1 : 1,
      }}
    />
  );
}





function HpBar({ cur, max }: { cur: number; max: number }) {
  const pct = hpPct(cur, max);

  const col = pct > 50 ? "#34d399" : pct > 25 ? "#eab308" : "#f87171";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: "var(--t2)" }}>HP</span>
        <span style={{ fontFamily: "Bebas Neue", letterSpacing: 1, color: col, fontSize: 13 }}>{cur}/{max}</span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,.07)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: col, transition: "width .45s ease" }} />
      </div>
    </div>
  );
}

function MiniCard({ bc, size = 82, hl, withSprite, flip, attacking, hit, side = "player" }: { bc: { card: TCGCard; hp: number; maxHp: number } | null; size?: number; hl?: boolean; withSprite?: boolean; flip?: boolean; attacking?: boolean; hit?: boolean; side?: "player" | "ai" }) {
  const w = size, h = Math.round(size * 1.4);
  if (!bc) {
    return (
      <div style={{
        width: w, height: h, borderRadius: 9,
        border: `2px dashed ${hl ? "var(--gold)" : "rgba(255,255,255,.12)"}`,
        background: hl ? "rgba(255,215,0,.06)" : "rgba(255,255,255,.02)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, color: "var(--t3)",
      }}>EMPTY</div>
    );
  }
  const pct = hpPct(bc.hp, bc.maxHp);
  const col = pct > 50 ? "#34d399" : pct > 25 ? "#eab308" : "#f87171";
  const ko = bc.hp <= 0;
  return (
    <div className={hit ? "pv-card-hit" : ""} style={{ width: w, height: h, borderRadius: 9, overflow: "visible", position: "relative", boxShadow: "0 4px 18px rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.08)" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 9, overflow: "hidden" }}>
        <img {...hdImg(bc.card)} alt={bc.card.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
        <div style={{ position: "absolute", inset: "auto 0 0 0", background: "rgba(0,0,0,.78)", padding: "2px 4px" }}>
          <div style={{ height: 3, borderRadius: 2, background: col, width: `${pct}%`, transition: "width .45s" }} />
        </div>
      </div>
      {withSprite && bc.card.supertype === "Pokémon" && (
        <PokeSprite name={bc.card.name} size={Math.round(size * 1.15)} flip={flip} attacking={attacking} hit={hit} ko={ko} side={side} />
      )}
    </div>
  );
}


function BenchRow({ bench, size = 56, onSelect, flip }: { bench: { card: TCGCard; hp: number; maxHp: number }[]; size?: number; onSelect?: (i: number) => void; flip?: boolean }) {
  const slots = 5;
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {Array.from({ length: slots }).map((_, i) => {
        const bc = bench[i];
        return (
          <div key={i} onClick={() => bc && onSelect?.(i)} style={{ cursor: bc && onSelect ? "pointer" : "default" }}>
            <MiniCard bc={bc ?? null} size={size} withSprite flip={flip} />
          </div>
        );
      })}
    </div>
  );
}

const BATTLE_TYPES = ["Fire","Water","Grass","Lightning","Psychic","Fighting","Darkness","Metal","Dragon","Fairy","Colorless"];
const pickN = <T,>(arr: T[], n: number): T[] => shuffle(arr).slice(0, n);

async function fetchRandomDeck(era: Era | undefined, size = 24): Promise<TCGCard[]> {
  const eraQ = era ? eraSeriesQuery(era) : "";
  const types = pickN(BATTLE_TYPES, 2 + Math.floor(Math.random() * 2));
  const typeQ = types.map(t => `types:${t}`).join(" OR ");
  const orderBy = Math.random() > 0.5 ? "-set.releaseDate" : "-hp";

  // Try a query; if empty or too small, return what we got. Caller chains fallbacks.
  async function tryQ(q: string, pageSize = 40, page = 1): Promise<TCGCard[]> {
    try {
      const r = await searchCards({ q, pageSize, page, orderBy });
      return r.data || [];
    } catch { return []; }
  }

  const pkmCount = Math.round(size * 0.7);
  const trainerCount = Math.round(size * 0.2);
  const energyCount = size - pkmCount - trainerCount;

  // POKÉMON: try era+type+hp → era+type → era only → no era
  let pkm: TCGCard[] = [];
  const pkmQueries = [
    eraQ ? `${eraQ} subtypes:basic supertype:Pokémon hp:[60 TO *] (${typeQ})` : `subtypes:basic supertype:Pokémon hp:[60 TO *] (${typeQ})`,
    eraQ ? `${eraQ} subtypes:basic supertype:Pokémon (${typeQ})` : `subtypes:basic supertype:Pokémon (${typeQ})`,
    eraQ ? `${eraQ} supertype:Pokémon` : `supertype:Pokémon`,
    `subtypes:basic supertype:Pokémon hp:[60 TO *]`,
  ];
  for (const q of pkmQueries) {
    const page = 1 + Math.floor(Math.random() * 4);
    const r = await tryQ(q, 60, page);
    pkm = r.filter(isPlayablePokemon);
    if (pkm.length >= pkmCount) break;
  }

  // TRAINERS: era-scoped → any
  let trainers: TCGCard[] = [];
  for (const q of [eraQ ? `${eraQ} supertype:Trainer` : `supertype:Trainer`, `supertype:Trainer`]) {
    trainers = await tryQ(q, 40, 1 + Math.floor(Math.random() * 3));
    if (trainers.length >= trainerCount) break;
  }

  // ENERGY: basics are era-agnostic; never filter by era
  const energies = await tryQ(`supertype:Energy subtypes:Basic`, 30, 1);

  const out: TCGCard[] = [
    ...shuffle(pkm).slice(0, pkmCount),
    ...shuffle(trainers).slice(0, trainerCount),
    ...shuffle(energies).slice(0, energyCount),
  ];

  // Final safety net — pad with any playable Pokémon (no era)
  if (out.length < 6) {
    const r2 = await tryQ(`subtypes:basic supertype:Pokémon hp:[60 TO *]`, 60, 1);
    out.push(...shuffle(r2.filter(isPlayablePokemon)).slice(0, size - out.length));
  }
  return shuffle(out).slice(0, size);
}

export function BattleView({ onExit, customDeck, era }: { onExit: () => void; customDeck?: TCGCard[]; era?: Era }) {
  const { vault } = useVault();
  const [deck, setDeck] = useState<TCGCard[] | null>(null);
  const [aiDeckOverride, setAiDeckOverride] = useState<TCGCard[] | null>(null);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [gs, setGs] = useState<GameState | null>(null);
  const [dmgFloat, setDmgFloat] = useState<string | null>(null);
  const [attackFlash, setAttackFlash] = useState<"player" | "ai" | null>(null);
  const [moveFx, setMoveFx] = useState<MoveFxData | null>(null);
  const [aiThink, setAiThink] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (customDeck && customDeck.length >= 4) {
      setDeck(customDeck);
      setAiDeckOverride(null);
      return;
    }
    const fromVault = Object.values(vault).flatMap(e => Array(Math.min(e.qty, 4)).fill(e.card)).filter(isPlayablePokemon) as TCGCard[];
    setLoadingDeck(true);
    Promise.all([fetchRandomDeck(era, 24), fetchRandomDeck(era, 24)]).then(([playerPool, aiPool]) => {
      if (cancelled) return;
      const playerDeck = shuffle([...fromVault, ...playerPool]).slice(0, 30);
      setDeck(playerDeck.length >= 6 ? playerDeck : fromVault);
      setAiDeckOverride(aiPool.length >= 6 ? aiPool : null);
    }).finally(() => { if (!cancelled) setLoadingDeck(false); });
    return () => { cancelled = true; };
  }, [vault, customDeck, era]);

  // Initialize game when deck ready
  useEffect(() => {
    if (!deck || deck.length < 6) return;
    const aiDeck = aiDeckOverride && aiDeckOverride.length >= 6
      ? shuffle(aiDeckOverride).slice(0, 20)
      : shuffle(deck).slice(0, Math.min(deck.length, 20));
    setGs({
      phase: "setup", turn: 0, winner: null,
      player: makePlayerState(deck),
      ai: makePlayerState(aiDeck),
      log: ["⚡ Battle ready! Tap a Pokémon in your hand to set Active."],
    });
  }, [deck, aiDeckOverride]);

  // AI turn
  useEffect(() => {
    if (!gs || gs.phase !== "aiTurn") return;
    setAiThink(true);
    const tid = setTimeout(() => {
      setGs(prev => {
        if (!prev || prev.phase !== "aiTurn") return prev;
        let g: GameState = JSON.parse(JSON.stringify(prev));
        if (!g.ai.active && g.ai.bench.length > 0) {
          g.ai.active = g.ai.bench.shift()!;
          g.log.unshift(`🤖 AI promotes ${g.ai.active.card.name}`);
        }
        // Bench a Pokémon from hand
        const handIdx = g.ai.hand.findIndex(isPlayablePokemon);
        if (handIdx >= 0 && g.ai.bench.length < 5) {
          const [p] = g.ai.hand.splice(handIdx, 1);
          if (!g.ai.active) {
            g.ai.active = makeBattleCard(p);
            g.log.unshift(`🤖 AI plays ${p.name} as Active`);
          } else {
            g.ai.bench.push(makeBattleCard(p));
            g.log.unshift(`🤖 AI benches ${p.name}`);
          }
        }
        // AI attaches an energy if it has one
        const enIdx = g.ai.hand.findIndex(c => c.supertype === "Energy");
        if (enIdx >= 0 && g.ai.active) g = applyEnergy(g, "ai", enIdx);
        // AI plays a trainer ~50% chance
        const trIdx = g.ai.hand.findIndex(c => c.supertype === "Trainer");
        if (trIdx >= 0 && Math.random() < 0.5) g = applyTrainer(g, "ai", trIdx);
        if (g.ai.deck.length > 0) g.ai.hand.push(g.ai.deck.shift()!);
        if (g.ai.active && g.player.active) {
          const idx = bestAttackIdx(g.ai.active, g.player.active);
          const dmg = calcDamage(g.ai.active.card, g.player.active.card, idx);
          const atk = g.ai.active.card.attacks?.[idx];
          setMoveFx({
            type: g.ai.active.card.types?.[0] ?? "Colorless",
            name: atk?.name ?? "Attack",
            side: "ai",
          });
          setDmgFloat(`-${dmg}`);
          setAttackFlash("ai");
          setTimeout(() => setDmgFloat(null), 900);
          setTimeout(() => setAttackFlash(null), 600);
          g = applyAttack(g, "ai", idx);
        }

        if (g.phase !== "gameOver") {
          g.phase = "playerTurn"; g.turn++;
          g.player.attacked = false;
          if (g.player.deck.length > 0) { g.player.hand.push(g.player.deck.shift()!); g.log.unshift("▶ You draw a card."); }
        }
        return g;
      });
      setAiThink(false);
    }, 1400);
    return () => clearTimeout(tid);
  }, [gs?.phase]);

  if (!deck || loadingDeck) {
    return (
      <div className="pad">
        <button className="pv-back" onClick={onExit}>← Back</button>
        <div className="pv-empty">
          <div className="pv-empty-icon">⚔️</div>
          <div className="pv-empty-title">PREPARING DECK…</div>
          <div>Building a battle-ready deck from your Vault & live Pokémon data.</div>
        </div>
      </div>
    );
  }

  if (!gs) {
    return (
      <div className="pad">
        <button className="pv-back" onClick={onExit}>← Back</button>
        <div className="pv-empty">
          <div className="pv-empty-icon">🃏</div>
          <div className="pv-empty-title">NOT ENOUGH POKÉMON</div>
          <div>Add at least 6 playable Pokémon to your Vault to battle.</div>
        </div>
      </div>
    );
  }

  const isTurn = gs.phase === "playerTurn";
  const isSetup = gs.phase === "setup";
  const canAttack = isTurn && !gs.player.attacked && !!gs.player.active && !!gs.ai.active && !aiThink;

  function playCard(card: TCGCard, idx: number) {
    if (card.supertype === "Energy") {
      setGs(prev => prev && prev.player.active ? applyEnergy(prev, "player", idx) : prev);
      return;
    }
    if (card.supertype === "Trainer") {
      setGs(prev => prev ? applyTrainer(prev, "player", idx) : prev);
      return;
    }
    if (!isPlayablePokemon(card)) return;
    setGs(prev => {
      if (!prev) return prev;
      const g: GameState = JSON.parse(JSON.stringify(prev));
      g.player.hand.splice(idx, 1);
      const bc = makeBattleCard(card);
      if (!g.player.active) {
        g.player.active = bc;
        g.log.unshift(`▶ ${card.name} is your Active!`);
        if (g.phase === "setup") {
          g.phase = "playerTurn"; g.turn = 1;
          g.log.unshift("⚡ Battle begins — your turn!");
          const ai = g.ai.hand.findIndex(isPlayablePokemon);
          if (ai >= 0) {
            const [ap] = g.ai.hand.splice(ai, 1);
            g.ai.active = makeBattleCard(ap);
            g.log.unshift(`🤖 AI plays ${ap.name} as Active!`);
          }
        }
      } else if (g.player.bench.length < 5) {
        g.player.bench.push(bc);
        g.log.unshift(`▶ ${card.name} benched!`);
      } else {
        g.log.unshift("⚠ Bench full!");
      }
      return g;
    });
  }

  function doAttack(atkIdx: number) {
    setGs(prev => {
      if (!prev || prev.phase !== "playerTurn" || prev.player.attacked || !prev.player.active || !prev.ai.active) return prev;
      const dmg = calcDamage(prev.player.active.card, prev.ai.active.card, atkIdx);
      const atk = prev.player.active.card.attacks?.[atkIdx];
      setMoveFx({
        type: prev.player.active.card.types?.[0] ?? "Colorless",
        name: atk?.name ?? "Attack",
        side: "player",
      });
      setDmgFloat(`-${dmg}`);
      setAttackFlash("player");
      setTimeout(() => setDmgFloat(null), 900);
      setTimeout(() => setAttackFlash(null), 600);

      let g = applyAttack(prev, "player", atkIdx);
      if (g.phase !== "gameOver") { g.phase = "aiTurn"; g.log.unshift("🤖 AI's turn…"); }
      return g;
    });
  }

  function promote(i: number) {
    setGs(prev => {
      if (!prev || prev.player.active) return prev;
      const g: GameState = JSON.parse(JSON.stringify(prev));
      const [bc] = g.player.bench.splice(i, 1);
      g.player.active = bc;
      g.log.unshift(`▶ ${bc.card.name} promoted to Active!`);
      return g;
    });
  }

  function endTurn() {
    setGs(prev => {
      if (!prev || prev.phase !== "playerTurn") return prev;
      return { ...prev, phase: "aiTurn", log: ["🤖 AI's turn…", ...prev.log] };
    });
  }

  return (
    <div className="pad pv-battle">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button className="pv-back" onClick={onExit}>← Exit Battle</button>
        <div style={{ fontFamily: "Bebas Neue", letterSpacing: 3, fontSize: 18, color: "var(--gold)" }}>⚡ ARENA</div>
        <div style={{ fontSize: 11, color: "var(--t2)" }}>
          {aiThink ? "AI thinking…" : isSetup ? "SETUP" : isTurn ? "YOUR TURN" : "AI TURN"}
        </div>
      </div>

      <div className={`pv-board pv-arena${attackFlash ? ` flash-${attackFlash}` : ""}`}>
        <div className="pv-arena-bg" aria-hidden>
          <div className="pv-arena-grid" />
          <div className="pv-arena-orb pv-arena-orb-top" />
          <div className="pv-arena-orb pv-arena-orb-bot" />
          <div className="pv-arena-rays" />
        </div>
        {gs.phase === "gameOver" && (
          <div className="pv-victory">
            <div style={{ fontSize: 60, marginBottom: 10 }}>{gs.winner === "player" ? "🏆" : "💀"}</div>
            <h2 style={{ fontFamily: "Bebas Neue", letterSpacing: 4, fontSize: 36, color: gs.winner === "player" ? "var(--gold)" : "#f87171" }}>
              {gs.winner === "player" ? "VICTORY" : "DEFEAT"}
            </h2>
            <button className="pv-btn pv-btn-fill yes" style={{ marginTop: 18 }} onClick={onExit}>Back to Vault</button>
          </div>
        )}

        {/* HUD */}
        <div className="pv-hud">
          <HudSide label="🤖 OPPONENT" color="#f87171" prizes={gs.ai.prizes.length} deck={gs.ai.deck.length} hand={gs.ai.hand.length} />
          <div className="pv-turnbadge">
            <div style={{ fontFamily: "Bebas Neue", letterSpacing: 2, fontSize: 14, color: "var(--gold)" }}>
              {isSetup ? "SETUP" : gs.phase === "gameOver" ? "GAME OVER" : `TURN ${gs.turn}`}
            </div>
            <div style={{ fontSize: 10, color: "var(--t2)" }}>{aiThink ? "AI thinking…" : isTurn ? "▶ YOUR MOVE" : isSetup ? "Place Active" : "⏳ AI"}</div>
          </div>
          <HudSide label="▶ YOU" color="#38bdf8" prizes={gs.player.prizes.length} deck={gs.player.deck.length} hand={gs.player.hand.length} right />
        </div>

        {/* AI zone */}
        <div className="pv-zone">
          <BenchRow bench={gs.ai.bench} size={50} />
          <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div className="pv-active-wrap ai" style={{ position: "relative", "--aura": tc(gs.ai.active?.card.types?.[0] ?? "Colorless") } as React.CSSProperties}>
              <MiniCard bc={gs.ai.active} size={120} withSprite attacking={attackFlash === "ai"} hit={attackFlash === "player"} side="ai" />
              {moveFx && moveFx.side === "player" && (
                <MoveFx fx={moveFx} onDone={() => setMoveFx(null)} />
              )}
            </div>

            {dmgFloat && attackFlash === "player" && <div className="pv-dmgfloat">{dmgFloat}</div>}
            {gs.ai.active && (
              <div style={{ minWidth: 140 }}>
                <div style={{ fontFamily: "Bebas Neue", letterSpacing: 1, fontSize: 14, color: "#f87171", marginBottom: 4 }}>{gs.ai.active.card.name}</div>
                <HpBar cur={gs.ai.active.hp} max={gs.ai.active.maxHp} />
                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                  {gs.ai.active.card.types?.map(t => (
                    <span key={t} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: `${tc(t)}22`, color: tc(t), fontWeight: 700 }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pv-fieldline" />

        {/* Player zone */}
        <div className="pv-zone">
          <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div className="pv-active-wrap me" style={{ position: "relative", "--aura": tc(gs.player.active?.card.types?.[0] ?? "Colorless") } as React.CSSProperties}>
              <MiniCard bc={gs.player.active} size={120} hl={isSetup && !gs.player.active} withSprite flip attacking={attackFlash === "player"} hit={attackFlash === "ai"} side="player" />
              {moveFx && moveFx.side === "ai" && (
                <MoveFx fx={moveFx} onDone={() => setMoveFx(null)} />
              )}
            </div>

            {dmgFloat && attackFlash === "ai" && <div className="pv-dmgfloat" style={{ left: "auto", right: "60%" }}>{dmgFloat}</div>}
            <div style={{ minWidth: 180, display: "flex", flexDirection: "column", gap: 6 }}>
              {gs.player.active && (
                <>
                  <div style={{ fontFamily: "Bebas Neue", letterSpacing: 1, fontSize: 14, color: "#38bdf8" }}>{gs.player.active.card.name}</div>
                  <HpBar cur={gs.player.active.hp} max={gs.player.active.maxHp} />
                  {gs.player.active.energies.length > 0 && (
                    <div style={{ display: "flex", gap: 3, marginTop: 2 }} title="Attached energy">
                      {gs.player.active.energies.map((e, k) => (
                        <span key={k} style={{ width: 13, height: 13, borderRadius: "50%", background: tc(e), border: "1px solid rgba(0,0,0,.4)", boxShadow: `0 0 6px ${tc(e)}` }} />
                      ))}
                    </div>
                  )}
                </>
              )}
              {gs.player.active?.card.attacks?.slice(0, 2).map((atk, i) => (
                <button key={i} className="pv-batk" disabled={!canAttack} onClick={() => doAttack(i)}>
                  <span style={{ display: "flex", gap: 3 }}>
                    {atk.cost?.slice(0, 4).map((c, ci) => (
                      <span key={ci} style={{ width: 14, height: 14, borderRadius: "50%", background: tc(c), color: "#000", fontSize: 8, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{c[0]}</span>
                    ))}
                  </span>
                  <span style={{ flex: 1, textAlign: "left", fontSize: 12 }}>{atk.name}</span>
                  {atk.damage && <span style={{ fontFamily: "Bebas Neue", fontSize: 16, color: "#f87171", letterSpacing: 1 }}>{atk.damage}</span>}
                </button>
              ))}
              {isTurn && <button className="pv-btn pv-btn-out" onClick={endTurn} disabled={aiThink}>End Turn →</button>}
              {isSetup && <div style={{ fontSize: 11, color: "var(--t2)" }}>↓ Tap a Pokémon in your hand</div>}
            </div>
          </div>
          <BenchRow bench={gs.player.bench} size={50} onSelect={i => !gs.player.active && promote(i)} />
        </div>

        {/* Hand */}
        <div className="pv-hand">
          <div style={{ fontSize: 10, color: "var(--t2)", marginRight: 6, whiteSpace: "nowrap" }}>HAND ({gs.player.hand.length})</div>
          {gs.player.hand.map((card, i) => {
            const isPkm = card.supertype === "Pokémon" && isPlayablePokemon(card);
            const isTrainer = card.supertype === "Trainer";
            const isEnergy = card.supertype === "Energy";
            const ok = isPkm || isTrainer || (isEnergy && !!gs.player.active);
            const badge = isTrainer ? "T" : isEnergy ? "E" : isPkm ? "P" : "";
            const badgeBg = isTrainer ? "#a855f7" : isEnergy ? "#eab308" : "#38bdf8";
            return (
              <div
                key={card.id + i}
                className={`pv-hcard${ok ? " ok" : ""}`}
                onClick={() => (isTurn || isSetup) && ok && playCard(card, i)}
                title={`${card.name} · ${card.supertype}`}
              >
                <img {...hdImg(card)} alt={card.name} loading="lazy" />
                <span style={{
                  position: "absolute", top: 3, left: 3, width: 14, height: 14, borderRadius: 4,
                  background: badgeBg, color: "#000", fontSize: 9, fontWeight: 900,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                }}>{badge}</span>
              </div>
            );
          })}
        </div>

        {/* Log */}
        <div className="pv-log" ref={logRef}>
          {gs.log.slice(0, 30).map((e, i) => (
            <div key={i} style={{
              fontSize: 11, padding: "2px 0", lineHeight: 1.6,
              color: e.startsWith("▶") ? "#38bdf8" : e.startsWith("🤖") ? "#f87171" : e.includes("WIN") ? "#34d399" : e.includes("KO") ? "#fb923c" : "var(--gold)",
            }}>{e}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HudSide({ label, color, prizes, deck, hand, right }: { label: string; color: string; prizes: number; deck: number; hand: number; right?: boolean }) {
  return (
    <div style={{ textAlign: right ? "right" : "left" }}>
      <div style={{ fontFamily: "Bebas Neue", letterSpacing: 2, fontSize: 12, color, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 3, justifyContent: right ? "flex-end" : "flex-start", alignItems: "center", flexWrap: "wrap" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i < prizes ? "var(--gold)" : "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)" }} />
        ))}
        <span style={{ fontSize: 9, color: "var(--t2)", marginLeft: 4 }}>{prizes}p · {deck}d · {hand}h</span>
      </div>
    </div>
  );
}

/* ─── BATTLE HUB ─── */
type HubMode = "hub" | "deck" | "battle" | "quick";

export function BattleHub({ onExit }: { onExit: () => void }) {
  const { vault } = useVault();
  const [mode, setMode] = useState<HubMode>("hub");
  const [customDeck, setCustomDeck] = useState<TCGCard[] | undefined>(undefined);
  const [era, setEra] = useState<Era>(ERAS[0]);
  const [showRules, setShowRules] = useState(false);

  const vaultPokemon = useMemo(
    () => Object.values(vault).filter(e => isPlayablePokemon(e.card)),
    [vault],
  );

  if (mode === "quick") return <BattleView era={era} onExit={() => setMode("hub")} />;
  if (mode === "battle" && customDeck) return <BattleView customDeck={customDeck} era={era} onExit={() => setMode("hub")} />;
  if (mode === "deck") return (
    <DeckBuilder
      onBack={() => setMode("hub")}
      onBattle={(cards) => { setCustomDeck(cards); setMode("battle"); }}
    />
  );

  return (
    <div className="pad pv-hub">
      <button className="pv-back" onClick={onExit}>← Back to Vault</button>

      <div className="pv-hub-banner">
        <div className="pv-hub-glow" />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700, letterSpacing: 3, marginBottom: 6 }}>⚡ POKÉMON TCG</div>
          <h1 style={{ fontFamily: "Bebas Neue", letterSpacing: 4, fontSize: 56, lineHeight: 1, marginBottom: 6 }}>BATTLE ARENA</h1>
          <p style={{ color: "var(--t2)", fontSize: 13, maxWidth: 460 }}>
            Duel a tactical AI using real Pokémon, Trainer & Energy cards across every era of the TCG — live from the Pokémon TCG API.
          </p>
          <button className="pv-btn pv-btn-out" style={{ marginTop: 12 }} onClick={() => setShowRules(true)}>📖 Official Rules</button>
        </div>
      </div>

      {/* Era Selector */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: "Bebas Neue", letterSpacing: 3, fontSize: 16, color: "var(--gold)" }}>⏳ ERA / FORMAT</div>
          <div style={{ fontSize: 11, color: "var(--t2)" }}>{era.years}</div>
        </div>
        <div className="pv-era-row">
          {ERAS.map(e => (
            <button
              key={e.id}
              className={`pv-era ${era.id === e.id ? "on" : ""}`}
              onClick={() => setEra(e)}
              title={e.blurb}
            >
              <div className="pv-era-name">{e.name}</div>
              <div className="pv-era-years">{e.years}</div>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6, fontStyle: "italic" }}>{era.blurb}</div>
      </div>

      <div className="pv-hub-grid" style={{ marginTop: 18 }}>
        <button className="pv-hub-card primary" onClick={() => setMode("quick")}>
          <div className="pv-hub-ico">⚡</div>
          <div className="pv-hub-tt">QUICK BATTLE</div>
          <div className="pv-hub-sub">Random {era.name} deck — Pokémon, Trainers & Energy — straight into a duel.</div>
          <div className="pv-hub-cta">START →</div>
        </button>

        <button className="pv-hub-card" onClick={() => setMode("deck")}>
          <div className="pv-hub-ico">🃏</div>
          <div className="pv-hub-tt">DECK BUILDER</div>
          <div className="pv-hub-sub">Hand-pick cards from your Vault or the API. Up to 4 copies per card, 4–60 total.</div>
          <div className="pv-hub-cta">BUILD →</div>
        </button>

        <div className="pv-hub-card stat">
          <div className="pv-hub-ico">📦</div>
          <div className="pv-hub-tt">VAULT POKÉMON</div>
          <div style={{ fontFamily: "Bebas Neue", letterSpacing: 2, fontSize: 48, color: "var(--gold)", lineHeight: 1 }}>{vaultPokemon.length}</div>
          <div className="pv-hub-sub">Battle-ready cards in your collection</div>
        </div>
      </div>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

/* ─── RULES MODAL ─── */
function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="pv-modal-bg" onClick={onClose}>
      <div className="pv-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontFamily: "Bebas Neue", letterSpacing: 3, fontSize: 26, color: "var(--gold)" }}>📖 Official Pokémon TCG Rules</h2>
          <button className="pv-btn pv-btn-out" onClick={onClose}>✕ Close</button>
        </div>

        <h3 className="pv-rule-h">🎯 Goal</h3>
        <p>Win by doing any one of these first:</p>
        <ul>
          <li>Take all <b>6 Prize cards</b> by Knocking Out opponent Pokémon.</li>
          <li>Knock Out your opponent's last Pokémon in play (no more to promote).</li>
          <li>Your opponent can't draw a card at the start of their turn (deck-out).</li>
        </ul>

        <h3 className="pv-rule-h">🗂 Setup</h3>
        <ol>
          <li>Shake hands, flip a coin — winner picks who goes first.</li>
          <li>Shuffle your 60-card deck. Draw <b>7 cards</b>.</li>
          <li>Place 1 <b>Basic Pokémon</b> face-down as your Active. Up to 5 Basics on your <b>Bench</b>.</li>
          <li>Place 6 cards from the top of your deck face-down as <b>Prize cards</b>.</li>
          <li>Flip Active and Bench face-up — battle begins!</li>
          <li>No Basics in hand? Reveal your hand, shuffle, redraw — opponent draws an extra card.</li>
        </ol>

        <h3 className="pv-rule-h">🔄 Your Turn</h3>
        <ol>
          <li><b>Draw 1 card</b> from your deck.</li>
          <li>Do any of the following in any order:
            <ul>
              <li>Put Basic Pokémon on your Bench (up to 5).</li>
              <li>Evolve a Pokémon (once per Pokémon per turn — not the turn it was played).</li>
              <li>Attach <b>1 Energy</b> from your hand to one of your Pokémon (once per turn).</li>
              <li>Play any number of <b>Item</b> Trainer cards.</li>
              <li>Play <b>1 Supporter</b> card per turn.</li>
              <li>Play <b>1 Stadium</b> card per turn (replaces any in play).</li>
              <li>Use Pokémon <b>Abilities</b>.</li>
              <li>Retreat your Active (pay the retreat cost in Energy — once per turn).</li>
            </ul>
          </li>
          <li><b>Attack</b> — your Active uses an attack if it has the required Energy. This ends your turn.</li>
        </ol>

        <h3 className="pv-rule-h">💥 Combat</h3>
        <ul>
          <li>Damage = attack damage, doubled by <b>Weakness</b>, reduced 30 by <b>Resistance</b>.</li>
          <li>When a Pokémon's HP hits 0 it's Knocked Out — attacker takes a Prize card.</li>
          <li>KO'd Active means defender promotes a Benched Pokémon to Active.</li>
        </ul>

        <h3 className="pv-rule-h">🎴 Card Types</h3>
        <ul>
          <li><b style={{ color: "#38bdf8" }}>Pokémon</b> — your fighters. Basics can be played directly; Stage 1/2 evolve from a previous stage.</li>
          <li><b style={{ color: "#a855f7" }}>Trainer</b> — Items, Supporters, Stadiums, Tools. Powerful one-shot effects.</li>
          <li><b style={{ color: "#eab308" }}>Energy</b> — fuel for attacks. One attach per turn; Special Energy give bonuses.</li>
        </ul>

        <h3 className="pv-rule-h">⚙️ This App's Implementation</h3>
        <p>Pokévault's battle engine simulates the core loop: Basics, Bench (5), Prizes (6), KO → prize, weakness ×2, resistance −30, and Trainer / Energy plays with simplified one-shot effects. Evolution chains, Special Energy, retreat costs, status conditions, and Stadium slots are omitted for speed of play.</p>

        <p style={{ marginTop: 14, fontSize: 11, color: "var(--t3)" }}>
          Full rulebook PDFs: <a href="https://www.pokemon.com/us/pokemon-tcg/play-pokemon-tcg/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>pokemon.com</a> ·
          {" "}<a href="https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Trading_Card_Game" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>Bulbapedia</a>
        </p>
      </div>
    </div>
  );
}

/* ─── DECK BUILDER ─── */
function DeckBuilder({ onBack, onBattle }: { onBack: () => void; onBattle: (cards: TCGCard[]) => void }) {
  const { vault } = useVault();
  const [deck, setDeck] = useState<Record<string, { card: TCGCard; qty: number }>>({});
  const [tab, setTab] = useState<"vault" | "search">("vault");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TCGCard[]>([]);
  const [loading, setLoading] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const vaultPokemon = Object.values(vault).filter(e => isPlayablePokemon(e.card)).map(e => e.card);
  const total = Object.values(deck).reduce((s, e) => s + e.qty, 0);
  const canBattle = total >= 4;

  const add = (c: TCGCard) => setDeck(p => {
    const cur = p[c.id]?.qty ?? 0;
    if (cur >= 4) return p;
    return { ...p, [c.id]: { card: c, qty: cur + 1 } };
  });
  const remove = (id: string) => setDeck(p => {
    const cur = p[id]?.qty ?? 0;
    if (cur <= 1) { const n = { ...p }; delete n[id]; return n; }
    return { ...p, [id]: { ...p[id], qty: cur - 1 } };
  });

  function onSearchChange(v: string) {
    setQ(v);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      if (!v.trim()) { setResults([]); return; }
      setLoading(true);
      try {
        const r = await searchCards({ q: `name:"${v}*" supertype:Pokémon`, pageSize: 24 });
        setResults(r.data.filter(isPlayablePokemon));
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);
  }

  const pool = tab === "vault" ? vaultPokemon : results;

  return (
    <div className="pad pv-dbuild">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <button className="pv-back" onClick={onBack} style={{ marginBottom: 0 }}>← Hub</button>
        <div style={{ fontFamily: "Bebas Neue", letterSpacing: 3, fontSize: 22, color: "var(--gold)" }}>🃏 DECK BUILDER</div>
        <button
          className="pv-btn pv-btn-fill yes"
          disabled={!canBattle}
          style={{ opacity: canBattle ? 1 : 0.4 }}
          onClick={() => onBattle(Object.values(deck).flatMap(e => Array(e.qty).fill(e.card)))}
        >⚡ BATTLE ({total})</button>
      </div>

      <div className="pv-dbuild-grid">
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button className={`pv-pill ${tab === "vault" ? "on" : ""}`} onClick={() => setTab("vault")}>📦 Vault ({vaultPokemon.length})</button>
            <button className={`pv-pill ${tab === "search" ? "on" : ""}`} onClick={() => setTab("search")}>🔍 Search API</button>
          </div>
          {tab === "search" && (
            <input
              className="pv-input"
              placeholder="Search Pokémon by name…"
              value={q}
              onChange={e => onSearchChange(e.target.value)}
              style={{ marginBottom: 10 }}
            />
          )}
          {loading ? (
            <div className="pv-empty"><div className="pv-empty-icon">⏳</div><div>Searching…</div></div>
          ) : pool.length === 0 ? (
            <div className="pv-empty">
              <div className="pv-empty-icon">{tab === "vault" ? "📦" : "🔍"}</div>
              <div className="pv-empty-title">{tab === "vault" ? "NO POKÉMON IN VAULT" : "SEARCH TO FIND CARDS"}</div>
            </div>
          ) : (
            <div className="pv-dbuild-pool">
              {pool.map(card => {
                const inDeck = deck[card.id]?.qty ?? 0;
                return (
                  <div key={card.id} className={`pv-dbuild-card ${inDeck ? "in" : ""}`} onClick={() => add(card)}>
                    <img {...hdImg(card)} alt={card.name} loading="lazy" />
                    <div style={{ padding: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.name}</div>
                      <div style={{ fontSize: 9, color: "var(--t3)" }}>HP {card.hp ?? "—"}</div>
                    </div>
                    {inDeck > 0 && <div className="pv-dbuild-badge">×{inDeck}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pv-dbuild-panel">
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--brd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "Bebas Neue", letterSpacing: 2, fontSize: 14 }}>YOUR DECK</div>
              <div style={{ fontSize: 10, color: "var(--t3)" }}>{total} / 60 cards · min 4</div>
            </div>
            {Object.keys(deck).length > 0 && (
              <button className="pv-btn pv-btn-out" style={{ padding: "4px 9px", fontSize: 10 }} onClick={() => setDeck({})}>Clear</button>
            )}
          </div>
          <div style={{ padding: 8, maxHeight: 480, overflowY: "auto" }}>
            {Object.values(deck).length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 11 }}>
                Tap cards on the left to add
              </div>
            ) : Object.values(deck).map(e => (
              <div key={e.card.id} className="pv-dbuild-row">
                <img {...hdImg(e.card)} alt="" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.card.name}</div>
                  <div style={{ fontSize: 9, color: "var(--t3)" }}>HP {e.card.hp ?? "—"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button className="pv-qty" onClick={() => remove(e.card.id)}>−</button>
                  <span style={{ fontFamily: "Bebas Neue", fontSize: 13, minWidth: 14, textAlign: "center" }}>{e.qty}</span>
                  <button className="pv-qty" onClick={() => add(e.card)} disabled={e.qty >= 4}>＋</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
