// MCP tools exposing Pokémon TCG card data + HD image resolution.
import { defineTool } from "mcp-tanstack-start";
import { z } from "zod";

const TCG_BASE = "https://api.pokemontcg.io/v2";

async function tcg<T>(path: string): Promise<T> {
  const r = await fetch(`${TCG_BASE}${path}`);
  if (!r.ok) throw new Error(`pokemontcg.io ${r.status}`);
  return r.json() as Promise<T>;
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
  } catch { return null; }
}

const j = (v: unknown) => JSON.stringify(v, null, 2);

export const searchCardsTool = defineTool({
  name: "search_cards",
  description: "Search the Pokémon TCG catalog. Supports pokemontcg.io v2 `q` syntax (e.g. `name:charizard set.id:sv3`).",
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
      cards: res.data.map(c => ({
        id: c.id, name: c.name, set: c.set?.name, number: c.number, rarity: c.rarity, images: c.images,
      })),
    });
  },
});

export const getCardTool = defineTool({
  name: "get_card",
  description: "Fetch full details for a Pokémon TCG card by id (e.g. `sv3-199`).",
  parameters: z.object({ id: z.string() }),
  execute: async ({ id }) => {
    const res = await tcg<{ data: any }>(`/cards/${encodeURIComponent(id)}`);
    return j(res.data);
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
  description: "Resolve the highest-resolution image available for a card. Prefers TCGdex high.webp, falls back to images.large from pokemontcg.io.",
  parameters: z.object({
    id: z.string().describe("Card id, e.g. `sv3-199`."),
    number: z.string().optional(),
  }),
  execute: async ({ id, number }) => {
    const hd = await tcgdexHD(id, number);
    if (hd) return j({ id, url: hd, source: "tcgdex" });
    const res = await tcg<{ data: { images: { large: string; small: string }; number: string } }>(`/cards/${encodeURIComponent(id)}`);
    const url = res.data.images.large || res.data.images.small;
    const second = await tcgdexHD(id, res.data.number);
    return j({ id, url: second || url, source: second ? "tcgdex" : "pokemontcg" });
  },
});

export const refreshSetImagesTool = defineTool({
  name: "refresh_set_images",
  description: "Return HD image URLs for every card in a set. Use to bulk-refresh artwork in a client cache.",
  parameters: z.object({ setId: z.string().describe("e.g. `sv3`, `base1`, `swsh4`.") }),
  execute: async ({ setId }) => {
    const params = new URLSearchParams({ q: `set.id:${setId}`, page: "1", pageSize: "250", orderBy: "number" });
    const res = await tcg<{ data: any[]; totalCount: number }>(`/cards?${params}`);
    const images = await Promise.all(res.data.map(async c => {
      const hd = await tcgdexHD(c.id, c.number);
      return {
        id: c.id, name: c.name, number: c.number,
        url: hd || c.images?.large || c.images?.small,
        source: hd ? "tcgdex" : "pokemontcg",
      };
    }));
    return j({ setId, count: images.length, images });
  },
});
