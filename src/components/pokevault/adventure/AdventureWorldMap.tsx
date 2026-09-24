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
  MAP_ZOOM_DEFAULT,
  haversineMeters,
  geoOffsetFromMeters,
  geoScreenOffset,
  metersPerPixel,
  pinWorldPoisToGeo,
  latLngToWorldPixels,
} from "@/lib/adventure-engine";
import { animatedSpriteUrl, trainerFacingUrl } from "@/lib/sprites";
import { AdventureJoystick } from "./AdventureJoystick";
import { GodsEyeMap } from "./GodsEyeMap";
import {
  isDresdenHub,
  isNearDresdenGeo,
  regionWalkOrigin,
  walkSkinForNode,
  gbaCellKind,
  GBA_CELL_COLORS,
  GBA_CELL_TEXTURE,
  type GodsEyeNode,
} from "@/lib/gods-eye-world";
import {
  forceSwitchEra,
  generateEraSpawns,
  saveAdventureState,
  cloneAdventureState,
} from "@/lib/adventure-engine";

const GBA_CELL_PX = 32;

function GbaWalkLayer({
  playerGeo,
  zoom,
}: {
  playerGeo: { lat: number; lng: number };
  zoom: number;
}) {
  const world = latLngToWorldPixels(playerGeo.lat, playerGeo.lng, zoom);
  const originCol = Math.floor(world.x / GBA_CELL_PX);
  const originRow = Math.floor(world.y / GBA_CELL_PX);
  const fracX = world.x % GBA_CELL_PX;
  const fracY = world.y % GBA_CELL_PX;
  const cols = 28;
  const rows = 24;
  const cells: { key: string; left: number; top: number; a: string; b: string; tex: string }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const kind = gbaCellKind(
        originCol + col - Math.floor(cols / 2),
        originRow + row - Math.floor(rows / 2),
      );
      const [a, b] = GBA_CELL_COLORS[kind];
      cells.push({
        key: `${originCol + col}-${originRow + row}`,
        left: (col - cols / 2) * GBA_CELL_PX - fracX,
        top: (row - rows / 2) * GBA_CELL_PX - fracY,
        a,
        b,
        tex: GBA_CELL_TEXTURE[kind],
      });
    }
  }
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute left-1/2 top-1/2">
        {cells.map((c) => (
          <div
            key={c.key}
            className="absolute"
            style={{
              width: GBA_CELL_PX,
              height: GBA_CELL_PX,
              left: c.left,
              top: c.top,
              backgroundColor: c.a,
              backgroundImage: `url(${c.tex})`,
              backgroundSize: "cover",
              imageRendering: "pixelated",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Slippy Tile coordinate calculation for Web Mercator map tiles
 */
function latLngToTile(lat: number, lng: number, zoom = 17) {
  const x = ((lng + 180) / 360) * Math.pow(2, zoom);
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom);
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
    newGeo?: { lat: number; lng: number; accuracy?: number; heading?: number },
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
    },
  );
  const [useLiveGps, setUseLiveGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "tracking" | "denied">("idle");
  const [mapStyle, setMapStyle] = useState<"dark" | "streets">("dark");
  const [facingAngle, setFacingAngle] = useState(0);
  const [isWalking, setIsWalking] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(adventureState.world.timeOfDay);
  const [weather, setWeather] = useState<WeatherType>(adventureState.world.weather);
  const [recentlyPoppedId, setRecentlyPoppedId] = useState<string | null>(null);
  const [godsEyeOpen, setGodsEyeOpen] = useState(false);
  const [walkSkin, setWalkSkin] = useState<"go" | "gba">(adventureState.world.walkSkin || "go");

  const walkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const playerGeoRef = useRef(playerGeo);
  playerGeoRef.current = playerGeo;

  // Sync external state changes
  useEffect(() => {
    setPlayerCoords(adventureState.world.playerCoords);
    if (adventureState.world.playerGeo) {
      setPlayerGeo(adventureState.world.playerGeo);
    }
    if (adventureState.world.walkSkin) setWalkSkin(adventureState.world.walkSkin);
  }, [
    adventureState.world.playerCoords,
    adventureState.world.playerGeo,
    adventureState.world.walkSkin,
  ]);

  // Live GPS Tracking with navigator.geolocation
  useEffect(() => {
    if (!useLiveGps) {
      if (
        watchIdRef.current !== null &&
        typeof navigator !== "undefined" &&
        navigator.geolocation
      ) {
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
        const prev = playerGeoRef.current;
        const dist = haversineMeters(prev.lat, prev.lng, latitude, longitude);

        const newGeo = {
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 10,
          heading: heading || 0,
        };

        setPlayerGeo(newGeo);
        if (heading) setFacingAngle(heading);

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
      },
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [useLiveGps, onUpdateCoords]);

  // Joystick walks the planet in meters. Camera stays GO-style: player at screen center.
  const handleJoystickMove = (dx: number, dy: number, distMeters: number) => {
    setIsWalking(true);
    if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
    walkTimerRef.current = setTimeout(() => setIsWalking(false), 180);

    const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    setFacingAngle(deg);

    const metersX = dx * 14;
    const metersY = -dy * 14;
    const nextGeo = geoOffsetFromMeters(playerGeo.lat, playerGeo.lng, metersX, metersY);
    const nextCoords = { xPct: 50, yPct: 50 };
    setPlayerGeo((prev) => ({ ...prev, lat: nextGeo.lat, lng: nextGeo.lng, heading: deg }));
    setPlayerCoords(nextCoords);
    onUpdateCoords(nextCoords, Math.max(1, distMeters), {
      ...playerGeo,
      lat: nextGeo.lat,
      lng: nextGeo.lng,
      heading: deg,
    });
  };

  // Teleport Hotspot Handler — geo is the source of truth; trainer stays centered.
  const handleTeleport = (
    xPct: number,
    yPct: number,
    name: string,
    geo?: { lat: number; lng: number },
  ) => {
    const nextCoords = { xPct: 50, yPct: 50 };
    setPlayerCoords(nextCoords);

    let nextGeo = geo || { lat: DRESDEN_PARK_GEO.lat, lng: DRESDEN_PARK_GEO.lng };
    if (!geo && name.includes("Dresden")) {
      nextGeo = { lat: DRESDEN_PARK_GEO.lat, lng: DRESDEN_PARK_GEO.lng };
    }
    setPlayerGeo((prev) => ({ ...prev, ...nextGeo }));
    onUpdateCoords(nextCoords, 250, { ...playerGeo, ...nextGeo });
  };

  const handleHotspotTeleport = (
    xPct: number,
    yPct: number,
    name: string,
    geo?: { lat: number; lng: number },
  ) => {
    if (name === "Local GPS") {
      handleRecenterGps();
      return;
    }
    handleTeleport(xPct, yPct, name, geo);
    if (!onStateUpdate || !geo) return;
    let next = cloneAdventureState(adventureState);
    next.world.playerCoords = { xPct: 50, yPct: 50 };
    next.world.playerGeo = { lat: geo.lat, lng: geo.lng, accuracy: 12, heading: 0 };
    next.world.biome = name;
    next.world.isInsidePark = name.includes("Dresden");
    next.wildCreatures = generateEraSpawns(next.world.activeEraId, 10, Date.now(), geo, {
      includeParkNest: name.includes("Dresden"),
    });
    next = pinWorldPoisToGeo(next, geo);
    saveAdventureState(next);
    onStateUpdate(next);
  };

  const handleGodsEyeTeleport = (node: GodsEyeNode) => {
    const origin = { xPct: 50, yPct: 50 };
    const skin = walkSkinForNode(node);
    handleTeleport(origin.xPct, origin.yPct, node.name, { lat: node.lat, lng: node.lng });
    setWalkSkin(skin);
    if (onStateUpdate) {
      let next = forceSwitchEra(adventureState, node.eraId).state;
      next = cloneAdventureState(next);
      next.world.playerCoords = origin;
      next.world.playerGeo = { lat: node.lat, lng: node.lng, accuracy: 12, heading: 0 };
      next.world.biome = node.name;
      next.world.activeRegionId = node.id;
      next.world.walkSkin = skin;
      next.world.isInsidePark = isDresdenHub(node);
      next.wildCreatures = generateEraSpawns(
        node.eraId,
        14,
        Date.now(),
        { lat: node.lat, lng: node.lng },
        {
          includeParkNest: isDresdenHub(node),
          localOrigin: regionWalkOrigin(node),
        },
      );
      next = pinWorldPoisToGeo(next, { lat: node.lat, lng: node.lng });
      saveAdventureState(next);
      onStateUpdate(next);
    }
  };

  const showDresdenOverlay =
    adventureState.world.activeRegionId === "dresden" ||
    isNearDresdenGeo(playerGeo.lat, playerGeo.lng);

  // Map tap walks toward that geo (player stays centered; tiles pan).
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dxPx = e.clientX - rect.left - rect.width / 2;
    const dyPx = e.clientY - rect.top - rect.height / 2;
    const mpp = metersPerPixel(playerGeo.lat, MAP_ZOOM_DEFAULT);
    const metersX = dxPx * mpp;
    const metersY = -dyPx * mpp;
    const dist = Math.round(Math.hypot(metersX, metersY));

    const deg = (Math.atan2(dyPx, dxPx) * 180) / Math.PI + 90;
    setFacingAngle(deg);

    const nextGeo = geoOffsetFromMeters(playerGeo.lat, playerGeo.lng, metersX, metersY);
    const nextCoords = { xPct: 50, yPct: 50 };
    setPlayerGeo((prev) => ({ ...prev, lat: nextGeo.lat, lng: nextGeo.lng }));
    setPlayerCoords(nextCoords);
    onUpdateCoords(nextCoords, Math.max(1, dist), {
      ...playerGeo,
      lat: nextGeo.lat,
      lng: nextGeo.lng,
    });
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
          setPlayerCoords({ xPct: 50, yPct: 50 });
          onUpdateCoords({ xPct: 50, yPct: 50 }, 5, {
            lat: DRESDEN_PARK_GEO.lat,
            lng: DRESDEN_PARK_GEO.lng,
          });
        },
      );
    }
  };

  // Slippy Map Tiles (CartoDB Dark Matter / OpenStreetMap)
  const zoom = MAP_ZOOM_DEFAULT;
  const tileInfo = useMemo(() => {
    return latLngToTile(playerGeo.lat, playerGeo.lng, zoom);
  }, [playerGeo.lat, playerGeo.lng]);

  const screenPos = (entity: { lat?: number; lng?: number; xPct: number; yPct: number }) => {
    if (typeof entity.lat === "number" && typeof entity.lng === "number") {
      const off = geoScreenOffset(playerGeo, { lat: entity.lat, lng: entity.lng }, zoom);
      return { left: `calc(50% + ${off.dx}px)`, top: `calc(50% + ${off.dy}px)` };
    }
    return { left: `${entity.xPct}%`, top: `${entity.yPct}%` };
  };

  const walkTowardGeo = (target: { lat: number; lng: number }) => {
    const dist = Math.max(1, haversineMeters(playerGeo.lat, playerGeo.lng, target.lat, target.lng));
    const step = Math.min(28, Math.max(8, dist * 0.35));
    const frac = step / dist;
    const next = {
      lat: playerGeo.lat + (target.lat - playerGeo.lat) * frac,
      lng: playerGeo.lng + (target.lng - playerGeo.lng) * frac,
    };
    const nextCoords = { xPct: 50, yPct: 50 };
    setPlayerGeo((prev) => ({ ...prev, lat: next.lat, lng: next.lng }));
    setPlayerCoords(nextCoords);
    onUpdateCoords(nextCoords, step, { ...playerGeo, lat: next.lat, lng: next.lng });
  };

  const trySelectCreature = (creature: WildCreature, mode: "catch" | "battle") => {
    if (creature.distanceMeters > RADAR_DISCOVERY_RADIUS_METERS) {
      if (typeof creature.lat === "number" && typeof creature.lng === "number") {
        walkTowardGeo({ lat: creature.lat, lng: creature.lng });
      }
      return;
    }
    onSelectCreature(creature, mode);
  };

  const tileGrid = useMemo(() => {
    const tiles: { key: string; url: string; xOffset: number; yOffset: number }[] = [];
    const radius = 2; // 5x5 so walking the planet does not flash empty tiles

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = tileInfo.tileX + dx;
        const ty = tileInfo.tileY + dy;
        const key = `${zoom}-${tx}-${ty}`;
        // Default: Esri (no API key, no watermark). Optional Carto if VITE_CARTO_API_KEY / VITE_MAP_TILE_KEY set.
        const cartoKey =
          (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim() ||
          (import.meta.env.VITE_MAP_TILE_KEY as string | undefined)?.trim() ||
          "";
        let url: string;
        if (mapStyle === "dark" && cartoKey) {
          url = `https://a.basemaps.cartocdn.com/dark_all/${zoom}/${tx}/${ty}@2x.png?api_key=${encodeURIComponent(cartoKey)}`;
        } else if (mapStyle === "dark") {
          // Esri's Dark Gray Canvas stops at z16 and returns "Map data not yet
          // available" placeholders at our z17 walk zoom, so render the street
          // map and darken it with a CSS filter instead (see tile <img> below).
          url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${ty}/${tx}`;
        } else {
          // Esri World Street Map — tile order is z/y/x (= zoom/ty/tx)
          url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${ty}/${tx}`;
        }

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

  const hasCartoKey = !!(
    (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_MAP_TILE_KEY as string | undefined)?.trim()
  );
  const darkTileFilter =
    mapStyle === "dark" && !hasCartoKey
      ? "invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.55)"
      : "contrast(1.25) brightness(0.95)";

  const isNight = timeOfDay === "night";
  const isSunset = timeOfDay === "sunset";

  return (
    <div className="pv-adv-stage relative w-full rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950 shadow-2xl select-none font-mono">
      {/* Dynamic 2.5D Map Canvas Viewport */}
      <div
        onClick={handleMapClick}
        className="relative w-full h-full cursor-crosshair overflow-hidden bg-[#09111e]"
        style={{ perspective: "1000px" }}
      >
        {/* Real-World Street Map Tile Layer (Esri basemaps; optional Carto with API key) */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 overflow-hidden flex items-center justify-center"
          style={{
            opacity: walkSkin === "gba" ? 0.28 : 0.88,
            transform: walkSkin === "gba" ? "none" : "rotateX(12deg) scale(1.08)",
            transformOrigin: "center center",
            imageRendering: walkSkin === "gba" ? "pixelated" : undefined,
          }}
        >
          {/* One filter pass for the whole tile layer (per-tile filters cost ~25 passes/frame). */}
          <div className="relative w-[768px] h-[768px]" style={{ filter: darkTileFilter }}>
            {tileGrid.map((t) => (
              <img
                key={t.key}
                src={t.url}
                alt="Map Tile"
                className="absolute w-[256px] h-[256px] object-cover pointer-events-none"
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

        {walkSkin === "gba" && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ transform: "none", imageRendering: "pixelated" }}
          >
            <GbaWalkLayer playerGeo={playerGeo} zoom={zoom} />
          </div>
        )}

        {/* 2.5D Tilt Perspective Surface Layer */}
        <div
          className="absolute inset-0 transition-transform duration-300"
          style={{
            transform: walkSkin === "gba" ? "none" : "rotateX(12deg) translateZ(0)",
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
          {/* DRESDEN PARK NATURE RESERVE & RARE NEST BIOME (hub only) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {showDresdenOverlay && (
            <div
              style={{
                left: `calc(50% + ${geoScreenOffset(playerGeo, DRESDEN_PARK_GEO, zoom).dx}px)`,
                top: `calc(50% + ${geoScreenOffset(playerGeo, DRESDEN_PARK_GEO, zoom).dy}px)`,
                width: `${Math.max(80, 900 / Math.max(4, metersPerPixel(playerGeo.lat, zoom)))}px`,
                height: `${Math.max(70, 700 / Math.max(4, metersPerPixel(playerGeo.lat, zoom)))}px`,
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
          )}

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
                ...screenPos(arena),
                transform: "translate(-50%, -50%)",
              }}
              className="absolute z-20 cursor-pointer group flex flex-col items-center hover:scale-110 transition-transform duration-200"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-b from-rose-400 to-amber-500 p-[3px] shadow-[0_0_18px_rgba(244,63,94,0.55)] flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-neutral-950 flex flex-col items-center justify-center text-white border border-amber-400/40">
                  <Swords className="w-5 h-5 text-amber-400" />
                  <span className="text-[8px] font-bold text-rose-300 tracking-wide">GYM</span>
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
                  ...screenPos(point),
                  transform: "translate(-50%, -50%)",
                }}
                className="absolute z-20 cursor-pointer group flex flex-col items-center hover:scale-110 transition-transform duration-200"
              >
                <div className="relative flex items-center justify-center">
                  {!onCooldown && (
                    <div className="absolute w-14 h-3 rounded-full border border-white/80 bg-white/15" />
                  )}
                  <div
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition shadow-lg ${
                      onCooldown
                        ? "bg-fuchsia-950/80 border-fuchsia-500/50"
                        : "bg-cyan-400 border-white shadow-cyan-400/40"
                    }`}
                  >
                    <MapPin
                      className={`w-4 h-4 ${onCooldown ? "text-fuchsia-300" : "text-neutral-950"}`}
                    />
                  </div>
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
                  ...screenPos(cache),
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
              creature.isDiscovered || creature.distanceMeters <= RADAR_DISCOVERY_RADIUS_METERS;

            // 1. HIDDEN DISTANT SPAWN (> 45m): Render subtle shaking tall grass foliage
            if (!isDiscovered) {
              return (
                <div
                  key={creature.id}
                  style={{
                    ...screenPos(creature),
                    transform: "translate(-50%, -50%)",
                  }}
                  className="absolute z-15 flex flex-col items-center group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof creature.lat === "number" && typeof creature.lng === "number") {
                      walkTowardGeo({ lat: creature.lat, lng: creature.lng });
                    }
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <img
                      src="/adventure-assets/tex-tallgrass.jpg"
                      alt=""
                      className="w-10 h-10 object-cover rounded-sm shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
                      style={{ imageRendering: "pixelated" }}
                    />
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
                  trySelectCreature(creature, "catch");
                }}
                style={{
                  ...screenPos(creature),
                  transform: "translate(-50%, -50%)",
                }}
                className="absolute z-25 cursor-pointer group flex flex-col items-center hover:scale-115 transition-transform duration-200"
              >
                {/* Rarity Ring Aura — GO-style ground disc, not infinite ping */}
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
                      trySelectCreature(creature, "catch");
                    }}
                    className="px-2 py-1 rounded-md bg-cyan-500 text-neutral-950 font-bold text-[9px] hover:bg-cyan-400 shadow flex items-center gap-0.5"
                  >
                    <span>🔴</span> CATCH
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      trySelectCreature(creature, "battle");
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
              left: "50%",
              top: "50%",
              transform: isWalking ? "translate(-50%, calc(-50% - 3px))" : "translate(-50%, -50%)",
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

            {/* Original 4-dir trainer (adventure-assets), not PokeAPI trainers/1.png */}
            <div
              className="relative flex items-center justify-center"
              style={{ transform: isWalking ? "translateY(-2px)" : undefined }}
            >
              <div className="absolute w-10 h-4 rounded-full bg-black/40 blur-[2px] top-[52px]" />
              <img
                src={trainerFacingUrl(facingAngle)}
                alt="Trainer"
                className="w-16 h-16 object-contain relative z-10"
                style={{ imageRendering: "pixelated" }}
              />
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
      <div className="absolute top-[4.25rem] left-3 sm:left-4 z-30 flex flex-col items-start gap-1 pointer-events-auto max-w-[55%]">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800 shadow-xl text-xs">
          <Radio
            className={`w-3.5 h-3.5 ${
              useLiveGps ? "text-emerald-400 animate-pulse" : "text-cyan-400"
            }`}
          />
          <div className="flex flex-col">
            <span className="font-bold text-white text-[11px] leading-tight">
              {useLiveGps
                ? "🛰️ LIVE GPS · WALK THE WORLD"
                : isWalking
                  ? walkSkin === "gba"
                    ? "🚶 GBA MAP · CATCH RANGE 45m"
                    : "🚶 GO MAP · CATCH RANGE 45m"
                  : walkSkin === "gba"
                    ? "🎮 GBA OVERWORLD ON MAP"
                    : "🌍 POKÉMON GO MAP"}
            </span>
            <span className="text-[9px] text-neutral-400">
              {playerGeo.lat.toFixed(4)}, {playerGeo.lng.toFixed(4)} ·{" "}
              {adventureState.world.biome || "Walk plane"}
            </span>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MAP CONTROLS & ENVIRONMENT SWITCHERS (TOP RIGHT) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-[4.25rem] right-3 sm:right-4 z-30 flex flex-col items-end gap-1.5 sm:gap-2">
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
            onClick={() => setMapStyle("dark")}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
              mapStyle === "dark"
                ? "bg-cyan-500 text-neutral-950"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            DARK TILES
          </button>
          <button
            type="button"
            onClick={() => setMapStyle("streets")}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
              mapStyle === "streets"
                ? "bg-cyan-500 text-neutral-950"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            STREETS
          </button>
          <button
            type="button"
            onClick={() => {
              const next = walkSkin === "gba" ? "go" : "gba";
              setWalkSkin(next);
              if (onStateUpdate) {
                const s = cloneAdventureState(adventureState);
                s.world.walkSkin = next;
                saveAdventureState(s);
                onStateUpdate(s);
              }
            }}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
              walkSkin === "gba"
                ? "bg-amber-400 text-neutral-950"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            GBA MAP
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

      {/* Basemap attribution (Esri courtesy) */}
      <div className="absolute bottom-2 left-2 z-30 pointer-events-none px-2 py-0.5 rounded bg-black/55 text-[9px] text-neutral-400 font-sans tracking-wide">
        Basemap © Esri
      </div>

      <GodsEyeMap
        open={godsEyeOpen}
        onClose={() => setGodsEyeOpen(false)}
        playerCoords={playerCoords}
        playerGeo={playerGeo}
        wildCreatures={adventureState.wildCreatures}
        onTeleport={handleGodsEyeTeleport}
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* VIRTUAL JOYSTICK (JAILBREAK PGSHARP STYLE) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <AdventureJoystick
        currentCoords={playerCoords}
        onMove={handleJoystickMove}
        onTeleport={handleHotspotTeleport}
      />
    </div>
  );
}
