// TCGdex API — free, no key. Multi-language alt artworks.
// https://api.tcgdex.net/v2/<lang>/cards/<id>  (id format: <set-id>-<number>)
const BASE = "https://api.tcgdex.net/v2";

export type TCGdexCard = {
  id: string;
  name: string;
  image?: string; // base URL without quality/extension
  variants?: Record<string, boolean>;
  rarity?: string;
};

async function j<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export type AltArt = { lang: string; url: string };

// pokemontcg.io IDs look like "swsh4-25". TCGdex uses similar ids but with their own set codes.
// We try direct lookup; falls back to search-by-name within the same set series.
export async function getAltArtworks(card: { id: string; name: string; number?: string; set: { id: string; name: string } }): Promise<AltArt[]> {
  const langs = ["en", "fr", "es", "it", "de", "pt", "ja"];
  const results: AltArt[] = [];

  // Try each language. TCGdex IDs are not always the same as pokemontcg.io IDs,
  // but for many modern sets the pattern <setId>-<number> works.
  const candidateId = card.number ? `${card.id.split("-")[0]}-${card.number}` : card.id;

  await Promise.all(langs.map(async (lang) => {
    const direct = await j<TCGdexCard>(`${BASE}/${lang}/cards/${candidateId}`);
    if (direct?.image) {
      results.push({ lang, url: `${direct.image}/high.webp` });
      return;
    }
    // Fallback: search by name in that language
    const search = await j<TCGdexCard[]>(`${BASE}/${lang}/cards?name=${encodeURIComponent(card.name)}`);
    const hit = search?.find(c => c.image);
    if (hit?.image) results.push({ lang, url: `${hit.image}/high.webp` });
  }));

  return results;
}
