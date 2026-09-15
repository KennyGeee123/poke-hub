import React, { useState } from "react";
import {
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
import { type AdventureState } from "@/lib/adventure-engine";

export function AdventureHUD({
  adventureState,
  onOpenShop,
  onOpenEvolution,
  onOpenInventory,
  onOpenQuests,
  onOpenBuddy,
  onOpenVault,
  onToggleNearby,
}: {
  adventureState: AdventureState;
  onOpenShop: () => void;
  onOpenEvolution: () => void;
  onOpenInventory: () => void;
  onOpenQuests: () => void;
  onOpenBuddy: () => void;
  onOpenVault: () => void;
  onToggleNearby: () => void;
}) {
  const [radialOpen, setRadialOpen] = useState(false);

  const p = adventureState.player;
  const inv = adventureState.inventory;
  const w = adventureState.world;

  const xpPct = Math.min(100, Math.round((p.xp / p.xpToNextLevel) * 100));
  const energyPct = Math.min(100, Math.round((inv.energy / inv.maxEnergy) * 100));

  return (
    <>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* TOP FLOATING HUD BAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-3 inset-x-3 sm:inset-x-6 z-40 flex items-center justify-between gap-2 pointer-events-none select-none font-mono">
        {/* Left: Player Profile & Level */}
        <div className="pointer-events-auto flex items-center gap-2.5 p-1.5 sm:p-2 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800 shadow-xl">
          {/* Avatar Icon */}
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 flex items-center justify-center shadow">
            <div className="w-full h-full rounded-[10px] bg-neutral-950 flex items-center justify-center overflow-hidden">
              <img
                src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/1.png"
                alt="Trainer"
                className="w-8 h-8 object-contain"
              />
            </div>
            {/* Level Tag */}
            <span className="absolute -bottom-1.5 -right-1 px-1.5 py-0.2 rounded bg-amber-500 text-neutral-950 font-extrabold text-[9px] shadow">
              Lv.{p.level}
            </span>
          </div>

          {/* XP Progression */}
          <div className="hidden sm:flex flex-col gap-0.5 w-28">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white font-bold truncate">{p.displayName}</span>
              <span className="text-cyan-400 font-bold">{xpPct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-neutral-900 border border-neutral-800 overflow-hidden">
              <div className="h-full bg-cyan-400 transition-all" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        {/* Center: Biome & Event Banner */}
        <div className="pointer-events-auto hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800 shadow-xl text-xs">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold text-neutral-200">{w.biome}</span>
          <span className="text-neutral-600">|</span>
          <span className="text-[11px] text-amber-300 font-semibold">{w.eventName}</span>
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
            <span>{inv.energy}/{inv.maxEnergy}</span>
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BOTTOM CENTER: RADIAL ADVENTURE ACTION WHEEL */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-6 inset-x-0 z-40 flex items-center justify-center pointer-events-none select-none">
        <div className="pointer-events-auto relative flex items-center justify-center">
          {/* Expanding Radial Menu Options */}
          {radialOpen && (
            <div className="absolute bottom-16 flex items-center justify-center w-72 h-44 pointer-events-auto animate-fade-in">
              {/* Radial Backdrop */}
              <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-lg rounded-3xl border border-neutral-800 shadow-2xl" />

              {/* Menu Grid */}
              <div className="relative z-10 grid grid-cols-3 gap-3 p-4 text-center font-mono">
                {/* 1. Quests */}
                <button
                  type="button"
                  onClick={() => {
                    setRadialOpen(false);
                    onOpenQuests();
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-neutral-800 transition"
                >
                  <Trophy className="w-6 h-6 text-amber-400" />
                  <span className="text-[10px] font-bold text-neutral-200">QUESTS</span>
                </button>

                {/* 2. Evolution */}
                <button
                  type="button"
                  onClick={() => {
                    setRadialOpen(false);
                    onOpenEvolution();
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-neutral-800 transition"
                >
                  <Sparkles className="w-6 h-6 text-cyan-400" />
                  <span className="text-[10px] font-bold text-neutral-200">EVOLVE</span>
                </button>

                {/* 3. Shop */}
                <button
                  type="button"
                  onClick={() => {
                    setRadialOpen(false);
                    onOpenShop();
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-neutral-800 transition"
                >
                  <ShoppingBag className="w-6 h-6 text-emerald-400" />
                  <span className="text-[10px] font-bold text-neutral-200">SHOP</span>
                </button>

                {/* 4. Buddy */}
                <button
                  type="button"
                  onClick={() => {
                    setRadialOpen(false);
                    onOpenBuddy();
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-neutral-800 transition"
                >
                  <Users className="w-6 h-6 text-fuchsia-400" />
                  <span className="text-[10px] font-bold text-neutral-200">BUDDY</span>
                </button>

                {/* 5. Bag */}
                <button
                  type="button"
                  onClick={() => {
                    setRadialOpen(false);
                    onOpenInventory();
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-neutral-800 transition"
                >
                  <Package className="w-6 h-6 text-blue-400" />
                  <span className="text-[10px] font-bold text-neutral-200">ITEMS</span>
                </button>

                {/* 6. Vault */}
                <button
                  type="button"
                  onClick={() => {
                    setRadialOpen(false);
                    onOpenVault();
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-neutral-800 transition"
                >
                  <Layers className="w-6 h-6 text-orange-400" />
                  <span className="text-[10px] font-bold text-neutral-200">VAULT</span>
                </button>
              </div>
            </div>
          )}

          {/* Central Main PokéBall Trigger Button */}
          <button
            type="button"
            onClick={() => setRadialOpen(!radialOpen)}
            className={`w-14 h-14 rounded-full border-4 shadow-2xl flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95 ${
              radialOpen
                ? "bg-rose-600 border-white text-white rotate-45 shadow-[0_0_25px_rgba(244,63,94,0.6)]"
                : "bg-gradient-to-b from-rose-500 via-rose-600 to-neutral-900 border-white/90 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]"
            }`}
            title="Open Adventure Menu"
          >
            {radialOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-white border-2 border-neutral-900 shadow-inner" />
            )}
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BOTTOM RIGHT: NEARBY INTELLIGENCE DRAWER TRIGGER */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-6 right-3 sm:right-6 z-40 pointer-events-auto select-none font-mono">
        <button
          type="button"
          onClick={onToggleNearby}
          className="p-2.5 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800 hover:border-cyan-500/50 text-neutral-300 hover:text-white shadow-xl flex items-center gap-2 text-xs transition"
          title="Open Nearby Creatures & Stops"
        >
          <div className="flex items-center -space-x-2">
            {adventureState.wildCreatures.slice(0, 3).map((c) => (
              <div
                key={c.id}
                className="w-7 h-7 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden"
              >
                <img
                  src={`https://img.pokemondb.net/sprites/home/normal/${c.species.toLowerCase()}.png`}
                  alt={c.species}
                  className="w-6 h-6 object-contain"
                />
              </div>
            ))}
          </div>
          <span className="hidden sm:inline font-bold">NEARBY ({adventureState.wildCreatures.length})</span>
        </button>
      </div>
    </>
  );
}
