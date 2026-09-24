import { addSpeciesToParty, type GBMon } from "./gbgame";

/** Living-World types use game names; the Adventure/GB party uses TCG energy types. */
const GAME_TO_TCG: Record<string, string> = {
  Normal: "Colorless",
  Fire: "Fire",
  Water: "Water",
  Grass: "Grass",
  Electric: "Lightning",
  Ice: "Water",
  Fighting: "Fighting",
  Poison: "Darkness",
  Ground: "Fighting",
  Flying: "Colorless",
  Psychic: "Psychic",
  Bug: "Grass",
  Rock: "Fighting",
  Ghost: "Psychic",
  Dragon: "Dragon",
  Dark: "Darkness",
  Steel: "Metal",
  Fairy: "Fairy",
};

export function toTcgTypes(types: string[] | undefined): string[] {
  const out = (types ?? []).map((t) => GAME_TO_TCG[t] || t).filter(Boolean);
  return out.length ? [...new Set(out)] : ["Colorless"];
}

/**
 * A wild Pokémon caught in the Living World joins the same Adventure party the
 * Retro overworld battles use (guest: this device · signed in: your account).
 */
export async function addWildCatchToParty(
  species: string,
  level: number,
  types: string[] | undefined,
): Promise<GBMon> {
  const lvl = Math.max(2, Math.min(60, Math.round(level || 5)));
  const mon = await addSpeciesToParty(species, lvl, toTcgTypes(types));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pv-adventure-caught", { detail: { name: species } }));
  }
  return mon;
}
