import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { easeToward, untiltPoint, MAP_TILT } from "@/lib/adventure-motion";
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
  SlidersHorizontal,
  X,
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
  WORLD_SCALE,
  worldPlaneSpanMeters,
} from "@/lib/adventure-engine";
import { trainerFacingUrl } from "@/lib/sprites";
import { WorldSprite } from "./WorldSprite";
import { AdventureJoystick } from "./AdventureJoystick";
import { GodsEyeMap } from "./GodsEyeMap";
import {
  isDresdenHub,
  isNearDresdenGeo,
  regionWalkOrigin,
  walkSkinForNode,
  gbaCellKind,
  gbaCellCover,
  gbaShoreEdge,
  eraWorldLight,
  esriWorldImageryTile,
  GBA_CELL_COLORS,
  GBA_CELL_TEXTURE,
  nearestGodsEyeNodeByGeo,
  findGodsEyeNode,
  type GodsEyeNode,
} from "@/lib/gods-eye-world";
import { earnedStopIds, routeStopLayout, type RouteStop } from "@/lib/route-towns";
import { dryRouteStart, marchGbaWalk, type WildEncounter } from "@/lib/adventure-step";
import {
  forceSwitchEra,
  generateEraSpawns,
  saveAdventureState,
  cloneAdventureState,
} from "@/lib/adventure-engine";

const GBA_CELL_PX = 64;

const routeTex = new Map<string, HTMLImageElement>();

function loadRouteTex(src: string): Promise<HTMLImageElement | null> {
  const cached = routeTex.get(src);
  if (cached?.complete) return Promise.resolve(cached.naturalWidth > 0 ? cached : null);
  return new Promise((resolve) => {
    const img = cached || new Image();
    const finish = () => resolve(img.naturalWidth > 0 ? img : null);
    img.addEventListener("load", finish, { once: true });
    img.addEventListener("error", () => resolve(null), { once: true });
    if (!cached) {
      routeTex.set(src, img);
      img.src = src;
    } else if (img.complete) finish();
  });
}

type RouteCell = {
  key: string;
  left: number;
  top: number;
  a: string;
  tex: string;
  kind: "grass" | "path" | "water" | "tree" | "dirt";
  cover: number;
  shore: boolean;
};

/** One bitmap for the visible route. Photos stay smooth. Cells no longer stack 352 boxes. */
function RouteCanvas({ cells }: { cells: RouteCell[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const minLeft = cells[0]?.left ?? 0;
  const minTop = cells[0]?.top ?? 0;
  const width = 22 * GBA_CELL_PX;
  const height = 16 * GBA_CELL_PX;
  const paintKey = cells.map((c) => `${c.left},${c.top},${c.kind},${c.shore ? 1 : 0}`).join(";");
  const counts = { grass: 0, path: 0, water: 0, tree: 0, dirt: 0 };
  for (const cell of cells) counts[cell.kind] += 1;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || cells.length === 0) return;
    let dead = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const urls = [...new Set(cells.map((c) => c.tex))];
    Promise.all(urls.map((url) => loadRouteTex(url))).then((loaded) => {
      if (dead) return;
      const bySrc = new Map<string, HTMLImageElement | null>();
      urls.forEach((url, i) => bySrc.set(url, loaded[i]));
      ctx.clearRect(0, 0, width, height);
      for (const cell of cells) {
        const x = cell.left - minLeft;
        const y = cell.top - minTop;
        const img = bySrc.get(cell.tex);
        ctx.globalAlpha = cell.cover;
        if (img) ctx.drawImage(img, x, y, GBA_CELL_PX, GBA_CELL_PX);
        else {
          ctx.fillStyle = cell.a;
          ctx.fillRect(x, y, GBA_CELL_PX, GBA_CELL_PX);
        }
        if (cell.shore) {
          ctx.globalAlpha = 0.92;
          ctx.fillStyle = "rgba(224, 242, 254, 0.95)";
          ctx.fillRect(x, y + GBA_CELL_PX - 5, GBA_CELL_PX, 5);
        }
      }
      ctx.globalAlpha = 1;
    });
    return () => {
      dead = true;
    };
  }, [paintKey, cells, minLeft, minTop, width, height]);

  return (
    <canvas
      ref={ref}
      className="absolute pv-route-canvas"
      data-route-render="canvas"
      data-cell-count={cells.length}
      data-cell-grass={counts.grass}
      data-cell-path={counts.path}
      data-cell-water={counts.water}
      data-cell-tree={counts.tree}
      data-cell-dirt={counts.dirt}
      style={{ left: minLeft, top: minTop, width, height, imageRendering: "auto" }}
    />
  );
}

function GbaWalkLayer({
  playerGeo,
  zoom,
  anchorGeo,
  eraId,
  onChallengeGym,
  onVisitHome,
  earnedIds,
}: {
  playerGeo: { lat: number; lng: number };
  zoom: number;
  anchorGeo: { lat: number; lng: number };
  eraId: AdventureState["world"]["activeEraId"];
  onChallengeGym?: (stop: RouteStop) => void;
  onVisitHome?: (stop: RouteStop) => void;
  earnedIds: string[];
}) {
  const world = latLngToWorldPixels(playerGeo.lat, playerGeo.lng, zoom);
  const originCol = Math.floor(world.x / GBA_CELL_PX);
  const originRow = Math.floor(world.y / GBA_CELL_PX);
  const fracX = world.x % GBA_CELL_PX;
  const fracY = world.y % GBA_CELL_PX;
  const cols = 22;
  const rows = 16;
  const cells: RouteCell[] = [];
  const stops = eraId ? routeStopLayout(anchorGeo, zoom, eraId, GBA_CELL_PX) : [];
  const visibleStops: Array<RouteStop & { left: number; top: number }> = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = originCol + col - Math.floor(cols / 2);
      const ty = originRow + row - Math.floor(rows / 2);
      const kind = gbaCellKind(tx, ty);
      const [a] = GBA_CELL_COLORS[kind];
      cells.push({
        key: `${originCol + col}-${originRow + row}`,
        left: (col - cols / 2) * GBA_CELL_PX - fracX,
        top: (row - rows / 2) * GBA_CELL_PX - fracY,
        a,
        tex: GBA_CELL_TEXTURE[kind],
        kind,
        cover: gbaCellCover(kind),
        shore: gbaShoreEdge(tx, ty),
      });
    }
  }
  for (const stop of stops) {
    const relCol = stop.tx - (originCol - Math.floor(cols / 2));
    const relRow = stop.ty - (originRow - Math.floor(rows / 2));
    if (relCol < 0 || relCol >= cols || relRow < 0 || relRow >= rows) continue;
    visibleStops.push({
      ...stop,
      left: (relCol - cols / 2) * GBA_CELL_PX - fracX,
      top: (relRow - rows / 2) * GBA_CELL_PX - fracY,
    });
  }
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute left-1/2 top-1/2">
        <RouteCanvas cells={cells} />
        {visibleStops.map((stop) => {
          const earned = !!stop.leader && earnedIds.includes(stop.id);
          return (
          <button
            key={stop.id}
            type="button"
            className="absolute pointer-events-auto flex flex-col items-center"
            style={{ left: stop.left + 8, top: stop.top - 18, width: 48, zIndex: 5 }}
            aria-label={
              stop.leader
                ? earned
                  ? `${stop.town} Gym, ${stop.badge} Badge earned. Rematch is open.`
                  : `${stop.town} Gym, ${stop.leader}. Challenge in any order.`
                : `${stop.town}, hometown. Choose your partner.`
            }
            onClick={() => {
              if (stop.leader && stop.mon && stop.level && stop.type) onChallengeGym?.(stop);
              else onVisitHome?.(stop);
            }}
          >
            <span
              className="block h-0 w-0"
              style={{
                borderLeft: "16px solid transparent",
                borderRight: "16px solid transparent",
                borderBottom: stop.leader ? "10px solid #9f1239" : "10px solid #44403c",
              }}
            />
            <span
              className="block h-6 w-8 border border-neutral-900"
              style={{ background: stop.leader ? "#fde68a" : "#e7e5e4" }}
            />
            <span className="mt-0.5 max-w-[72px] truncate rounded bg-neutral-950/90 px-1 text-[8px] font-bold leading-tight text-amber-100">
              {earned ? "✓ " : ""}
              {stop.town}
              {stop.leader ? ` · ${stop.leader}` : ""}
            </span>
          </button>
          );
        })}
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
  onChallengeGym,
  onVisitHome,
  onWildEncounter,
}: {
  adventureState: AdventureState;
  onSelectCreature: (creature: WildCreature, mode: "catch" | "battle") => void;
  onSelectDiscoveryPoint: (point: DiscoveryPoint) => void;
  onSelectBattleArena: (arena: BattleArena) => void;
  onSelectCardCache: (cache: CardCacheDrop) => void;
  onChallengeGym?: (stop: RouteStop) => void;
  onVisitHome?: (stop: RouteStop) => void;
  onWildEncounter?: (encounter: WildEncounter) => void;
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
  // Esri World Dark Gray Canvas has no zoom-17 tiles (they paint "Map data not yet available").
  // Zoom 16 is the last level that draws real streets. Streets stay at the walk zoom.
  const zoom = mapStyle === "dark" ? 16 : MAP_ZOOM_DEFAULT;
  const [facingAngle, setFacingAngle] = useState(0);
  const [isWalking, setIsWalking] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(adventureState.world.timeOfDay);
  const [weather, setWeather] = useState<WeatherType>(adventureState.world.weather);
  const [recentlyPoppedId, setRecentlyPoppedId] = useState<string | null>(null);
  const [godsEyeOpen, setGodsEyeOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [walkSkin, setWalkSkin] = useState<"go" | "gba">("gba");
  const nearestHub = nearestGodsEyeNodeByGeo(playerGeo.lat, playerGeo.lng);
  const routeAnchor = nearestHub.kind === "region" ? nearestHub : findGodsEyeNode("dresden") || nearestHub;

  const walkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const routeBootRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const playerGeoRef = useRef(playerGeo);
  playerGeoRef.current = playerGeo;
  const encounterLock = useRef(false);

  const applyGbaStep = (
    metersX: number,
    metersY: number,
  ): { lat: number; lng: number; meters: number } | null => {
    if (walkSkin !== "gba") return null;
    const here = playerGeoRef.current;
    const step = marchGbaWalk({
      lat: here.lat,
      lng: here.lng,
      metersX,
      metersY,
      zoom,
      eraId: adventureState.world.activeEraId || "vintage_kanto",
    });
    if (!step.moved) return null;
    if (step.encounter && !encounterLock.current) {
      encounterLock.current = true;
      onWildEncounter?.(step.encounter);
      window.setTimeout(() => {
        encounterLock.current = false;
      }, 2500);
    }
    return { lat: step.lat, lng: step.lng, meters: step.meters };
  };

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

  // Open on the route. City streets stay one tap away. Runs once so the toggle still sticks.
  // A pin that lands in the river is moved to the nearest path so grass steps can start.
  useEffect(() => {
    if (routeBootRef.current) return;
    routeBootRef.current = true;
    setWalkSkin("gba");
    if (!onStateUpdate) return;
    const here = adventureState.world.playerGeo;
    const dry = here ? dryRouteStart(here.lat, here.lng, zoom) : null;
    const stuck = !!(here && dry && (dry.lat !== here.lat || dry.lng !== here.lng));
    if (adventureState.world.walkSkin === "gba" && !stuck) return;
    const s = cloneAdventureState(adventureState);
    s.world.walkSkin = "gba";
    if (stuck && dry) {
      s.world.playerGeo = {
        lat: dry.lat,
        lng: dry.lng,
        accuracy: 12,
        heading: s.world.playerGeo?.heading || 0,
      };
    }
    saveAdventureState(s);
    onStateUpdate(s);
  }, [adventureState, onStateUpdate, zoom]);

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
    const stepped = applyGbaStep(metersX, metersY);
    const here = playerGeoRef.current;
    const nextGeo = stepped
      ? { lat: stepped.lat, lng: stepped.lng }
      : walkSkin === "gba"
        ? null
        : geoOffsetFromMeters(here.lat, here.lng, metersX, metersY);
    if (!nextGeo) return;
    const nextCoords = { xPct: 50, yPct: 50 };
    setPlayerGeo((prev) => ({ ...prev, lat: nextGeo.lat, lng: nextGeo.lng, heading: deg }));
    setPlayerCoords(nextCoords);
    onUpdateCoords(nextCoords, stepped ? stepped.meters : Math.max(1, distMeters), {
      ...here,
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
    // Undo the GO tilt camera so a tap lands where it looks like it lands.
    const flat = untiltPoint(
      e.clientX - rect.left - rect.width / 2,
      e.clientY - rect.top - rect.height / 2,
    );
    const dxPx = flat.x;
    const dyPx = flat.y;
    const mpp = metersPerPixel(playerGeo.lat, zoom);
    const metersX = dxPx * mpp;
    const metersY = -dyPx * mpp;
    const dist = Math.round(Math.hypot(metersX, metersY));

    const deg = (Math.atan2(dyPx, dxPx) * 180) / Math.PI + 90;
    setFacingAngle(deg);

    const stepped = applyGbaStep(metersX, metersY);
    const here = playerGeoRef.current;
    const nextGeo = stepped
      ? { lat: stepped.lat, lng: stepped.lng }
      : walkSkin === "gba"
        ? null
        : geoOffsetFromMeters(here.lat, here.lng, metersX, metersY);
    if (!nextGeo) return;
    const nextCoords = { xPct: 50, yPct: 50 };
    setPlayerGeo((prev) => ({ ...prev, lat: nextGeo.lat, lng: nextGeo.lng }));
    setPlayerCoords(nextCoords);
    onUpdateCoords(nextCoords, stepped ? stepped.meters : Math.max(1, dist), {
      ...here,
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
  const tileInfo = useMemo(() => {
    return latLngToTile(playerGeo.lat, playerGeo.lng, zoom);
  }, [playerGeo.lat, playerGeo.lng, zoom]);

  const screenPos = (entity: { lat?: number; lng?: number; xPct: number; yPct: number }) => {
    if (typeof entity.lat === "number" && typeof entity.lng === "number") {
      const off = geoScreenOffset(playerGeo, { lat: entity.lat, lng: entity.lng }, zoom);
      return { left: `calc(50% + ${off.dx}px)`, top: `calc(50% + ${off.dy}px)` };
    }
    return { left: `${entity.xPct}%`, top: `${entity.yPct}%` };
  };

  // The catalog is WORLD_SCALE times the old plane. Only the camera window is mounted.
  const inWalkWindow = (entity: { lat?: number; lng?: number }) => {
    if (typeof entity.lat !== "number" || typeof entity.lng !== "number") return true;
    const off = geoScreenOffset(playerGeo, { lat: entity.lat, lng: entity.lng }, zoom);
    return Math.abs(off.dx) <= 1100 && Math.abs(off.dy) <= 800;
  };
  const worldKm = Math.round(worldPlaneSpanMeters() / 1000);

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
    const tiles: { key: string; url: string; xOffset: number; yOffset: number; size: number }[] = [];
    const cartoKey =
      (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim() ||
      (import.meta.env.VITE_MAP_TILE_KEY as string | undefined)?.trim() ||
      "";
    // Walk math stays at `zoom`. Imagery is fetched one level closer and drawn
    // at half size, so the same ground gets twice the photo detail.
    const sharp = mapStyle === "dark" && walkSkin === "gba" && !cartoKey;
    const imageryZoom = sharp ? Math.min(18, zoom + 1) : zoom;
    const info = sharp ? latLngToTile(playerGeo.lat, playerGeo.lng, imageryZoom) : tileInfo;
    const tilePx = 256 / 2 ** (imageryZoom - zoom);
    const radius = sharp ? 5 : 2;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = info.tileX + dx;
        const ty = info.tileY + dy;
        const key = `${imageryZoom}-${tx}-${ty}`;
        let url: string;
        if (mapStyle === "dark" && cartoKey) {
          url = `https://a.basemaps.cartocdn.com/dark_all/${zoom}/${tx}/${ty}@2x.png?api_key=${encodeURIComponent(cartoKey)}`;
        } else if (sharp) {
          url = esriWorldImageryTile(imageryZoom, ty, tx);
        } else if (mapStyle === "dark") {
          url = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${zoom}/${ty}/${tx}`;
        } else {
          url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${ty}/${tx}`;
        }

        tiles.push({
          key,
          url,
          size: tilePx,
          xOffset: dx * tilePx - info.fracX * tilePx,
          yOffset: dy * tilePx - info.fracY * tilePx,
        });
      }
    }
    return tiles;
  }, [tileInfo, mapStyle, walkSkin, zoom, playerGeo.lat, playerGeo.lng]);

  const hasCartoKey = !!(
    (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_MAP_TILE_KEY as string | undefined)?.trim()
  );
  const darkTileFilter =
    mapStyle === "dark"
      ? "contrast(1.25) brightness(1.25)"
      : "none";

  // ── GO-style camera follow ────────────────────────────────────────────
  // The world re-renders centred on the player at ~30 Hz. To make that look
  // continuous, each move offsets the world layers by the pixel delta and
  // eases the offset back to 0 every animation frame (exponential follow).
  const camRef = useRef<HTMLDivElement>(null);
  const camOffRef = useRef({ x: 0, y: 0 });
  const camPrevRef = useRef<{ lat: number; lng: number } | null>(null);
  const camRafRef = useRef<number | null>(null);
  const applyCam = () => {
    const root = camRef.current;
    if (!root) return;
    const { x, y } = camOffRef.current;
    root.style.setProperty("--pv-cam-x", `${x.toFixed(2)}px`);
    root.style.setProperty("--pv-cam-y", `${y.toFixed(2)}px`);
  };
  useLayoutEffect(() => {
    const prev = camPrevRef.current;
    camPrevRef.current = { lat: playerGeo.lat, lng: playerGeo.lng };
    if (!prev) return;
    const a = latLngToWorldPixels(prev.lat, prev.lng, zoom);
    const b = latLngToWorldPixels(playerGeo.lat, playerGeo.lng, zoom);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.hypot(dx, dy) > 240) {
      camOffRef.current = { x: 0, y: 0 }; // teleport: cut, don't glide
      applyCam();
      return;
    }
    camOffRef.current = { x: camOffRef.current.x + dx, y: camOffRef.current.y + dy };
    applyCam();
    if (camRafRef.current != null) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const o = camOffRef.current;
      camOffRef.current = { x: easeToward(o.x, 0, dt), y: easeToward(o.y, 0, dt) };
      applyCam();
      if (camOffRef.current.x === 0 && camOffRef.current.y === 0) {
        camRafRef.current = null;
        return;
      }
      camRafRef.current = requestAnimationFrame(step);
    };
    camRafRef.current = requestAnimationFrame(step);
  }, [playerGeo.lat, playerGeo.lng, zoom]);
  useEffect(
    () => () => {
      if (camRafRef.current != null) cancelAnimationFrame(camRafRef.current);
    },
    [],
  );

  const isNight = timeOfDay === "night";
  const isSunset = timeOfDay === "sunset";

  return (
    <div className="pv-adv-stage pv-go relative w-full rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950 shadow-2xl select-none font-mono">
      {/* Dynamic 2.5D Map Canvas Viewport */}
      <div
        ref={camRef}
        onClick={handleMapClick}
        className="pv-go-viewport relative w-full h-full cursor-crosshair overflow-hidden bg-[#09111e]"
        style={
          {
            perspective: `${MAP_TILT.perspective}px`,
            "--pv-tilt": `${MAP_TILT.deg}deg`,
            "--pv-tilt-scale": MAP_TILT.scale,
          } as React.CSSProperties
        }
      >
        <div className="pv-go-sky" aria-hidden />
        {/* Real-World Street Map Tile Layer (Esri basemaps; optional Carto with API key) */}
        <div
          data-cam="tiles"
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 overflow-hidden flex items-center justify-center"
          style={{
            opacity: 1,
            imageRendering: walkSkin === "gba" ? "auto" : undefined,
          }}
        >
          {/* One filter pass for the whole tile layer (per-tile filters cost ~25 passes/frame). */}
          <div
            className="relative w-[768px] h-[768px]"
            data-world-basemap={walkSkin === "gba" && mapStyle === "dark" && !hasCartoKey ? "world-imagery" : mapStyle}
            style={{ filter: walkSkin === "gba" ? "saturate(1.15) contrast(1.05)" : darkTileFilter }}
          >
            {tileGrid.map((t) => (
              <img
                key={t.key}
                src={t.url}
                alt="Map Tile"
                className="pv-basemap-tile absolute object-cover pointer-events-none"
                style={{
                  left: `calc(50% + ${t.xOffset}px)`,
                  top: `calc(50% + ${t.yOffset}px)`,
                  width: t.size,
                  height: t.size,
                }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ))}
          </div>
        </div>

        {walkSkin === "gba" && (
          <div data-cam className="absolute inset-0 pointer-events-none">
            <GbaWalkLayer
              playerGeo={playerGeo}
              zoom={zoom}
              anchorGeo={routeAnchor}
              eraId={adventureState.world.activeEraId}
              earnedIds={earnedStopIds(
                adventureState.world.routeBadges,
                adventureState.world.activeEraId || "vintage_kanto",
              )}
              onChallengeGym={onChallengeGym}
              onVisitHome={onVisitHome}
            />
          </div>
        )}

        {walkSkin === "gba" && (
          <div
            className="absolute inset-0 pointer-events-none"
            data-era-light={adventureState.world.activeEraId || "vintage_kanto"}
            data-era-label={eraWorldLight(adventureState.world.activeEraId).label}
            style={{
              background: eraWorldLight(adventureState.world.activeEraId).wash,
              mixBlendMode: "soft-light",
            }}
          />
        )}

        {/* 2.5D Tilt Perspective Surface Layer */}
        <div data-cam className="absolute inset-0">
          {walkSkin !== "gba" && (
            <div
              className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#06b6d4_1px,transparent_1px)]"
              style={{ backgroundSize: "36px 36px" }}
            />
          )}

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
          {adventureState.battleArenas.filter(inWalkWindow).map((arena) => (
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
          {adventureState.discoveryPoints.filter(inWalkWindow).map((point) => {
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
            .filter((c) => !c.claimed && inWalkWindow(c))
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
          {adventureState.wildCreatures.filter(inWalkWindow).map((creature) => {
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
                  className="absolute z-20 flex flex-col items-center group cursor-pointer"
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
                      style={{ imageRendering: "auto" }}
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
                className="absolute z-20 cursor-pointer group flex flex-col items-center hover:scale-115 transition-transform duration-200"
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
                <WorldSprite
                  name={creature.species}
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
            data-cam-inv
            data-walking={isWalking ? "1" : undefined}
            style={{ left: "50%", top: "50%" }}
            className="pv-go-avatar absolute z-30 flex items-center justify-center pointer-events-none"
          >
            {/* 45-Meter Glowing GO Interaction Radar Ring */}
            <div className="pv-go-radius w-40 h-40 rounded-full absolute" />
            <div className="pv-go-radius-outer w-56 h-56 rounded-full absolute" />

            {/* Original 4-dir trainer (adventure-assets), not PokeAPI trainers/1.png */}
            {/* Billboard wrapper: CSS rotateX counters the map tilt so the trainer stands upright.
                No inline transform here — it would override the billboard while walking. */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-10 h-4 rounded-full bg-black/40 blur-[2px] top-[52px]" />
              <img
                src={trainerFacingUrl(facingAngle)}
                alt="Trainer"
                className="w-16 h-16 object-contain relative z-10"
                style={{ imageRendering: "pixelated" }}
              />
            </div>

            {/* Buddy trails behind the trainer (opposite the heading), eased via CSS transition,
                billboarded upright and mirrored to face the same way. */}
            {(() => {
              const rad = (facingAngle * Math.PI) / 180;
              const bx = -Math.sin(rad) * 44;
              const by = Math.cos(rad) * 22 + 6;
              const faceLeft = Math.sin(rad) < -0.2;
              return (
                <div
                  className="pv-go-buddy absolute flex items-center justify-center"
                  style={{ ["--pv-buddy-x" as string]: `${bx.toFixed(1)}px`, ["--pv-buddy-y" as string]: `${by.toFixed(1)}px` }}
                >
                  <div className="pv-go-buddy-bb relative" data-face-left={faceLeft ? "1" : undefined}>
                    <div className="absolute w-7 h-2.5 rounded-full bg-black/35 blur-[2px] left-1/2 -translate-x-1/2 top-[34px]" />
                    <WorldSprite
                      name={adventureState.buddy.species}
                      alt={adventureState.buddy.species}
                      className="w-10 h-10 object-contain relative z-10 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]"
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* HUD: compact status chip (left) + icon rail (right). Everything else */}
      {/* (GPS, map style, time of day, weather) lives in one collapsible panel. */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-[4.25rem] left-3 sm:left-4 z-30 pointer-events-auto max-w-[62%]">
        <button
          type="button"
          onClick={() => setControlsOpen((o) => !o)}
          className="pv-lw-chip"
          aria-label="Map status — open map controls"
        >
          <Radio
            className={`w-3.5 h-3.5 shrink-0 ${
              useLiveGps ? "text-emerald-400 animate-pulse" : "text-cyan-400"
            }`}
          />
          <span className="flex flex-col min-w-0 text-left">
            <span className="pv-lw-chip-title">
              {useLiveGps
                ? "LIVE GPS"
                : isWalking
                  ? walkSkin === "gba"
                    ? "ROUTE · 45m"
                    : "CITY STREETS · 45m"
                  : walkSkin === "gba"
                    ? "ROUTE OVERWORLD"
                    : "CITY STREETS"}
            </span>
            <span className="pv-lw-chip-sub">
              {playerGeo.lat.toFixed(4)}, {playerGeo.lng.toFixed(4)} · ×{WORLD_SCALE} · {worldKm} km
            </span>
          </span>
        </button>
      </div>

      <div
        className={`absolute top-[4.25rem] right-3 sm:right-4 ${controlsOpen ? "z-50" : "z-30"} flex flex-col items-end gap-2`}
      >
        <button
          type="button"
          onClick={() => setControlsOpen((o) => !o)}
          className={`pv-lw-rail-btn ${controlsOpen ? "on" : ""}`}
          aria-label="Map controls"
          aria-expanded={controlsOpen}
          title="Map controls: GPS, map style, time & weather"
        >
          {controlsOpen ? <X className="w-5 h-5" /> : <SlidersHorizontal className="w-5 h-5" />}
        </button>
        <button
          type="button"
          onClick={() => setGodsEyeOpen(true)}
          className="pv-lw-rail-btn gold"
          aria-label="God's Eye world atlas"
          title="God's Eye world atlas — teleport across regions"
        >
          <Eye className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleRecenterGps}
          className="pv-lw-rail-btn"
          aria-label="Recenter map on my location"
          title="Recenter Map on Real Location"
        >
          <LocateFixed className="w-5 h-5" />
        </button>

        {controlsOpen && (
          <div className="pv-lw-panel" role="dialog" aria-label="Map controls">
            <div className="pv-lw-panel-sec">Location</div>
            <button
              type="button"
              onClick={() => setUseLiveGps(!useLiveGps)}
              className={`pv-lw-toggle ${useLiveGps ? "on" : ""}`}
              aria-pressed={useLiveGps}
              title="Toggle Real Device Geolocation"
            >
              <Radio className="w-4 h-4" />
              <span className="flex-1 text-left">{useLiveGps ? "Live GPS on" : "Use my GPS"}</span>
              <span className="pv-lw-switch" aria-hidden />
            </button>
            <div className="pv-lw-coords">
              {playerGeo.lat.toFixed(4)}, {playerGeo.lng.toFixed(4)}
            </div>

            <div className="pv-lw-panel-sec">Map style</div>
            <div className="pv-lw-seg" role="group" aria-label="Map style">
              <button
                type="button"
                onClick={() => setMapStyle("dark")}
                className={mapStyle === "dark" ? "on" : ""}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setMapStyle("streets")}
                className={mapStyle === "streets" ? "on" : ""}
              >
                Streets
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = walkSkin === "gba" ? "go" : "gba";
                  setWalkSkin(next);
                  if (onStateUpdate) {
                    const st = cloneAdventureState(adventureState);
                    st.world.walkSkin = next;
                    saveAdventureState(st);
                    onStateUpdate(st);
                  }
                }}
                className={walkSkin === "gba" ? "on gold" : ""}
                aria-pressed={walkSkin === "gba"}
              >
                ROUTE
              </button>
            </div>

            <div className="pv-lw-panel-sec">Time of day</div>
            <div className="pv-lw-seg" role="group" aria-label="Time of day">
              {(["day", "sunset", "night"] as TimeOfDay[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeOfDay(t)}
                  className={timeOfDay === t ? "on" : ""}
                  title={t.toUpperCase()}
                >
                  {t === "day" ? (
                    <Sun className="w-4 h-4" />
                  ) : t === "sunset" ? (
                    <Sparkles className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>

            <div className="pv-lw-panel-sec">Weather</div>
            <div className="pv-lw-seg" role="group" aria-label="Weather">
              {(["clear", "rain", "storm"] as WeatherType[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeather(w)}
                  className={weather === w ? "on" : ""}
                  title={w.toUpperCase()}
                >
                  {w === "clear" ? (
                    <Sun className="w-4 h-4" />
                  ) : w === "rain" ? (
                    <CloudRain className="w-4 h-4" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  <span className="capitalize">{w}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Basemap attribution (Esri courtesy) */}
      <div className="absolute bottom-2 left-2 z-30 pointer-events-none px-2 py-0.5 rounded bg-black/55 text-[9px] text-neutral-400 font-sans tracking-wide">
        {walkSkin === "gba" && mapStyle === "dark" && !hasCartoKey
          ? `Imagery © Esri, Maxar, Earthstar Geographics · ${eraWorldLight(adventureState.world.activeEraId).label}`
          : "Basemap © Esri"}
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
