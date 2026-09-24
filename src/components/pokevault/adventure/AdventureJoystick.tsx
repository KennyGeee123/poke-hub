import React, { useState, useRef, useEffect } from "react";
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

  const thumbRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const activeMoveRef = useRef<{ dx: number; dy: number } | null>(null);
  const isPointerActiveRef = useRef(false);
  const pressedKeysRef = useRef<Set<string>>(new Set());

  // Speed configuration
  const currentSpeedConfig = SPEED_CONFIG[speed];

  function handleSpeedSelect(s: MoveSpeed) {
    setSpeed(s);
    onSpeedChange?.(s);
  }

  // Continuous movement loop while holding joystick or pressing arrow keys.
  // Time-based (not per-frame) so speed is the same on 60/120 Hz screens, and
  // batched to ~15 updates/s so the world state is not cloned + saved 60×/s.
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  useEffect(() => {
    let animId: number;
    let last = performance.now();
    let acc = 0;
    let accDx = 0;
    let accDy = 0;
    const FLUSH_SEC = 1 / 15;

    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      let vec: { dx: number; dy: number } | null = activeMoveRef.current;
      let scale = 1;
      if (!vec && autoWalk) {
        // Subtle wander simulation
        const angle = Date.now() / 4000;
        vec = { dx: Math.cos(angle), dy: Math.sin(angle) };
        scale = 0.7;
      }
      if (vec) {
        const step = currentSpeedConfig.stepPct * scale * JOY_UNITS_PER_SEC * dt;
        accDx += vec.dx * step;
        accDy += vec.dy * step;
        acc += dt;
        if (acc >= FLUSH_SEC) {
          const meters = Math.hypot(accDx, accDy) * JOY_METERS_PER_UNIT;
          onMoveRef.current(accDx, accDy, meters);
          acc = 0;
          accDx = 0;
          accDy = 0;
        }
      } else {
        acc = 0;
        accDx = 0;
        accDy = 0;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [currentSpeedConfig, autoWalk]);

  // Keyboard Arrow Keys & WASD Event Listeners
  useEffect(() => {
    function computeKeyVector() {
      let kx = 0;
      let ky = 0;
      const keys = pressedKeysRef.current;

      if (keys.has("ArrowUp") || keys.has("KeyW") || keys.has("w") || keys.has("W")) ky -= 1;
      if (keys.has("ArrowDown") || keys.has("KeyS") || keys.has("s") || keys.has("S")) ky += 1;
      if (keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("a") || keys.has("A")) kx -= 1;
      if (keys.has("ArrowRight") || keys.has("KeyD") || keys.has("d") || keys.has("D")) kx += 1;

      if (kx !== 0 || ky !== 0) {
        const len = Math.hypot(kx, ky);
        const normX = kx / len;
        const normY = ky / len;
        activeMoveRef.current = { dx: normX, dy: normY };

        // Animate virtual thumbstick puck
        if (thumbRef.current) {
          const maxRadius = 34;
          thumbRef.current.style.transform = `translate(${normX * maxRadius}px, ${normY * maxRadius}px)`;
        }
      } else {
        if (!isPointerActiveRef.current) {
          activeMoveRef.current = null;
          if (thumbRef.current) {
            thumbRef.current.style.transform = "translate(0px, 0px)";
          }
        }
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      const monitored = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "KeyW",
        "KeyS",
        "KeyA",
        "KeyD",
        "w",
        "W",
        "s",
        "S",
        "a",
        "A",
        "d",
        "D",
      ];

      if (monitored.includes(e.code) || monitored.includes(e.key)) {
        e.preventDefault();
        pressedKeysRef.current.add(e.code);
        pressedKeysRef.current.add(e.key);
        computeKeyVector();
      }

      // Quick speed toggle via number keys 1, 2, 3, 4
      if (e.key === "1") handleSpeedSelect("walk");
      if (e.key === "2") handleSpeedSelect("jog");
      if (e.key === "3") handleSpeedSelect("bike");
      if (e.key === "4") handleSpeedSelect("drive");
    }

    function handleKeyUp(e: KeyboardEvent) {
      pressedKeysRef.current.delete(e.code);
      pressedKeysRef.current.delete(e.key);
      computeKeyVector();
    }

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleSpeedSelect]);

  // Touch / Pointer Joystick Dragging
  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const base = baseRef.current;
    if (!base) return;

    isPointerActiveRef.current = true;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const updateFromPointer = (clientX: number, clientY: number) => {
      const rawDx = clientX - centerX;
      const rawDy = clientY - centerY;
      const distance = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
      const maxRadius = rect.width / 2 - 16;

      const clampedDist = Math.min(distance, maxRadius);
      const angle = Math.atan2(rawDy, rawDx);

      const normX = clampedDist > 5 ? (Math.cos(angle) * clampedDist) / maxRadius : 0;
      const normY = clampedDist > 5 ? (Math.sin(angle) * clampedDist) / maxRadius : 0;

      if (thumbRef.current) {
        thumbRef.current.style.transform = `translate(${normX * maxRadius}px, ${normY * maxRadius}px)`;
      }

      activeMoveRef.current = clampedDist > 5 ? { dx: normX, dy: normY } : null;
    };

    updateFromPointer(e.clientX, e.clientY);

    const onPointerMove = (moveEvt: PointerEvent) => {
      updateFromPointer(moveEvt.clientX, moveEvt.clientY);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      isPointerActiveRef.current = false;
      if (pressedKeysRef.current.size === 0) {
        if (thumbRef.current) {
          thumbRef.current.style.transform = `translate(0px, 0px)`;
        }
        activeMoveRef.current = null;
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
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
      <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800/80 shadow-2xl text-xs font-mono">
        {/* Speed Selector */}
        <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
          {(["walk", "jog", "bike", "drive"] as MoveSpeed[]).map((s) => {
            const Icon = SPEED_CONFIG[s].icon;
            const active = speed === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleSpeedSelect(s)}
                className={`p-1.5 rounded-md transition flex items-center justify-center ${
                  active
                    ? "bg-cyan-500 text-neutral-950 font-bold shadow-md shadow-cyan-500/30"
                    : "text-neutral-400 hover:text-white"
                }`}
                title={`${SPEED_CONFIG[s].label} (${SPEED_CONFIG[s].kmh} km/h) [Key ${
                  s === "walk" ? 1 : s === "jog" ? 2 : s === "bike" ? 3 : 4
                }]`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>

        {/* Auto Walk Toggle */}
        <button
          type="button"
          onClick={() => setAutoWalk(!autoWalk)}
          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
            autoWalk
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse"
              : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
          }`}
          title="Automatic Wander / Patrol"
        >
          <span>AUTO</span>
        </button>

        {/* Teleport Hotspots Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setHotspotMenuOpen(!hotspotMenuOpen)}
            className="px-2 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 flex items-center gap-1 text-[11px]"
            title="Teleport Hotspots"
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
          className="p-1 rounded-lg text-neutral-400 hover:text-white"
          title="Minimize Joystick"
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Circular Analog Thumbstick Base */}
      <div
        ref={baseRef}
        onPointerDown={handlePointerDown}
        className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-neutral-950/80 backdrop-blur-md border-2 border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.25)] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
      >
        {/* Cardinal Direction Indicators */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            stepDirection(0, -1);
          }}
          className="absolute top-1 text-[10px] font-mono text-cyan-400/80 hover:text-cyan-200 font-bold p-1"
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
          className="absolute right-1 text-[10px] font-mono text-cyan-400/80 hover:text-cyan-200 font-bold p-1"
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
          className="absolute bottom-1 text-[10px] font-mono text-cyan-400/80 hover:text-cyan-200 font-bold p-1"
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
          className="absolute left-1 text-[10px] font-mono text-cyan-400/80 hover:text-cyan-200 font-bold p-1"
          title="West / Arrow Left"
        >
          ◀ W
        </button>

        {/* Inner Guide Ring */}
        <div className="w-16 h-16 rounded-full border border-dashed border-cyan-500/25 pointer-events-none" />

        {/* Movable Thumbstick Puck */}
        <div
          ref={thumbRef}
          className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.6)] border-2 border-white/60 flex items-center justify-center pointer-events-none transition-transform duration-75"
        >
          <Navigation2 className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}
