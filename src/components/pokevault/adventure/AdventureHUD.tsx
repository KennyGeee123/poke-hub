import React, { useState } from "react";
import {
  BookOpen,
  Compass,
  ShoppingBag,
  Sparkles,
  Trophy,
  Zap,
  Users,
  Coins,
  Package,
  Layers,
  MapPin,
  Flame,
  Menu,
  X,
  Footprints,
  Eye,
} from "lucide-react";
import {
  type AdventureState,
  type PokemonEraId,
  getEraRotationStatus,
  POKEMON_ERAS,
  ERA_ROTATION_ORDER,
  DRESDEN_PARK_GEO,
  haversineMeters,
  isInsidePark,
  WORLD_SCALE,
  RADAR_DISCOVERY_RADIUS_METERS,
} from "@/lib/adventure-engine";
import { trainerFacingUrl } from "@/lib/sprites";
import { WorldSprite } from "./WorldSprite";
import { leagueStanding, nextOpenGym, routeBadgeCase } from "@/lib/route-towns";

export function AdventureHUD({
  adventureState,
  onOpenShop,
  onOpenEvolution,
  onOpenInventory,
  onOpenQuests,
  onOpenBuddy,
  onOpenVault,
  onToggleNearby,
  onForceSwitchEra,
  onOpenPokedex,
  onChallengeLeague,
}: {
  adventureState: AdventureState;
  onOpenShop: () => void;
  onOpenEvolution: () => void;
  onOpenInventory: () => void;
  onOpenQuests: () => void;
  onOpenBuddy: () => void;
  onOpenVault: () => void;
  onToggleNearby: () => void;
  onForceSwitchEra?: (eraId: PokemonEraId) => void;
  onOpenPokedex?: () => void;
  onChallengeLeague?: () => void;
}) {
  const [radialOpen, setRadialOpen] = useState(false);
  const [eraModalOpen, setEraModalOpen] = useState(false);
  const [eraStatus, setEraStatus] = useState(() => getEraRotationStatus());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setEraStatus(getEraRotationStatus());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const geo = adventureState.world.playerGeo;
  const inDresdenPark = geo
    ? haversineMeters(geo.lat, geo.lng, DRESDEN_PARK_GEO.lat, DRESDEN_PARK_GEO.lng) <= 450
    : adventureState.world.activeRegionId === "dresden" ||
      isInsidePark(adventureState.world.playerCoords.xPct, adventureState.world.playerCoords.yPct);

  const p = adventureState.player;
  const inv = adventureState.inventory;
  const w = adventureState.world;

  const xpPct = Math.min(100, Math.round((p.xp / p.xpToNextLevel) * 100));
  const energyPct = Math.min(100, Math.round((inv.energy / inv.maxEnergy) * 100));
  const eraId = w.activeEraId || "vintage_kanto";
  const badgeCase = routeBadgeCase(eraId, w.routeBadges);
  const earnedCount = badgeCase.filter((row) => row.earned).length;
  const openGym = nextOpenGym(eraId, w.routeBadges);
  const partnerName = w.partner?.eraId === eraId ? w.partner.species : "";
  const gate = leagueStanding(eraId, w.routeBadges);
  const leagueCleared = !!w.leaguesCleared?.[eraId];
  const nearby = adventureState.wildCreatures
    .filter((c) => c.distanceMeters <= 2000)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  const menuItems: { label: string; Icon: typeof Trophy; tone: string; run: () => void }[] = [
    ...(onOpenPokedex
      ? [{ label: "POKÉDEX", Icon: BookOpen, tone: "bg-rose-500", run: onOpenPokedex }]
      : []),
    { label: "ITEMS", Icon: Package, tone: "bg-sky-500", run: onOpenInventory },
    { label: "SHOP", Icon: ShoppingBag, tone: "bg-emerald-500", run: onOpenShop },
    { label: "QUESTS", Icon: Trophy, tone: "bg-amber-500", run: onOpenQuests },
    { label: "BUDDY", Icon: Users, tone: "bg-fuchsia-500", run: onOpenBuddy },
    { label: "EVOLVE", Icon: Sparkles, tone: "bg-cyan-500", run: onOpenEvolution },
    { label: "VAULT", Icon: Layers, tone: "bg-orange-500", run: onOpenVault },
    { label: "SETTINGS", Icon: Compass, tone: "bg-slate-500", run: () => setEraModalOpen(true) },
  ];

  return (
    <>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* TOP FLOATING HUD BAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-3 inset-x-3 sm:inset-x-6 z-40 flex items-center justify-between gap-2 pointer-events-none select-none font-mono">
        <span aria-hidden className="w-0" />
        {/* Center: Biome, Dresden Park Nest & 30-Minute Era Rotation */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Biome Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800 shadow-xl text-xs">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-neutral-200">
              {inDresdenPark ? "🌳 Dresden Park Nature Reserve" : w.biome}
            </span>
            {inDresdenPark && (
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-[10px] font-bold animate-pulse">
                ⚡ 5x RARE NEST
              </span>
            )}
          </div>

          {/* 30-Minute Era Rotation Capsule Widget */}
          <button
            type="button"
            onClick={() => setEraModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-amber-500/40 hover:border-amber-400 shadow-xl text-xs text-neutral-200 transition group"
            title="Active Pokémon Era (Rotates every 30 mins) · Tap to Inspect or Shift"
          >
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <span>⚡</span>
              <span className="hidden sm:inline">{eraStatus.activeEra.name}</span>
              <span className="sm:hidden">{eraStatus.activeEra.shortName}</span>
            </span>
            <span className="text-neutral-600">|</span>
            <span className="font-mono text-cyan-300 font-bold text-[11px] group-hover:text-white">
              ⏳ {eraStatus.formattedCountdown}
            </span>
          </button>
        </div>

        {/* Right: Currencies & Quick Bag */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Coins Counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-amber-500/30 text-amber-300 text-xs font-bold shadow-xl">
            <span>🪙</span>
            <span>{inv.coins}</span>
          </div>

          {/* Energy Counter */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-cyan-500/30 text-cyan-300 text-xs font-bold shadow-xl">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {inv.energy}/{inv.maxEnergy}
            </span>
          </div>

          {/* Bag Quick Trigger */}
          <button
            type="button"
            onClick={onOpenInventory}
            className="p-2.5 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800 hover:border-cyan-400 text-neutral-300 hover:text-white shadow-xl transition"
            title="Open Bag"
          >
            <Package className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>

      <div
        className="absolute top-[4.25rem] left-3 right-3 z-40 pointer-events-none select-none"
        data-route-case="1"
      >
        <div className="pointer-events-auto inline-flex max-w-full flex-col gap-1 rounded-2xl border border-amber-500/30 bg-neutral-950/85 px-2.5 py-1.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 text-[10px] font-bold">
            <span className="text-amber-200">
              Badge case {earnedCount}/{badgeCase.length}
            </span>
            <span className="truncate text-neutral-300">
              {partnerName ? partnerName : "Partner at hometown"}
              {openGym ? ` · Open ${openGym.town}` : badgeCase.length ? " · Route clear" : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {badgeCase.map((row) => (
              <span
                key={row.id}
                title={
                  row.earned ? `${row.badge} Badge · ${row.town}` : `${row.town} · ${row.leader}`
                }
                className={`h-2.5 w-2.5 rounded-full border ${
                  row.earned ? "border-amber-200 bg-amber-400" : "border-neutral-600 bg-neutral-800"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            data-league-gate="1"
            disabled={!gate.open}
            onClick={() => gate.open && onChallengeLeague?.()}
            className={`mt-0.5 w-fit max-w-full truncate rounded-full px-2 py-0.5 text-left text-[10px] font-bold ${
              gate.open ? "bg-amber-400 text-neutral-950" : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {leagueCleared
              ? `${gate.name} rematch`
              : gate.open
                ? `${gate.name} open`
                : `${gate.name} sealed ${gate.earned}/${gate.need}`}
          </button>
        </div>
      </div>

      {/* BOTTOM LEFT: GO-STYLE PROFILE BUBBLE */}
      <button
        type="button"
        data-go-profile="1"
        onClick={onOpenBuddy}
        className="pv-go-hud absolute bottom-3 left-3 sm:left-6 z-40 flex items-center gap-2 select-none"
        title={`${p.displayName} · Lv.${p.level} · ${p.xp}/${p.xpToNextLevel} XP`}
        aria-label={`Trainer profile, level ${p.level}, ${xpPct}% to next level`}
      >
        <span
          className="relative grid h-14 w-14 place-items-center rounded-full"
          style={{
            background: `conic-gradient(#22d3ee ${xpPct * 3.6}deg, rgba(255,255,255,0.35) 0deg)`,
          }}
        >
          <span className="grid h-[48px] w-[48px] place-items-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-sky-200 to-emerald-200 shadow-lg">
            <img
              src={trainerFacingUrl(180)}
              alt=""
              className="h-10 w-10 object-contain"
              style={{ imageRendering: "pixelated" }}
            />
          </span>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-slate-800 px-1.5 text-[10px] font-extrabold leading-4 text-white shadow">
            {p.level}
          </span>
        </span>
        <span className="hidden sm:flex flex-col items-start rounded-full bg-white/85 px-3 py-1 text-left shadow-lg backdrop-blur">
          <span className="max-w-[9rem] truncate text-[11px] font-extrabold text-slate-800">
            {p.displayName}
          </span>
          <span className="text-[9px] font-bold text-slate-500">
            {p.xp.toLocaleString()} / {p.xpToNextLevel.toLocaleString()} XP
          </span>
        </span>
      </button>

      {/* BOTTOM CENTER: BALL MENU BUTTON + MAIN MENU SHEET */}
      {radialOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
          onClick={() => setRadialOpen(false)}
        />
      )}
      <div className="absolute bottom-3 inset-x-0 z-40 flex flex-col items-center pointer-events-none select-none">
        {radialOpen && (
          <div
            role="menu"
            data-go-menu="1"
            className="pointer-events-auto mb-3 grid w-[min(20rem,calc(100vw-1.5rem))] grid-cols-3 gap-2 rounded-[1.75rem] bg-white/95 p-3 shadow-2xl animate-fade-in"
          >
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setRadialOpen(false);
                  item.run();
                }}
                className="flex flex-col items-center gap-1 rounded-2xl p-2 text-slate-700 transition hover:bg-slate-100 active:scale-95"
              >
                <span
                  className={`grid h-11 w-11 place-items-center rounded-full text-white shadow ${item.tone}`}
                >
                  <item.Icon className="h-5 w-5" />
                </span>
                <span className="text-[10px] font-extrabold tracking-wide">{item.label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          data-go-ball="1"
          aria-expanded={radialOpen}
          aria-label={radialOpen ? "Close main menu" : "Open main menu"}
          onClick={() => setRadialOpen(!radialOpen)}
          className="pointer-events-auto relative h-16 w-16 rounded-full shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          {radialOpen ? (
            <span className="grid h-full w-full place-items-center rounded-full border-4 border-white bg-slate-700 text-white">
              <X className="h-7 w-7" />
            </span>
          ) : (
            <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
              <circle cx="32" cy="32" r="30" fill="#f8fafc" stroke="#1e293b" strokeWidth="3" />
              <path d="M2 32a30 30 0 0 1 60 0Z" fill="#ef4444" stroke="#1e293b" strokeWidth="3" />
              <path
                d="M8 22a26 26 0 0 1 14-12"
                stroke="#fff"
                strokeOpacity=".55"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
              <rect x="2" y="29.5" width="60" height="5" fill="#1e293b" />
              <circle cx="32" cy="32" r="9" fill="#f8fafc" stroke="#1e293b" strokeWidth="4" />
              <circle cx="32" cy="32" r="4" fill="#e2e8f0" />
            </svg>
          )}
        </button>
      </div>

      {/* BOTTOM RIGHT: GO-STYLE NEARBY TRACKER */}
      <button
        type="button"
        data-go-nearby="1"
        onClick={onToggleNearby}
        className="absolute bottom-3 right-3 sm:right-6 z-40 flex items-center gap-1 rounded-2xl bg-white/90 p-1.5 shadow-lg backdrop-blur select-none transition hover:bg-white active:scale-95"
        title={`Nearby: ${nearby.length} of ${adventureState.wildCreatures.length} · ×${WORLD_SCALE}`}
        aria-label={`Open nearby tracker, ${nearby.length} Pokémon nearby`}
      >
        <span className="flex gap-0.5">
          {Array.from({ length: 3 }).map((_, i) => {
            const c = nearby[i];
            const seen = c && (c.isDiscovered || c.distanceMeters <= RADAR_DISCOVERY_RADIUS_METERS);
            return (
              <span
                key={c?.id ?? i}
                className={`h-7 w-7 sm:h-9 sm:w-9 place-items-center rounded-xl bg-slate-100 ${i === 2 ? "hidden sm:grid" : "grid"}`}
              >
                {c ? (
                  <WorldSprite
                    name={c.species}
                    alt={seen ? c.species : "Unknown Pokémon"}
                    className={`h-6 w-6 sm:h-8 sm:w-8 object-contain ${seen ? "" : "brightness-0 opacity-50"}`}
                  />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                )}
              </span>
            );
          })}
        </span>
        <span className="flex flex-col items-center px-1 text-slate-700">
          <Footprints className="h-4 w-4" />
          <span className="text-[10px] font-extrabold">{nearby.length}</span>
        </span>
      </button>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ERA ROTATION & INSPECTION MODAL (30-MINUTES ROTATION) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {eraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md animate-fade-in font-mono select-none pointer-events-auto">
          <div className="relative w-full max-w-lg rounded-3xl bg-neutral-950 border border-amber-500/40 shadow-2xl p-6 flex flex-col gap-4 text-center">
            <button
              type="button"
              onClick={() => setEraModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                ⚡ 30-MINUTE ERA SPAWN ENGINE
              </span>
              <h3 className="text-xl font-extrabold text-white mt-1">
                Active Era: {eraStatus.activeEra.name}
              </h3>
              <p className="text-xs text-neutral-400">
                Overworld Pokémon spawns cycle through 5 canonical eras every 30 minutes!
              </p>
            </div>

            {/* Countdown Progress Card */}
            <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">
                  Next Rotation:{" "}
                  <span className="text-white font-bold">{eraStatus.nextEra.name}</span>
                </span>
                <span className="text-cyan-400 font-bold font-mono">
                  ⏳ {eraStatus.formattedCountdown} left
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-950 overflow-hidden border border-neutral-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-1000"
                  style={{ width: `${eraStatus.progressPct}%` }}
                />
              </div>
            </div>

            {/* 5 Eras Grid Selector */}
            <div className="flex flex-col gap-2 text-left text-xs max-h-64 overflow-y-auto pr-1">
              {ERA_ROTATION_ORDER.map((eraId) => {
                const era = POKEMON_ERAS[eraId];
                const isActive = eraStatus.activeEraId === eraId;
                return (
                  <div
                    key={eraId}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition ${
                      isActive
                        ? "bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-500/10"
                        : "bg-neutral-900/80 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{era.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-[9px] font-bold text-neutral-300">
                          {era.years}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500 text-neutral-950 text-[9px] font-extrabold">
                            LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{era.description}</p>
                      <div className="flex items-center gap-1 mt-1 text-[9px] text-amber-300">
                        <span className="text-neutral-500">Icons:</span>
                        <span>{era.legendaries.slice(0, 3).join(", ")}</span>
                      </div>
                    </div>

                    {onForceSwitchEra && !isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          onForceSwitchEra(eraId);
                          setEraModalOpen(false);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-[10px] font-bold transition whitespace-nowrap ml-2"
                      >
                        Shift Now
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setEraModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 font-bold text-xs shadow-lg hover:brightness-110 transition"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  );
}
