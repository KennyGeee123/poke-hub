// PokeAPI v2 — free, no key, CORS-enabled
const BASE = "https://pokeapi.co/api/v2";

export type Pokedex = {
  id: number;
  name: string;
  types: string[];
  height: number; // decimetres
  weight: number; // hectograms
  stats: { name: string; base: number }[];
  abilities: string[];
  sprite: string | null;
  artwork: string | null;
  shinyArtwork: string | null;
  flavorText: string | null;
  genus: string | null;
  evolutionChain: string[];
};

function slug(name: string): string {
  // PokeAPI uses lowercased base species names. Strip suffixes like " V", " VMAX", " ex", "δ", "(...)".
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[♀♂δ★]/g, "")
    .replace(/'/g, "")
    .replace(/\b(v|vmax|vstar|gx|ex|tag team|prime|break|lv\.?x|legend)\b/gi, "")
    .replace(/\s+&\s+\w+/g, "") // "Pikachu & Zekrom" -> "Pikachu"
    .trim()
    .split(/\s+/)[0]
    .replace(/[^a-z0-9-]/g, "");
}

async function j<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`PokeAPI ${r.status}`);
  return r.json();
}

export async function getPokedex(cardName: string): Promise<Pokedex | null> {
  const id = slug(cardName);
  if (!id) return null;
  try {
    const p: any = await j(`${BASE}/pokemon/${id}`);
    let species: any = null;
    let evoNames: string[] = [];
    try {
      species = await j(p.species.url);
      if (species?.evolution_chain?.url) {
        const evo: any = await j(species.evolution_chain.url);
        const walk = (n: any) => {
          if (!n) return;
          evoNames.push(n.species?.name);
          n.evolves_to?.forEach(walk);
        };
        walk(evo.chain);
      }
    } catch { /* ignore */ }

    const flavor = species?.flavor_text_entries?.find((e: any) => e.language?.name === "en")?.flavor_text?.replace(/\s+/g, " ") ?? null;
    const genus = species?.genera?.find((g: any) => g.language?.name === "en")?.genus ?? null;

    return {
      id: p.id,
      name: p.name,
      types: (p.types ?? []).map((t: any) => t.type.name),
      height: p.height,
      weight: p.weight,
      stats: (p.stats ?? []).map((s: any) => ({ name: s.stat.name, base: s.base_stat })),
      abilities: (p.abilities ?? []).map((a: any) => a.ability.name),
      sprite: p.sprites?.front_default ?? null,
      artwork: p.sprites?.other?.["official-artwork"]?.front_default ?? null,
      shinyArtwork: p.sprites?.other?.["official-artwork"]?.front_shiny ?? null,
      flavorText: flavor,
      genus,
      evolutionChain: evoNames.filter(Boolean),
    };
  } catch {
    return null;
  }
}
