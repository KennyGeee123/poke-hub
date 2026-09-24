import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchCards, type TCGCard } from "@/lib/pokemon-api";
import { formatPrice, useVault } from "@/lib/vault";
import { identifyCard } from "@/lib/scanner.functions";
import { useLivePrice } from "@/lib/live-prices";
import { fairTradeSwap } from "@/lib/p2p-trading";
import { hdImg } from "@/lib/card-images";

type SlotId = "mine" | "theirs";

function SlotCard({ card }: { card: TCGCard }) {
  const live = useLivePrice(card);
  const n = live || 0;
  const img = hdImg(card, { tile: true });
  return (
    <div className="ft-picked">
      <img src={img.src} alt={card.name} className="ft-picked-img" />
      <div>
        <div className="ft-picked-name">{card.name}</div>
        <div className="ft-picked-set">{card.set?.name}</div>
        <div className="ft-picked-price">{n > 0 ? formatPrice(n) : "Getting live quote…"}</div>
      </div>
    </div>
  );
}

function ScanSlot({
  label,
  card,
  onPick,
  onClear,
}: {
  label: string;
  card: TCGCard | null;
  onPick: (c: TCGCard) => void;
  onClear: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cam, setCam] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TCGCard[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
      setErr("Camera blocked — type the card name instead.");
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
        setErr(r?.error || "Could not read the card. Type the name.");
        setBusy(false);
        return;
      }
      const res = await searchCards({ q: name, pageSize: 8, orderBy: "-set.releaseDate" });
      if (res.data[0]) onPick(res.data[0]);
      setHits(res.data);
    } catch (e: any) {
      setErr(e?.message || "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function search() {
    const name = q.trim();
    if (!name) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await searchCards({ q: name, pageSize: 8, orderBy: "-set.releaseDate" });
      setHits(res.data);
      if (res.data[0] && res.data.length === 1) onPick(res.data[0]);
    } catch {
      setErr("Search failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ft-slot">
      <div className="ft-slot-label">{label}</div>
      {card ? (
        <>
          <SlotCard card={card} />
          <button type="button" className="pv-btn pv-btn-out" onClick={onClear}>
            Clear
          </button>
        </>
      ) : (
        <>
          {cam ? (
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
          )}
          <form
            className="ft-search"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <input
              className="pv-input"
              placeholder="Or type a name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="pv-btn pv-btn-out" disabled={busy}>
              {busy ? "…" : "Find"}
            </button>
          </form>
          {vaultList.length > 0 && (
            <div className="ft-vault">
              <div className="ft-mini">From your vault</div>
              <div className="flex gap-1 flex-wrap">
                {vaultList.map((c) => (
                  <button key={c.id} type="button" className="pv-pill" onClick={() => onPick(c)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {hits.length > 1 && (
            <div className="ft-hits">
              {hits.map((c) => (
                <button key={c.id} type="button" className="ft-hit" onClick={() => onPick(c)}>
                  {c.name} · {c.set?.name}
                </button>
              ))}
            </div>
          )}
          {err && <div className="pv-scan-err">{err}</div>}
        </>
      )}
    </div>
  );
}

function LivePair({ mine, theirs }: { mine: TCGCard | null; theirs: TCGCard | null }) {
  const a = useLivePrice(mine);
  const b = useLivePrice(theirs);
  const v = fairTradeSwap(a, b);
  return (
    <div className={`ft-verdict ft-${v.label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="ft-verdict-kicker">FAIR TRADE</div>
      <div className="ft-verdict-label">
        {v.label === "YOU ADD"
          ? `YOU ADD ${formatPrice(v.youAdd)}`
          : v.label === "THEY ADD"
            ? `THEY ADD ${formatPrice(v.theyAdd)}`
            : v.label}
      </div>
      <p>{v.line}</p>
      <div className="ft-math">
        <span>Yours {a > 0 ? formatPrice(a) : "—"}</span>
        <span>↔</span>
        <span>Theirs {b > 0 ? formatPrice(b) : "—"}</span>
      </div>
    </div>
  );
}

export function FairTradeView() {
  const [mine, setMine] = useState<TCGCard | null>(null);
  const [theirs, setTheirs] = useState<TCGCard | null>(null);

  return (
    <div className="pad ft-page">
      <h1 className="ft-title">FAIR TRADE</h1>
      <p className="ft-sub">
        Scan your card and their card. Live market quotes decide if the swap is fair, or who adds
        cash.
      </p>
      <div className="ft-grid">
        <ScanSlot label="Your card" card={mine} onPick={setMine} onClear={() => setMine(null)} />
        <ScanSlot
          label="Their card"
          card={theirs}
          onPick={setTheirs}
          onClear={() => setTheirs(null)}
        />
      </div>
      <LivePair mine={mine} theirs={theirs} />
    </div>
  );
}
