import type { PokemonEraId } from "@/lib/adventure-engine";
import {
  earnedStopIds,
  routeStopsForEra,
  sanitizeRouteBook,
  type RouteBadgeBook,
} from "@/lib/route-towns";

/** The retro iframe save. The living world writes the same badge book into it. */
export const RETRO_SAVE_KEY = "pokeregions-save";

const BADGE_NAME = /^[A-Za-z0-9 .'-]{1,32}$/;

export function badgeNamesForBook(book: RouteBadgeBook | undefined): string[] {
  const names: string[] = [];
  if (!book) return names;
  for (const era of Object.keys(book) as PokemonEraId[]) {
    for (const id of earnedStopIds(book, era)) {
      const stop = routeStopsForEra(era).find((row) => row.id === id);
      if (!stop?.badge || !BADGE_NAME.test(stop.badge) || names.includes(stop.badge)) continue;
      names.push(stop.badge);
    }
  }
  return names;
}

export function mergeRouteBooks(
  local: RouteBadgeBook | undefined,
  retro: RouteBadgeBook | undefined,
): RouteBadgeBook {
  const base = sanitizeRouteBook(retro);
  const extra = sanitizeRouteBook(local);
  const out: RouteBadgeBook = { ...base };
  for (const era of Object.keys(extra) as PokemonEraId[]) {
    const ids = new Set([...(out[era] || []), ...(extra[era] || [])]);
    out[era] = [...ids];
  }
  return out;
}

/** Keep the retro save's position and party, and stamp the shared badge book. */
export function mergeRetroSave(raw: string | null, book: RouteBadgeBook | undefined): string {
  let state: Record<string, unknown> = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        state = parsed as Record<string, unknown>;
      }
    } catch {
      state = {};
    }
  }
  const clean = sanitizeRouteBook(book);
  const names = badgeNamesForBook(clean);
  const prev = Array.isArray(state.badges)
    ? state.badges.filter((name): name is string => typeof name === "string" && BADGE_NAME.test(name))
    : [];
  for (const name of names) {
    if (!prev.includes(name)) prev.push(name);
  }
  state.badges = prev;
  state.routeBadges = clean;
  if (!state.worldVersion) state.worldVersion = 2;
  return JSON.stringify(state);
}

export function bookFromRetroRaw(raw: string | null): RouteBadgeBook {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return sanitizeRouteBook((parsed as { routeBadges?: unknown }).routeBadges);
  } catch {
    return {};
  }
}

export function syncRouteBookToRetro(book: RouteBadgeBook | undefined): void {
  if (typeof localStorage === "undefined") return;
  try {
    const next = mergeRetroSave(localStorage.getItem(RETRO_SAVE_KEY), book);
    localStorage.setItem(RETRO_SAVE_KEY, next);
  } catch {
    /* private mode */
  }
}

export function routeBookFromRetro(): RouteBadgeBook {
  if (typeof localStorage === "undefined") return {};
  try {
    return bookFromRetroRaw(localStorage.getItem(RETRO_SAVE_KEY));
  } catch {
    return {};
  }
}
