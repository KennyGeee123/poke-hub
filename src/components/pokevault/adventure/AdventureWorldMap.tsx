import React, { useState, useEffect, useRef } from "react";
import {
  Compass,
  MapPin,
  Sparkles,
  Sun,
  Moon,
  CloudRain,
  CloudSnow,
  Wind,
  Zap,
  Swords,
  Layers,
  LocateFixed,
  Eye,
  ShoppingBag,
} from "lucide-react";
import {
  type AdventureState,
  type WildCreature,
  type DiscoveryPoint,
  type BattleArena,
  type CardCacheDrop,
  type TimeOfDay,
  type WeatherType,
} from "@/lib/adventure-engine";
import { animatedSpriteUrl } from "@/lib/sprites";
import { AdventureJoystick, type MoveSpeed } from "./AdventureJoystick";

export function AdventureWorldMap({
  adventureState,
  onSelectCreature,
  onSelectDiscoveryPoint,
  onSelectBattleArena,
  onSelectCardCache,
  onUpdateCoords,
}: {
  adventureState: AdventureState;
  onSelectCreature: (creature: WildCreature, mode: "catch" | "battle") => void;
  onSelectDiscoveryPoint: (point: DiscoveryPoint) => void;
  onSelectBattleArena: (arena: BattleArena) => void;
  onSelectCardCache: (cache: CardCacheDrop) => void;
  onUpdateCoords: (newCoords: { xPct: number; yPct: number }, distMeters: number) => void;
}) {
  const [playerCoords, setPlayerCoords] = useState(adventureState.world.playerCoords);
  const [facingAngle, setFacingAngle] = useState(0);
  const [isWalking, setIsWalking] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(adventureState.world.timeOfDay);
  const [weather, setWeather] = useState<WeatherType>(adventureState.world.weather);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [radarPulse, setRadarPulse] = useState(true);

  const walkTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle Joystick Move
  const handleJoystickMove = (dx: number, dy: number, distMeters: number) => {
    setIsWalking(true);
    if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
    walkTimerRef.current = setTimeout(() => setIsWalking(false), 300);

    // Compute facing angle in degrees
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    setFacingAngle(deg);

    // Update Player coordinates
    setPlayerCoords((prev) => {
      const nextX = Math.max(5, Math.min(95, prev.xPct + dx * 0.4));
      const nextY = Math.max(5, Math.min(95, prev.yPct + dy * 0.4));
      const nextCoords = { xPct: nextX, yPct: nextY };
      onUpdateCoords(nextCoords, distMeters);
      return nextCoords;
    });
  };

  // Teleport Hotspot Handler
  const handleTeleport = (xPct: number, yPct: number, name: string) => {
    const nextCoords = { xPct, yPct };
    setPlayerCoords(nextCoords);
    onUpdateCoords(nextCoords, 250);
  };

  // Map Tap to Walk
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const dx = clickX - playerCoords.xPct;
    const dy = clickY - playerCoords.yPct;
    const dist = Math.round(Math.sqrt(dx * dx + dy * dy) * 10);

    const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    setFacingAngle(deg);

    setPlayerCoords({ xPct: clickX, yPct: clickY });
    onUpdateCoords({ xPct: clickX, yPct: clickY }, dist);
  };

  // Time of Day theme styles
  const isNight = timeOfDay === "night";
  const isSunset = timeOfDay === "sunset";

  return (
    <div className="relative w-full h-[640px] sm:h-[720px] rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950 shadow-2xl select-none">
      {/* Dynamic 2.5D Map Canvas Viewport */}
      <div
        onClick={handleMapClick}
        className={`relative w-full h-full cursor-crosshair overflow-hidden transition-colors duration-1000 ${
          isNight
            ? "bg-[#09111e]"
            : isSunset
            ? "bg-[#2d1b2e]"
            : "bg-[#163426]"
        }`}
        style={{
          perspective: "1000px",
        }}
      >
        {/* Stylized SVG Map Layer (Roads, Water, Parks, Grid) */}
        <div
          className="absolute inset-0 transition-transform duration-300 origin-center"
          style={{
            transform: `scale(${zoomLevel}) rotateX(24deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Ground Terrain Base Grid */}
          <div
            className={`absolute inset-0 opacity-40 transition-colors duration-1000 ${
              isNight
                ? "bg-[radial-gradient(#1e3a5f_1px,transparent_1px)]"
                : isSunset
                ? "bg-[radial-gradient(#ffaa44_1px,transparent_1px)]"
                : "bg-[radial-gradient(#34d399_1px,transparent_1px)]"
            }`}
            style={{ backgroundSize: "36px 36px" }}
          />

          {/* Stylized Water River & Ponds */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-80" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="riverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isNight ? "#0ea5e9" : "#38bdf8"} stopOpacity="0.7" />
                <stop offset="100%" stopColor={isNight ? "#0369a1" : "#0284c7"} stopOpacity="0.9" />
              </linearGradient>
            </defs>
            {/* River Curve */}
            <path
              d="M -50,150 Q 250,50 450,280 T 950,380 T 1400,600"
              fill="none"
              stroke="url(#riverGrad)"
              strokeWidth="54"
              strokeLinecap="round"
            />
            {/* Pond */}
            <ellipse cx="28%" cy="40%" rx="70" ry="45" fill="url(#riverGrad)" opacity="0.85" />
            <ellipse cx="78%" cy="75%" rx="90" ry="60" fill="url(#riverGrad)" opacity="0.85" />
          </svg>

          {/* Stylized Paved Pathways & Roads */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-60" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 100,700 L 350,450 L 550,450 L 800,200 L 1100,100"
              fill="none"
              stroke={isNight ? "#475569" : "#e2e8f0"}
              strokeWidth="24"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 200,100 L 350,450 L 500,550 L 750,680"
              fill="none"
              stroke={isNight ? "#334155" : "#cbd5e1"}
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Atmospheric Weather Particles */}
          {weather === "rain" && (
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,rgba(56,189,248,0.2)_1px,transparent_1px)] bg-[length:16px_16px] animate-pulse" />
          )}
          {weather === "storm" && (
            <div className="absolute inset-0 pointer-events-none animate-pulse bg-indigo-500/10" />
          )}


          {/* ───────────────────────────────────────────────────────────── */}
          {/* DRESDEN PARK NATURE RESERVE & RARE NEST BIOME */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div
            style={{
              left: "31%",
              top: "48%",
              width: "30%",
              height: "26%",
              transform: "translate(-50%, -50%)",
            }}
            className="absolute rounded-[36px] border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-600/30 via-teal-800/20 to-green-950/40 shadow-[0_0_40px_rgba(16,185,129,0.4)] pointer-events-none overflow-hidden"
          >
            {/* Lush Park Grass Grid Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#34d399_1.5px,transparent_1.5px)] bg-[length:18px_18px] opacity-40" />

            {/* Nature Trees Clusters */}
            <div className="absolute top-2 left-3 text-lg opacity-85">🌲</div>
            <div className="absolute top-3 right-4 text-xl opacity-85">🌳</div>
            <div className="absolute bottom-2 left-5 text-xl opacity-85">🌳</div>
            <div className="absolute bottom-3 right-5 text-lg opacity-85">🌲</div>

            {/* Glowing Center Park Nest Aura */}
            <div className="absolute inset-0 bg-radial from-emerald-400/25 via-transparent to-transparent animate-pulse" />

            {/* Park Entrance Signboard */}
            <div className="absolute top-1 inset-x-0 flex justify-center">
              <div className="px-2.5 py-0.5 rounded-full bg-neutral-950/90 border border-emerald-400/60 shadow-lg text-[9px] font-mono font-bold text-emerald-300 flex items-center gap-1">
                <span>🌳</span>
                <span>DRESDEN PARK</span>
                <span className="text-amber-400 text-[8px] animate-pulse">⚡ 5x RARE NEST</span>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ENTITY: BATTLE ARENA (GYM TOWERS) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {adventureState.battleArenas.map((arena) => (
            <div
              key={arena.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBattleArena(arena);
              }}
              style={{
                left: `${arena.xPct}%`,
                top: `${arena.yPct}%`,
                transform: "translate(-50%, -50%)",
              }}
              className="absolute z-20 cursor-pointer group flex flex-col items-center hover:scale-110 transition-transform duration-200"
            >
              {/* Pillar Light Beam */}
              <div className="w-1.5 h-20 bg-gradient-to-t from-rose-500 to-transparent rounded-full animate-pulse" />
              {/* Gym Tower Structure */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-500 to-yellow-400 p-0.5 shadow-[0_0_25px_rgba(244,63,94,0.6)] flex items-center justify-center animate-bounce">
                <div className="w-full h-full bg-neutral-950 rounded-[14px] flex flex-col items-center justify-center text-white">
                  <Swords className="w-6 h-6 text-amber-400" />
                  <span className="text-[8px] font-mono font-bold text-rose-400">GYM</span>
                </div>
              </div>
              {/* Badge Tag */}
              <div className="mt-1 px-2 py-0.5 rounded-md bg-neutral-950/90 border border-rose-500/40 text-[10px] font-mono text-white font-bold whitespace-nowrap shadow-lg">
                {arena.name}
              </div>
            </div>
          ))}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ENTITY: DISCOVERY POINTS (POKESTOPS) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {adventureState.discoveryPoints.map((point) => {
            const onCooldown = Date.now() - point.lastSpunTimestamp < point.cooldownMs;
            return (
              <div
                key={point.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDiscoveryPoint(point);
                }}
                style={{
                  left: `${point.xPct}%`,
                  top: `${point.yPct}%`,
                  transform: "translate(-50%, -50%)",
                }}
                className="absolute z-20 cursor-pointer group flex flex-col items-center hover:scale-110 transition-transform duration-200"
              >
                {/* 3D Spinning Photo Disc Crystal */}
                <div
                  className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition shadow-lg ${
                    onCooldown
                      ? "bg-purple-950/80 border-purple-500/60 shadow-purple-500/30"
                      : "bg-cyan-950/90 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)] animate-spin-slow"
                  }`}
                >
                  <MapPin className={`w-5 h-5 ${onCooldown ? "text-purple-400" : "text-cyan-300"}`} />
                </div>
                {/* Name Pill */}
                <div className="mt-1 px-2 py-0.5 rounded-md bg-neutral-950/90 border border-neutral-800 text-[10px] font-mono text-neutral-200 whitespace-nowrap shadow-md">
                  {point.title}
                </div>
              </div>
            );
          })}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ENTITY: CARD CACHES (DIGITAL TCG REVEALS) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {adventureState.cardCaches.filter((c) => !c.claimed).map((cache) => (
            <div
              key={cache.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCardCache(cache);
              }}
              style={{
                left: `${cache.xPct}%`,
                top: `${cache.yPct}%`,
                transform: "translate(-50%, -50%)",
              }}
              className="absolute z-20 cursor-pointer group flex flex-col items-center hover:scale-110 transition-transform duration-200"
            >
              {/* Holographic Glowing Pack / Crate */}
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 via-fuchsia-500 to-cyan-400 p-0.5 shadow-[0_0_20px_rgba(217,70,239,0.7)] animate-pulse">
                <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-amber-300" />
                </div>
              </div>
              <div className="mt-1 px-2 py-0.5 rounded-md bg-neutral-950/90 border border-fuchsia-500/50 text-[10px] font-mono text-fuchsia-300 font-bold whitespace-nowrap shadow-lg">
                📦 {cache.rarityTier}
              </div>
            </div>
          ))}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ENTITY: WILD POKÉMON CREATURES */}
          {/* ───────────────────────────────────────────────────────────── */}
          {adventureState.wildCreatures.map((creature) => {
            const isLegendary = creature.rarity === "legendary";
            const isEpic = creature.rarity === "epic";
            return (
              <div
                key={creature.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCreature(creature, "catch");
                }}
                style={{
                  left: `${creature.xPct}%`,
                  top: `${creature.yPct}%`,
                  transform: "translate(-50%, -50%)",
                }}
                className="absolute z-20 cursor-pointer group flex flex-col items-center hover:scale-115 transition-transform duration-200"
              >
                {/* Rarity Ring Shadow */}
                <div
                  className={`w-14 h-6 rounded-full absolute bottom-1 filter blur-[2px] transition ${
                    isLegendary
                      ? "bg-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.6)]"
                      : isEpic
                      ? "bg-purple-500/40"
                      : "bg-cyan-500/30"
                  }`}
                />

                {/* Park Nest Badge if in Dresden Park */}
                {creature.isParkNest && (
                  <div className="flex items-center gap-1 mb-0.5 px-1.5 py-0.2 rounded-full bg-emerald-950/95 border border-emerald-400 text-[8px] font-mono text-emerald-300 font-bold shadow-[0_0_10px_rgba(16,185,129,0.5)] z-20">
                    <span>🌳</span> PARK NEST
                  </div>
                )}

                {/* Animated 3D Pokémon Model */}
                <img
                  src={animatedSpriteUrl(creature.species)}
                  alt={creature.species}
                  className={`w-14 h-14 sm:w-16 sm:h-16 object-contain relative z-10 filter animate-bounce ${
                    creature.isParkNest
                      ? "drop-shadow-[0_0_12px_rgba(16,185,129,0.9)]"
                      : "drop-shadow-[0_8px_12px_rgba(0,0,0,0.8)]"
                  }`}
                />

                {/* CP Pill Tag */}
                <div className="flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-neutral-950/95 border border-neutral-800 text-[10px] font-mono shadow-md">
                  <span className="text-white font-bold">{creature.species}</span>
                  <span className="text-amber-400 font-bold">CP {creature.cp}</span>
                </div>

                {/* Quick Action Bubble on Hover */}
                <div className="hidden group-hover:flex items-center gap-1 mt-1 z-30">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCreature(creature, "catch");
                    }}
                    className="px-2 py-1 rounded-md bg-cyan-500 text-neutral-950 font-bold text-[9px] font-mono hover:bg-cyan-400 shadow"
                  >
                    CATCH
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCreature(creature, "battle");
                    }}
                    className="px-2 py-1 rounded-md bg-rose-500 text-white font-bold text-[9px] font-mono hover:bg-rose-400 shadow"
                  >
                    HD BATTLE
                  </button>
                </div>
              </div>
            );
          })}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* PLAYER AVATAR & BUDDY COMPANION */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div
            style={{
              left: `${playerCoords.xPct}%`,
              top: `${playerCoords.yPct}%`,
              transform: "translate(-50%, -50%)",
            }}
            className="absolute z-30 flex items-center justify-center pointer-events-none transition-all duration-300"
          >
            {/* Pulsing GPS Radar Ring */}
            <div className="w-32 h-32 rounded-full border-2 border-cyan-400/40 bg-cyan-400/10 animate-ping absolute" />
            <div className="w-48 h-48 rounded-full border border-dashed border-cyan-400/25 absolute" />

            {/* Walking Direction Pointer Cone */}
            <div
              style={{
                transform: `rotate(${facingAngle}deg)`,
              }}
              className="absolute w-20 h-20 -top-6 flex items-center justify-center pointer-events-none transition-transform duration-150"
            >
              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[16px] border-b-cyan-400/80 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            </div>

            {/* Trainer 3D Avatar */}
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-[0_0_20px_rgba(6,182,212,0.8)] flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center overflow-hidden">
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/1.png"
                  alt="Trainer"
                  className="w-10 h-10 object-contain"
                />
              </div>
            </div>

            {/* Buddy Pokémon Companion Following on the Side */}
            <div className="absolute -right-10 -bottom-2 flex items-center justify-center animate-bounce">
              <img
                src={animatedSpriteUrl(adventureState.buddy.species)}
                alt={adventureState.buddy.species}
                className="w-9 h-9 object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MAP CONTROLS & ENVIRONMENT SWITCHERS (TOP RIGHT) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-40 flex flex-col items-end gap-2 font-mono">
        {/* Time of Day Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-neutral-950/80 backdrop-blur-md border border-neutral-800 text-xs">
          {(["day", "sunset", "night"] as TimeOfDay[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTimeOfDay(t)}
              className={`p-1.5 rounded-lg transition ${
                timeOfDay === t
                  ? "bg-cyan-500 text-neutral-950 font-bold shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
              title={t.toUpperCase()}
            >
              {t === "day" ? <Sun className="w-3.5 h-3.5" /> : t === "sunset" ? <Sparkles className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>

        {/* Weather Selector */}
        <div className="flex items-center p-1 rounded-xl bg-neutral-950/80 backdrop-blur-md border border-neutral-800 text-xs">
          {(["clear", "rain", "storm"] as WeatherType[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWeather(w)}
              className={`p-1.5 rounded-lg transition ${
                weather === w
                  ? "bg-cyan-500 text-neutral-950 font-bold shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
              title={w.toUpperCase()}
            >
              {w === "clear" ? <Sun className="w-3.5 h-3.5" /> : w === "rain" ? <CloudRain className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>

        {/* Recenter on Player */}
        <button
          type="button"
          onClick={() => setPlayerCoords({ xPct: 50, yPct: 50 })}
          className="p-2 rounded-xl bg-neutral-950/80 backdrop-blur-md border border-neutral-800 text-neutral-300 hover:text-cyan-400 transition shadow"
          title="Recenter Map"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* VIRTUAL JOYSTICK (JAILBREAK PGSHARP STYLE) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <AdventureJoystick
        currentCoords={playerCoords}
        onMove={handleJoystickMove}
        onTeleport={handleTeleport}
      />
    </div>
  );
}
