// MCP tools exposing Pokémon TCG card data + HD image resolution.
import { defineTool } from "mcp-tanstack-start";
import { z } from "zod";
import { parseCardId } from "@/lib/card-identity";
import {
  SCRYDEX_PLACEHOLDER_BYTES,
  classicScrydexCatalog,
  scrydexClassicImages,
  scrydexImagesForId,
  scrydexScanUrls,
} from "@/lib/classic-scans";

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

/** True when a Scrydex URL is a real scan, not the fixed-size placeholder. */
async function scrydexIsReal(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return false;
    const type = r.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return false;
    const len = Number(r.headers.get("content-length") || 0);
    if (!len || SCRYDEX_PLACEHOLDER_BYTES.has(len)) return false;
    return true;
  } catch {
    return false;
  }
}

async function firstRealScrydex(id: string, number?: string): Promise<string | null> {
  const parsed = parseCardId(id);
  const setId = parsed.setId;
  const num = number || parsed.localId;
  const urls = [
    ...scrydexScanUrls(setId, num, id, false),
    ...scrydexScanUrls(setId, num, id, true),
  ];
  for (const url of urls) {
    if (await scrydexIsReal(url)) return url;
  }
  return null;
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
  description:
    "Fetch full details for a Pokémon TCG card by id (e.g. `sv3-199`, `30th-c-001`). Images are the Scrydex scan of the printed card.",
  parameters: z.object({ id: z.string() }),
  execute: async ({ id }) => {
    const parsed = parseCardId(id);
    const scan =
      scrydexClassicImages(id) ||
      scrydexImagesForId(id, parsed.setId, parsed.localId);
    const withScan = (data: Record<string, unknown>) =>
      scan
        ? {
            ...data,
            images: { small: scan.small, large: scan.large },
            scrydexId: scan.scrydexId,
            imageSource: "scrydex",
          }
        : data;
    try {
      const res = await tcg<{ data: any }>(`/cards/${encodeURIComponent(id)}`);
      return j(withScan(res.data));
    } catch (e) {
      const fallback = await tcgdexCard(id);
      if (fallback) return j(withScan(fallback));
      if (scan) {
        const row = classicScrydexCatalog().find((r) => r.scrydexId === scan.scrydexId);
        return j({
          id: row?.id || id,
          name: row?.name,
          number: row ? row.id.slice(row.id.lastIndexOf("-") + 1) : undefined,
          images: { small: scan.small, large: scan.large },
          scrydexId: scan.scrydexId,
          source: "scrydex",
        });
      }
      const live = await firstRealScrydex(id);
      if (live) return j({ id, images: { large: live, small: live }, source: "scrydex" });
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
    "Resolve the highest-resolution scan of the printed card, frame included. Uses the Scrydex scan. Placeholder files are rejected.",
  parameters: z.object({
    id: z.string().describe("Card id, e.g. `sv3-199` or `30th-c-001`."),
    number: z.string().optional(),
  }),
  execute: async ({ id, number }) => {
    const scan = scrydexClassicImages(id);
    if (scan) {
      return j({
        id,
        url: scan.large,
        small: scan.small,
        source: "scrydex",
        scrydexId: scan.scrydexId,
      });
    }
    const parsed = parseCardId(id);
    const built = scrydexImagesForId(id, parsed.setId, number || parsed.localId);
    if (built && (await scrydexIsReal(built.large))) {
      return j({
        id,
        url: built.large,
        small: built.small,
        source: "scrydex",
        scrydexId: built.scrydexId,
      });
    }
    const live = await firstRealScrydex(id, number);
    if (live) return j({ id, url: live, source: "scrydex" });
    throw new Error(`no image for ${id}`);
  },
});

export const refreshSetImagesTool = defineTool({
  name: "refresh_set_images",
  description:
    "Return HD image URLs for every card in a set. Every scan is the Scrydex file of the printed card.",
  parameters: z.object({ setId: z.string().describe("e.g. `sv3`, `base1`, `30th-c`.") }),
  execute: async ({ setId }) => {
    if (/^(30th-c|me55c)$/i.test(setId)) {
      const images = classicScrydexCatalog().map((row) => ({
        id: row.id,
        name: row.name,
        number: row.id.slice(row.id.lastIndexOf("-") + 1),
        url: row.large,
        small: row.small,
        source: "scrydex",
        scrydexId: row.scrydexId,
      }));
      return j({ setId, count: images.length, source: "scrydex", images });
    }
    const params = new URLSearchParams({
      q: `set.id:${setId}`,
      page: "1",
      pageSize: "250",
      orderBy: "number",
    });
    const res = await tcg<{ data: any[]; totalCount: number }>(`/cards?${params}`);
    const images = await Promise.all(
      res.data.map(async (c) => {
        const built = scrydexImagesForId(c.id, c.set?.id || setId, c.number);
        let url = built?.large || "";
        let source = built ? "scrydex" : "none";
        if (built && !(await scrydexIsReal(built.large))) {
          const live = await firstRealScrydex(c.id, c.number);
          url = live || "";
          source = live ? "scrydex" : "none";
        }
        return {
          id: c.id,
          name: c.name,
          number: c.number,
          url,
          small: built?.small,
          source,
          scrydexId: built?.scrydexId,
        };
      }),
    );
    return j({ setId, count: images.length, images });
  },
});
