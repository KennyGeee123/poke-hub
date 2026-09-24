import React, { useState, useEffect, useRef } from "react";
import {
  Swords,
  Shield,
  Heart,
  Sparkles,
  Zap,
  RotateCcw,
  ShoppingBag,
  Users,
  ChevronRight,
  Trophy,
  Flame,
  Droplets,
  Wind,
} from "lucide-react";
import { animatedSpriteUrl } from "@/lib/sprites";
import {
  type AdventureState,
  type CaptureItemId,
  CAPTURE_ITEMS,
  addAdventureXp,
  saveAdventureState,
} from "@/lib/adventure-engine";

export interface BattlePokemon {
  name: string;
  species: string;
  level: number;
  maxHp: number;
  currentHp: number;
  types: string[];
  moves: {
    name: string;
    type: string;
    power: number;
    pp: number;
    maxPp: number;
    description: string;
  }[];
  spriteUrl?: string;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Fire: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/50" },
  Water: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/50" },
  Electric: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/50" },
  Grass: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/50" },
  Normal: { bg: "bg-neutral-500/20", text: "text-neutral-300", border: "border-neutral-500/50" },
  Ghost: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/50" },
  Dragon: { bg: "bg-indigo-500/20", text: "text-indigo-400", border: "border-indigo-500/50" },
  Fighting: { bg: "bg-rose-500/20", text: "text-rose-400", border: "border-rose-500/50" },
  Psychic: { bg: "bg-pink-500/20", text: "text-pink-400", border: "border-pink-500/50" },
};

function getTypeEffectiveness(atkType: string, defTypes: string[]): number {
  let mult = 1.0;
  for (const defType of defTypes) {
    if (atkType === "Water" && defType === "Fire") mult *= 2.0;
    if (atkType === "Fire" && defType === "Grass") mult *= 2.0;
    if (atkType === "Grass" && defType === "Water") mult *= 2.0;
    if (atkType === "Electric" && defType === "Water") mult *= 2.0;
    if (atkType === "Ghost" && defType === "Normal") mult *= 0.0;
    if (atkType === "Fighting" && defType === "Normal") mult *= 2.0;
    if (atkType === "Dragon" && defType === "Dragon") mult *= 2.0;
  }
  return mult;
}

export function HDBattleArena({
  foeMon,
  playerParty,
  adventureState,
  onBattleEnd,
}: {
  foeMon: BattlePokemon;
  playerParty: BattlePokemon[];
  adventureState: AdventureState;
  onBattleEnd: (result: "win" | "lose" | "run" | "caught") => void;
}) {
  const [activePartyIdx, setActivePartyIdx] = useState(0);
  const [playerMon, setPlayerMon] = useState<BattlePokemon>(playerParty[0]);
  const [foe, setFoe] = useState<BattlePokemon>(foeMon);

  const [menuView, setMenuView] = useState<"main" | "fight" | "bag" | "pokemon">("main");
  const [battleLog, setBattleLog] = useState<string[]>([
    `⚔️ A wild Lv. ${foeMon.level} ${foeMon.name} appeared!`,
    `Go, ${playerParty[0].name}!`,
  ]);
  const [isTurnBusy, setIsTurnBusy] = useState(false);
  const [playerAnim, setPlayerAnim] = useState<"" | "attack" | "hit" | "faint">("");
  const [foeAnim, setFoeAnim] = useState<"" | "attack" | "hit" | "faint">("");
  const [vfxFlash, setVfxFlash] = useState<string | null>(null);
  const [battleOver, setBattleOver] = useState<"win" | "lose" | null>(null);

  const logBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [battleLog]);

  function appendLog(msg: string) {
    setBattleLog((prev) => [...prev, msg]);
  }

  // Execute Player Move
  async function executeMove(moveIdx: number) {
    if (isTurnBusy || battleOver) return;
    const move = playerMon.moves[moveIdx];
    if (move.pp <= 0) {
      appendLog(`No PP left for ${move.name}!`);
      return;
    }

    setIsTurnBusy(true);
    setMenuView("main");

    // Deduct PP
    const updatedMoves = [...playerMon.moves];
    updatedMoves[moveIdx].pp -= 1;
    setPlayerMon({ ...playerMon, moves: updatedMoves });

    appendLog(`${playerMon.name} used ${move.name.toUpperCase()}!`);
    setPlayerAnim("attack");
    setVfxFlash("attack-cyan");

    await new Promise((r) => setTimeout(r, 600));
    setPlayerAnim("");

    // Calculate Damage
    const mult = getTypeEffectiveness(move.type, foe.types);
    const isCrit = Math.random() < 0.12;
    const baseDmg = Math.round(
      playerMon.level * 2.5 * (move.power / 50) * mult * (isCrit ? 1.5 : 1.0),
    );
    const finalDmg = Math.max(8, baseDmg + Math.floor(Math.random() * 6));

    setFoeAnim("hit");
    await new Promise((r) => setTimeout(r, 400));
    setFoeAnim("");

    const newFoeHp = Math.max(0, foe.currentHp - finalDmg);
    setFoe((prev) => ({ ...prev, currentHp: newFoeHp }));

    if (mult > 1.0) appendLog("It's super effective!");
    else if (mult < 1.0 && mult > 0) appendLog("It's not very effective...");
    else if (mult === 0) appendLog("It had no effect!");
    if (isCrit) appendLog("A critical hit!");

    // Check Foe Faint
    if (newFoeHp <= 0) {
      await new Promise((r) => setTimeout(r, 500));
      setFoeAnim("faint");
      appendLog(`Foe ${foe.name} fainted!`);

      const xpGain = Math.round(foe.level * 45);
      const coinsGain = Math.round(foe.level * 10);
      appendLog(`You earned ${xpGain} XP and ${coinsGain} Coins!`);

      // Update Adventure State
      const updated = { ...adventureState };
      updated.inventory.coins += coinsGain;
      addAdventureXp(updated, xpGain);

      setBattleOver("win");
      setIsTurnBusy(false);
      return;
    }

    // Foe Turn Counter-Attack
    await new Promise((r) => setTimeout(r, 900));
    const foeMove = foe.moves[Math.floor(Math.random() * foe.moves.length)] || {
      name: "Tackle",
      type: "Normal",
      power: 40,
    };

    appendLog(`Foe ${foe.name} used ${foeMove.name.toUpperCase()}!`);
    setFoeAnim("attack");
    setVfxFlash("attack-red");

    await new Promise((r) => setTimeout(r, 600));
    setFoeAnim("");

    const foeMult = getTypeEffectiveness(foeMove.type, playerMon.types);
    const foeDmg = Math.max(5, Math.round(foe.level * 2.0 * (foeMove.power / 50) * foeMult));

    setPlayerAnim("hit");
    await new Promise((r) => setTimeout(r, 400));
    setPlayerAnim("");

    const newPlayerHp = Math.max(0, playerMon.currentHp - foeDmg);
    setPlayerMon((prev) => ({ ...prev, currentHp: newPlayerHp }));

    if (newPlayerHp <= 0) {
      setPlayerAnim("faint");
      appendLog(`${playerMon.name} fainted!`);
      // Check if other party members alive
      const aliveIdx = playerParty.findIndex((p, idx) => idx !== activePartyIdx && p.currentHp > 0);
      if (aliveIdx !== -1) {
        appendLog(`Choose your next Pokémon!`);
        setMenuView("pokemon");
      } else {
        appendLog(`You have no more Pokémon able to battle! Whited out...`);
        setBattleOver("lose");
      }
    }

    setIsTurnBusy(false);
  }

  // Use Potion from Bag
  async function usePotion() {
    if (isTurnBusy) return;
    setIsTurnBusy(true);
    setMenuView("main");

    const healAmount = 50;
    const newHp = Math.min(playerMon.maxHp, playerMon.currentHp + healAmount);
    setPlayerMon({ ...playerMon, currentHp: newHp });
    appendLog(`Used Super Potion! ${playerMon.name} restored ${healAmount} HP.`);

    await new Promise((r) => setTimeout(r, 800));

    // Foe Turn
    const foeMove = foe.moves[0] || { name: "Quick Attack", type: "Normal", power: 40 };
    appendLog(`Foe ${foe.name} used ${foeMove.name}!`);
    setPlayerAnim("hit");
    await new Promise((r) => setTimeout(r, 400));
    setPlayerAnim("");
    setPlayerMon((prev) => ({ ...prev, currentHp: Math.max(0, prev.currentHp - 20) }));

    setIsTurnBusy(false);
  }

  // Throw Poké Ball
  async function throwBall(ballId: CaptureItemId) {
    if (isTurnBusy) return;
    setIsTurnBusy(true);
    setMenuView("main");

    appendLog(`Threw a ${CAPTURE_ITEMS[ballId].name}!`);
    setVfxFlash("ball-throw");

    await new Promise((r) => setTimeout(r, 1000));
    appendLog("The Poké Ball wobbled once...");
    await new Promise((r) => setTimeout(r, 700));
    appendLog("The Poké Ball wobbled twice...");
    await new Promise((r) => setTimeout(r, 700));

    // Catch chance based on HP and ball multiplier
    const hpFactor = (foe.maxHp * 3 - foe.currentHp * 2) / (foe.maxHp * 3);
    const catchRate = Math.min(1.0, 0.4 * hpFactor * CAPTURE_ITEMS[ballId].multiplier);

    if (Math.random() < catchRate || ballId === "master_ball") {
      appendLog(`Gotcha! ${foe.name} was caught! ✨`);
      setBattleOver("win");
      setTimeout(() => onBattleEnd("caught"), 1500);
    } else {
      appendLog(`Oh no! The wild ${foe.name} broke free!`);
      // Foe counter attacks
      const foeMove = foe.moves[0] || { name: "Scratch", type: "Normal", power: 40 };
      appendLog(`Foe ${foe.name} used ${foeMove.name}!`);
      setPlayerAnim("hit");
      await new Promise((r) => setTimeout(r, 400));
      setPlayerAnim("");
      setPlayerMon((prev) => ({ ...prev, currentHp: Math.max(0, prev.currentHp - 18) }));
      setIsTurnBusy(false);
    }
  }

  // HP Bar Percentages
  const playerHpPct = Math.round((playerMon.currentHp / playerMon.maxHp) * 100);
  const foeHpPct = Math.round((foe.currentHp / foe.maxHp) * 100);

  return (
    <div className="relative w-full h-[640px] sm:h-[720px] rounded-3xl overflow-hidden bg-gradient-to-b from-neutral-950 via-slate-900 to-neutral-950 border border-cyan-500/40 shadow-2xl flex flex-col justify-between select-none">
      {/* 3D Dynamic Battle Stadium Top Visuals */}
      <div className="relative flex-1 w-full overflow-hidden flex flex-col justify-between p-4 sm:p-6">
        {/* Stadium Background Atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/40 via-neutral-950/80 to-neutral-950 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-emerald-950/30 to-transparent pointer-events-none" />

        {/* TOP RIGHT: FOE POKEMON & STATUS CARD */}
        <div className="relative z-10 flex items-start justify-end gap-3 sm:gap-6">
          {/* Foe Status HUD */}
          <div className="w-56 sm:w-64 p-3 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800 shadow-xl flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white font-mono tracking-wide">
                {foe.name}
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">Lv. {foe.level}</span>
            </div>

            {/* Foe Types */}
            <div className="flex items-center gap-1">
              {foe.types.map((t) => {
                const conf = TYPE_COLORS[t] || TYPE_COLORS.Normal;
                return (
                  <span
                    key={t}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${conf.bg} ${conf.text} border ${conf.border}`}
                  >
                    {t}
                  </span>
                );
              })}
            </div>

            {/* HP Bar */}
            <div className="flex flex-col gap-1 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-neutral-400 font-bold">HP</span>
                <span className="text-neutral-300">
                  {foe.currentHp} / {foe.maxHp}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    foeHpPct > 50
                      ? "bg-emerald-500"
                      : foeHpPct > 20
                        ? "bg-amber-500"
                        : "bg-rose-500 animate-pulse"
                  }`}
                  style={{ width: `${foeHpPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Foe 3D Model Platform */}
          <div className="relative w-28 h-28 sm:w-40 sm:h-40 flex items-center justify-center">
            {/* Ground Ring Shadow */}
            <div className="absolute bottom-1 w-24 sm:w-32 h-8 rounded-full bg-cyan-500/20 filter blur-sm animate-pulse" />
            <img
              src={foe.spriteUrl || animatedSpriteUrl(foe.species)}
              alt={foe.name}
              className={`relative z-10 max-w-full max-h-full object-contain filter drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)] transition-transform duration-200 ${
                foeAnim === "attack"
                  ? "-translate-x-6 translate-y-6 scale-110"
                  : foeAnim === "hit"
                    ? "translate-x-3 -translate-y-3 opacity-60"
                    : foeAnim === "faint"
                      ? "translate-y-12 opacity-0"
                      : "hover:scale-105"
              }`}
            />
          </div>
        </div>

        {/* BOTTOM LEFT: PLAYER POKEMON & STATUS CARD */}
        <div className="relative z-10 flex items-end justify-start gap-3 sm:gap-6 mt-4">
          {/* Player 3D Model Platform */}
          <div className="relative w-32 h-32 sm:w-44 sm:h-44 flex items-center justify-center">
            {/* Ground Ring Shadow */}
            <div className="absolute bottom-1 w-28 sm:w-36 h-10 rounded-full bg-emerald-500/20 filter blur-sm" />
            <img
              src={playerMon.spriteUrl || animatedSpriteUrl(playerMon.species)}
              alt={playerMon.name}
              className={`relative z-10 max-w-full max-h-full object-contain filter drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)] transition-transform duration-200 ${
                playerAnim === "attack"
                  ? "translate-x-8 -translate-y-8 scale-110"
                  : playerAnim === "hit"
                    ? "-translate-x-4 translate-y-4 opacity-60"
                    : playerAnim === "faint"
                      ? "translate-y-12 opacity-0"
                      : ""
              }`}
            />
          </div>

          {/* Player Status HUD */}
          <div className="w-56 sm:w-64 p-3 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800 shadow-xl flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white font-mono tracking-wide">
                {playerMon.name}
              </span>
              <span className="text-xs font-mono font-bold text-cyan-400">
                Lv. {playerMon.level}
              </span>
            </div>

            {/* Player Types */}
            <div className="flex items-center gap-1">
              {playerMon.types.map((t) => {
                const conf = TYPE_COLORS[t] || TYPE_COLORS.Normal;
                return (
                  <span
                    key={t}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${conf.bg} ${conf.text} border ${conf.border}`}
                  >
                    {t}
                  </span>
                );
              })}
            </div>

            {/* Player HP Bar */}
            <div className="flex flex-col gap-1 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-neutral-400 font-bold">HP</span>
                <span className="text-neutral-300 font-bold">
                  {playerMon.currentHp} / {playerMon.maxHp}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    playerHpPct > 50
                      ? "bg-emerald-500"
                      : playerHpPct > 20
                        ? "bg-amber-500"
                        : "bg-rose-500 animate-pulse"
                  }`}
                  style={{ width: `${playerHpPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LOWER HALF: HD BATTLE COMMAND CONTROLLER & DIALOGUE LOG */}
      <div className="relative z-20 w-full p-3 sm:p-5 bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-800 flex flex-col gap-3">
        {/* Battle Commentary Box */}
        <div
          ref={logBoxRef}
          className="h-16 overflow-y-auto px-4 py-2 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs font-mono text-neutral-200 flex flex-col gap-1 scroll-smooth"
        >
          {battleLog.map((line, i) => (
            <p key={i} className="leading-tight">
              {line}
            </p>
          ))}
        </div>

        {/* Action Panel */}
        {battleOver ? (
          <div className="p-4 rounded-2xl bg-neutral-900 border border-cyan-500/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
              <div>
                <h4 className="text-sm font-bold text-white uppercase font-mono">
                  {battleOver === "win" ? "Victory!" : "Defeat..."}
                </h4>
                <p className="text-xs text-neutral-400">
                  {battleOver === "win"
                    ? "You won the battle and earned battle rewards!"
                    : "Blacked out and returned to camp."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onBattleEnd(battleOver)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-neutral-950 hover:brightness-110 shadow-lg font-mono text-xs"
            >
              CONTINUE
            </button>
          </div>
        ) : menuView === "fight" ? (
          /* 4 MOVES SELECTION PANE */
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-400 font-mono">CHOOSE AN ATTACK</span>
              <button
                type="button"
                onClick={() => setMenuView("main")}
                className="text-xs text-cyan-400 font-mono hover:underline"
              >
                ← Back
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {playerMon.moves.map((m, idx) => {
                const conf = TYPE_COLORS[m.type] || TYPE_COLORS.Normal;
                return (
                  <button
                    key={m.name}
                    type="button"
                    disabled={isTurnBusy || m.pp <= 0}
                    onClick={() => executeMove(idx)}
                    className="p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-cyan-500/50 transition flex flex-col justify-between text-left disabled:opacity-40"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-white text-xs font-mono">{m.name}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${conf.bg} ${conf.text}`}
                      >
                        {m.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mt-1">
                      <span>Power: {m.power}</span>
                      <span>
                        PP: {m.pp}/{m.maxPp}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : menuView === "bag" ? (
          /* BAG ITEM SELECTION PANE */
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-400 font-mono">BAG ITEMS</span>
              <button
                type="button"
                onClick={() => setMenuView("main")}
                className="text-xs text-cyan-400 font-mono hover:underline"
              >
                ← Back
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={usePotion}
                className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 flex flex-col gap-1 text-left"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 font-mono">
                  <Sparkles className="w-3.5 h-3.5" /> Potion
                </div>
                <span className="text-[10px] text-neutral-400">Restore +50 HP</span>
              </button>

              {(["poke_ball", "great_ball", "ultra_ball"] as CaptureItemId[]).map((ballId) => {
                const b = CAPTURE_ITEMS[ballId];
                const count = adventureState.inventory.captureItems[ballId] || 0;
                return (
                  <button
                    key={ballId}
                    type="button"
                    disabled={count <= 0 || isTurnBusy}
                    onClick={() => throwBall(ballId)}
                    className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 flex flex-col gap-1 text-left disabled:opacity-40"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-amber-400 font-mono">
                      <span>{b.name}</span>
                      <span className="text-neutral-400 text-[10px]">x{count}</span>
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      Capture Power x{b.multiplier}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : menuView === "pokemon" ? (
          /* POKEMON PARTY SWITCH PANE */
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-400 font-mono">SWITCH POKÉMON</span>
              <button
                type="button"
                onClick={() => setMenuView("main")}
                className="text-xs text-cyan-400 font-mono hover:underline"
              >
                ← Back
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {playerParty.map((p, idx) => (
                <button
                  key={p.name}
                  type="button"
                  disabled={idx === activePartyIdx || p.currentHp <= 0}
                  onClick={() => {
                    setActivePartyIdx(idx);
                    setPlayerMon(p);
                    setMenuView("main");
                    appendLog(`Switched to ${p.name}!`);
                  }}
                  className={`p-2.5 rounded-xl border transition flex items-center justify-between ${
                    idx === activePartyIdx
                      ? "bg-cyan-500/20 border-cyan-500/50"
                      : p.currentHp <= 0
                        ? "bg-neutral-900 opacity-40 border-neutral-800"
                        : "bg-neutral-900 hover:bg-neutral-800 border-neutral-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={p.spriteUrl || animatedSpriteUrl(p.species)}
                      alt={p.name}
                      className="w-8 h-8 object-contain"
                    />
                    <div className="text-left">
                      <div className="text-xs font-bold text-white font-mono">{p.name}</div>
                      <div className="text-[10px] text-neutral-400">Lv. {p.level}</div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] font-mono">
                    <div className={p.currentHp > 0 ? "text-emerald-400" : "text-rose-500"}>
                      {p.currentHp > 0 ? `${p.currentHp}/${p.maxHp} HP` : "FAINTED"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* 4 CORE COMMAND BUTTONS: FIGHT, BAG, POKEMON, RUN */
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              disabled={isTurnBusy || playerMon.currentHp <= 0}
              onClick={() => setMenuView("fight")}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:brightness-110 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 transition disabled:opacity-40"
            >
              <Swords className="w-4 h-4" />
              <span>FIGHT</span>
            </button>

            <button
              type="button"
              disabled={isTurnBusy}
              onClick={() => setMenuView("bag")}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-neutral-950 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 transition disabled:opacity-40"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>BAG</span>
            </button>

            <button
              type="button"
              disabled={isTurnBusy}
              onClick={() => setMenuView("pokemon")}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-neutral-950 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition disabled:opacity-40"
            >
              <Users className="w-4 h-4" />
              <span>POKÉMON</span>
            </button>

            <button
              type="button"
              disabled={isTurnBusy}
              onClick={() => {
                appendLog("Got away safely!");
                setTimeout(() => onBattleEnd("run"), 600);
              }}
              className="py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-mono font-bold text-xs flex items-center justify-center gap-2 border border-neutral-700 transition disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" />
              <span>RUN</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
