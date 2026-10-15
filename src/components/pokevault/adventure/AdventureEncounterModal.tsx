import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Zap, Target, Swords, X, CheckCircle, ExternalLink } from "lucide-react";
import {
  type AdventureState,
  type WildCreature,
  type CaptureItemId,
  CAPTURE_ITEMS,
  attemptCapture,
} from "@/lib/adventure-engine";
import { addWildCatchToParty } from "@/lib/adventure-party";
import { WorldSprite } from "./WorldSprite";
import { throwRating, pathTurn, type Vec2 } from "@/lib/adventure-motion";

const RING_PERIOD_MS = 1600;
/** Matches the pv-go-ring keyframes (1 → 0.25 → 1, ease-in-out). */
function ringScaleAt(ms: number): number {
  return 0.625 + 0.375 * Math.cos((2 * Math.PI * ms) / RING_PERIOD_MS);
}

export function AdventureEncounterModal({
  creature,
  adventureState,
  onClose,
  onStateUpdate,
  onSwitchToBattle,
  onOpenVault,
}: {
  creature: WildCreature;
  adventureState: AdventureState;
  onClose: () => void;
  onStateUpdate: (updated: AdventureState) => void;
  onSwitchToBattle: () => void;
  onOpenVault?: () => void;
}) {
  const [selectedBall, setSelectedBall] = useState<CaptureItemId>("poke_ball");
  const [selectedBerry, setSelectedBerry] = useState<CaptureItemId | undefined>(undefined);
  const [isThrowing, setIsThrowing] = useState(false);
  const [throwPhase, setThrowPhase] = useState<
    "aiming" | "flying" | "shaking" | "caught" | "escaped"
  >("aiming");
  const [captureReward, setCaptureReward] = useState<{
    xp: number;
    coins: number;
    candies: number;
    rareCandyChance: boolean;
  } | null>(null);

  const availableBalls = (
    ["poke_ball", "great_ball", "ultra_ball", "master_ball"] as CaptureItemId[]
  ).filter((b) => (adventureState.inventory.captureItems[b] || 0) > 0);

  const availableBerries = (
    ["razz_berry", "nanab_berry", "pinap_berry", "golden_razz"] as CaptureItemId[]
  ).filter((b) => (adventureState.inventory.captureItems[b] || 0) > 0);

  const [partyNote, setPartyNote] = useState<string | null>(null);
  const stateRef = useRef(adventureState);
  stateRef.current = adventureState;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  // When the selected ball / berry runs out, fall back to one you still have
  // (previously the empty ball stayed selected and every throw "escaped").
  const outOfBalls = availableBalls.length === 0;
  const ballsKey = availableBalls.join(",");
  const berriesKey = availableBerries.join(",");
  useEffect(() => {
    const balls = ballsKey ? (ballsKey.split(",") as CaptureItemId[]) : [];
    const berries = berriesKey ? (berriesKey.split(",") as CaptureItemId[]) : [];
    if (!balls.includes(selectedBall) && balls[0]) setSelectedBall(balls[0]);
    if (selectedBerry && !berries.includes(selectedBerry)) setSelectedBerry(undefined);
  }, [ballsKey, berriesKey, selectedBall, selectedBerry]);

  const ringStartRef = useRef(performance.now());
  useEffect(() => {
    if (throwPhase === "aiming") ringStartRef.current = performance.now();
  }, [throwPhase]);
  const [lastThrow, setLastThrow] = useState<{ rating: "nice" | "great" | "excellent"; curve: boolean } | null>(null);
  const swipeRef = useRef<Vec2[] | null>(null);
  const ringColor = creature.cp < 500 ? "#4ade80" : creature.cp < 1500 ? "#fb923c" : "#ef4444";

  function onBallPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (isThrowing || throwPhase !== "aiming" || outOfBalls) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    swipeRef.current = [{ x: e.clientX, y: e.clientY }];
  }
  function onBallPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    swipeRef.current?.push({ x: e.clientX, y: e.clientY });
  }
  function onBallPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const pts = swipeRef.current;
    swipeRef.current = null;
    if (!pts) return;
    pts.push({ x: e.clientX, y: e.clientY });
    const rise = pts[0].y - pts[pts.length - 1].y;
    const curve = Math.abs(pathTurn(pts)) > Math.PI * 1.5;
    // A tap (no swipe) still throws, like the old button; a flick up or a spin
    // is the GO gesture.
    if (rise > 40 || curve || Math.hypot(pts[0].x - e.clientX, pts[0].y - e.clientY) < 8) {
      handleThrow(curve);
    }
  }

  function handleThrow(curve = false) {
    if (isThrowing || throwPhase !== "aiming" || outOfBalls) return;
    if ((stateRef.current.inventory.captureItems[selectedBall] || 0) <= 0) return;
    const rating = throwRating(ringScaleAt(performance.now() - ringStartRef.current));
    setLastThrow({ rating, curve });
    setIsThrowing(true);
    setThrowPhase("flying");

    timersRef.current.push(
      setTimeout(() => {
        setThrowPhase("shaking");

        timersRef.current.push(
          setTimeout(() => {
            const res = attemptCapture(
              stateRef.current,
              creature.id,
              selectedBall,
              selectedBerry,
              rating,
              { curveball: curve },
            );
            if (res.success && res.rewards) {
              setThrowPhase("caught");
              setCaptureReward(res.rewards);
              onStateUpdate(res.state);
              addWildCatchToParty(creature.species, creature.level, creature.types)
                .then(() => setPartyNote(`${creature.species} joined your Adventure party.`))
                .catch((e) => {
                  console.error(e);
                  setPartyNote("Caught! (Saving it to your party failed — check your connection.)");
                });
            } else {
              setThrowPhase("escaped");
              onStateUpdate(res.state);
              timersRef.current.push(setTimeout(() => setThrowPhase("aiming"), 1400));
            }
            setIsThrowing(false);
          }, 1600),
        );
      }, 800),
    );
  }

  return (
    <div className="pv-adv-encounter fixed inset-0 z-50 flex justify-center overflow-y-auto p-3 sm:p-4 pb-[calc(var(--pv-tabbar-h,84px)+var(--pv-safe-b,0px)+16px)] bg-sky-950/60 backdrop-blur-md">
      <div className="relative my-auto w-full max-w-lg rounded-3xl bg-white/95 border border-white shadow-2xl flex flex-col items-center gap-3 text-center overflow-hidden pb-5">
        {/* GO-style scene: sky, hills, ground disc, Pokémon centred, ring + ball */}
        <div
          className="pv-go-enc-scene relative w-full h-[27rem] sm:h-[29rem] overflow-hidden"
          data-throw-phase={throwPhase}
        >
          <div className="pv-go-enc-hill" aria-hidden />
          <div className="pv-go-enc-ground" aria-hidden />

          {/* Top bar: run away (left), battle (right) */}
          <div className="absolute top-3 inset-x-3 flex items-center justify-between z-40">
            <button
              type="button"
              onClick={onClose}
              aria-label="Run away"
              className="w-10 h-10 rounded-full bg-white/85 text-sky-900 shadow flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onSwitchToBattle}
              className="px-3 py-1.5 rounded-full bg-white/85 text-rose-600 shadow text-xs font-bold flex items-center gap-1.5"
              title="Fight in HD Turn-Based Battle"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>BATTLE</span>
            </button>
          </div>

          {/* Name + CP label, GO-style, above the Pokémon */}
          <div className="absolute top-12 inset-x-0 flex flex-col items-center z-30 pv-go-cp">
            <span className="text-sm font-bold tracking-wide opacity-95">CP</span>
            <span className="text-4xl font-extrabold leading-none" data-testid="enc-cp">
              {creature.cp}
            </span>
            <span className="mt-1 text-lg font-bold">{creature.species}</span>
            <span className="text-[11px] font-semibold opacity-90">
              Lv. {creature.level} · {creature.types.join(" / ")} · ~{creature.distanceMeters}m
            </span>
          </div>

          {/* Pokémon */}
          <WorldSprite
            name={creature.species}
            className={`absolute left-1/2 bottom-[33%] -translate-x-1/2 w-36 h-36 object-contain z-20 drop-shadow-[0_10px_10px_rgba(0,0,0,0.35)] transition-all duration-300 ${
              throwPhase === "shaking"
                ? "scale-0 opacity-0"
                : throwPhase === "caught"
                  ? "scale-0 opacity-0"
                  : ""
            }`}
          />

          {/* Target ring: shrinks and grows; smaller ring = better throw */}
          {throwPhase === "aiming" && !outOfBalls && (
            <>
              <div className="pv-go-target-outer z-20" aria-hidden />
              <div
                className="pv-go-target z-20"
                style={{ ["--pv-ring" as string]: ringColor } as React.CSSProperties}
                aria-hidden
              />
            </>
          )}

          {/* Ball in flight (straight or curveball arc) */}
          {throwPhase === "flying" && (
            <div
              className="pv-go-ball pv-go-ball-fly"
              data-ball={selectedBall}
              data-curve={lastThrow?.curve ? "1" : undefined}
              aria-hidden
            />
          )}
          {throwPhase === "shaking" && (
            <div
              className="absolute left-1/2 bottom-[35%] -ml-6 w-12 h-12 z-30 pv-go-ball pv-go-ball-shake"
              data-ball={selectedBall}
              aria-hidden
            />
          )}
          {lastThrow && (throwPhase === "shaking" || throwPhase === "flying") && (
            <div className="absolute inset-x-0 top-[42%] z-40 text-2xl font-extrabold text-white pv-go-rating">
              {lastThrow.rating === "excellent" ? "Excellent!" : lastThrow.rating === "great" ? "Great!" : "Nice!"}
              {lastThrow.curve && <span className="block text-sm">Curveball!</span>}
            </div>
          )}

          {/* Ball at bottom centre: tap, flick up, or spin then flick */}
          {throwPhase !== "caught" && (
            <div className="absolute bottom-4 inset-x-0 flex flex-col items-center z-40">
              <button
                type="button"
                data-testid="go-ball"
                aria-label={`Throw ${CAPTURE_ITEMS[selectedBall].name}`}
                disabled={isThrowing || outOfBalls || throwPhase !== "aiming"}
                onPointerDown={onBallPointerDown}
                onPointerMove={onBallPointerMove}
                onPointerUp={onBallPointerUp}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleThrow(false);
                  }
                }}
                className={`pv-go-ball ${throwPhase === "flying" ? "opacity-0" : ""} disabled:opacity-40`}
                data-ball={selectedBall}
              />
              <span className="mt-1 px-2 py-0.5 rounded-full bg-white/85 text-[10px] font-bold text-sky-900">
                {CAPTURE_ITEMS[selectedBall].name} × {adventureState.inventory.captureItems[selectedBall] || 0}
              </span>
            </div>
          )}
        </div>

        {creature.isParkNest && (
          <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 text-[11px] font-bold flex items-center gap-1.5">
            <span>🌳</span>
            <span>DRESDEN PARK RARE NEST</span>
            <span className="text-amber-600">· +50% CANDY BONUS</span>
          </div>
        )}
        <div className="text-[11px] text-slate-500">
          {creature.relatedCardsCount} related TCG cards · tap the ball, flick it up, or spin it first for a curveball
        </div>
        <div className="w-full px-5 flex flex-col gap-3 pv-go-enc-dock">
        {/* Post-Catch Celebration */}
        {throwPhase === "caught" && captureReward ? (
          <div className="w-full p-4 rounded-2xl bg-neutral-900 border border-emerald-500/40 flex flex-col gap-2 font-mono">
            <div className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              <span>{creature.species} WAS CAUGHT!</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs pt-1">
              <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-amber-400 font-bold">+{captureReward.coins}</span>
                <span className="block text-[10px] text-neutral-400">Coins</span>
              </div>
              <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-cyan-400 font-bold">+{captureReward.xp}</span>
                <span className="block text-[10px] text-neutral-400">XP</span>
              </div>
              <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-emerald-400 font-bold">+{captureReward.candies}</span>
                <span className="block text-[10px] text-neutral-400">Candies</span>
              </div>
            </div>
            {creature.isParkNest && (
              <span className="text-xs text-emerald-300 font-bold flex items-center justify-center gap-1">
                <span>🌳</span> Dresden Park Nest Bonus: +50% Extra Candies Awarded!
              </span>
            )}
            {partyNote && <span className="text-xs text-cyan-300 font-bold">🎒 {partyNote}</span>}
            {captureReward.rareCandyChance && (
              <span className="text-xs text-amber-300 font-bold">
                ✨ Bonus: +1 Rare Candy Dropped!
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs"
            >
              CONTINUE
            </button>
          </div>
        ) : (
          /* BALL & BERRY SELECTION DOCK */
          <div className="w-full flex flex-col gap-3">
            {/* Balls Picker */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 font-bold">POKÉ BALLS</span>
              <div className="flex items-center gap-1.5">
                {availableBalls.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBall(b)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
                      selectedBall === b
                        ? "bg-cyan-500 text-neutral-950 border-cyan-400 shadow"
                        : "bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    {CAPTURE_ITEMS[b].name} ({adventureState.inventory.captureItems[b] || 0})
                  </button>
                ))}
              </div>
            </div>

            {/* Berries Picker */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 font-bold">BERRIES</span>
              <div className="flex items-center gap-1.5">
                {availableBerries.map((berry) => (
                  <button
                    key={berry}
                    type="button"
                    onClick={() => setSelectedBerry(selectedBerry === berry ? undefined : berry)}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition ${
                      selectedBerry === berry
                        ? "bg-amber-500 text-neutral-950 border-amber-400 shadow"
                        : "bg-slate-100 border-slate-200 text-slate-600"
                    }`}
                  >
                    {CAPTURE_ITEMS[berry].name} ({adventureState.inventory.captureItems[berry] || 0}
                    )
                  </button>
                ))}
              </div>
            </div>

            {throwPhase === "escaped" && (
              <div className="text-xs font-mono font-bold text-rose-300" role="status">
                💢 {creature.species} broke free! Try again.
              </div>
            )}
            {outOfBalls && (
              <div className="text-xs font-mono text-amber-300" role="status">
                You're out of Poké Balls — spin a landmark or visit the Shop for more.
              </div>
            )}

            {/* Throw Action */}
            <button
              type="button"
              disabled={isThrowing || outOfBalls || throwPhase !== "aiming"}
              onClick={() => handleThrow(false)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-neutral-950 font-mono font-bold text-xs tracking-wider shadow-xl shadow-cyan-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Target className="w-4 h-4" />
              <span>
                {isThrowing
                  ? "THROWING..."
                  : outOfBalls
                    ? "NO POKÉ BALLS LEFT"
                    : `THROW ${CAPTURE_ITEMS[selectedBall].name.toUpperCase()}`}
              </span>
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
