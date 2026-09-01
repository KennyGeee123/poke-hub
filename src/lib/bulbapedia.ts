// Bulbapedia (MediaWiki API) — public, CORS-enabled with origin=*
const API = "https://bulbapedia.bulbagarden.net/w/api.php";

export type BulbaInfo = {
  title: string;
  extract: string;
  image: string | null;
  url: string;
};

function cleanName(cardName: string): string {
  // Strip suffixes like " EX", " GX", " V", " VMAX", " ex", " δ", subtype tags, owner names
  return cardName
    .replace(/\b(EX|GX|V|VMAX|VSTAR|BREAK|LV\.X|δ|Star|ex)\b/gi, "")
    .replace(/['']s\s+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")[0]; // take first word (the species)
}

export async function fetchBulbapedia(cardName: string): Promise<BulbaInfo | null> {
  const species = cleanName(cardName);
  if (!species) return null;
  const title = `${species}_(Pokémon)`;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "extracts|pageimages",
    exintro: "1",
    explaintext: "1",
    exchars: "600",
    piprop: "original",
    pithumbsize: "400",
    redirects: "1",
    titles: title,
    origin: "*",
  });
  try {
    const r = await fetch(`${API}?${params}`);
    if (!r.ok) return null;
    const j = await r.json();
    const pages = j?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return null;
    return {
      title: page.title,
      extract: page.extract || "",
      image: page.original?.source || page.thumbnail?.source || null,
      url: `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    };
  } catch {
    return null;
  }
}
