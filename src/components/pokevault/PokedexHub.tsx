import { useState, useEffect, useCallback, useRef } from "react";

const BASE = "https://pokeapi.co/api/v2";

type PokeListItem = { name: string; url: string };

type PokeDetail = {
  id: number;
  name: string;
  types: string[];
  height: number;
  weight: number;
  stats: { name: string; base: number }[];
  abilities: string[];
  artwork: string | null;
  shinyArtwork: string | null;
  flavorText: string | null;
  genus: string | null;
  cries: string | null;
};

const typeColors: Record<string, string> = {
  normal: "#A8A77A", fire: "#EE8130", water: "#6390F0", electric: "#F7D02C",
  grass: "#7AC74C", ice: "#96D9D6", fighting: "#C22E28", poison: "#A33EA1",
  ground: "#E2BF65", flying: "#A98FF3", psychic: "#F95587", bug: "#A6B91A",
  rock: "#B6A136", ghost: "#735797", dragon: "#6F35FC", dark: "#705746",
  steel: "#B7B7CE", fairy: "#D685AD",
};

async function j<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

function useDebounce<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function PokedexHub() {
  const [query, setQuery] = useState("");
  const dq = useDebounce(query, 350);
  const [all, setAll] = useState<PokeListItem[]>([]);
  const [filtered, setFiltered] = useState<PokeListItem[]>([]);
  const [selected, setSelected] = useState<PokeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load full list once
  useEffect(() => {
    let mounted = true;
    fetch(`${BASE}/pokemon?limit=1025`)
      .then(r => r.json())
      .then((d: any) => { if (mounted) setAll(d.results); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Filter locally
  useEffect(() => {
    if (!dq.trim()) { setFiltered([]); return; }
    const q = dq.toLowerCase();
    const out = all.filter(p => p.name.includes(q)).slice(0, 60);
    setFiltered(out);
  }, [dq, all]);

  const loadDetail = useCallback(async (name: string) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setDetailLoading(true);
    try {
      const p: any = await j(`${BASE}/pokemon/${name}`);
      let species: any = null;
      try { species = await j(p.species.url); } catch { /* ignore */ }
      const flavor = species?.flavor_text_entries?.find((e: any) => e.language?.name === "en")?.flavor_text?.replace(/\s+/g, " ") ?? null;
      const genus = species?.genera?.find((g: any) => g.language?.name === "en")?.genus ?? null;
      setSelected({
        id: p.id,
        name: p.name,
        types: (p.types ?? []).map((t: any) => t.type.name),
        height: p.height,
        weight: p.weight,
        stats: (p.stats ?? []).map((s: any) => ({ name: s.stat.name, base: s.base_stat })),
        abilities: (p.abilities ?? []).map((a: any) => a.ability.name),
        artwork: p.sprites?.other?.["official-artwork"]?.front_default ?? null,
        shinyArtwork: p.sprites?.other?.["official-artwork"]?.front_shiny ?? null,
        flavorText: flavor,
        genus,
        cries: p.cries?.latest ?? null,
      });
    } catch { setSelected(null); }
    setDetailLoading(false);
  }, []);

  const playCry = useCallback(() => {
    if (!selected?.cries) return;
    const a = new Audio(selected.cries);
    a.volume = 0.35;
    a.play().catch(() => {});
  }, [selected]);

  return (
    <div className="px-4 py-4 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="pv-pokeball" aria-hidden />
          <h2 className="text-xl font-bold tracking-wider" style={{ color: "var(--gold)" }}>POKÉDEX HUB</h2>
        </div>
        <input
          className="pv-key-in w-full max-w-md"
          placeholder="Search Pokémon by name..."
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
        />
      </div>

      {!query.trim() && (
        <div className="mt-6 text-sm" style={{ color: "var(--t3)" }}>
          Start typing to search all 1,000+ Pokémon. Click a result to view details, stats, and shiny form.
        </div>
      )}

      {query.trim() && !selected && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(p => (
            <button
              key={p.name}
              className="pv-dex-tile"
              onClick={() => loadDetail(p.name)}
            >
              <img
                src={`https://img.pokemondb.net/sprites/home/normal/${p.name}.png`}
                alt={p.name}
                className="w-16 h-16 object-contain mx-auto"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.url.split('/').filter(Boolean).pop()}.png`;
                }}
              />
              <div className="capitalize text-xs font-semibold mt-1 truncate">{p.name}</div>
            </button>
          ))}
        </div>
      )}

      {detailLoading && (
        <div className="mt-8 flex items-center justify-center" style={{ color: "var(--t3)" }}>Loading…</div>
      )}

      {selected && !detailLoading && (
        <div className="mt-6">
          <button className="pv-back" onClick={() => setSelected(null)}>← Back to results</button>
          <div className="pv-dex-detail mt-4">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex flex-col items-center gap-3">
                <img
                  src={selected.artwork ?? `https://img.pokemondb.net/sprites/home/normal/${selected.name}.png`}
                  alt={selected.name}
                  className="w-48 h-48 object-contain drop-shadow-xl"
                />
                {selected.shinyArtwork && (
                  <img
                    src={selected.shinyArtwork}
                    alt={`${selected.name} shiny`}
                    className="w-32 h-32 object-contain drop-shadow-xl"
                  />
                )}
                {selected.cries && (
                  <button className="pv-ksave" onClick={playCry}>▶ Play Cry</button>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-2xl font-bold capitalize">{selected.name}</h3>
                  <span style={{ color: "var(--t3)" }}>#{String(selected.id).padStart(4, "0")}</span>
                </div>
                {selected.genus && <div className="text-sm mt-1" style={{ color: "var(--t2)" }}>{selected.genus}</div>}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {selected.types.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded text-xs font-bold uppercase" style={{ background: typeColors[t] ?? "#888", color: "#111" }}>
                      {t}
                    </span>
                  ))}
                </div>
                {selected.flavorText && (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--t2)" }}>{selected.flavorText}</p>
                )}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="pv-stat-box">
                    <div className="text-xs" style={{ color: "var(--t3)" }}>Height</div>
                    <div className="font-bold">{(selected.height / 10).toFixed(1)} m</div>
                  </div>
                  <div className="pv-stat-box">
                    <div className="text-xs" style={{ color: "var(--t3)" }}>Weight</div>
                    <div className="font-bold">{(selected.weight / 10).toFixed(1)} kg</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selected.stats.map(s => (
                    <div key={s.name} className="pv-stat-box">
                      <div className="text-xs capitalize" style={{ color: "var(--t3)" }}>{s.name}</div>
                      <div className="font-bold">{s.base}</div>
                      <div className="w-full h-1.5 rounded-full mt-1" style={{ background: "var(--s3)" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (s.base / 255) * 100)}%`, background: "var(--gold)" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="text-xs font-semibold mb-1" style={{ color: "var(--t3)" }}>Abilities</div>
                  <div className="flex gap-2 flex-wrap">
                    {selected.abilities.map(a => (
                      <span key={a} className="px-2 py-1 rounded text-xs font-medium" style={{ background: "var(--s3)", color: "var(--t2)" }}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
