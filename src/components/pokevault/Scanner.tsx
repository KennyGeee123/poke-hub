import { useEffect, useRef, useState } from "react";
import { hdImg } from "@/lib/card-images";
import { useServerFn } from "@tanstack/react-start";
import { searchCards, getMarketPrice, type TCGCard } from "@/lib/pokemon-api";
import { useVault, formatPrice } from "@/lib/vault";
import { identifyCard } from "@/lib/scanner.functions";
import { usePremium } from "@/lib/premium";
import { Paywall, TrialBanner } from "./Paywall";

type Phase = "idle" | "live" | "captured" | "identifying" | "searching" | "results";
type Identified = { name: string; hp?: string | null; setNumber?: string | null; setName?: string | null; supertype?: string; confidence?: number };

export function ScannerView({ onOpen }: { onOpen: (id: string) => void }) {
  const { scanLocked, incScan, isPro } = usePremium();
  if (scanLocked) {
    return <Paywall reason="You've used your 10 free scans. Upgrade to keep scanning unlimited cards." />;
  }
  return <ScannerInner onOpen={onOpen} onScanSuccess={() => { if (!isPro) incScan(); }} showTrial={!isPro} />;
}

function ScannerInner({ onOpen, onScanSuccess, showTrial }: { onOpen: (id: string) => void; onScanSuccess: () => void; showTrial: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [snap, setSnap] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TCGCard[]>([]);
  const [ident, setIdent] = useState<Identified | null>(null);
  const { addToVault } = useVault();
  const identifyFn = useServerFn(identifyCard);

  // cleanup
  useEffect(() => () => stopCamera(), []);

  async function startCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera API unavailable. Open the published app on a phone/desktop with camera access (the in-editor preview blocks getUserMedia).");
      return;
    }
    if (!window.isSecureContext) {
      setError("Camera requires HTTPS. Open the published app over https://");
      return;
    }
    try {
      // Move to live phase BEFORE awaiting so the <video> element exists in the DOM
      setPhase("live");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      // Wait a tick for the video element to mount
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.muted = true;
        (v as any).playsInline = true;
        try { await v.play(); } catch { /* autoplay policy — user gesture already happened */ }
      }
    } catch (e: any) {
      const name = e?.name || "";
      const msg =
        name === "NotAllowedError" ? "Camera permission denied. Allow camera access in your browser settings." :
        name === "NotFoundError"   ? "No camera found on this device." :
        name === "NotReadableError"? "Camera is in use by another app." :
        (e?.message || "Camera unavailable.");
      setError(msg);
      setPhase("idle");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  async function capture() {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    const w = v.videoWidth || 720, h = v.videoHeight || 1280;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", 0.8);
    setSnap(dataUrl);
    setPhase("identifying");
    stopCamera();
    await autoIdentify(dataUrl);
  }

  function retake() {
    setSnap(null); setResults([]); setQuery(""); setIdent(null); setError(null);
    startCamera();
  }

  async function autoIdentify(dataUrl: string) {
    setError(null);
    try {
      const r: any = await identifyFn({ data: { imageDataUrl: dataUrl } });
      if (!r?.ok) {
        setError(r?.error || "Could not identify card. Try typing the name.");
        setPhase("captured");
        return;
      }
      const card: Identified = r.card;
      setIdent(card);
      setQuery(card.name || "");
      onScanSuccess();
      await runSearch(card);
    } catch (e: any) {
      setError(e?.message || "Identification failed.");
      setPhase("captured");
    }
  }

  async function runSearch(hint?: Identified) {
    const raw = (hint?.name || query).trim();
    if (!raw) return;
    setPhase("searching");
    try {
      // Strip trailing tags ("ex", "V", "VMAX", "GX") for a broader base match,
      // then quote the core name (TCG API requires quotes for multi-word values,
      // and wildcards must live OUTSIDE the quotes).
      const cleaned = raw.replace(/[“”"]/g, "").trim();
      const core = cleaned.replace(/\s+(ex|EX|V|VMAX|VSTAR|GX|BREAK|LV\.?X)$/i, "").trim() || cleaned;
      const quote = (s: string) => `"${s.replace(/"/g, "")}"`;

      const stHint = (hint?.supertype || "").toLowerCase();
      const supertype =
        stHint.startsWith("trainer") ? "Trainer" :
        stHint.startsWith("energy")  ? "Energy"  :
        stHint.startsWith("pok")     ? "Pokémon" : null;

      // Progressive query fallback: most specific → broadest
      const queries: string[] = [];
      if (supertype && hint?.hp) queries.push(`name:${quote(core)} hp:${hint.hp} supertype:"${supertype}"`);
      if (supertype)             queries.push(`name:${quote(core)} supertype:"${supertype}"`);
      queries.push(`name:${quote(core)}*`);
      queries.push(`name:${quote(cleaned)}*`);

      let data: TCGCard[] = [];
      for (const q of queries) {
        const r = await searchCards({ q, pageSize: 18, orderBy: "-set.releaseDate" });
        if (r.data?.length) { data = r.data; break; }
      }
      setResults(data);
      setPhase("results");
    } catch {
      setError("Search failed. Try again.");
      setPhase("captured");
    }
  }

  const identify = () => runSearch();


  return (
    <div className="pv-scan">
      {showTrial && <TrialBanner />}
      <div className="pv-scan-hd">
        <div className="pv-scan-ball" />
        <div>
          <div className="pv-scan-title">POKÉDEX SCANNER</div>
          <div className="pv-scan-sub">Point your camera at any card</div>
        </div>
      </div>

      <div className="pv-scan-stage">
        {phase === "idle" && (
          <div className="pv-scan-idle">
            <div className="pv-pokeball-lg" aria-hidden />
            <div className="pv-scan-cta-title">READY TO SCAN</div>
            <div className="pv-scan-cta-sub">We'll use your device camera to capture a card, then match it against the live Pokémon TCG database.</div>
            <button className="pv-scan-go" onClick={startCamera}>📷 Activate Scanner</button>
            {error && <div className="pv-scan-err">{error}</div>}
          </div>
        )}

        {phase === "live" && (
          <>
            <div className="pv-scan-frame">
              <video ref={videoRef} playsInline muted autoPlay className="pv-scan-video" />
              <div className="pv-scan-overlay">
                <div className="pv-scan-corners" />
                <div className="pv-scan-line" />
              </div>
            </div>
            <div className="pv-scan-hint">Align the card inside the Pokéball</div>
            <div className="pv-scan-controls">
              <button className="pv-scan-cancel" onClick={() => { stopCamera(); setPhase("idle"); }}>Cancel</button>
              <button className="pv-scan-shutter" onClick={capture} aria-label="Capture">
                <span />
              </button>
              <div style={{ width: 70 }} />
            </div>
          </>
        )}

        {(phase === "captured" || phase === "identifying" || phase === "searching" || phase === "results") && snap && (
          <div className="pv-scan-result">
            <div className="pv-scan-snapwrap">
              <img src={snap} alt="Scanned card" className="pv-scan-snap" />
              <div className="pv-scan-snap-glow" />
              {phase === "identifying" && (
                <div className="pv-scan-analyzing">
                  <div className="pv-scan-line" />
                  <div className="pv-scan-analyzing-text">🔍 Analyzing card…</div>
                </div>
              )}
            </div>
            <div className="pv-scan-id">
              <div className="pv-scan-id-label">
                ⚡ {phase === "identifying" ? "IDENTIFYING…" : "IDENTIFY CARD"}
              </div>
              {ident ? (
                <div className="pv-scan-id-sub">
                  AI detected: <b>{ident.name}</b>
                  {ident.hp ? ` · HP ${ident.hp}` : ""}
                  {ident.setNumber ? ` · ${ident.setNumber}` : ""}
                  {typeof ident.confidence === "number" ? ` · ${Math.round(ident.confidence * 100)}% conf` : ""}
                </div>
              ) : (
                <div className="pv-scan-id-sub">AI vision will read the card. Edit the name if it's wrong.</div>
              )}
              <div className="pv-scan-search">
                <input
                  className="pv-scan-input"
                  placeholder="e.g. Charizard, Pikachu, Mew…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && identify()}
                  disabled={phase === "identifying"}
                />
                <button className="pv-scan-find" onClick={identify} disabled={!query.trim() || phase === "searching" || phase === "identifying"}>
                  {phase === "searching" ? "Searching…" : phase === "identifying" ? "Reading…" : "Match"}
                </button>
              </div>
              {error && <div className="pv-scan-err">{error}</div>}
              <div className="pv-scan-row">
                <button className="pv-scan-retake" onClick={retake}>↺ Retake</button>
                <button className="pv-scan-retake" onClick={() => { setSnap(null); setPhase("idle"); setResults([]); setQuery(""); setIdent(null); setError(null); }}>✕ Close</button>
              </div>
            </div>
          </div>
        )}

        {phase === "results" && (
          <div className="pv-scan-matches">
            <div className="pv-scan-matches-hd">
              <span>🎴 {results.length} possible {results.length === 1 ? "match" : "matches"}</span>
            </div>
            {results.length === 0 ? (
              <div className="pv-scan-none">No matches. Try a different spelling.</div>
            ) : (
              <div className="pv-scan-grid">
                {results.map(c => (
                  <div key={c.id} className="pv-scan-match" onClick={() => onOpen(c.id)}>
                    <img {...hdImg(c)} alt={c.name} loading="lazy" />
                    <div className="pv-scan-match-info">
                      <div className="pv-scan-match-name">{c.name}</div>
                      <div className="pv-scan-match-set">{c.set.name} · {c.number}/{c.set.printedTotal ?? "?"}</div>
                      <div className="pv-scan-match-foot">
                        <span className="pv-scan-match-price">{formatPrice(getMarketPrice(c))}</span>
                        <button
                          className="pv-scan-add"
                          onClick={(e) => { e.stopPropagation(); addToVault(c); }}
                        >+ Vault</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
