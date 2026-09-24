import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Swords,
  Layers,
  Gamepad2,
  Compass,
  MapPin,
  Flame,
  ArrowRight,
} from "lucide-react";
import {
  type AdventureState,
  type WildCreature,
  type DiscoveryPoint,
  type BattleArena,
  type CardCacheDrop,
  loadAdventureState,
  saveAdventureState,
  forceSwitchEra,
  type PokemonEraId,
  addAdventureXp,
  updatePlayerLocation,
} from "@/lib/adventure-engine";

// Sub-components
import { AdventureWorldMap } from "./adventure/AdventureWorldMap";
import { AdventureHUD } from "./adventure/AdventureHUD";
import { AdventureEncounterModal } from "./adventure/AdventureEncounterModal";
import { AdventureDiscoveryModal } from "./adventure/AdventureDiscoveryModal";
import { AdventureCardCacheModal } from "./adventure/AdventureCardCacheModal";
import { AdventureEvolutionModal } from "./adventure/AdventureEvolutionModal";
import { AdventureShopModal } from "./adventure/AdventureShopModal";
import { AdventureInventoryModal } from "./adventure/AdventureInventoryModal";
import { AdventureBuddyModal } from "./adventure/AdventureBuddyModal";
import { AdventureQuestsModal } from "./adventure/AdventureQuestsModal";
import { AdventureNearbyDrawer } from "./adventure/AdventureNearbyDrawer";
import { AdventurePokedexModal } from "./adventure/AdventurePokedexModal";
import { toast } from "sonner";
import { HDBattleArena, type BattlePokemon } from "./adventure/HDBattleArena";
import { GBBattleSession, type GBBattleFoe } from "./GBBattleSession";
import { healParty } from "@/lib/gbgame";
import { healAllHp } from "@/lib/gb-hp";

const RETRO_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "w",
  "a",
  "s",
  "d",
  "W",
  "A",
  "S",
  "D",
  " ",
  "Enter",
  "m",
  "M",
  "p",
  "P",
]);

export function AdventureView() {
  const [adventureState, setAdventureState] = useState<AdventureState>(loadAdventureState);
  const [viewMode, setViewMode] = useState<"living_world" | "retro_gb">("living_world");

  const retroIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [gbBattleFoe, setGbBattleFoe] = useState<GBBattleFoe | null>(null);
  const gbBattleOpenRef = useRef(false);
  gbBattleOpenRef.current = !!gbBattleFoe;

  const focusRetro = () => {
    try {
      retroIframeRef.current?.contentWindow?.focus();
    } catch {}
  };

  // Keyboard play without clicking into the iframe first: forward arrows /
  // WASD / Space from the app window into the overworld while it is visible.
  useEffect(() => {
    if (viewMode !== "retro_gb") return;
    const onKey = (e: KeyboardEvent) => {
      if (gbBattleOpenRef.current) return;
      if (!RETRO_KEYS.has(e.key)) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      const win = retroIframeRef.current?.contentWindow as
        | (Window & { document: Document })
        | null
        | undefined;
      if (!win) return;
      e.preventDefault();
      try {
        win.document.dispatchEvent(
          new KeyboardEvent(e.type, { key: e.key, code: e.code, bubbles: true, cancelable: true }),
        );
      } catch {
        /* cross-origin guard — iframe is same-origin in practice */
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode]);

  // Retro GB iframe → in-tab GBBattleSession overlay (never pv-goto gb).
  useEffect(() => {
    const postIframe = (msg: Record<string, unknown>) => {
      try {
        retroIframeRef.current?.contentWindow?.postMessage(msg, "*");
      } catch {}
    };
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (retroIframeRef.current && e.source !== retroIframeRef.current.contentWindow) return;
      if (d.type === "pv-adventure-heal") {
        healAllHp();
        healParty().catch((err) => console.error(err));
        return;
      }
      if (d.type !== "pv-adventure-encounter" || typeof d.name !== "string") return;
      if (gbBattleOpenRef.current) return;
      const kind = (d.kind as GBBattleFoe["kind"]) || "wild";
      setGbBattleFoe({
        name: d.name,
        level: typeof d.level === "number" ? d.level : 5,
        kind,
        catchable: d.catchable !== false && kind === "wild",
        badge: typeof d.badge === "string" ? d.badge : undefined,
        e4Index: typeof d.e4Index === "number" ? d.e4Index : undefined,
        leader: typeof d.leader === "string" ? d.leader : undefined,
        trainerId: typeof d.trainerId === "string" ? d.trainerId : undefined,
      });
      postIframe({ type: "pv-adventure-pause" });
    };
    const onGym = (e: Event) => {
      const badge = (e as CustomEvent).detail?.badge;
      if (badge) postIframe({ type: "pv-adventure-badge", badge });
    };
    const onElite = (e: Event) => {
      const index = (e as CustomEvent).detail?.index ?? 0;
      postIframe({ type: "pv-adventure-e4-won", index });
    };
    const onCaught = (e: Event) => {
      const name = (e as CustomEvent).detail?.name;
      if (name) postIframe({ type: "pv-adventure-caught", name });
    };
    const onTrainer = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id) postIframe({ type: "pv-adventure-trainer-won", id });
    };
    window.addEventListener("message", onMsg);
    window.addEventListener("pv-adv-gym-won", onGym as EventListener);
    window.addEventListener("pv-adv-elite-won", onElite as EventListener);
    window.addEventListener("pv-adventure-caught", onCaught as EventListener);
    window.addEventListener("pv-adv-trainer-won", onTrainer as EventListener);
    return () => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener("pv-adv-gym-won", onGym as EventListener);
      window.removeEventListener("pv-adv-elite-won", onElite as EventListener);
      window.removeEventListener("pv-adventure-caught", onCaught as EventListener);
      window.removeEventListener("pv-adv-trainer-won", onTrainer as EventListener);
    };
  }, []);

  // Active Modals
  const [activeCreature, setActiveCreature] = useState<{
    creature: WildCreature;
    mode: "catch" | "battle";
  } | null>(null);
  const [activeDiscoveryPoint, setActiveDiscoveryPoint] = useState<DiscoveryPoint | null>(null);
  const [activeBattleArena, setActiveBattleArena] = useState<BattleArena | null>(null);
  const [activeCardCache, setActiveCardCache] = useState<CardCacheDrop | null>(null);

  const [shopOpen, setShopOpen] = useState(false);
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [questsOpen, setQuestsOpen] = useState(false);
  const [buddyOpen, setBuddyOpen] = useState(false);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [pokedexOpen, setPokedexOpen] = useState(false);

  // HD Turn-Based Battle State
  const [hdBattleOpen, setHdBattleOpen] = useState(false);
  const [currentBattleFoe, setCurrentBattleFoe] = useState<BattlePokemon | null>(null);
  const [battleCtx, setBattleCtx] = useState<{ kind: "wild" | "gym"; creatureId?: string }>({
    kind: "wild",
  });

  // Default Player Party for HD Battles
  const [playerParty, setPlayerParty] = useState<BattlePokemon[]>([
    {
      name: "Sparky (Pikachu)",
      species: "Pikachu",
      level: 32,
      maxHp: 120,
      currentHp: 120,
      types: ["Electric"],
      moves: [
        {
          name: "Thunderbolt",
          type: "Electric",
          power: 90,
          pp: 15,
          maxPp: 15,
          description: "Powerful electric strike.",
        },
        {
          name: "Iron Tail",
          type: "Normal",
          power: 75,
          pp: 15,
          maxPp: 15,
          description: "Hard tail slam.",
        },
        {
          name: "Volt Tackle",
          type: "Electric",
          power: 120,
          pp: 5,
          maxPp: 5,
          description: "High-voltage charge.",
        },
        {
          name: "Quick Attack",
          type: "Normal",
          power: 40,
          pp: 30,
          maxPp: 30,
          description: "Always strikes first.",
        },
      ],
    },
    {
      name: "Blaze (Charizard)",
      species: "Charizard",
      level: 38,
      maxHp: 165,
      currentHp: 165,
      types: ["Fire", "Flying"],
      moves: [
        {
          name: "Flamethrower",
          type: "Fire",
          power: 90,
          pp: 15,
          maxPp: 15,
          description: "Scorching flame blast.",
        },
        {
          name: "Dragon Claw",
          type: "Dragon",
          power: 80,
          pp: 15,
          maxPp: 15,
          description: "Slashes with sharp claws.",
        },
        {
          name: "Fire Blast",
          type: "Fire",
          power: 110,
          pp: 5,
          maxPp: 5,
          description: "Intense five-pronged fireball.",
        },
        {
          name: "Wing Attack",
          type: "Flying",
          power: 60,
          pp: 25,
          maxPp: 25,
          description: "Strikes with wings.",
        },
      ],
    },
  ]);

  // Handle Updates to Adventure Engine State
  const handleStateUpdate = (updated: AdventureState) => {
    setAdventureState(updated);
    saveAdventureState(updated);
  };

  // Update Coordinates from Virtual Joystick, Real GPS, or Map Clicks
  const handleUpdateCoords = (
    newCoords: { xPct: number; yPct: number },
    distMeters: number,
    newGeo?: { lat: number; lng: number; accuracy?: number; heading?: number },
  ) => {
    setAdventureState((prev) => {
      const result = updatePlayerLocation(prev, newCoords, distMeters, newGeo);
      if (result.newlyDiscovered && result.newlyDiscovered.length > 0) {
        const first = result.newlyDiscovered[0];
        toast.success(`✨ Wild ${first.species} nearby! Walk up & catch · CP ${first.cp}`, {
          icon: "⚡",
        });
        if (typeof window !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate([40, 40, 80]);
          } catch {}
        }
        // Auto-open catch sheet when you walk into radar range (GO-style)
        if (!hdBattleOpen) {
          setTimeout(() => {
            // Never replace an encounter that's already open (e.g. mid-throw).
            setActiveCreature((cur) => cur ?? { creature: first, mode: "catch" });
          }, 0);
        }
      }
      return result.state;
    });
  };

  // Launch HD Battle Arena
  const startHdBattle = (
    foeName: string,
    foeSpecies: string,
    level: number,
    types: string[],
    ctx: { kind: "wild" | "gym"; creatureId?: string } = { kind: "wild" },
  ) => {
    setBattleCtx(ctx);
    const foe: BattlePokemon = {
      name: foeName,
      species: foeSpecies,
      level,
      maxHp: Math.round(level * 4.2 + 25),
      currentHp: Math.round(level * 4.2 + 25),
      types,
      moves: [
        {
          name: "Tackle",
          type: "Normal",
          power: 40,
          pp: 35,
          maxPp: 35,
          description: "Full body charge.",
        },
        {
          name: types[0] === "Fire" ? "Ember" : types[0] === "Water" ? "Water Gun" : "Quick Strike",
          type: types[0] || "Normal",
          power: 65,
          pp: 20,
          maxPp: 20,
          description: "Signature elemental strike.",
        },
      ],
    };
    setCurrentBattleFoe(foe);
    setHdBattleOpen(true);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-1 sm:p-4 flex flex-col gap-2 sm:gap-3 font-mono">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* MASTER TOP HEADER: MODE TOGGLE (LIVING WORLD vs RETRO GB) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-3.5 rounded-2xl bg-neutral-950/80 backdrop-blur-md border border-neutral-800 shadow-xl">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-neutral-950 font-bold">
            <Compass className="w-5 h-5 text-neutral-950 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide uppercase">
              POKÉVAULT ADVENTURE
            </h2>
            <p className="hidden sm:block text-xs text-neutral-400">
              Living GPS Overworld · Virtual Joystick · HD Stadium Battles
            </p>
            <p className="sm:hidden text-[10px] text-neutral-400">
              {viewMode === "retro_gb"
                ? "Retro overworld · D-pad / WASD"
                : "GPS overworld · Joystick"}
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
          <button
            type="button"
            aria-label="Living World mode"
            aria-pressed={viewMode === "living_world"}
            onClick={() => setViewMode("living_world")}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              viewMode === "living_world"
                ? "bg-cyan-500 text-neutral-950 shadow-md shadow-cyan-500/25"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">LIVING WORLD</span>
          </button>
          <button
            type="button"
            aria-label="Retro Game Boy mode"
            aria-pressed={viewMode === "retro_gb"}
            onClick={() => setViewMode("retro_gb")}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              viewMode === "retro_gb"
                ? "bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/25"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">RETRO GAME BOY</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODE 1: LIVING WORLD EXPLORATION (POKÉMON GO STYLE + JOYSTICK) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === "living_world" ? (
        <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl">
          {hdBattleOpen && currentBattleFoe ? (
            /* HD STADIUM BATTLE ARENA */
            <HDBattleArena
              key={`${currentBattleFoe.species}-${battleCtx.creatureId ?? battleCtx.kind}`}
              foeMon={currentBattleFoe}
              playerParty={playerParty}
              adventureState={adventureState}
              onStateUpdate={handleStateUpdate}
              catchable={battleCtx.kind === "wild"}
              foeKind={battleCtx.kind}
              creatureId={battleCtx.creatureId}
              onBattleEnd={(res) => {
                if (res === "win" && battleCtx.creatureId) {
                  // The wild Pokémon fainted — it leaves the map.
                  setAdventureState((prev) => {
                    const next = {
                      ...prev,
                      wildCreatures: prev.wildCreatures.filter(
                        (c) => c.id !== battleCtx.creatureId,
                      ),
                    };
                    saveAdventureState(next);
                    return next;
                  });
                }
                if (res === "caught")
                  toast.success(`${currentBattleFoe.species} joined your party!`);
                setHdBattleOpen(false);
                setCurrentBattleFoe(null);
                setActiveCreature(null);
                setActiveBattleArena(null);
              }}
            />
          ) : (
            /* 2.5D INTERACTIVE MAP & OVERLAY HUD */
            <>
              {/* Living World Map Component */}
              <AdventureWorldMap
                adventureState={adventureState}
                onSelectCreature={(creature, mode) => {
                  if (mode === "battle") {
                    startHdBattle(
                      creature.species,
                      creature.species,
                      creature.level,
                      creature.types,
                      { kind: "wild", creatureId: creature.id },
                    );
                  } else {
                    setActiveCreature({ creature, mode });
                  }
                }}
                onSelectDiscoveryPoint={(point) => setActiveDiscoveryPoint(point)}
                onSelectBattleArena={(arena) => {
                  startHdBattle(
                    `Gym Leader (${arena.championSpecies})`,
                    arena.championSpecies,
                    arena.championLevel,
                    ["Fire", "Flying"],
                    { kind: "gym" },
                  );
                }}
                onSelectCardCache={(cache) => setActiveCardCache(cache)}
                onStateUpdate={handleStateUpdate}
                onUpdateCoords={handleUpdateCoords}
              />

              {/* Floating Game HUD */}
              <AdventureHUD
                adventureState={adventureState}
                onForceSwitchEra={(eraId) => {
                  setAdventureState((prev) => forceSwitchEra(prev, eraId).state);
                }}
                onOpenShop={() => setShopOpen(true)}
                onOpenEvolution={() => setEvolutionOpen(true)}
                onOpenInventory={() => setInventoryOpen(true)}
                onOpenQuests={() => setQuestsOpen(true)}
                onOpenBuddy={() => setBuddyOpen(true)}
                onOpenVault={() => {
                  window.dispatchEvent(new CustomEvent("pv-goto", { detail: "vault" }));
                }}
                onToggleNearby={() => setNearbyOpen(!nearbyOpen)}
                onOpenPokedex={() => setPokedexOpen(true)}
              />

              {/* Nearby Proximity Drawer */}
              {nearbyOpen && (
                <AdventureNearbyDrawer
                  adventureState={adventureState}
                  onClose={() => setNearbyOpen(false)}
                  onSelectCreature={(c) => setActiveCreature({ creature: c, mode: "catch" })}
                  onSelectDiscoveryPoint={(p) => setActiveDiscoveryPoint(p)}
                  onSelectBattleArena={(a) => {
                    startHdBattle(
                      `Leader ${a.championSpecies}`,
                      a.championSpecies,
                      a.championLevel,
                      ["Fire"],
                      { kind: "gym" },
                    );
                  }}
                />
              )}
            </>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* INTERACTIVE MODALS */}
          {/* ───────────────────────────────────────────────────────────── */}

          {/* 1. Wild Creature Catch Encounter */}
          {activeCreature && activeCreature.mode === "catch" && (
            <AdventureEncounterModal
              creature={activeCreature.creature}
              adventureState={adventureState}
              onClose={() => setActiveCreature(null)}
              onStateUpdate={handleStateUpdate}
              onSwitchToBattle={() => {
                const c = activeCreature.creature;
                setActiveCreature(null);
                startHdBattle(c.species, c.species, c.level, c.types, {
                  kind: "wild",
                  creatureId: c.id,
                });
              }}
              onOpenVault={() => {
                setActiveCreature(null);
                window.dispatchEvent(new CustomEvent("pv-goto", { detail: "vault" }));
              }}
            />
          )}

          {/* 2. Discovery Point Landmark Spin */}
          {activeDiscoveryPoint && (
            <AdventureDiscoveryModal
              point={activeDiscoveryPoint}
              adventureState={adventureState}
              onClose={() => setActiveDiscoveryPoint(null)}
              onStateUpdate={handleStateUpdate}
            />
          )}

          {/* 3. Card Cache Pack Opening */}
          {activeCardCache && (
            <AdventureCardCacheModal
              cache={activeCardCache}
              adventureState={adventureState}
              onClose={() => setActiveCardCache(null)}
              onStateUpdate={handleStateUpdate}
              onOpenVault={() => {
                setActiveCardCache(null);
                window.dispatchEvent(new CustomEvent("pv-goto", { detail: "vault" }));
              }}
            />
          )}

          {/* 4. Evolution Chamber with 10 Stones & Rare Candy */}
          {evolutionOpen && (
            <AdventureEvolutionModal
              adventureState={adventureState}
              onClose={() => setEvolutionOpen(false)}
              onStateUpdate={handleStateUpdate}
            />
          )}

          {/* 5. Trainer Supply Shop */}
          {shopOpen && (
            <AdventureShopModal
              adventureState={adventureState}
              onClose={() => setShopOpen(false)}
              onStateUpdate={handleStateUpdate}
            />
          )}

          {/* 6. Item Bag */}
          {inventoryOpen && (
            <AdventureInventoryModal
              adventureState={adventureState}
              onClose={() => setInventoryOpen(false)}
              onOpenEvolution={() => {
                setInventoryOpen(false);
                setEvolutionOpen(true);
              }}
            />
          )}

          {/* 7. Research Tasks / Quests */}
          {questsOpen && (
            <AdventureQuestsModal
              adventureState={adventureState}
              onClose={() => setQuestsOpen(false)}
              onStateUpdate={handleStateUpdate}
            />
          )}

          {/* 9. National Pokédex Directory (All 1,025 Pokémon) */}
          {pokedexOpen && (
            <AdventurePokedexModal
              onClose={() => setPokedexOpen(false)}
              onOpenVaultWithQuery={(species) => {
                setPokedexOpen(false);
                window.dispatchEvent(new CustomEvent("pv-goto", { detail: "vault" }));
                window.dispatchEvent(new CustomEvent("pv-search", { detail: species }));
              }}
            />
          )}

          {/* 8. Buddy Interaction */}
          {buddyOpen && (
            <AdventureBuddyModal
              adventureState={adventureState}
              onClose={() => setBuddyOpen(false)}
              onStateUpdate={handleStateUpdate}
            />
          )}
        </div>
      ) : (
        /* ───────────────────────────────────────────────────────────── */
        /* MODE 2: RETRO GAME BOY CANVAS MINI-GAME */
        /* ───────────────────────────────────────────────────────────── */
        <div className="pv-adv-stage relative w-full rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950 flex flex-col items-center justify-center">
          <iframe
            ref={retroIframeRef}
            src="/adventure.html"
            title="Classic Pokémon Adventure"
            className="w-full h-full border-0"
            style={{ pointerEvents: gbBattleFoe ? "none" : "auto" }}
            allow="autoplay"
            onLoad={focusRetro}
          />

          {gbBattleFoe && (
            <div
              className="pv-adv-battle-overlay absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-3"
              role="dialog"
              aria-modal="true"
              aria-label={`Battle ${gbBattleFoe.name}`}
            >
              <div className="w-full max-w-md max-h-[96%] overflow-auto rounded-2xl shadow-2xl">
                <GBBattleSession
                  foe={gbBattleFoe}
                  chrome
                  onDone={(result) => {
                    setGbBattleFoe(null);
                    if (result === "lose") {
                      // White-out: heal everyone and send the player back to
                      // the Poké Center instead of leaving them in the grass.
                      healAllHp();
                      healParty().catch((err) => console.error(err));
                    }
                    setTimeout(() => {
                      try {
                        retroIframeRef.current?.contentWindow?.postMessage(
                          {
                            type:
                              result === "lose" ? "pv-adventure-whiteout" : "pv-adventure-resume",
                          },
                          "*",
                        );
                      } catch {}
                      focusRetro();
                    }, 120);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
