// Full Art Studio: pick a card → extended full-bleed fan design → preview → save / download.
import { useCallback, useEffect, useRef, useState } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import { getCard, getDiscoverFast, searchCards } from "@/lib/pokemon-api";
import { useVault } from "@/lib/vault";
import {
  FULLARTS_EVENT,
  STYLE_LABELS,
  canvasToBlob,
  deleteFullArt,
  downloadBlob,
  fullArtFilename,
  listFullArts,
  loadCardImage,
  renderFullArt,
  saveFullArt,
  type FullArtRecord,
  type FullArtRim,
  type FullArtStyle,
} from "@/lib/fullart";
import {
  AI_PAINT_NOTES,
  getAiPaintStatus,
  paintWithAi,
  type AiPaintStatus,
} from "@/lib/fullart-ai";
import { AI_ART_STYLES, AI_ART_STYLE_LABELS, type AiArtStyle } from "@/lib/fullart-prompt";
import { EmptyState, SkeletonCards } from "./ui";

const STYLES: FullArtStyle[] = ["holo", "rainbow", "gold", "alt"];
const AI_PREF = "pv-fa-ai";
const AI_STYLE_HINTS: Record<AiArtStyle, string> = {
  faithful: "Same art, painted past the frame",
  storybook: "Painterly scene, SIR-style",
  chibi: "Cute, rounded, pastel",
  neon: "Glowing synthwave night",
};

export function FullArtStudio({
  initialCardId,
  onToast,
}: {
  initialCardId?: string | null;
  onToast: (m: string) => void;
}) {
  const [card, setCard] = useState<TCGCard | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [style, setStyle] = useState<FullArtStyle>("holo");
  const [frame, setFrame] = useState(true);
  const [rim, setRim] = useState<FullArtRim>("silver");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  // AI paint (Nano Banana). Off by default; falls back to the compositor on any failure.
  const [aiOn, setAiOn] = useState(false);
  const [aiStyle, setAiStyle] = useState<AiArtStyle>("faithful");
  const [aiStatus, setAiStatus] = useState<AiPaintStatus | null>(null);
  const [aiArt, setAiArt] = useState<HTMLImageElement | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const aiReq = useRef(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(AI_PREF) === "1") setAiOn(true);
    } catch {
      /* private mode */
    }
  }, []);
  useEffect(() => {
    if (!aiOn) return;
    let alive = true;
    getAiPaintStatus().then((st) => {
      if (!alive) return;
      setAiStatus(st);
      if (!st.enabled)
        setAiNote(st.reason === "no_key" ? AI_PAINT_NOTES.no_key : AI_PAINT_NOTES.offline);
    });
    return () => {
      alive = false;
    };
  }, [aiOn]);
  // AI art is specific to card + finish + art style.
  useEffect(() => {
    aiReq.current++;
    setAiArt(null);
    setAiBusy(false);
  }, [card?.id, style, aiStyle]);

  const toggleAi = () => {
    const next = !aiOn;
    setAiOn(next);
    if (!next) setAiNote(null);
    try {
      localStorage.setItem(AI_PREF, next ? "1" : "0");
    } catch {
      /* private mode */
    }
  };
  const onPaint = async () => {
    if (!card || !img) return;
    const st = aiStatus ?? (await getAiPaintStatus());
    setAiStatus(st);
    if (!st.enabled) {
      setAiNote(AI_PAINT_NOTES.no_key);
      return;
    }
    const id = ++aiReq.current;
    setAiBusy(true);
    setAiNote(null);
    const res = await paintWithAi(card, img, style, aiStyle);
    if (id !== aiReq.current) return;
    setAiBusy(false);
    if (res.ok) {
      setAiArt(res.img);
      if (!res.cached) void getAiPaintStatus(true).then(setAiStatus);
      onToast(res.cached ? "AI paint loaded from this device" : "Painted with Nano Banana");
    } else {
      setAiArt(null);
      setAiNote(res.message);
      if (res.error === "no_key") setAiStatus({ ...st, enabled: false, reason: "no_key" });
    }
  };
  const aiEnabled = !!aiStatus?.enabled;
  const showAi = aiOn && !!aiArt;

  const pick = useCallback(async (c: TCGCard) => {
    setCard(c);
    setImg(null);
    setErr(null);
    setStatus("loading");
    try {
      await document.fonts?.ready;
      // Lists (Discover/search) can carry trimmed card data; fetch the full
      // record so the frame gets HP, types and attacks.
      // pokemontcg-imaged cards already carry full data (or aren't on TCGdex).
      const fromTcgdex = !/images\.pokemontcg\.io/.test(`${c.images?.small} ${c.images?.large}`);
      const appOnlySet = /^(base1sl|error)-/.test(c.id);
      const needsData =
        fromTcgdex && !appOnlySet && (!c.hp || !(c.attacks?.length || c.abilities?.length));
      const [image, full] = await Promise.all([
        loadCardImage(c),
        needsData
          ? Promise.race([
              // Single-card route passes attacks/abilities through from TCGdex.
              import("@/lib/tcgdex")
                .then((m) => m.tcgdexGetCard(c.id, c.lang || "en"))
                .catch(() => null),
              new Promise<null>((r) => setTimeout(() => r(null), 6000)),
            ])
          : Promise.resolve(null),
      ]);
      if (full && full.id === c.id)
        setCard({
          ...c,
          hp: c.hp || full.hp,
          types: c.types?.length ? c.types : full.types,
          attacks: full.attacks?.length ? full.attacks : c.attacks,
          abilities: full.abilities?.length ? full.abilities : c.abilities,
          subtypes: c.subtypes?.length ? c.subtypes : full.subtypes,
        });
      setImg(image);
      setStatus("ready");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t load this card’s art.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!initialCardId) return;
    let alive = true;
    getCard(initialCardId)
      .then((c) => {
        if (alive && c) void pick(c);
      })
      .catch(() => alive && setErr("Couldn’t load that card."));
    return () => {
      alive = false;
    };
  }, [initialCardId, pick]);

  useEffect(() => {
    if (!img || !card || !canvasRef.current) return;
    try {
      renderFullArt(canvasRef.current, img, card, {
        style,
        frame,
        rim,
        aiArt: showAi ? aiArt : null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Render failed");
      setStatus("error");
    }
  }, [img, card, style, frame, rim, showAi, aiArt]);

  const onTilt = (e: React.PointerEvent) => {
    const el = tiltRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--fx", `${x * 100}%`);
    el.style.setProperty("--fy", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 12}deg`);
  };
  const resetTilt = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  const onDownload = async () => {
    if (!canvasRef.current || !card) return;
    const blob = await canvasToBlob(canvasRef.current);
    downloadBlob(blob, fullArtFilename(card.name, style));
    onToast("Full art PNG downloaded");
  };
  const onSave = async () => {
    if (!canvasRef.current || !card) return;
    setSaving(true);
    try {
      await saveFullArt(card, canvasRef.current, { style, frame, rim });
      onToast("Saved to My Full Arts in your Vault");
    } catch {
      onToast("Couldn’t save on this device — try Download instead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pad pv-fa">
      <header className="pv-fa-head">
        <div>
          <div className="pv-fa-kicker">FULL ART STUDIO</div>
          <h1 className="pv-fa-title">Make any card a full art</h1>
          <p className="pv-fa-sub">
            We extend regular card art edge-to-edge (Special Illustration Rare style), then add a
            thin rim, glass attack panel, and card text.
          </p>
        </div>
      </header>
      <div className="pv-fa-disclaimer" role="note">
        <strong>Fan-made custom design.</strong> Not an official Pokémon card and not for resale.
        Uses only the card image you pick.
      </div>

      {!card && <CardPicker onPick={pick} />}

      {card && (
        <div className="pv-fa-work">
          <div className="pv-fa-stage">
            <div
              ref={tiltRef}
              className={`pv-fa-tilt style-${style}`}
              onPointerMove={onTilt}
              onPointerLeave={resetTilt}
            >
              <canvas
                ref={canvasRef}
                className="pv-fa-canvas"
                width={1000}
                height={1400}
                aria-label={`Full art preview of ${card.name}`}
                role="img"
                style={{ opacity: status === "ready" ? 1 : 0 }}
              />
              {status === "ready" && <div className="pv-fa-shine" aria-hidden />}
              {status === "ready" && showAi && (
                <span className="pv-fa-aibadge">
                  ✨ AI painted · {AI_ART_STYLE_LABELS[aiStyle]}
                </span>
              )}
              {status === "ready" && aiBusy && (
                <div className="pv-fa-aibusy" role="status">
                  <span className="pv-fa-aispin" aria-hidden />
                  Painting with Nano Banana…
                </div>
              )}
              {status === "loading" && (
                <div className="pv-fa-loading" role="status">
                  <div className="pv-skel-block" style={{ position: "absolute", inset: 0 }} />
                  <span>Extending the art…</span>
                </div>
              )}
              {status === "error" && (
                <div className="pv-fa-loading">
                  <span>{err || "Couldn’t load this card’s art."}</span>
                  <button type="button" className="pv-btn pv-btn-fill" onClick={() => pick(card)}>
                    ↻ Try again
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pv-fa-controls">
            <div className="pv-fa-card">
              <div className="pv-fa-cardname">{card.name}</div>
              <div className="pv-fa-cardsub">
                {card.set?.name}
                {card.number ? ` · #${card.number}` : ""}
              </div>
              <button type="button" className="pv-fa-change" onClick={() => setCard(null)}>
                Change card
              </button>
            </div>

            <div className="pv-fa-sec">Finish</div>
            <div className="pv-fa-styles" role="radiogroup" aria-label="Finish">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={style === s}
                  className={`pv-fa-style s-${s} ${style === s ? "on" : ""}`}
                  onClick={() => setStyle(s)}
                >
                  <span className="pv-fa-swatch" aria-hidden />
                  {STYLE_LABELS[s]}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`pv-fa-toggle ${frame ? "on" : ""}`}
              aria-pressed={frame}
              onClick={() => setFrame((f) => !f)}
            >
              <span className="flex-1 text-left">
                <strong>SIR overlay (name · HP · glass attacks)</strong>
                <em>Full-bleed art with translucent panels — fan-made label always on</em>
              </span>
              <span className="pv-lw-switch" aria-hidden />
            </button>

            {frame && (
              <div className="pv-fa-rim" role="radiogroup" aria-label="Rim">
                {(
                  [
                    ["silver", "Silver rim"],
                    ["gold", "Gold rim"],
                    ["none", "No rim"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={rim === k}
                    className={`pv-fa-rim-btn ${rim === k ? "on" : ""}`}
                    onClick={() => setRim(k)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className={`pv-fa-toggle pv-fa-aitoggle ${aiOn ? "on" : ""}`}
              aria-pressed={aiOn}
              onClick={toggleAi}
            >
              <span className="flex-1 text-left">
                <strong>AI paint (Nano Banana)</strong>
                <em>Google’s image model paints the art past the frame</em>
              </span>
              <span className="pv-lw-switch" aria-hidden />
            </button>

            {aiOn && (
              <div className="pv-fa-ai">
                <div className="pv-fa-sec">Art style</div>
                <div className="pv-fa-aistyles" role="radiogroup" aria-label="AI art style">
                  {AI_ART_STYLES.map((a) => (
                    <button
                      key={a}
                      type="button"
                      role="radio"
                      aria-checked={aiStyle === a}
                      className={`pv-fa-aistyle a-${a} ${aiStyle === a ? "on" : ""}`}
                      onClick={() => setAiStyle(a)}
                    >
                      <strong>{AI_ART_STYLE_LABELS[a]}</strong>
                      <em>{AI_STYLE_HINTS[a]}</em>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="pv-btn pv-btn-fill pv-fa-paint"
                  disabled={status !== "ready" || aiBusy || (aiStatus !== null && !aiEnabled)}
                  onClick={onPaint}
                >
                  {aiBusy ? "Painting…" : showAi ? "✨ Repaint with AI" : "✨ Paint with AI"}
                </button>
                {aiNote ? (
                  <p className="pv-fa-ainote" role="status">
                    {aiNote}
                  </p>
                ) : (
                  aiEnabled &&
                  typeof aiStatus?.remaining === "number" && (
                    <p className="pv-fa-ainote soft">
                      {aiStatus.remaining} of {aiStatus.dailyLimit} AI paints left today · frame,
                      text and the fan-made label are still added on your device.
                    </p>
                  )
                )}
              </div>
            )}

            <div className="pv-fa-actions">
              <button
                type="button"
                className="pv-btn pv-btn-fill"
                disabled={status !== "ready" || saving}
                onClick={onSave}
              >
                {saving ? "Saving…" : "★ Save to My Full Arts"}
              </button>
              <button
                type="button"
                className="pv-btn"
                disabled={status !== "ready"}
                onClick={onDownload}
              >
                ⬇ Download PNG
              </button>
            </div>
            <p className="pv-fa-how">
              How it works: by default a colour-sampled backdrop, blurred art bleed and mirrored
              edge extension are blended on your device. With AI paint on, only the card’s art
              window is sent to Google’s Gemini image model to paint the scene; the frame, text and
              fan-made label are still drawn here.
            </p>
          </div>
        </div>
      )}

      <FullArtGallery onToast={onToast} />
    </div>
  );
}

function CardPicker({ onPick }: { onPick: (c: TCGCard) => void }) {
  const { vault } = useVault();
  const vaultCards = Object.values(vault || {})
    .map((e) => e.card)
    .filter((c) => c?.id && c?.images);
  const [src, setSrc] = useState<"vault" | "discover" | "search">(
    vaultCards.length ? "vault" : "discover",
  );
  const [list, setList] = useState<TCGCard[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (src === "vault") setList(vaultCards);
    else if (src === "discover") {
      setList(null);
      getDiscoverFast()
        .then((c) => setList(c.slice(0, 24)))
        .catch(() => setList([]));
    } else setList([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const raw = q.trim();
      let found: TCGCard[] = [];
      for (const query of /[:*]/.test(raw)
        ? [raw]
        : [raw, /\s/.test(raw) ? `name:"${raw}"` : `name:${raw}*`]) {
        try {
          const res = await searchCards({ q: query, page: 1, pageSize: 24 });
          if (res.data?.length) {
            found = res.data;
            break;
          }
        } catch {
          /* try next form */
        }
      }
      setList(found);
    } catch {
      setList([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pv-fa-picker" aria-label="Pick a card">
      <div className="pv-fa-sec">1 · Pick a card</div>
      <div className="pv-fa-tabs" role="tablist">
        {(
          [
            ["vault", `Vault (${vaultCards.length})`],
            ["discover", "Discover"],
            ["search", "Search"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={src === k}
            className={`pv-pill ${src === k ? "on" : ""}`}
            onClick={() => setSrc(k)}
          >
            {l}
          </button>
        ))}
      </div>
      {src === "search" && (
        <form className="pv-fa-search" onSubmit={runSearch}>
          <input
            className="pv-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search any card — e.g. Charizard"
            aria-label="Search cards"
          />
          <button type="submit" className="pv-btn pv-btn-fill" disabled={busy}>
            {busy ? "…" : "Search"}
          </button>
        </form>
      )}
      {list === null || busy ? (
        <SkeletonCards count={6} label="Loading cards" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={src === "vault" ? "🔒" : "🔍"}
          title={src === "vault" ? "VAULT EMPTY" : "NO CARDS YET"}
        >
          {src === "vault"
            ? "Add cards to your vault, or pick one from Discover or Search."
            : src === "search"
              ? "Search for a card to turn into a full art."
              : "Discover didn’t load — try Search."}
        </EmptyState>
      ) : (
        <div className="pv-fa-grid">
          {list.map((c) => (
            <button key={c.id} type="button" className="pv-fa-pick" onClick={() => onPick(c)}>
              <img
                src={c.images?.small || c.images?.large}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function FullArtGallery({
  onToast,
  compact,
}: {
  onToast: (m: string) => void;
  compact?: boolean;
}) {
  const [items, setItems] = useState<FullArtRecord[] | null>(null);
  const [open, setOpen] = useState<FullArtRecord | null>(null);
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = () => listFullArts().then(setItems);
    load();
    window.addEventListener(FULLARTS_EVENT, load);
    return () => window.removeEventListener(FULLARTS_EVENT, load);
  }, []);
  useEffect(() => {
    if (!open) return setOpenUrl(null);
    const u = URL.createObjectURL(open.blob);
    setOpenUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [open]);

  if (!items) return null;
  const goStudio = () => window.dispatchEvent(new CustomEvent("pv-goto", { detail: "fullart" }));
  if (compact && items.length === 0)
    return (
      <button type="button" className="pv-fa-cta" onClick={goStudio}>
        <span className="pv-fa-cta-ico" aria-hidden>
          ✨
        </span>
        <span className="pv-fa-cta-txt">
          <strong>Full Art Studio</strong>
          <span>Turn any card into a full-bleed fan design</span>
        </span>
        <span aria-hidden>→</span>
      </button>
    );
  return (
    <section className="pv-fa-gallery" aria-label="My Full Arts">
      <div className="pv-fa-gallery-head">
        <div className="pv-section-title">
          ★ MY FULL ARTS {items.length ? `· ${items.length}` : ""}
        </div>
        {compact && (
          <button type="button" className="pv-fa-link" onClick={goStudio}>
            Open Studio →
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="pv-fa-how">Saved designs appear here and in your Vault.</p>
      ) : (
        <div className="pv-fa-grid">
          {items.map((it) => (
            <button key={it.id} type="button" className="pv-fa-pick" onClick={() => setOpen(it)}>
              <img src={it.thumb} alt={`${it.cardName} full art`} loading="lazy" />
              <span>
                {it.cardName} · {STYLE_LABELS[it.style]}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && openUrl && (
        <div
          className="pv-fa-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${open.cardName} full art`}
        >
          <div className="pv-settings-scrim" onClick={() => setOpen(null)} aria-hidden />
          <div className="pv-fa-modal-card">
            <img src={openUrl} alt={`${open.cardName} full art`} />
            <div className="pv-fa-modal-meta">
              <strong>{open.cardName}</strong>
              <span>
                {STYLE_LABELS[open.style]} · {new Date(open.createdAt).toLocaleDateString()}
                {open.cloud ? " · synced" : " · on this device"}
              </span>
              <em>Fan-made custom design — not an official card.</em>
            </div>
            <div className="pv-fa-actions">
              <button
                type="button"
                className="pv-btn pv-btn-fill"
                onClick={() => downloadBlob(open.blob, fullArtFilename(open.cardName, open.style))}
              >
                ⬇ Download PNG
              </button>
              <button
                type="button"
                className="pv-btn"
                onClick={async () => {
                  await deleteFullArt(open.id);
                  setOpen(null);
                  onToast("Full art deleted");
                }}
              >
                Delete
              </button>
              <button type="button" className="pv-btn" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
