import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchCards, type TCGCard } from "@/lib/pokemon-api";
import { formatPrice, useVault } from "@/lib/vault";
import { identifyCard } from "@/lib/scanner.functions";
import { useLivePrice } from "@/lib/live-prices";
import { hdImg } from "@/lib/card-images";
import {
  ALL_GRADES,
  type CardGrade,
  getGradeMeta,
} from "@/lib/card-grades";
import {
  findSpecies,
  pogoSpriteUrl,
  type PoGoSpecies,
} from "@/lib/pogo-market";
import {
  type FairAsset,
  type FairAssetKind,
  compareFairAssets,
  fairTradeDemos,
  gradeMockImg,
  makeCardAsset,
  makeGoAsset,
} from "@/lib/fair-trade-assets";

function CardHit({ card, onPick }: { card: TCGCard; onPick: (c: TCGCard) => void }) {
  const live = useLivePrice(card);
  const img = hdImg(card, { tile: true });
  return (
    <button type="button" className="ft-hit" onClick={() => onPick(card)}>
      <img src={img.src} alt="" className="ft-hit-thumb" />
      <span className="ft-hit-copy">
        <strong>{card.name}</strong>
        <em>
          {card.set?.name} {card.number ? `#${card.number}` : ""}
        </em>
      </span>
      <span className="ft-hit-price">{live > 0 ? formatPrice(live) : "…"}</span>
    </button>
  );
}

function GoHit({ sp, onPick }: { sp: PoGoSpecies; onPick: (s: PoGoSpecies) => void }) {
  return (
    <button type="button" className="ft-hit" onClick={() => onPick(sp)}>
      <img src={pogoSpriteUrl(sp.id)} alt="" className="ft-hit-thumb ft-hit-thumb-go" />
      <span className="ft-hit-copy">
        <strong>{sp.name}</strong>
        <em>
          GO · {sp.types.join("/")} · {sp.rarity}
        </em>
      </span>
      <span className="ft-hit-price">#{sp.id}</span>
    </button>
  );
}

function AssetPreview({ asset }: { asset: FairAsset }) {
  const meta = asset.kind === "card" ? getGradeMeta(asset.grade) : null;
  return (
    <div className="ft-picked">
      <div className="ft-picked-art">
        <img src={asset.image} alt={asset.label} className="ft-picked-img" />
        {asset.kind === "card" && (
          <img
            src={gradeMockImg(asset.grade)}
            alt=""
            className="ft-grade-badge-img"
            title={meta?.label}
          />
        )}
      </div>
      <div>
        <div className="ft-picked-name">{asset.label}</div>
        <div className="ft-picked-set">{asset.sublabel}</div>
        {meta && (
          <span
            className="ft-grade-pill"
            style={{ background: meta.badgeBg, color: meta.badgeText }}
          >
            {meta.shortLabel}
          </span>
        )}
        {asset.kind === "go" && (
          <span className="ft-grade-pill ft-go-pill">Pokémon GO</span>
        )}
        <div className="ft-picked-price">{formatPrice(asset.valueUsd)}</div>
      </div>
    </div>
  );
}

function ScanSlot({
  label,
  asset,
  onSet,
  onClear,
}: {
  label: string;
  asset: FairAsset | null;
  onSet: (a: FairAsset) => void;
  onClear: () => void;
}) {
  const [kind, setKind] = useState<FairAssetKind>(asset?.kind || "card");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TCGCard[]>([]);
  const [goHits, setGoHits] = useState<PoGoSpecies[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grade, setGrade] = useState<CardGrade>(
    asset?.kind === "card" ? asset.grade : "raw_nm",
  );
  const [shiny, setShiny] = useState(asset?.kind === "go" ? asset.shiny : false);
  const [lucky, setLucky] = useState(asset?.kind === "go" ? asset.lucky : false);

  // Keep local controls in sync when a demo (or parent) swaps the asset.
  useEffect(() => {
    if (!asset) return;
    setKind(asset.kind);
    if (asset.kind === "card") setGrade(asset.grade);
    if (asset.kind === "go") {
      setShiny(asset.shiny);
      setLucky(asset.lucky);
    }
  }, [asset]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cam, setCam] = useState(false);
  const identifyFn = useServerFn(identifyCard);
  const { vault } = useVault();
  const vaultList = Object.values(vault)
    .map((e) => e.card)
    .slice(0, 8);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  useEffect(() => {
    const name = q.trim();
    if (kind === "go") {
      setGoHits(findSpecies(name).slice(0, 10));
      setHits([]);
      return;
    }
    if (name.length < 2) {
      setHits([]);
      return;
    }
    setBusy(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await searchCards({
          q: name,
          pageSize: 8,
          orderBy: "-set.releaseDate",
        });
        setHits(res.data);
        setErr(null);
      } catch {
        setErr("Search failed — try a demo below (works offline).");
      } finally {
        setBusy(false);
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [q, kind]);

  async function startCam() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCam(true);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setErr("Camera blocked — search Find or use a demo.");
    }
  }

  async function snap() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth || 720;
    c.height = v.videoHeight || 1280;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.8);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCam(false);
    setBusy(true);
    try {
      const r: any = await identifyFn({ data: { imageDataUrl: dataUrl } });
      const name = r?.card?.name || (r?.ok && r?.card?.name);
      if (!name) {
        setErr(r?.error || "Could not read the card. Search Find instead.");
        setBusy(false);
        return;
      }
      setKind("card");
      setQ(name);
      const res = await searchCards({ q: name, pageSize: 8, orderBy: "-set.releaseDate" });
      setHits(res.data);
      if (res.data[0]) onSet(makeCardAsset(res.data[0], grade));
    } catch (e: any) {
      setErr(e?.message || "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  function pickCard(c: TCGCard) {
    onSet(makeCardAsset(c, grade));
    setHits([]);
    setQ("");
  }

  function pickGo(s: PoGoSpecies) {
    onSet(makeGoAsset(s, { shiny, lucky, ivPct: 95, cp: 2500 }));
    setGoHits([]);
    setQ("");
  }

  // Re-value when grade / shiny / lucky changes on an existing pick
  useEffect(() => {
    if (!asset) return;
    if (asset.kind === "card" && asset.grade !== grade) {
      onSet(makeCardAsset(asset.card, grade));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade]);

  useEffect(() => {
    if (!asset || asset.kind !== "go") return;
    if (asset.shiny !== shiny || asset.lucky !== lucky) {
      onSet(makeGoAsset(asset.species, { shiny, lucky, ivPct: asset.ivPct, cp: asset.cp }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiny, lucky]);

  return (
    <div className="ft-slot">
      <div className="ft-slot-label">{label}</div>
      <div className="ft-kind-tabs" role="tablist" aria-label={`${label} type`}>
        <button
          type="button"
          role="tab"
          aria-selected={kind === "card"}
          className={kind === "card" ? "on" : ""}
          onClick={() => setKind("card")}
        >
          TCG Card
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === "go"}
          className={kind === "go" ? "on" : ""}
          onClick={() => setKind("go")}
        >
          Pokémon GO
        </button>
      </div>

      {asset ? <AssetPreview asset={asset} /> : (
        <div className="ft-empty-slot">
          {kind === "card"
            ? "Scan, search, or pick a demo card (any grade)."
            : "Search a GO species — value is name-keyed from eBay/GO comps."}
        </div>
      )}

      {asset ? (
        <button type="button" className="pv-btn pv-btn-out" onClick={onClear}>
          Clear
        </button>
      ) : null}

      {kind === "card" && (
        <label className="ft-grade-select">
          <span>Grade</span>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value as CardGrade)}
            aria-label="Card grade"
          >
            {ALL_GRADES.map((g) => {
              const m = getGradeMeta(g);
              return (
                <option key={g} value={g}>
                  {m.shortLabel} — {m.label}
                </option>
              );
            })}
          </select>
        </label>
      )}

      {kind === "go" && (
        <div className="ft-go-opts">
          <label>
            <input type="checkbox" checked={shiny} onChange={(e) => setShiny(e.target.checked)} />
            Shiny
          </label>
          <label>
            <input type="checkbox" checked={lucky} onChange={(e) => setLucky(e.target.checked)} />
            Lucky
          </label>
        </div>
      )}

      {kind === "card" &&
        (cam ? (
          <div className="ft-cam">
            <video ref={videoRef} playsInline muted autoPlay className="ft-video" />
            <canvas ref={canvasRef} hidden />
            <div className="flex gap-2">
              <button type="button" className="pv-btn pv-btn-fill" onClick={snap}>
                Capture
              </button>
              <button
                type="button"
                className="pv-btn pv-btn-out"
                onClick={() => {
                  streamRef.current?.getTracks().forEach((t) => t.stop());
                  setCam(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="pv-btn pv-btn-fill" onClick={startCam}>
            📷 Scan card
          </button>
        ))}

      <div className="ft-find">
        <div className="ft-mini">Find {kind === "go" ? "GO species" : "card"}</div>
        <form
          className="ft-search"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <input
            className="pv-input"
            placeholder={
              kind === "go" ? "Search GO name or type…" : "Search name, set, or #…"
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
          <span className="ft-find-status">
            {busy
              ? "…"
              : kind === "go"
                ? `${goHits.length}`
                : q.trim().length >= 2
                  ? `${hits.length}`
                  : "Find"}
          </span>
        </form>
        {kind === "card" && hits.length > 0 && (
          <div className="ft-hits" role="listbox">
            {hits.map((c) => (
              <CardHit key={c.id} card={c} onPick={pickCard} />
            ))}
          </div>
        )}
        {kind === "go" && goHits.length > 0 && (
          <div className="ft-hits" role="listbox">
            {goHits.map((s) => (
              <GoHit key={s.id} sp={s} onPick={pickGo} />
            ))}
          </div>
        )}
        {kind === "card" && q.trim().length >= 2 && !busy && hits.length === 0 && (
          <div className="ft-mini">No cards match “{q.trim()}”.</div>
        )}
      </div>

      {kind === "card" && vaultList.length > 0 && (
        <div className="ft-vault">
          <div className="ft-mini">From your vault</div>
          <div className="flex gap-1 flex-wrap">
            {vaultList.map((c) => (
              <button key={c.id} type="button" className="pv-pill" onClick={() => pickCard(c)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {err && <div className="pv-scan-err">{err}</div>}
    </div>
  );
}

function IsoCard({ asset, side }: { asset: FairAsset | null; side: "left" | "right" }) {
  if (!asset) {
    return (
      <div className={`ft-iso-card ${side} empty`}>
        <img src="/fair-trade/iso-pedestal.jpg" alt="" />
      </div>
    );
  }
  return (
    <div className={`ft-iso-card ${side}`}>
      <img src={asset.image} alt={asset.label} />
      {asset.kind === "card" && (
        <span className="ft-iso-grade">{getGradeMeta(asset.grade).shortLabel}</span>
      )}
      {asset.kind === "go" && <span className="ft-iso-grade go">GO</span>}
    </div>
  );
}

function LivePair({ mine, theirs }: { mine: FairAsset | null; theirs: FairAsset | null }) {
  const v = useMemo(() => compareFairAssets(mine, theirs), [mine, theirs]);
  const tone =
    v.youWinLose === "FAIR"
      ? "fair"
      : v.youWinLose === "YOU WIN"
        ? "they-add"
        : v.youWinLose === "YOU LOSE"
          ? "you-add"
          : "need-prices";
  return (
    <div className={`ft-verdict ft-${tone}`}>
      <div className="ft-verdict-kicker">
        FAIR TRADE ·{" "}
        {v.mode === "card-card"
          ? "CARD ↔ CARD"
          : v.mode === "go-go"
            ? "GO ↔ GO"
            : v.mode === "mixed"
              ? "CARD ↔ GO"
              : "PICK BOTH SIDES"}
      </div>
      <div className="ft-verdict-label">
        {v.youWinLose === "YOU WIN"
          ? `YOU WIN · THEY ADD ${formatPrice(v.theyAdd)}`
          : v.youWinLose === "YOU LOSE"
            ? `YOU LOSE · YOU ADD ${formatPrice(v.youAdd)}`
            : v.youWinLose}
      </div>
      <p>{v.line}</p>
      <div className="ft-math">
        <span>
          Yours {mine ? formatPrice(mine.valueUsd) : "—"}
          {mine
            ? ` (${mine.kind === "go" ? "GO" : getGradeMeta(mine.grade).shortLabel})`
            : ""}
        </span>
        <span>↔</span>
        <span>
          Theirs {theirs ? formatPrice(theirs.valueUsd) : "—"}
          {theirs
            ? ` (${theirs.kind === "go" ? "GO" : getGradeMeta(theirs.grade).shortLabel})`
            : ""}
        </span>
      </div>
    </div>
  );
}

export function FairTradeView() {
  const [mine, setMine] = useState<FairAsset | null>(null);
  const [theirs, setTheirs] = useState<FairAsset | null>(null);
  const demos = useMemo(() => fairTradeDemos(), []);

  return (
    <div className="pad ft-page">
      <h1 className="ft-title">FAIR TRADE</h1>
      <p className="ft-sub">
        Compare <strong>TCG cards</strong> (any grade) and <strong>Pokémon GO</strong> creatures
        side-by-side — card↔card, GO↔GO, or mixed. Card value uses grade ladders; GO value is
        name-keyed from eBay/GO comps. Works for guests offline via demos.
      </p>

      <div className="ft-demos" aria-label="Demo verdicts">
        <div className="ft-mini">Try a demo (fair / you win / you lose)</div>
        <div className="ft-demo-row">
          {demos.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`ft-demo-btn ft-demo-${d.id.includes("win") ? "win" : d.id.includes("lose") ? "lose" : "fair"}`}
              title={d.blurb}
              onClick={() => {
                setMine(d.mine);
                setTheirs(d.theirs);
              }}
            >
              {d.title}
            </button>
          ))}
        </div>
      </div>

      <div className="ft-iso-stage" aria-hidden>
        <div className="ft-iso-rail">
          {[
            gradeMockImg("psa10"),
            gradeMockImg("psa9"),
            gradeMockImg("psa8"),
            gradeMockImg("psa7"),
            gradeMockImg("raw"),
            gradeMockImg("cgc10_pristine"),
            gradeMockImg("bgs10_black"),
            pogoSpriteUrl(150),
          ].map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </div>
        <IsoCard asset={mine} side="left" />
        <IsoCard asset={theirs} side="right" />
      </div>

      <div className="ft-grid">
        <ScanSlot label="Your side" asset={mine} onSet={setMine} onClear={() => setMine(null)} />
        <ScanSlot
          label="Their side"
          asset={theirs}
          onSet={setTheirs}
          onClear={() => setTheirs(null)}
        />
      </div>
      <LivePair mine={mine} theirs={theirs} />
    </div>
  );
}
