import { knownCardMoves, scannedSpecies, scheduledLevelUps, speciesFromCardName } from "./card-moves";
import {
  addSpeciesToParty,
  fetchParty,
  replaceSpeciesMovesOnParty,
  type GBMove,
  type GBMon,
} from "./gbgame";

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
function toPartyMoves(moves: { name: string; type: string; power: number; description: string }[]): GBMove[] {
  return moves.map((move) => ({
    name: move.name,
    damage: move.power,
    type: move.type,
    text: move.description,
  }));
}

/**
 * Level-up moves a scanned card learns between two levels.
 * Null means this Pokémon was not scanned, so the caller uses the wild learnset.
 */
export async function movesLearnedOnLevel(
  name: string,
  oldLevel: number,
  newLevel: number,
): Promise<GBMove[] | null> {
  const { loadAdventureState } = await import("./adventure-engine");
  const fighter = scannedSpecies(loadAdventureState().world.scannedFighters, name);
  if (!fighter?.levelUps) return null;
  return toPartyMoves(scheduledLevelUps(fighter, oldLevel, newLevel));
}

/** Point one scanned species' party attacks at the moves it knows right now. */
export async function syncPartyToScannedCards(species?: string): Promise<void> {
  const { loadAdventureState } = await import("./adventure-engine");
  const book = loadAdventureState().world.scannedFighters;
  const party = await fetchParty();
  const want = species?.trim().toLowerCase();
  for (const mon of party) {
    const fighter = scannedSpecies(book, mon.name);
    if (!fighter?.levelUps) continue;
    if (want && fighter.species.toLowerCase() !== want && speciesFromCardName(mon.name).toLowerCase() !== want) {
      continue;
    }
    await replaceSpeciesMovesOnParty(fighter.species, toPartyMoves(knownCardMoves(fighter, mon.level)));
  }
}

let settling: Promise<void> | null = null;

/**
 * Scanned cards keep printed attacks plus the level-up moves for their level.
 * Species that were never scanned drop the dumped learnset. TMs stay in the bag.
 */
export function settleScannedCardMoves(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!settling) {
    settling = (async () => {
      const { loadAdventureState, saveAdventureState, saveCardLearnset } = await import("./adventure-engine");
      const { fetchSpeciesMoves } = await import("./pokeapi-moves");
      const state = loadAdventureState();
      const book = { ...(state.world.scannedFighters || {}) };
      for (const key of Object.keys(book)) {
        const fighter = book[key];
        if (!fighter?.cardIds?.length) {
          delete book[key];
          continue;
        }
        const learn = await fetchSpeciesMoves(fighter.species);
        saveCardLearnset(
          fighter.species,
          learn.map((move) => ({
            name: move.name,
            type: move.type,
            power: move.damage,
            text: move.text,
            source: move.source,
            level: move.level,
          })),
        );
      }
      if (Object.keys(book).length !== Object.keys(state.world.scannedFighters || {}).length) {
        const latest = loadAdventureState();
        const kept = { ...(latest.world.scannedFighters || {}) };
        for (const key of Object.keys(kept)) {
          if (!kept[key]?.cardIds?.length) delete kept[key];
        }
        saveAdventureState({ ...latest, world: { ...latest.world, scannedFighters: kept } });
      }
      await syncPartyToScannedCards();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pv-card-moves", { detail: { species: null } }));
      }
    })().catch((err) => {
      settling = null;
      console.warn("scanned move sets failed", err);
    });
  }
  return settling;
}

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
