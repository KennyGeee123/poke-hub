import {
  addAdventureXp,
  modifyCoins,
  type AdventureState,
  type PokemonEraId,
  latLngToWorldPixels,
} from "@/lib/adventure-engine";
import { gbaCellKind } from "@/lib/gods-eye-world";

/**
 * Hometown plus the gyms already authored in public/adventure-world.js.
 * Nothing here requires a previous badge. Paldea's eight gyms can be
 * challenged in any order, the same way the route lists them.
 */
export type RouteStop = {
  id: string;
  town: string;
  leader?: string;
  type?: string;
  badge?: string;
  mon?: string;
  level?: number;
};

type Gym = [town: string, leader: string, type: string, badge: string, mon: string, level: number];

function line(era: string, home: string, gyms: Gym[]): RouteStop[] {
  const stops: RouteStop[] = [{ id: `${era}-home`, town: home }];
  for (const [town, leader, type, badge, mon, level] of gyms) {
    const slug = town.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    stops.push({ id: `${era}-${slug}`, town, leader, type, badge, mon, level });
  }
  return stops;
}

const STOPS: Record<PokemonEraId, RouteStop[]> = {
  vintage_kanto: line("kanto", "Pallet", [
    ["Pewter", "Brock", "Rock", "Boulder", "Onix", 14],
    ["Cerulean", "Misty", "Water", "Cascade", "Starmie", 16],
    ["Vermilion", "Lt. Surge", "Electric", "Thunder", "Raichu", 18],
    ["Celadon", "Erika", "Grass", "Rainbow", "Vileplume", 20],
    ["Fuchsia", "Koga", "Poison", "Soul", "Weezing", 22],
    ["Saffron", "Sabrina", "Psychic", "Marsh", "Alakazam", 24],
    ["Cinnabar", "Blaine", "Fire", "Volcano", "Arcanine", 26],
  ]),
  neo_johto: line("johto", "New Bark", [
    ["Violet", "Falkner", "Flying", "Zephyr", "Pidgeotto", 14],
    ["Azalea", "Bugsy", "Bug", "Hive", "Scyther", 16],
    ["Goldenrod", "Whitney", "Normal", "Plain", "Miltank", 18],
    ["Ecruteak", "Morty", "Ghost", "Fog", "Gengar", 20],
    ["Cianwood", "Chuck", "Fighting", "Storm", "Poliwrath", 22],
    ["Olivine", "Jasmine", "Steel", "Mineral", "Steelix", 24],
    ["Mahogany", "Pryce", "Ice", "Glacier", "Piloswine", 26],
    ["Blackthorn", "Clair", "Dragon", "Rising", "Kingdra", 28],
  ]),
  advanced_hoenn: line("hoenn", "Littleroot", [
    ["Rustboro", "Roxanne", "Rock", "Stone", "Nosepass", 16],
    ["Dewford", "Brawly", "Fighting", "Knuckle", "Hariyama", 18],
    ["Mauville", "Wattson", "Electric", "Dynamo", "Manectric", 20],
    ["Lavaridge", "Flannery", "Fire", "Heat", "Torkoal", 22],
    ["Petalburg", "Norman", "Normal", "Balance", "Slaking", 24],
    ["Fortree", "Winona", "Flying", "Feather", "Altaria", 26],
    ["Mossdeep", "Tate & Liza", "Psychic", "Mind", "Solrock", 28],
    ["Sootopolis", "Wallace", "Water", "Rain", "Milotic", 30],
  ]),
  diamond_sinnoh: line("sinnoh", "Twinleaf", [
    ["Oreburgh", "Roark", "Rock", "Coal", "Rampardos", 16],
    ["Eterna", "Gardenia", "Grass", "Forest", "Roserade", 18],
    ["Hearthome", "Fantina", "Ghost", "Relic", "Mismagius", 20],
    ["Veilstone", "Maylene", "Fighting", "Cobble", "Lucario", 22],
    ["Pastoria", "Crasher Wake", "Water", "Fen", "Floatzel", 24],
    ["Canalave", "Byron", "Steel", "Mine", "Bastiodon", 28],
    ["Snowpoint", "Candice", "Ice", "Icicle", "Abomasnow", 30],
    ["Sunyshore", "Volkner", "Electric", "Beacon", "Electivire", 32],
  ]),
  black_unova: line("unova", "Nuvema", [
    ["Striaton", "Cilan", "Grass", "Trio", "Simisage", 16],
    ["Nacrene", "Lenora", "Normal", "Basic", "Watchog", 18],
    ["Castelia", "Burgh", "Bug", "Insect", "Leavanny", 20],
    ["Nimbasa", "Elesa", "Electric", "Bolt", "Zebstrika", 22],
    ["Driftveil", "Clay", "Ground", "Quake", "Excadrill", 24],
    ["Mistralton", "Skyla", "Flying", "Jet", "Swanna", 26],
    ["Icirrus", "Brycen", "Ice", "Freeze", "Beartic", 28],
    ["Opelucid", "Drayden", "Dragon", "Legend", "Haxorus", 30],
  ]),
  mega_kalos: line("kalos", "Vaniville", [
    ["Santalune", "Viola", "Bug", "Bug", "Vivillon", 16],
    ["Cyllage", "Grant", "Rock", "Cliff", "Tyrunt", 18],
    ["Shalour", "Korrina", "Fighting", "Rumble", "Lucario", 22],
    ["Coumarine", "Ramos", "Grass", "Plant", "Gogoat", 24],
    ["Lumiose", "Clemont", "Electric", "Voltage", "Heliolisk", 26],
    ["Laverre", "Valerie", "Fairy", "Fairy", "Sylveon", 28],
    ["Anistar", "Olympia", "Psychic", "Psychic", "Meowstic", 30],
    ["Snowbelle", "Wulfric", "Ice", "Iceberg", "Avalugg", 32],
  ]),
  sun_alola: line("alola", "Iki Town", [
    ["Melemele", "Hala", "Fighting", "Melemele", "Crabominable", 20],
    ["Akala", "Olivia", "Rock", "Akala", "Lycanroc", 24],
    ["Ulaula", "Nanu", "Dark", "Ulaula", "Persian", 28],
    ["Poni", "Hapu", "Ground", "Poni", "Mudsdale", 32],
  ]),
  sword_galar: line("galar", "Postwick", [
    ["Turffield", "Milo", "Grass", "Grass", "Eldegoss", 18],
    ["Hulbury", "Nessa", "Water", "Water", "Drednaw", 20],
    ["Motostoke", "Kabu", "Fire", "Fire", "Centiskorch", 22],
    ["Stow-on-Side", "Bea", "Fighting", "Fighting", "Machamp", 24],
    ["Ballonlea", "Opal", "Fairy", "Fairy", "Alcremie", 26],
    ["Circhester", "Melony", "Ice", "Ice", "Lapras", 28],
    ["Hammerlocke", "Raihan", "Dragon", "Dragon", "Duraludon", 32],
  ]),
  modern_paldea: line("paldea", "Cabo Poco", [
    ["Cortondo", "Katy", "Bug", "Bug", "Teddiursa", 16],
    ["Artazon", "Brassius", "Grass", "Grass", "Sudowoodo", 18],
    ["Levincia", "Iono", "Electric", "Electric", "Bellibolt", 22],
    ["Cascarrafa", "Kofu", "Water", "Water", "Wugtrio", 24],
    ["Medali", "Larry", "Normal", "Normal", "Staraptor", 26],
    ["Montenevera", "Ryme", "Ghost", "Ghost", "Toxtricity", 28],
    ["Alfornada", "Tulip", "Psychic", "Psychic", "Espathra", 30],
    ["Glaseado", "Grusha", "Ice", "Ice", "Beartic", 32],
  ]),
};

export function routeStopsForEra(eraId: PokemonEraId): RouteStop[] {
  return STOPS[eraId];
}

export function routeGyms(stops: RouteStop[]): RouteStop[] {
  return stops.filter((s) => !!s.leader && !!s.mon);
}

export type RouteBadgeBook = Partial<Record<PokemonEraId, string[]>>;

export function earnedStopIds(book: RouteBadgeBook | undefined, eraId: PokemonEraId): string[] {
  const ids = book?.[eraId];
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => typeof id === "string" && id.length > 0);
}

const ERA_IDS = Object.keys(STOPS) as PokemonEraId[];

/** Drop unknown eras and ids that are not gyms. Hometown visits never enter the book. */
export function sanitizeRouteBook(book: unknown): RouteBadgeBook {
  if (!book || typeof book !== "object") return {};
  const out: RouteBadgeBook = {};
  for (const era of ERA_IDS) {
    const ids = (book as Record<string, unknown>)[era];
    if (!Array.isArray(ids)) continue;
    const gymIds = new Set(routeGyms(STOPS[era]).map((stop) => stop.id));
    const clean = ids.filter((id): id is string => typeof id === "string" && gymIds.has(id));
    if (clean.length) out[era] = [...new Set(clean)];
  }
  return out;
}

export function routeBadgeCase(eraId: PokemonEraId, book?: RouteBadgeBook) {
  const earned = new Set(earnedStopIds(book, eraId));
  return routeGyms(routeStopsForEra(eraId)).map((stop) => ({
    id: stop.id,
    town: stop.town,
    leader: stop.leader || "",
    badge: stop.badge || "",
    earned: earned.has(stop.id),
  }));
}

/** First unearned gym in route order. The rest stay open. */
export function nextOpenGym(eraId: PokemonEraId, book?: RouteBadgeBook): RouteStop | null {
  const earned = new Set(earnedStopIds(book, eraId));
  return routeGyms(routeStopsForEra(eraId)).find((stop) => !earned.has(stop.id)) || null;
}

/** First win stores the stop id and pays once. A rematch leaves the case as it is. */
export function awardRouteBadge(state: AdventureState, eraId: PokemonEraId, stopId: string) {
  const stop = routeStopsForEra(eraId).find((row) => row.id === stopId) || null;
  if (!stop?.leader || !stop.badge) {
    return { state, awarded: false as const, reason: "not-a-gym" as const, stop };
  }
  const have = earnedStopIds(state.world.routeBadges, eraId);
  if (have.includes(stop.id)) {
    return { state, awarded: false as const, reason: "rematch" as const, stop };
  }
  const stamped: AdventureState = {
    ...state,
    world: {
      ...state.world,
      routeBadges: {
        ...(state.world.routeBadges || {}),
        [eraId]: [...have, stop.id],
      },
    },
  };
  const xp = addAdventureXp(stamped, 80);
  const paid = modifyCoins(xp.state, 40);
  return { state: paid, awarded: true as const, reason: "earned" as const, stop, leveledUp: xp.leveledUp };
}

/**
 * Champion of each era, from the league tables in public/adventure-world.js.
 * Four badges of that era open the gate. Other gyms stay open.
 */
const LEAGUES: Record<
  PokemonEraId,
  { name: string; foe: string; species: string; type: string; level: number }
> = {
  vintage_kanto: { name: "Indigo League", foe: "Champion", species: "Mewtwo", type: "Psychic", level: 36 },
  neo_johto: { name: "Indigo Plateau", foe: "Lance", species: "Dragonite", type: "Dragon", level: 40 },
  advanced_hoenn: { name: "Ever Grande", foe: "Steven", species: "Metagross", type: "Steel", level: 40 },
  diamond_sinnoh: { name: "Sinnoh League", foe: "Cynthia", species: "Garchomp", type: "Dragon", level: 42 },
  black_unova: { name: "Unova League", foe: "Alder", species: "Volcarona", type: "Bug", level: 42 },
  mega_kalos: { name: "Kalos League", foe: "Diantha", species: "Gardevoir", type: "Fairy", level: 42 },
  sun_alola: { name: "Alola League", foe: "Kukui", species: "Incineroar", type: "Fire", level: 42 },
  sword_galar: { name: "Champion Cup", foe: "Leon", species: "Charizard", type: "Fire", level: 42 },
  modern_paldea: { name: "Paldea League", foe: "Geeta", species: "Glimmora", type: "Rock", level: 42 },
};

export function leagueStanding(eraId: PokemonEraId, book?: RouteBadgeBook) {
  const gyms = routeGyms(routeStopsForEra(eraId));
  const earnedIds = new Set(earnedStopIds(book, eraId));
  const earned = gyms.filter((stop) => earnedIds.has(stop.id)).length;
  const need = Math.min(4, gyms.length);
  const gate = LEAGUES[eraId];
  return { earned, need, open: earned >= need, ...gate };
}

/** The three first partners for an era. The hometown offers these and no others. */
export type RouteStarter = { species: string; type: string; move: string };

const STARTERS: Record<PokemonEraId, [RouteStarter, RouteStarter, RouteStarter]> = {
  vintage_kanto: [
    { species: "Bulbasaur", type: "Grass", move: "Vine Whip" },
    { species: "Charmander", type: "Fire", move: "Ember" },
    { species: "Squirtle", type: "Water", move: "Water Gun" },
  ],
  neo_johto: [
    { species: "Chikorita", type: "Grass", move: "Razor Leaf" },
    { species: "Cyndaquil", type: "Fire", move: "Ember" },
    { species: "Totodile", type: "Water", move: "Water Gun" },
  ],
  advanced_hoenn: [
    { species: "Treecko", type: "Grass", move: "Absorb" },
    { species: "Torchic", type: "Fire", move: "Ember" },
    { species: "Mudkip", type: "Water", move: "Water Gun" },
  ],
  diamond_sinnoh: [
    { species: "Turtwig", type: "Grass", move: "Absorb" },
    { species: "Chimchar", type: "Fire", move: "Ember" },
    { species: "Piplup", type: "Water", move: "Water Gun" },
  ],
  black_unova: [
    { species: "Snivy", type: "Grass", move: "Vine Whip" },
    { species: "Tepig", type: "Fire", move: "Ember" },
    { species: "Oshawott", type: "Water", move: "Water Gun" },
  ],
  mega_kalos: [
    { species: "Chespin", type: "Grass", move: "Vine Whip" },
    { species: "Fennekin", type: "Fire", move: "Ember" },
    { species: "Froakie", type: "Water", move: "Water Gun" },
  ],
  sun_alola: [
    { species: "Rowlet", type: "Grass", move: "Leafage" },
    { species: "Litten", type: "Fire", move: "Ember" },
    { species: "Popplio", type: "Water", move: "Water Gun" },
  ],
  sword_galar: [
    { species: "Grookey", type: "Grass", move: "Branch Poke" },
    { species: "Scorbunny", type: "Fire", move: "Ember" },
    { species: "Sobble", type: "Water", move: "Water Gun" },
  ],
  modern_paldea: [
    { species: "Sprigatito", type: "Grass", move: "Leafage" },
    { species: "Fuecoco", type: "Fire", move: "Ember" },
    { species: "Quaxly", type: "Water", move: "Water Gun" },
  ],
};

export function startersForEra(eraId: PokemonEraId): RouteStarter[] {
  return STARTERS[eraId];
}

/** A partner only exists when the species is one of that era's three starters. */
export function routePartner(eraId: PokemonEraId, species: string) {
  const hit = startersForEra(eraId).find((s) => s.species === species);
  return hit ? { ...hit, eraId } : null;
}

/** One route block between towns. The camera shows 22×16 cells, so the first town stays inside it. */
export const ROUTE_BLOCK_CELLS = 20;

function nearestPathCell(col: number, row: number): { tx: number; ty: number } {
  let best = { tx: col, ty: row, d: Infinity };
  for (let dy = -8; dy <= 7; dy++) {
    for (let dx = -11; dx <= 10; dx++) {
      const tx = col + dx;
      const ty = row + dy;
      if (gbaCellKind(tx, ty) !== "path") continue;
      const d = dx * dx + dy * dy;
      if (d < best.d) best = { tx, ty, d };
    }
  }
  return { tx: best.tx, ty: best.ty };
}

export function routeStopLayout(
  anchor: { lat: number; lng: number },
  zoom: number,
  eraId: PokemonEraId,
  cellPx = 64,
): Array<RouteStop & { tx: number; ty: number }> {
  const world = latLngToWorldPixels(anchor.lat, anchor.lng, zoom);
  const col = Math.floor(world.x / cellPx);
  const row = Math.floor(world.y / cellPx);
  const first = nearestPathCell(col, row);
  return routeStopsForEra(eraId).map((stop, i) => ({
    ...stop,
    tx: first.tx + i * ROUTE_BLOCK_CELLS,
    ty: first.ty,
  }));
}
