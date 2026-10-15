import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  stickToVector,
  keysToVector,
  stepVelocity,
  clampUnit,
  type Vec2,
} from "@/lib/adventure-motion";
import {
  Navigation2,
  Compass,
  Zap,
  Footprints,
  Bike,
  Car,
  MapPin,
  ChevronDown,
  Minimize2,
  Maximize2,
  Keyboard,
} from "lucide-react";

export type MoveSpeed = "walk" | "jog" | "bike" | "drive";

/** Joystick units → meters (the map multiplies each unit by 14 m). */
const JOY_METERS_PER_UNIT = 14;
/** Game-scaled pace: walk ≈ 30 m/s, jog ≈ 49, bike ≈ 81, drive ≈ 134. */
const JOY_UNITS_PER_SEC = 1.6;

const SPEED_CONFIG: Record<
  MoveSpeed,
  { label: string; kmh: number; stepPct: number; icon: React.ComponentType<{ className?: string }> }
> = {
  walk: { label: "Walk", kmh: 12.0, stepPct: 1.35, icon: Footprints },
  jog: { label: "Jog", kmh: 22.0, stepPct: 2.2, icon: Zap },
  bike: { label: "Bike", kmh: 40.0, stepPct: 3.6, icon: Bike },
  drive: { label: "Drive", kmh: 75.0, stepPct: 6.0, icon: Car },
};

export const POPULAR_HOTSPOTS = [
  { name: "Local GPS", xPct: 50, yPct: 50, desc: "Current Device Location" },
  {
    name: "🌳 Dresden Park (Rare Nest)",
    xPct: 50,
    yPct: 50,
    lat: 33.8824,
    lng: -84.2811,
    desc: "Down the Street · 5x Rare Nest Spawns",
  },
  {
    name: "Central Park, NY",
    xPct: 50,
    yPct: 50,
    lat: 40.7829,
    lng: -73.9654,
    desc: "Dense PokéStops & Lures",
  },
  {
    name: "Tokyo Akihabara",
    xPct: 50,
    yPct: 50,
    lat: 35.6984,
    lng: 139.7731,
    desc: "Legendary Raid District",
  },
  {
    name: "Santa Monica Pier",
    xPct: 50,
    yPct: 50,
    lat: 34.01,
    lng: -118.5,
    desc: "Water & Rare Spawns",
  },
  {
    name: "Sydney Circular Quay",
    xPct: 50,
    yPct: 50,
    lat: -33.86,
    lng: 151.21,
    desc: "Oceanic Event Hub",
  },
  {
    name: "Kanto · Indigo Gate",
    xPct: 50,
    yPct: 50,
    lat: 35.68,
    lng: 139.76,
    desc: "God's Eye · Gen 1 GBA map",
  },
  {
    name: "Johto · Violet",
    xPct: 50,
    yPct: 50,
    lat: 35.01,
    lng: 135.77,
    desc: "God's Eye · Gen 2 GBA map",
  },
  {
    name: "Hoenn · Littleroot seas",
    xPct: 50,
    yPct: 50,
    lat: 26.21,
    lng: 127.68,
    desc: "God's Eye · Gen 3 GBA map",
  },
  {
    name: "Sinnoh · Snowpoint",
    xPct: 50,
    yPct: 50,
    lat: 43.06,
    lng: 141.35,
    desc: "God's Eye · Gen 4 GBA map",
  },
  {
    name: "Paldea · Mesagoza",
    xPct: 50,
    yPct: 50,
    lat: 40.4,
    lng: -3.7,
    desc: "God's Eye · Gen 9 GBA map",
  },
];

export function AdventureJoystick({
  onMove,
  onTeleport,
  onSpeedChange,
  currentCoords,
}: {
  onMove: (deltaX: number, deltaY: number, distanceMeters: number) => void;
  onTeleport: (
    xPct: number,
    yPct: number,
    hotspotName: string,
    geo?: { lat: number; lng: number },
  ) => void;
  onSpeedChange?: (speed: MoveSpeed) => void;
  currentCoords: { xPct: number; yPct: number };
}) {
  const [speed, setSpeed] = useState<MoveSpeed>("walk");
  const [autoWalk, setAutoWalk] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hotspotMenuOpen, setHotspotMenuOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);

  const thumbRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  /** Stick target from pointer/touch, unit disc (after deadzone + curve). */
  const stickVecRef = useRef<Vec2 | null>(null);
  /** Raw thumb offset in px while dragging (visual only). */
  const thumbPxRef = useRef<Vec2>({ x: 0, y: 0 });
  const keyVecRef = useRef<Vec2>({ x: 0, y: 0 });
  const velRef = useRef<Vec2>({ x: 0, y: 0 });
  const isPointerActiveRef = useRef(false);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const radiusRef = useRef(40);

  // Speed configuration
  const currentSpeedConfig = SPEED_CONFIG[speed];

  const onSpeedChangeRef = useRef(onSpeedChange);
  onSpeedChangeRef.current = onSpeedChange;
  const handleSpeedSelect = useCallback((s: MoveSpeed) => {
    setSpeed(s);
    onSpeedChangeRef.current?.(s);
  }, []);

  // Analog movement loop (requestAnimationFrame + delta time).
  // Velocity eases toward the stick/keyboard target (accel/decel), so starts
  // and stops feel weighty like GO instead of snapping. Moves are batched at
  // ~30 Hz so the world state is not cloned + saved every frame; the map's
  // camera eases between batches so motion still looks continuous.
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const speedRef = useRef(currentSpeedConfig);
  speedRef.current = currentSpeedConfig;
  const autoWalkRef = useRef(autoWalk);
  autoWalkRef.current = autoWalk;
  useEffect(() => {
    let animId: number;
    let last = performance.now();
    let acc = 0;
    let accDx = 0;
    let accDy = 0;
    const FLUSH_SEC = 1 / 30;

    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      let target: Vec2 = stickVecRef.current ?? keyVecRef.current;
      if (target.x === 0 && target.y === 0 && autoWalkRef.current) {
        const angle = now / 4000;
        target = { x: Math.cos(angle) * 0.7, y: Math.sin(angle) * 0.7 };
      }
      target = clampUnit(target);
      const v = stepVelocity(velRef.current, target, dt);
      velRef.current = v;

      // Thumb visual: follows the finger while dragging, otherwise shows the
      // eased velocity so it springs back smoothly.
      const thumb = thumbRef.current;
      if (thumb) {
        const r = radiusRef.current;
        const t = isPointerActiveRef.current ? thumbPxRef.current : { x: v.x * r, y: v.y * r };
        thumb.style.transform = `translate3d(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px, 0)`;
      }

      if (v.x !== 0 || v.y !== 0) {
        const step = speedRef.current.stepPct * JOY_UNITS_PER_SEC * dt;
        accDx += v.x * step;
        accDy += v.y * step;
        acc += dt;
        if (acc >= FLUSH_SEC) {
          const meters = Math.hypot(accDx, accDy) * JOY_METERS_PER_UNIT;
          onMoveRef.current(accDx, accDy, meters);
          acc = 0;
          accDx = 0;
          accDy = 0;
        }
      } else if (accDx !== 0 || accDy !== 0) {
        onMoveRef.current(accDx, accDy, Math.hypot(accDx, accDy) * JOY_METERS_PER_UNIT);
        acc = 0;
        accDx = 0;
        accDy = 0;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Keyboard: arrows + WASD (diagonals normalised), 1-4 for speed.
  useEffect(() => {
    const has = (...k: string[]) => k.some((x) => pressedKeysRef.current.has(x));
    function computeKeyVector() {
      keyVecRef.current = keysToVector(
        has("ArrowUp", "KeyW"),
        has("ArrowDown", "KeyS"),
        has("ArrowLeft", "KeyA"),
        has("ArrowRight", "KeyD"),
      );
    }
    const MONITORED = new Set([
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyS", "KeyA", "KeyD",
    ]);

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (MONITORED.has(e.code)) {
        e.preventDefault();
        pressedKeysRef.current.add(e.code);
        computeKeyVector();
      }
      if (e.key === "1") handleSpeedSelect("walk");
      if (e.key === "2") handleSpeedSelect("jog");
      if (e.key === "3") handleSpeedSelect("bike");
      if (e.key === "4") handleSpeedSelect("drive");
    }

    function handleKeyUp(e: KeyboardEvent) {
      pressedKeysRef.current.delete(e.code);
      computeKeyVector();
    }
    // Releasing keys while the tab is hidden would otherwise leave you walking forever.
    function clearKeys() {
      pressedKeysRef.current.clear();
      computeKeyVector();
    }

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", clearKeys);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", clearKeys);
    };
  }, [handleSpeedSelect]);

  // Touch / mouse / pen via Pointer Events with pointer capture, so the stick
  // keeps tracking when the finger slides off the base.
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const base = baseRef.current;
    if (!base) return;
    try {
      base.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events */
    }
    isPointerActiveRef.current = true;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 20;
    radiusRef.current = maxRadius;
    const pointerId = e.pointerId;

    const update = (clientX: number, clientY: number) => {
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const len = Math.hypot(dx, dy);
      const k = len > maxRadius ? maxRadius / len : 1;
      thumbPxRef.current = { x: dx * k, y: dy * k };
      const v = stickToVector(dx, dy, maxRadius);
      stickVecRef.current = v.x === 0 && v.y === 0 ? { x: 0, y: 0 } : v;
    };
    update(e.clientX, e.clientY);

    const onPointerMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      update(ev.clientX, ev.clientY);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      base.removeEventListener("pointermove", onPointerMove);
      base.removeEventListener("pointerup", end);
      base.removeEventListener("pointercancel", end);
      base.removeEventListener("lostpointercapture", end);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", end);
      isPointerActiveRef.current = false;
      stickVecRef.current = null;
      thumbPxRef.current = { x: 0, y: 0 };
    };
    base.addEventListener("pointermove", onPointerMove);
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);
    base.addEventListener("lostpointercapture", end);
    // Fallback when capture is unavailable.
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", end);
  }

  // Quick directional step on button tap
  function stepDirection(dx: number, dy: number) {
    const step = currentSpeedConfig.stepPct * 1.5;
    onMove(dx * step, dy * step, Math.round(step * JOY_METERS_PER_UNIT));
  }

  if (minimized) {
    return (
      <div className="absolute bottom-24 left-4 z-40">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="p-3 rounded-2xl bg-neutral-950/80 backdrop-blur-md border border-cyan-500/40 text-cyan-400 shadow-2xl hover:scale-105 transition flex items-center gap-2 text-xs font-mono font-bold"
          title="Open GPS Joystick"
        >
          <Compass className="w-5 h-5 text-cyan-400 animate-spin-slow" />
          <span>JOYSTICK ON</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-20 left-3 sm:left-6 z-40 flex flex-col items-start gap-2 select-none">
      {/* Mini Bar: Speed Controls & Hotspot Menu */}
      <div className="pv-lw-minibar relative flex items-center gap-1.5 p-1.5 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800/80 shadow-2xl text-xs font-mono">
        {/* Speed: one compact chip; tap to reveal walk / run / bike / drive + auto */}
        {(() => {
          const Cur = SPEED_CONFIG[speed].icon;
          return (
            <button
              type="button"
              onClick={() => setSpeedOpen((o) => !o)}
              className={`pv-lw-mini ${speedOpen ? "on" : ""} ${autoWalk ? "auto" : ""}`}
              aria-expanded={speedOpen}
              aria-label={`Movement: ${SPEED_CONFIG[speed].label}${autoWalk ? ", auto-walk on" : ""}`}
              title="Movement mode"
            >
              <Cur className="w-4 h-4" />
              <span className="hidden min-[380px]:inline">{SPEED_CONFIG[speed].label}</span>
              {autoWalk && <span className="pv-lw-auto-dot" aria-hidden />}
              <ChevronDown className={`w-3 h-3 transition ${speedOpen ? "rotate-180" : ""}`} />
            </button>
          );
        })()}
        {speedOpen && (
          <div className="pv-lw-speed-pop" role="group" aria-label="Movement mode">
            {(["walk", "jog", "bike", "drive"] as MoveSpeed[]).map((s) => {
              const Icon = SPEED_CONFIG[s].icon;
              const active = speed === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    handleSpeedSelect(s);
                    setSpeedOpen(false);
                  }}
                  className={active ? "on" : ""}
                  aria-pressed={active}
                  title={`${SPEED_CONFIG[s].label} (${SPEED_CONFIG[s].kmh} km/h) [Key ${
                    s === "walk" ? 1 : s === "jog" ? 2 : s === "bike" ? 3 : 4
                  }]`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{SPEED_CONFIG[s].label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setAutoWalk(!autoWalk)}
              className={autoWalk ? "on auto" : ""}
              aria-pressed={autoWalk}
              title="Automatic Wander / Patrol"
            >
              <span>AUTO</span>
            </button>
          </div>
        )}

        {/* Teleport Hotspots Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setHotspotMenuOpen(!hotspotMenuOpen)}
            className="pv-lw-mini"
            title="Teleport Hotspots"
            aria-label="Warp to a hotspot"
            aria-expanded={hotspotMenuOpen}
          >
            <MapPin className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">WARP</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {hotspotMenuOpen && (
            <div className="absolute bottom-full mb-2 left-0 w-52 p-2 rounded-xl bg-neutral-950/95 backdrop-blur-md border border-neutral-700 shadow-2xl flex flex-col gap-1 z-50">
              <div className="text-[10px] uppercase font-bold text-neutral-400 px-2 py-1 border-b border-neutral-800">
                GPS Teleport Hotspots
              </div>
              {POPULAR_HOTSPOTS.map((h) => (
                <button
                  key={h.name}
                  type="button"
                  onClick={() => {
                    onTeleport(
                      h.xPct,
                      h.yPct,
                      h.name,
                      typeof h.lat === "number" && typeof h.lng === "number"
                        ? { lat: h.lat, lng: h.lng }
                        : undefined,
                    );
                    setHotspotMenuOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-cyan-500/20 hover:text-cyan-300 transition flex flex-col"
                >
                  <span className="font-bold text-white text-xs">{h.name}</span>
                  <span className="text-[10px] text-neutral-400">{h.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Arrow Keys Support Hint */}
        <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-[10px] text-cyan-400">
          <Keyboard className="w-3 h-3" />
          <span className="font-bold">↑↓←→</span>
        </div>

        {/* Minimize Button */}
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="pv-lw-mini icon"
          title="Minimize Joystick"
          aria-label="Minimize joystick"
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Circular Analog Thumbstick Base */}
      <div
        ref={baseRef}
        onPointerDown={handlePointerDown}
        data-joy-base
        role="application"
        aria-label="Movement joystick. Drag, or use arrow keys / WASD."
        className="pv-go-stick relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
      >
        {/* Cardinal Direction Indicators */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            stepDirection(0, -1);
          }}
          className="pv-go-dir absolute top-1 text-[10px] font-bold p-1"
          title="North / Arrow Up"
        >
          ▲ N
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            stepDirection(1, 0);
          }}
          className="pv-go-dir absolute right-1 text-[10px] font-bold p-1"
          title="East / Arrow Right"
        >
          E ▶
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            stepDirection(0, 1);
          }}
          className="pv-go-dir absolute bottom-1 text-[10px] font-bold p-1"
          title="South / Arrow Down"
        >
          ▼ S
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            stepDirection(-1, 0);
          }}
          className="pv-go-dir absolute left-1 text-[10px] font-bold p-1"
          title="West / Arrow Left"
        >
          ◀ W
        </button>

        {/* Inner Guide Ring */}
        <div className="pv-go-ring w-16 h-16 rounded-full pointer-events-none" />

        {/* Movable Thumbstick Puck */}
        <div
          ref={thumbRef}
          className="pv-go-thumb absolute w-12 h-12 rounded-full flex items-center justify-center pointer-events-none will-change-transform"
        >
          <Navigation2 className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}
