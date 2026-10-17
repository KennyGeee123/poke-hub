import { X } from "lucide-react";
import { animatedSpriteUrl } from "@/lib/sprites";
import type { RosterMon } from "@/lib/roster-lead";

export function AdventureRosterModal({
  roster,
  leadSpecies,
  onMakeLead,
  onClose,
}: {
  roster: RosterMon[];
  leadSpecies: string | null;
  onMakeLead: (species: string) => void;
  onClose: () => void;
}) {
  const lead = (leadSpecies || roster[0]?.species || "").toLowerCase();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
      <div
        className="relative flex max-h-[80vh] w-full max-w-md flex-col gap-3 overflow-hidden rounded-3xl border border-emerald-500/40 bg-neutral-950 p-5 font-mono shadow-2xl"
        data-roster-open="1"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:text-white"
          aria-label="Close roster"
        >
          <X className="h-5 w-5" />
        </button>
        <div>
          <h3 className="text-lg font-extrabold text-white">Roster</h3>
          <p className="text-xs text-neutral-400">
            Pick who walks with you and starts the next fight.
          </p>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto pr-1">
          {roster.map((mon) => {
            const main = mon.species.toLowerCase() === lead;
            return (
              <div
                key={`${mon.source}-${mon.id}`}
                data-roster-row={mon.species}
                data-main={main ? "1" : "0"}
                className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 ${
                  main ? "border-emerald-400/60 bg-emerald-500/10" : "border-neutral-800 bg-neutral-900"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <img
                    src={animatedSpriteUrl(mon.species)}
                    alt={mon.species}
                    className="h-10 w-10 object-contain"
                  />
                  <div className="min-w-0 text-left">
                    <div className="truncate text-sm font-bold text-white">{mon.name}</div>
                    <div className="text-[10px] text-neutral-400">
                      {mon.species} · Lv {mon.level}
                      {main ? " · Main" : ""}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={main}
                  onClick={() => onMakeLead(mon.species)}
                  className="shrink-0 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-bold text-neutral-950 disabled:bg-neutral-800 disabled:text-emerald-300"
                >
                  {main ? "MAIN" : "LEAD"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
