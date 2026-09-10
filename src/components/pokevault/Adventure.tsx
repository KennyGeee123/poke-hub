import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { healParty } from "@/lib/gbgame";
import { generateHiggsfieldImage, pollHiggsfieldImage } from "@/lib/higgsfield.functions";
import { GBBattleSession, type GBBattleFoe } from "./GBBattleSession";

type Toast = { msg: string; key: number };
type Scene = { name: string; url?: string; loading: boolean; error?: string; pending?: boolean };
type PendingWild = GBBattleFoe & { region?: string };

export function AdventureView() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [scene, setScene] = useState<Scene | null>(null);
  const [region, setRegion] = useState("Kanto");
  const [pendingWild, setPendingWild] = useState<PendingWild | null>(null);
  const [battleOpen, setBattleOpen] = useState(false);
  const [battleFoe, setBattleFoe] = useState<GBBattleFoe | null>(null);
  const [frameBlocked, setFrameBlocked] = useState(false);
  const [badges, setBadges] = useState<string[]>([]);
  const [e4, setE4] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sceneCache = useRef<Map<string, string>>(new Map());
  const higgsfield = useServerFn(generateHiggsfieldImage);
  const pollScene = useServerFn(pollHiggsfieldImage);

  function push(msg: string) {
    const key = Date.now() + Math.random();
    setToasts((t) => [...t, { msg, key }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), 3200);
  }

  function postIframe(msg: Record<string, unknown>) {
    try {
      iframeRef.current?.contentWindow?.postMessage(msg, "*");
    } catch {}
  }

  function goBattle(w: PendingWild) {
    // Keep Adventure tab + iframe mounted; battle runs as overlay.
    const foe: GBBattleFoe = {
      name: w.name,
      level: w.level,
      kind: w.kind || "wild",
      catchable: w.catchable !== false,
      badge: w.badge,
      e4Index: w.e4Index,
      leader: w.leader,
    };
    setBattleFoe(foe);
    setBattleOpen(true);
    setPendingWild(null);
    setScene(null);
    postIframe({ type: "pv-adventure-pause" });
  }

  function closeBattle(result: "win" | "lose" | "run" | "cancel") {
    setBattleOpen(false);
    setBattleFoe(null);
    setPendingWild(null);
    setScene(null);
    // Resume explore in iframe (gym/E4 badge events already posted by session / listeners).
    postIframe({ type: "pv-adventure-resume" });
    if (result === "win") push("Victory — back to the overworld");
    else if (result === "lose") push("White out — heal at a Poké Center");
    else if (result === "run") push("Got away safely");
  }

  async function renderScene(name: string) {
    const cached = sceneCache.current.get(name.toLowerCase());
    if (cached) {
      setScene({ name, url: cached, loading: false });
      return;
    }
    setScene({ name, loading: true });
    try {
      const prompt =
        `Cinematic Pokémon adventure still of a wild ${name} emerging from sunlit tall grass in a vast Kanto-style region, ` +
        `wide open biomes, Poké Center distant, golden-hour sky, modern Pokémon TCG app vibe, ` +
        `24mm anamorphic, volumetric light, shallow depth of field, no text, no logos, no watermark.`;
      let r = await higgsfield({ data: { prompt, width: 1024, height: 576 } });

      let tries = 0;
      while (!r.url && r.pending && r.id && tries < 20) {
        setScene({ name, loading: true, pending: true });
        await new Promise((res) => setTimeout(res, 2000));
        tries++;
        try {
          r = await pollScene({ data: { id: r.id } });
        } catch {
          break;
        }
      }

      if (r.url) {
        sceneCache.current.set(name.toLowerCase(), r.url);
        setScene({ name, url: r.url, loading: false });
      } else if (r.pending) {
        setScene({ name, loading: false, pending: true, error: "Scene still rendering — it will appear shortly" });
      } else {
        setScene({ name, loading: false, error: `Scene ${r.status || "unavailable"}` });
      }
    } catch (e: any) {
      setScene({ name, loading: false, error: e?.message?.slice(0, 120) || "scene failed" });
    }
  }

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;

      if (d.type === "pv-adventure-region" && typeof d.name === "string") {
        setRegion(d.name);
        return;
      }

      if (d.type === "pv-adventure-status") {
        if (typeof d.region === "string") setRegion(d.region);
        if (Array.isArray(d.badges)) setBadges(d.badges);
        if (typeof d.e4 === "number") setE4(d.e4);
        return;
      }
      if (d.type === "pv-adventure-heal") {
        try {
          await healParty();
          push("Healed at the Poké Center");
        } catch (err) {
          console.error(err);
          push("Poké Center healed your party");
        }
        return;
      }
      if (d.type === "pv-adventure-encounter" && typeof d.name === "string") {
        const name: string = d.name;
        if (typeof d.region === "string") setRegion(d.region);
        const kind = (d.kind as PendingWild["kind"]) || "wild";
        const level = typeof d.level === "number" ? d.level : 5 + Math.floor(Math.random() * 4);
        const catchable = d.catchable !== false && kind === "wild";
        const pending: PendingWild = {
          name,
          level,
          region: d.region,
          kind,
          catchable,
          badge: d.badge,
          e4Index: typeof d.e4Index === "number" ? d.e4Index : undefined,
          leader: d.leader,
        };
        if (kind !== "wild") {
          push(kind === "gym" ? `Gym challenge — ${d.leader || name}` : `Elite Four — ${d.leader || name}`);
        } else {
          // Honest wilds: do NOT auto-add to party. Catch only in battle when catchable.
          push(`A wild ${name} appeared!`);
        }

        // Fight already clicked in iframe — open overlay in-place (no tab switch / no scene race).
        setScene(null);
        setPendingWild(null);
        setBattleFoe({
          name: pending.name,
          level: pending.level,
          kind: pending.kind || "wild",
          catchable: pending.catchable !== false,
          badge: pending.badge,
          e4Index: pending.e4Index,
          leader: pending.leader,
        });
        setBattleOpen(true);
        postIframe({ type: "pv-adventure-pause" });
        return;
      }
    };
    window.addEventListener("message", onMsg);
    const onGoto = (e: Event) => {
      const dest = (e as CustomEvent).detail;
      if (dest !== "adventure") return;
      setTimeout(() => {
        postIframe({ type: "pv-adventure-resume" });
      }, 150);
    };
    window.addEventListener("pv-goto", onGoto as EventListener);
    const onGymWon = (e: Event) => {
      const badge = (e as CustomEvent).detail?.badge;
      if (!badge) return;
      postIframe({ type: "pv-adventure-badge", badge });
      push(`${badge} Badge earned!`);
    };
    const onE4Won = (e: Event) => {
      const index = (e as CustomEvent).detail?.index ?? 0;
      postIframe({ type: "pv-adventure-e4-won", index });
      push(index >= 4 ? "Champion defeated!" : `Elite Four chamber ${index + 1} cleared`);
    };
    window.addEventListener("pv-adv-gym-won", onGymWon as EventListener);
    window.addEventListener("pv-adv-elite-won", onE4Won as EventListener);
    const onCaught = (e: Event) => {
      const name = (e as CustomEvent).detail?.name;
      if (!name) return;
      postIframe({ type: "pv-adventure-caught", name });
    };
    window.addEventListener("pv-adventure-caught", onCaught as EventListener);
    return () => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener("pv-goto", onGoto as EventListener);
      window.removeEventListener("pv-adv-gym-won", onGymWon as EventListener);
      window.removeEventListener("pv-adv-elite-won", onE4Won as EventListener);
      window.removeEventListener("pv-adventure-caught", onCaught as EventListener);
    };
  }, []);

  const hudFight =
    e4 >= 5 ? "Champion" : e4 ? `Elite Four ${e4}/4` : battleOpen ? "In battle" : "Battles stay in Adventure";

  return (
    <div className="pv-adv">
      {scene?.url && !battleOpen && (
        <div className="pv-adv-scene">
          <img src={scene.url} alt={`Wild ${scene.name} scene`} className="pv-adv-scene-img" />
          <div className="pv-adv-scene-bar">
            <div>
              <div className="pv-adv-scene-kicker">
                {pendingWild?.kind === "gym"
                  ? "Gym battle"
                  : pendingWild?.kind === "elite"
                    ? "Elite Four"
                    : pendingWild?.kind === "champion"
                      ? "Champion"
                      : "Wild encounter"}
              </div>
              <div className="pv-adv-scene-name">
                {pendingWild?.leader ? `${pendingWild.leader} · ${scene.name}` : scene.name}
              </div>
            </div>
            {pendingWild && (
              <button className="pv-adv-battle" onClick={() => goBattle(pendingWild)}>
                Battle
              </button>
            )}
          </div>
        </div>
      )}

      <div className="pv-adv-stage">
        {frameBlocked ? (
          <div className="pv-adv-blocked">
            <div className="pv-adv-blocked-title">Adventure couldn&apos;t load in-app</div>
            <p>Open it full-screen to play.</p>
            <a className="pv-adv-battle" href="/adventure.html" target="_blank" rel="noreferrer">
              Launch Adventure
            </a>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src="/adventure.html"
            title="Pokémon Adventure"
            className={`pv-adv-frame${battleOpen ? " pv-adv-frame-paused" : ""}`}
            allow="autoplay"
            style={battleOpen ? { pointerEvents: "none" } : undefined}
            onLoad={() => {
              // Same-origin iframe: never blank the overworld on a slow first paint.
              try {
                const doc = iframeRef.current?.contentDocument;
                if (doc && doc.body && doc.body.childElementCount === 0 && !doc.getElementById("game")) {
                  setFrameBlocked(true);
                }
              } catch {
                /* cross-origin still paints the iframe — leave it */
              }
            }}
          />
        )}

        {battleOpen && battleFoe && (
          <div className="pv-adv-battle-overlay" role="dialog" aria-label="Adventure battle">
            <GBBattleSession
              key={`${battleFoe.name}-${battleFoe.level}-${battleFoe.kind || "wild"}-${battleFoe.e4Index ?? ""}`}
              foe={battleFoe}
              onDone={closeBattle}
            />
          </div>
        )}
      </div>

      <div className="pv-adv-toasts">
        {toasts.map((t) => (
          <div key={t.key} className="pv-adv-toast">
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
