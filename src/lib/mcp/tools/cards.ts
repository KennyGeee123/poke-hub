// MCP tools exposing Pokémon TCG card data + HD image resolution.
import { defineTool } from "mcp-tanstack-start";
import { z } from "zod";

const TCG_BASE = "https://api.pokemontcg.io/v2";

// pokemontcg.io intermittently answers 500/502/429 — retry with backoff (same policy as
// /api/public/tcg) and send the server key when configured, so MCP tools don't fail at random.
async function tcg<T>(path: string): Promise<T> {
  const key = process.env.POKEMONTCG_API_KEY || process.env.VITE_POKEMONTCG_API_KEY || "";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["X-Api-Key"] = key;
  let last = "network error";
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${TCG_BASE}${path}`, {
        headers,
        signal: AbortSignal.timeout(9000),
      });
      if (r.ok) return (await r.json()) as T;
      last = String(r.status);
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await new Promise((res) => setTimeout(res, 350 * (i + 1)));
  }
  throw new Error(`pokemontcg.io ${last}`);
}

/** Minimal pokemontcg-shaped card from TCGdex, used when pokemontcg.io is down. */
async function tcgdexCard(id: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const raw = (await r.json()) as {
      id?: string;
      name?: string;
      hp?: number;
      types?: string[];
      rarity?: string;
      localId?: string;
      illustrator?: string;
      image?: string;
      set?: { id?: string; name?: string };
    };
    const img = raw.image ?? "";
    return {
      id: raw.id ?? id,
      name: raw.name ?? id,
      hp: raw.hp != null ? String(raw.hp) : undefined,
      types: raw.types,
      rarity: raw.rarity,
      number: raw.localId,
      artist: raw.illustrator,
      set: { id: raw.set?.id, name: raw.set?.name },
      images: img ? { small: `${img}/low.webp`, large: `${img}/high.webp` } : undefined,
      source: "tcgdex",
    };
  } catch {
    return null;
  }
}

async function tcgdexHD(id: string, number?: string): Promise<string | null> {
  try {
    const setId = id.split("-")[0];
    const num = number ?? id.split("-")[1];
    if (!setId || !num) return null;
    const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${setId}-${num}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { image?: string };
    return j.image ? `${j.image}/high.webp` : null;
  } catch {
    return null;
  }
}

const j = (v: unknown) => JSON.stringify(v, null, 2);

export const searchCardsTool = defineTool({
  name: "search_cards",
  description:
    "Search the Pokémon TCG catalog. Supports pokemontcg.io v2 `q` syntax (e.g. `name:charizard set.id:sv3`).",
  parameters: z.object({
    q: z.string().describe("Query string in pokemontcg.io v2 syntax."),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(60).default(20),
  }),
  execute: async ({ q, page, pageSize }) => {
    const params = new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) });
    const res = await tcg<{ data: any[]; totalCount: number }>(`/cards?${params}`);
    return j({
      totalCount: res.totalCount,
      cards: res.data.map((c) => ({
        id: c.id,
        name: c.name,
        set: c.set?.name,
        number: c.number,
        rarity: c.rarity,
        images: c.images,
      })),
    });
  },
});

export const getCardTool = defineTool({
  name: "get_card",
  description: "Fetch full details for a Pokémon TCG card by id (e.g. `sv3-199`).",
  parameters: z.object({ id: z.string() }),
  execute: async ({ id }) => {
    try {
      const res = await tcg<{ data: any }>(`/cards/${encodeURIComponent(id)}`);
      return j(res.data);
    } catch (e) {
      const fallback = await tcgdexCard(id);
      if (fallback) return j(fallback);
      throw e;
    }
  },
});

export const listSetsTool = defineTool({
  name: "list_sets",
  description: "List Pokémon TCG box sets, newest first.",
  parameters: z.object({ pageSize: z.number().int().min(1).max(250).default(50) }),
  execute: async ({ pageSize }) => {
    const res = await tcg<{ data: any[] }>(`/sets?orderBy=-releaseDate&pageSize=${pageSize}`);
    return j(res.data);
  },
});

export const getHDImageTool = defineTool({
  name: "get_hd_image",
  description:
    "Resolve the highest-resolution image available for a card. Prefers TCGdex high.webp, falls back to images.large from pokemontcg.io.",
  parameters: z.object({
    id: z.string().describe("Card id, e.g. `sv3-199`."),
    number: z.string().optional(),
  }),
  execute: async ({ id, number }) => {
    const hd = await tcgdexHD(id, number);
    if (hd) return j({ id, url: hd, source: "tcgdex" });
    const res = await tcg<{ data: { images: { large: string; small: string }; number: string } }>(
      `/cards/${encodeURIComponent(id)}`,
    );
    const url = res.data.images.large || res.data.images.small;
    const second = await tcgdexHD(id, res.data.number);
    return j({ id, url: second || url, source: second ? "tcgdex" : "pokemontcg" });
  },
});

export const refreshSetImagesTool = defineTool({
  name: "refresh_set_images",
  description:
    "Return HD image URLs for every card in a set. Use to bulk-refresh artwork in a client cache.",
  parameters: z.object({ setId: z.string().describe("e.g. `sv3`, `base1`, `swsh4`.") }),
  execute: async ({ setId }) => {
    const params = new URLSearchParams({
      q: `set.id:${setId}`,
      page: "1",
      pageSize: "250",
      orderBy: "number",
    });
    const res = await tcg<{ data: any[]; totalCount: number }>(`/cards?${params}`);
    const images = await Promise.all(
      res.data.map(async (c) => {
        const hd = await tcgdexHD(c.id, c.number);
        return {
          id: c.id,
          name: c.name,
          number: c.number,
          url: hd || c.images?.large || c.images?.small,
          source: hd ? "tcgdex" : "pokemontcg",
        };
      }),
    );
    return j({ setId, count: images.length, images });
  },
});
