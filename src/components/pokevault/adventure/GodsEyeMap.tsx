import React, { useMemo, useState } from "react";
import { Eye, MapPin, Navigation, X, Crosshair, Sparkles, Swords } from "lucide-react";
import { GODS_EYE_NODES, type GodsEyeNode, nearestGodsEyeNode } from "@/lib/gods-eye-world";
import type { WildCreature } from "@/lib/adventure-engine";

export function GodsEyeMap({
  open,
  onClose,
  playerCoords,
  wildCreatures,
  onTeleport,
}: {
  open: boolean;
  onClose: () => void;
  playerCoords: { xPct: number; yPct: number };
  wildCreatures: WildCreature[];
  onTeleport: (node: GodsEyeNode) => void;
}) {
  const [selected, setSelected] = useState<GodsEyeNode | null>(null);
  const [filter, setFilter] = useState<"all" | "region" | "nest" | "city" | "landmark">("all");

  const here = useMemo(
    () => nearestGodsEyeNode(playerCoords.xPct, playerCoords.yPct),
    [playerCoords.xPct, playerCoords.yPct],
  );

  const nodes = useMemo(
    () => (filter === "all" ? GODS_EYE_NODES : GODS_EYE_NODES.filter((n) => n.kind === filter)),
    [filter],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-neutral-950/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="God's Eye world atlas"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400 to-red-500 text-neutral-950">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold tracking-wide text-white uppercase">God&apos;s Eye</h2>
            <p className="text-[10px] text-neutral-400">
              Huge world atlas · teleport · then walk &amp; catch (GO + GBA)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl border border-neutral-700 text-neutral-300 hover:text-white"
          aria-label="Close God&apos;s Eye"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-neutral-900">
        {(["all", "region", "nest", "city", "landmark"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
              filter === f ? "bg-amber-400 text-neutral-950" : "bg-neutral-900 text-neutral-400"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-neutral-500 self-center">
          Near: <b className="text-amber-300">{here.name}</b> · {wildCreatures.length} wilds on plane
        </span>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_280px]">
        <div className="relative m-3 rounded-2xl border border-neutral-800 bg-[radial-gradient(ellipse_at_center,#0f172a_0%,#020617_70%)] overflow-hidden">
          {/* Starfield / grid */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {nodes.map((n) => (
              <g key={n.id}>
                <circle
                  cx={n.atlasX}
                  cy={n.atlasY}
                  r={n.kind === "region" ? 3.2 : 2.2}
                  fill={n.accent}
                  opacity={0.85}
                  className="cursor-pointer"
                  onClick={() => setSelected(n)}
                />
                <text
                  x={n.atlasX}
                  y={n.atlasY - 3.5}
                  textAnchor="middle"
                  fill="#e5e7eb"
                  fontSize="2.4"
                  fontWeight="700"
                  className="pointer-events-none"
                >
                  {n.name}
                </text>
              </g>
            ))}
            {/* Player */}
            <circle
              cx={Math.min(95, Math.max(5, playerCoords.xPct * 0.9 + 5))}
              cy={Math.min(95, Math.max(5, playerCoords.yPct * 0.9 + 5))}
              r={1.6}
              fill="#22d3ee"
              stroke="#fff"
              strokeWidth={0.4}
            />
          </svg>
          <div className="absolute bottom-3 left-3 text-[10px] text-neutral-400 bg-black/50 px-2 py-1 rounded-lg">
            Tap a region · cyan = you · then Teleport &amp; Walk
          </div>
        </div>

        <div className="border-t lg:border-t-0 lg:border-l border-neutral-800 p-3 overflow-y-auto space-y-2">
          {(selected ? [selected] : nodes).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelected(n)}
              className={`w-full text-left p-3 rounded-xl border transition ${
                selected?.id === n.id
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" style={{ color: n.accent }} />
                <span className="text-xs font-extrabold text-white">{n.name}</span>
                <span className="text-[9px] uppercase text-neutral-500 ml-auto">{n.kind}</span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-0.5">{n.subtitle}</p>
              <p className="text-[10px] text-amber-200/80 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> {n.spawnHint}
              </p>
            </button>
          ))}

          {selected && (
            <div className="sticky bottom-0 pt-2 space-y-2 bg-neutral-950">
              <button
                type="button"
                onClick={() => {
                  onTeleport(selected);
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-extrabold text-sm bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 shadow-lg"
              >
                <Navigation className="w-4 h-4" />
                Teleport to {selected.name}
              </button>
              <p className="text-[10px] text-neutral-500 text-center flex items-center justify-center gap-1">
                <Crosshair className="w-3 h-3" /> Then joystick-walk · tap wilds to catch ·
                <Swords className="w-3 h-3" /> battle like GBA
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
