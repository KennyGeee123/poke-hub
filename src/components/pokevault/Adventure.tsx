import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchCards } from "@/lib/pokemon-api";
import { addToParty, saveMonStats, fetchParty } from "@/lib/gbgame";
import { movesAtLevel } from "@/lib/pokeapi-moves";
import { generateHiggsfieldImage, pollHiggsfieldImage } from "@/lib/higgsfield.functions";

type Toast = { msg: string; key: number };
type Scene = { name: string; url?: string; loading: boolean; error?: string; pending?: boolean };
type PendingWild = {
  name: string; level: number; region?: string;
  kind?: "wild" | "gym" | "elite" | "champion";
  catchable?: boolean; badge?: string; e4Index?: number; leader?: string;
};

export function AdventureView() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [scene, setScene] = useState<Scene | null>(null);
  const [region, setRegion] = useState("Kanto");
  const [pendingWild, setPendingWild] = useState<PendingWild | null>(null);
  const [sceneVidOk, setSceneVidOk] = useState(true);
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

  function goBattle(w: PendingWild) {
    window.dispatchEvent(new CustomEvent("pv-goto", { detail: "gb" }));
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("pv-gb-wild", { detail: {
          name: w.name, level: w.level, kind: w.kind || "wild",
          catchable: w.catchable !== false, badge: w.badge, e4Index: w.e4Index, leader: w.leader,
        } })
      );
    }, 250);
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
        `Photoreal PlayStation 5 cinematic, a wild ${name} emerging from sunlit tall grass, ` +
        `AAA open-world game still, 24mm anamorphic lens, volumetric golden-hour light, ` +
        `shallow depth of field, no text, no logos, no watermark.`;
      let r = await higgsfield({ data: { prompt, width: 1024, height: 576 } });

      // Keep polling in the background instead of hanging on a spinner forever.
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
        push("Healed at the Poké Center");
        return;
      }
      if (d.type === "pv-adventure-encounter" && typeof d.name === "string") {
        const name: string = d.name;
        if (typeof d.region === "string") setRegion(d.region);
        const kind = (d.kind as PendingWild["kind"]) || "wild";
        const level = typeof d.level === "number" ? d.level : 5 + Math.floor(Math.random() * 4);
        const catchable = d.catchable !== false && kind === "wild";
        setPendingWild({ name, level, region: d.region, kind, catchable, badge: d.badge, e4Index: d.e4Index, leader: d.leader });
        renderScene(name);

        if (kind !== "wild") {
          push(kind === "gym" ? `Gym challenge — ${d.leader || name}` : `Elite Four — ${d.leader || name}`);
          return;
        }

        try {
          const party = await fetchParty();
          if (!party.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
            const { data } = await searchCards({
              q: `name:"${name}" supertype:Pokémon`,
              pageSize: 8,
              orderBy: "-set.releaseDate",
            });
            const card = data.find((c) => Number(c.hp ?? 0) > 0 && (c.attacks?.length ?? 0) > 0) ?? data[0];
            if (card) {
              try {
                const mon = await addToParty(card, 5);
                try {
                  const real = await movesAtLevel(name, 5, mon.attacks);
                  if (real.length) { mon.attacks = real; await saveMonStats(mon); }
                } catch {}
                push(`✦ ${name} joined your party!`);
              } catch (err: any) {
                console.error(err);
                push(`Wild ${name} appeared — battle in Game Boy`);
              }
            }
          }
        } catch (err: any) {
          console.error(err);
        }
        return;
      }
    };
    window.addEventListener("message", onMsg);
    const onGoto = (e: Event) => {
      const dest = (e as CustomEvent).detail;
      if (dest !== "adventure") return;
      setTimeout(() => {
        try {
          iframeRef.current?.contentWindow?.postMessage({ type: "pv-adventure-resume" }, "*");
        } catch {}
      }, 150);
    };
    window.addEventListener("pv-goto", onGoto as EventListener);
    const onGymWon = (e: Event) => {
      const badge = (e as CustomEvent).detail?.badge;
      if (!badge) return;
      try { iframeRef.current?.contentWindow?.postMessage({ type: "pv-adventure-badge", badge }, "*"); } catch {}
    };
    const onE4Won = (e: Event) => {
      const index = (e as CustomEvent).detail?.index ?? 0;
      try { iframeRef.current?.contentWindow?.postMessage({ type: "pv-adventure-e4-won", index }, "*"); } catch {}
    };
    window.addEventListener("pv-adv-gym-won", onGymWon as EventListener);
    window.addEventListener("pv-adv-elite-won", onE4Won as EventListener);
    return () => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener("pv-goto", onGoto as EventListener);
      window.removeEventListener("pv-adv-gym-won", onGymWon as EventListener);
      window.removeEventListener("pv-adv-elite-won", onE4Won as EventListener);
    };
  }, []);

  return (
    <div className="pv-adv">
      {scene && (
        <div className="pv-adv-scene">
          {sceneVidOk && (
            <video
              key={scene.name}
              className="pv-adv-scene-vid"
              src="/fx/adventure-encounter.mp4"
              autoPlay
              muted
              loop
              playsInline
              onError={() => setSceneVidOk(false)}
            />
          )}
          {(!sceneVidOk && scene.url) ? (
            <img
              src={scene.url}
              alt={`Wild ${scene.name} scene`}
              className="pv-adv-scene-img"
            />
          ) : (!sceneVidOk && !scene.url) ? (
            <div className="pv-adv-scene-ph">
              {scene.loading
                ? `Rendering ${scene.name} cinematic…`
                : scene.error || "scene unavailable"}
            </div>
          ) : null}
          <div className="pv-adv-scene-bar">
            <div>
              <div className="pv-adv-scene-kicker">{
                pendingWild?.kind === "gym" ? "Gym battle" :
                pendingWild?.kind === "elite" ? "Elite Four" :
                pendingWild?.kind === "champion" ? "Champion" : "Wild encounter"
              }</div>
              <div className="pv-adv-scene-name">{pendingWild?.leader ? `${pendingWild.leader} · ${scene.name}` : scene.name}</div>
            </div>
            {pendingWild && (
              <button
                className="pv-adv-battle"
                onClick={() => goBattle(pendingWild)}
              >
                Battle
              </button>
            )}
          </div>
        </div>
      )}

      <div className="pv-adv-stage">
        <div className="pv-adv-hud">
          <div className="pv-adv-hud-region">{region}</div>
          <div className="pv-adv-hud-badges" title="Gym badges">
            {["Boulder","Cascade","Thunder","Volcano"].map((b) => (
              <span key={b} className={badges.includes(b) ? "on" : ""}>{b[0]}</span>
            ))}
          </div>
          <div className="pv-adv-hud-hint">Gyms · Poké Center · 4 badges unlocks Indigo</div>
          <div className="pv-adv-hud-fight">{e4 >= 5 ? "Champion" : e4 ? `Elite Four ${e4}/4` : "Fight goes to Game Boy"}</div>
        </div>
        <iframe
          ref={iframeRef}
          src="/adventure.html"
          title="Pokémon Adventure"
          className="pv-adv-frame"
        />
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
