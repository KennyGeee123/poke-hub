import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Radio,
  Footprints,
} from "lucide-react";
import {
  type AdventureState,
  type WildCreature,
  type DiscoveryPoint,
  type BattleArena,
  type CardCacheDrop,
  type TimeOfDay,
  type WeatherType,
  RADAR_DISCOVERY_RADIUS_METERS,
  DRESDEN_PARK_GEO,
  haversineMeters,
  geoOffsetFromMeters,
} from "@/lib/adventure-engine";
import { animatedSpriteUrl } from "@/lib/sprites";
import { AdventureJoystick, type MoveSpeed } from "./AdventureJoystick";
import { GodsEyeMap } from "./GodsEyeMap";
import { type GodsEyeNode } from "@/lib/gods-eye-world";
import { forceSwitchEra, generateEraSpawns, saveAdventureState, cloneAdventureState } from "@/lib/adventure-engine";

/**
 * Slippy Tile coordinate calculation for Web Mercator map tiles
 */
function latLngToTile(lat: number, lng: number, zoom = 17) {
  const x = ((lng + 180) / 360) * Math.pow(2, zoom);
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    Math.pow(2, zoom);
  return {
    tileX: Math.floor(x),
    tileY: Math.floor(y),
    fracX: x - Math.floor(x),
    fracY: y - Math.floor(y),
  };
}

export function AdventureWorldMap({
  adventureState,
  onSelectCreature,
  onSelectDiscoveryPoint,
  onSelectBattleArena,
  onSelectCardCache,
  onUpdateCoords,
  onStateUpdate,
}: {
  adventureState: AdventureState;
  onSelectCreature: (creature: WildCreature, mode: "catch" | "battle") => void;
  onSelectDiscoveryPoint: (point: DiscoveryPoint) => void;
  onSelectBattleArena: (arena: BattleArena) => void;
  onSelectCardCache: (cache: CardCacheDrop) => void;
  onUpdateCoords: (
    newCoords: { xPct: number; yPct: number },
    distMeters: number,
    newGeo?: { lat: number; lng: number; accuracy?: number; heading?: number }
  ) => void;
  onStateUpdate?: (state: AdventureState) => void;
}) {
  const [playerCoords, setPlayerCoords] = useState(adventureState.world.playerCoords);
  const [playerGeo, setPlayerGeo] = useState(
    adventureState.world.playerGeo || {
      lat: DRESDEN_PARK_GEO.lat,
      lng: DRESDEN_PARK_GEO.lng,
      accuracy: 10,
      heading: 0,
    }
  );
  const [useLiveGps, setUseLiveGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "tracking" | "denied">("idle");
  const [mapStyle, setMapStyle] = useState<"carto_dark" | "osm_streets">("carto_dark");
  const [facingAngle, setFacingAngle] = useState(0);
  const [isWalking, setIsWalking] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(adventureState.world.timeOfDay);
  const [weather, setWeather] = useState<WeatherType>(adventureState.world.weather);
  const [recentlyPoppedId, setRecentlyPoppedId] = useState<string | null>(null);
  const [godsEyeOpen, setGodsEyeOpen] = useState(false);

  const walkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Sync external state changes
  useEffect(() => {
    setPlayerCoords(adventureState.world.playerCoords);
    if (adventureState.world.playerGeo) {
      setPlayerGeo(adventureState.world.playerGeo);
    }
  }, [adventureState.world.playerCoords, adventureState.world.playerGeo]);

  // Live GPS Tracking with navigator.geolocation
  useEffect(() => {
    if (!useLiveGps) {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsStatus("idle");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("denied");
      return;
    }

    setGpsStatus("tracking");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading } = pos.coords;
        const dist = haversineMeters(playerGeo.lat, playerGeo.lng, latitude, longitude);

        const newGeo = {
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 10,
          heading: heading || 0,
        };

        setPlayerGeo(newGeo);
        if (heading) setFacingAngle(heading);

        // Keep player in center of screen
        const nextCoords = { xPct: 50, yPct: 50 };
        setPlayerCoords(nextCoords);
        onUpdateCoords(nextCoords, Math.max(1, dist), newGeo);
      },
      (err) => {
        console.warn("Geolocation watch error:", err);
        setGpsStatus("denied");
        setUseLiveGps(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [useLiveGps, playerGeo.lat, playerGeo.lng, onUpdateCoords]);

  // Handle Joystick Move — free-roam wrap (whole world plane, no soft walls)
  const handleJoystickMove = (dx: number, dy: number, distMeters: number) => {
    setIsWalking(true);
    if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
    walkTimerRef.current = setTimeout(() => setIsWalking(false), 180);

    const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    setFacingAngle(deg);

    // Real geographic delta scales with stick input (realtime feel)
    const metersX = dx * 14;
    const metersY = -dy * 14;
    const nextGeo = geoOffsetFromMeters(playerGeo.lat, playerGeo.lng, metersX, metersY);
    setPlayerGeo((prev) => ({ ...prev, lat: nextGeo.lat, lng: nextGeo.lng, heading: deg }));

    // Toroidal world plane: walk off one edge → appear on the opposite
    const wrap = (v: number) => {
      const n = v % 100;
      return n < 0 ? n + 100 : n;
    };

    setPlayerCoords((prev) => {
      const nextCoords = {
        xPct: wrap(prev.xPct + dx * 1.25),
        yPct: wrap(prev.yPct + dy * 1.25),
      };
      onUpdateCoords(nextCoords, Math.max(1, distMeters), {
        ...playerGeo,
        lat: nextGeo.lat,
        lng: nextGeo.lng,
        heading: deg,
      });
      return nextCoords;
    });
  };

  // Teleport Hotspot Handler
  const handleTeleport = (xPct: number, yPct: number, name: string, geo?: { lat: number; lng: number }) => {
    const nextCoords = { xPct, yPct };
    setPlayerCoords(nextCoords);

    let nextGeo = geo || { lat: DRESDEN_PARK_GEO.lat, lng: DRESDEN_PARK_GEO.lng };
    if (!geo && name.includes("Dresden")) {
      nextGeo = { lat: DRESDEN_PARK_GEO.lat, lng: DRESDEN_PARK_GEO.lng };
    }
    setPlayerGeo((prev) => ({ ...prev, ...nextGeo }));
    onUpdateCoords(nextCoords, 250, { ...playerGeo, ...nextGeo });
  };

  const handleGodsEyeTeleport = (node: GodsEyeNode) => {
    handleTeleport(node.xPct, node.yPct, node.name, { lat: node.lat, lng: node.lng });
    if (onStateUpdate) {
      let next = forceSwitchEra(adventureState, node.eraId).state;
      next = cloneAdventureState(next);
      next.world.playerCoords = { xPct: node.xPct, yPct: node.yPct };
      next.world.playerGeo = { lat: node.lat, lng: node.lng, accuracy: 12, heading: 0 };
      next.world.biome = node.name;
      next.wildCreatures = generateEraSpawns(node.eraId, 14, Date.now(), { lat: node.lat, lng: node.lng });
      saveAdventureState(next);
      onStateUpdate(next);
    }
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

    const nextGeo = geoOffsetFromMeters(playerGeo.lat, playerGeo.lng, dx * 6, -dy * 6);
    setPlayerGeo((prev) => ({ ...prev, lat: nextGeo.lat, lng: nextGeo.lng }));

    const nextCoords = { xPct: clickX, yPct: clickY };
    setPlayerCoords(nextCoords);
    onUpdateCoords(nextCoords, dist, { ...playerGeo, lat: nextGeo.lat, lng: nextGeo.lng });
  };

  // Recenter GPS button
  const handleRecenterGps = () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy, heading } = pos.coords;
          const newGeo = {
            lat: latitude,
            lng: longitude,
            accuracy: accuracy || 10,
            heading: heading || 0,
          };
          setPlayerGeo(newGeo);
          setPlayerCoords({ xPct: 50, yPct: 50 });
          onUpdateCoords({ xPct: 50, yPct: 50 }, 5, newGeo);
        },
        () => {
          // Fallback to Dresden Park
          setPlayerGeo({
            lat: DRESDEN_PARK_GEO.lat,
            lng: DRESDEN_PARK_GEO.lng,
            accuracy: 10,
            heading: 0,
          });
          setPlayerCoords({ xPct: 31, yPct: 48 });
          onUpdateCoords({ xPct: 31, yPct: 48 }, 5, {
            lat: DRESDEN_PARK_GEO.lat,
            lng: DRESDEN_PARK_GEO.lng,
          });
        }
      );
    }
  };

  // Slippy Map Tiles (CartoDB Dark Matter / OpenStreetMap)
  const zoom = 17;
  const tileInfo = useMemo(() => {
    return latLngToTile(playerGeo.lat, playerGeo.lng, zoom);
  }, [playerGeo.lat, playerGeo.lng]);

  const tileGrid = useMemo(() => {
    const tiles: { key: string; url: string; xOffset: number; yOffset: number }[] = [];
    const radius = 1; // 3x3 grid (-1, 0, 1)

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = tileInfo.tileX + dx;
        const ty = tileInfo.tileY + dy;
        const key = `${zoom}-${tx}-${ty}`;
        const url =
          mapStyle === "carto_dark"
            ? `https://a.basemaps.cartocdn.com/dark_all/${zoom}/${tx}/${ty}@2x.png`
            : `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;

        tiles.push({
          key,
          url,
          xOffset: dx * 256 - tileInfo.fracX * 256,
          yOffset: dy * 256 - tileInfo.fracY * 256,
        });
      }
    }
    return tiles;
  }, [tileInfo, mapStyle]);

  const isNight = timeOfDay === "night";
  const isSunset = timeOfDay === "sunset";

  return (
    <div className="relative w-full h-[640px] sm:h-[720px] rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950 shadow-2xl select-none font-mono">
      {/* Dynamic 2.5D Map Canvas Viewport */}
      <div
        onClick={handleMapClick}
        className="relative w-full h-full cursor-crosshair overflow-hidden bg-[#09111e]"
        style={{ perspective: "1000px" }}
      >
        {/* Real-World Street Map Tile Layer (CartoDB Dark Matter) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-85 transition-opacity duration-500 overflow-hidden flex items-center justify-center"
          style={{
            transform: "rotateX(20deg) scale(1.15)",
            transformOrigin: "center center",
          }}
        >
          <div className="relative w-[768px] h-[768px]">
            {tileGrid.map((t) => (
              <img
                key={t.key}
                src={t.url}
                alt="Map Tile"
                className="absolute w-[256px] h-[256px] object-cover pointer-events-none filter contrast-125 brightness-95"
                style={{
                  left: `calc(50% + ${t.xOffset}px)`,
                  top: `calc(50% + ${t.yOffset}px)`,
                }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ))}
          </div>
        </div>

        {/* 2.5D Tilt Perspective Surface Layer */}
        <div
          className="absolute inset-0 transition-transform duration-300"
          style={{
            transform: "rotateX(20deg) translateZ(0)",
            transformOrigin: "bottom center",
          }}
        >
          {/* Subtle Ambient Grid */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#06b6d4_1px,transparent_1px)]"
            style={{ backgroundSize: "36px 36px" }}
          />

          {/* Atmospheric Weather Particles */}
          {weather === "rain" && (
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,rgba(56,189,248,0.25)_1px,transparent_1px)] bg-[length:16px_16px] animate-pulse" />
          )}
          {weather === "storm" && (
            <div className="absolute inset-0 pointer-events-none animate-pulse bg-indigo-500/15" />
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* DRESDEN PARK NATURE RESERVE & RARE NEST BIOME */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div
            style={{
              left: "31%",
              top: "48%",
              width: "32%",
              height: "28%",
              transform: "translate(-50%, -50%)",
            }}
            className="absolute rounded-[36px] border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-600/30 via-teal-800/20 to-green-950/40 shadow-[0_0_40px_rgba(16,185,129,0.4)] pointer-events-none overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(#34d399_1.5px,transparent_1.5px)] bg-[length:18px_18px] opacity-40" />
            <div className="absolute top-2 left-3 text-lg opacity-85">🌲</div>
            <div className="absolute top-3 right-4 text-xl opacity-85">🌳</div>
            <div className="absolute bottom-2 left-5 text-xl opacity-85">🌳</div>
            <div className="absolute bottom-3 right-5 text-lg opacity-85">🌲</div>
            <div className="absolute inset-0 bg-radial from-emerald-400/25 via-transparent to-transparent animate-pulse" />

            {/* Park Entrance Signboard */}
            <div className="absolute top-1 inset-x-0 flex justify-center">
              <div className="px-2.5 py-0.5 rounded-full bg-neutral-950/90 border border-emerald-400/60 shadow-lg text-[9px] font-bold text-emerald-300 flex items-center gap-1">
                <span>🌳</span>
                <span>DRESDEN PARK</span>
                <span className="text-amber-400 text-[8px] animate-pulse">⚡ 5x RARE NEST</span>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ENTITY: BATTLE ARENAS (GYM TOWERS) */}
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
              <div className="w-1.5 h-20 bg-gradient-to-t from-rose-500 to-transparent rounded-full animate-pulse" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-500 to-yellow-400 p-0.5 shadow-[0_0_25px_rgba(244,63,94,0.6)] flex items-center justify-center animate-bounce">
                <div className="w-full h-full bg-neutral-950 rounded-[14px] flex flex-col items-center justify-center text-white">
                  <Swords className="w-6 h-6 text-amber-400" />
                  <span className="text-[8px] font-bold text-rose-400">GYM</span>
                </div>
              </div>
              <div className="mt-1 px-2 py-0.5 rounded-md bg-neutral-950/90 border border-rose-500/40 text-[10px] text-white font-bold whitespace-nowrap shadow-lg">
                {arena.name}
              </div>
            </div>
          ))}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ENTITY: DISCOVERY POINTS (POKÉSTOPS) */}
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
                <div
                  className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition shadow-lg ${
                    onCooldown
                      ? "bg-purple-950/80 border-purple-500/60 shadow-purple-500/30"
                      : "bg-cyan-950/90 border-cyan-400 shadow-cyan-500/50 animate-pulse"
                  }`}
                >
                  <MapPin
                    className={`w-5 h-5 ${
                      onCooldown ? "text-purple-400" : "text-cyan-300 animate-spin-slow"
                    }`}
                  />
                </div>
                <div className="mt-1 px-1.5 py-0.5 rounded bg-neutral-950/90 border border-neutral-800 text-[9px] text-white font-bold whitespace-nowrap shadow">
                  {point.title}
                </div>
              </div>
            );
          })}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ENTITY: CARD CACHES (HOLO CRATES) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {adventureState.cardCaches
            .filter((c) => !c.claimed)
            .map((cache) => (
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
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 via-fuchsia-500 to-cyan-400 p-0.5 shadow-[0_0_20px_rgba(217,70,239,0.7)] animate-pulse">
                  <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-amber-300" />
                  </div>
                </div>
                <div className="mt-1 px-2 py-0.5 rounded-md bg-neutral-950/90 border border-fuchsia-500/50 text-[10px] text-fuchsia-300 font-bold whitespace-nowrap shadow-lg">
                  📦 {cache.rarityTier}
                </div>
              </div>
            ))}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ENTITY: WILD POKÉMON CREATURES (45m HIDDEN SPAWN DISCOVERY) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {adventureState.wildCreatures.map((creature) => {
            const isDiscovered =
              creature.isDiscovered ||
              creature.distanceMeters <= RADAR_DISCOVERY_RADIUS_METERS;

            // 1. HIDDEN DISTANT SPAWN (> 45m): Render subtle shaking tall grass foliage
            if (!isDiscovered) {
              return (
                <div
                  key={creature.id}
                  style={{
                    left: `${creature.xPct}%`,
                    top: `${creature.yPct}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  className="absolute z-15 flex flex-col items-center group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Walking cue
                    handleTeleport(creature.xPct, creature.yPct, "Wild Track");
                  }}
                >
                  {/* Subtle rustling grass leaves */}
                  <div className="relative flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 filter blur-sm animate-pulse absolute" />
                    <span className="text-2xl filter drop-shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-bounce select-none">
                      🌿
                    </span>
                  </div>

                  {/* Distance Hint on Hover */}
                  <div className="hidden group-hover:flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-950/90 border border-emerald-500/50 text-[9px] text-emerald-300 whitespace-nowrap shadow-lg mt-0.5">
                    <span>🐾</span>
                    <span>Wild Presence (~{creature.distanceMeters}m)</span>
                  </div>
                </div>
              );
            }

            // 2. DISCOVERED SPAWN (Within 45m): Reveal Animated 3D Sprite + CP Tag
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
                className="absolute z-25 cursor-pointer group flex flex-col items-center hover:scale-115 transition-transform duration-200"
              >
                {/* Pop Discovery Shockwave Ripple */}
                <div className="w-20 h-20 rounded-full border-2 border-cyan-400/60 bg-cyan-400/15 animate-ping absolute -top-2" />

                {/* Rarity Ring Aura */}
                <div
                  className={`w-14 h-6 rounded-full absolute bottom-1 filter blur-[2px] transition ${
                    isLegendary
                      ? "bg-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.6)]"
                      : isEpic
                      ? "bg-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                      : "bg-cyan-500/30"
                  }`}
                />

                {/* Park Nest Badge if in Dresden Park */}
                {creature.isParkNest && (
                  <div className="flex items-center gap-1 mb-0.5 px-1.5 py-0.2 rounded-full bg-emerald-950/95 border border-emerald-400 text-[8px] text-emerald-300 font-bold shadow-[0_0_10px_rgba(16,185,129,0.5)] z-20">
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
                <div className="flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-neutral-950/95 border border-cyan-500/50 text-[10px] shadow-lg">
                  <span className="text-white font-bold">{creature.species}</span>
                  <span className="text-amber-400 font-bold">CP {creature.cp}</span>
                </div>

                {/* Action Buttons: Catch (GO Style) & HD Battle (Classic Game Boy/Stadium) */}
                <div className="flex items-center gap-1 mt-1 z-30 opacity-95 group-hover:scale-105 transition-transform">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCreature(creature, "catch");
                    }}
                    className="px-2 py-1 rounded-md bg-cyan-500 text-neutral-950 font-bold text-[9px] hover:bg-cyan-400 shadow flex items-center gap-0.5"
                  >
                    <span>🔴</span> CATCH
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCreature(creature, "battle");
                    }}
                    className="px-2 py-1 rounded-md bg-rose-500 text-white font-bold text-[9px] hover:bg-rose-400 shadow flex items-center gap-0.5"
                  >
                    <span>⚔️</span> BATTLE
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
              transform: isWalking
                ? "translate(-50%, calc(-50% - 3px))"
                : "translate(-50%, -50%)",
            }}
            className="absolute z-30 flex items-center justify-center pointer-events-none"
          >
            {/* 45-Meter Glowing GO Interaction Radar Ring */}
            <div
              className={`w-40 h-40 rounded-full border-2 border-cyan-400/50 bg-cyan-400/10 absolute ${
                isWalking ? "animate-ping" : ""
              }`}
            />
            <div className="w-56 h-56 rounded-full border border-dashed border-cyan-400/30 absolute" />

            {/* Walking Direction Pointer Cone */}
            <div
              style={{ transform: `rotate(${facingAngle}deg)` }}
              className="absolute w-20 h-20 -top-6 flex items-center justify-center pointer-events-none transition-transform duration-75"
            >
              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[16px] border-b-cyan-400/80 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            </div>

            {/* Trainer sprite — bob while walking in realtime */}
            <div
              className={`relative w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-[0_0_20px_rgba(6,182,212,0.8)] flex items-center justify-center ${
                isWalking ? "animate-bounce" : ""
              }`}
            >
              <div className="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center overflow-hidden">
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/1.png"
                  alt="Trainer"
                  className="w-11 h-11 object-contain"
                  style={{
                    imageRendering: "pixelated",
                    transform: isWalking ? `scaleX(${facingAngle > 90 && facingAngle < 270 ? -1 : 1})` : undefined,
                  }}
                />
              </div>
            </div>

            {/* Buddy follows beside you while you roam */}
            <div
              className={`absolute -right-11 -bottom-1 flex items-center justify-center ${
                isWalking ? "animate-bounce" : ""
              }`}
            >
              <img
                src={animatedSpriteUrl(adventureState.buddy.species)}
                alt={adventureState.buddy.species}
                className="w-10 h-10 object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* REAL-WORLD GPS & LOCATION STATUS HUD (TOP LEFT) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-40 flex flex-col items-start gap-1 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800 shadow-xl text-xs">
          <Radio
            className={`w-3.5 h-3.5 ${
              useLiveGps ? "text-emerald-400 animate-pulse" : "text-cyan-400"
            }`}
          />
          <div className="flex flex-col">
            <span className="font-bold text-white text-[11px] leading-tight">
              {useLiveGps
                ? "🛰️ LIVE GPS TRACKING"
                : isWalking
                  ? "🚶 FREE ROAM · CATCH RANGE ON"
                  : "🌍 FREE ROAM WORLD"}
            </span>
            <span className="text-[9px] text-neutral-400">
              {playerGeo.lat.toFixed(4)}, {playerGeo.lng.toFixed(4)} · Chamblee, GA
            </span>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MAP CONTROLS & ENVIRONMENT SWITCHERS (TOP RIGHT) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-40 flex flex-col items-end gap-2">
        {/* Real GPS Toggle */}
        <button
          type="button"
          onClick={() => setUseLiveGps(!useLiveGps)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl ${
            useLiveGps
              ? "bg-emerald-500 text-neutral-950 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
              : "bg-neutral-950/80 backdrop-blur-md border-neutral-800 text-neutral-300 hover:text-white"
          }`}
          title="Toggle Real Device Geolocation"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>{useLiveGps ? "GPS ON" : "USE MY GPS"}</span>
        </button>

        {/* Map Tile Style Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-neutral-950/80 backdrop-blur-md border border-neutral-800 text-xs">
          <button
            type="button"
            onClick={() => setMapStyle("carto_dark")}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
              mapStyle === "carto_dark"
                ? "bg-cyan-500 text-neutral-950"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            DARK TILES
          </button>
          <button
            type="button"
            onClick={() => setMapStyle("osm_streets")}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
              mapStyle === "osm_streets"
                ? "bg-cyan-500 text-neutral-950"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            OSM STREETS
          </button>
        </div>

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
              {t === "day" ? (
                <Sun className="w-3.5 h-3.5" />
              ) : t === "sunset" ? (
                <Sparkles className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
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
              {w === "clear" ? (
                <Sun className="w-3.5 h-3.5" />
              ) : w === "rain" ? (
                <CloudRain className="w-3.5 h-3.5" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
            </button>
          ))}
        </div>

        {/* God's Eye — huge world atlas */}
        <button
          type="button"
          onClick={() => setGodsEyeOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl bg-gradient-to-r from-amber-500 to-orange-600 text-neutral-950 border-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.45)]"
          title="God's Eye world atlas — teleport across regions"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>GOD&apos;S EYE</span>
        </button>

        {/* Recenter on GPS */}
        <button
          type="button"
          onClick={handleRecenterGps}
          className="p-2 rounded-xl bg-neutral-950/80 backdrop-blur-md border border-neutral-800 text-neutral-300 hover:text-cyan-400 transition shadow"
          title="Recenter Map on Real Location"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>

      <GodsEyeMap
        open={godsEyeOpen}
        onClose={() => setGodsEyeOpen(false)}
        playerCoords={playerCoords}
        wildCreatures={adventureState.wildCreatures}
        onTeleport={handleGodsEyeTeleport}
      />

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
