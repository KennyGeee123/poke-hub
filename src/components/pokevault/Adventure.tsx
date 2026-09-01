import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchCards } from "@/lib/pokemon-api";
import { addToParty, saveMonStats, fetchParty } from "@/lib/gbgame";
import { movesAtLevel } from "@/lib/pokeapi-moves";
import { generateHiggsfieldImage, pollHiggsfieldImage } from "@/lib/higgsfield.functions";

type Toast = { msg: string; key: number };
type Scene = { name: string; url?: string; loading: boolean; error?: string; pending?: boolean };

export function AdventureView() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [scene, setScene] = useState<Scene | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sceneCache = useRef<Map<string, string>>(new Map());
  const higgsfield = useServerFn(generateHiggsfieldImage);
  const pollScene = useServerFn(pollHiggsfieldImage);

  function push(msg: string) {
    const key = Date.now() + Math.random();
    setToasts((t) => [...t, { msg, key }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), 3200);
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
        `A wild ${name} appears in a lush pixel-art diorama scene, ` +
        `16-bit retro JRPG cinematic, tall grass, dramatic lighting, ` +
        `tilt-shift miniature world, vibrant Pokémon adventure, ` +
        `sharp pixels, painterly background, no text.`;
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
      if (!d || typeof d.name !== "string") return;

      if (d.type === "pv-adventure-encounter") {
        const name: string = d.name;
        // Kick off Higgsfield diorama art immediately
        renderScene(name);

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
              const mon = await addToParty(card, 5);
              try {
                const real = await movesAtLevel(name, 5, mon.attacks);
                if (real.length) { mon.attacks = real; await saveMonStats(mon); }
              } catch {}
              push(`✦ ${name} joined your party!`);
            }
          }
        } catch (err: any) {
          console.error(err);
        }

        window.dispatchEvent(new CustomEvent("pv-goto", { detail: "gb" }));
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("pv-gb-wild", { detail: { name, level: 5 + Math.floor(Math.random() * 4) } })
          );
        }, 250);
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
    return () => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener("pv-goto", onGoto as EventListener);
    };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12, color: "var(--t2)", fontSize: 13, textAlign: "center" }}>
        Explore Kanto → Unova, walk through tall grass, and <b>Fight</b> wild Pokémon to enlist them
        into your <b>Game Boy party</b> with their real moves.
      </div>

      {scene && (
        <div
          style={{
            width: "100%",
            maxWidth: 780,
            margin: "0 auto 12px",
            border: "2px solid var(--brd)",
            borderRadius: 12,
            overflow: "hidden",
            background: "#0b0b0b",
            position: "relative",
            aspectRatio: "16 / 9",
            imageRendering: "pixelated",
          }}
        >
          {scene.url ? (
            <img
              src={scene.url}
              alt={`Wild ${scene.name} scene`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                imageRendering: "pixelated",
                animation: "pv-scene-in .5s ease-out",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                color: "#FFDE00",
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: 1,
                background:
                  "repeating-linear-gradient(45deg,#111 0 12px,#1a1a1a 12px 24px)",
              }}
            >
              {scene.loading
                ? `⌁ Rendering ${scene.name} diorama…`
                : scene.error || "scene unavailable"}
            </div>
          )}
          <div
            style={{
              position: "absolute",
              left: 10,
              bottom: 10,
              background: "rgba(0,0,0,.6)",
              color: "#FFDE00",
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid #FFDE00",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Wild {scene.name}! · Higgsfield pixel diorama
          </div>
        </div>
      )}

      <div
        style={{
          width: "100%",
          maxWidth: 780,
          margin: "0 auto",
          border: "2px solid var(--brd)",
          borderRadius: 12,
          overflow: "hidden",
          background: "#1a1a1a",
        }}
      >
        <iframe
          ref={iframeRef}
          src="/adventure.html"
          title="Pokémon Adventure"
          style={{ width: "100%", height: 540, border: 0, display: "block" }}
        />
      </div>

      <style>{`
        @keyframes pv-scene-in {
          from { opacity: 0; transform: scale(1.03); filter: blur(8px); }
          to   { opacity: 1; transform: scale(1);    filter: blur(0); }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          bottom: 18,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.key}
            style={{
              background: "linear-gradient(90deg,#5C73FF,#FFDE00)",
              color: "#111",
              fontWeight: 800,
              padding: "10px 16px",
              borderRadius: 99,
              border: "2px solid #111",
              boxShadow: "0 6px 20px rgba(0,0,0,.4)",
              fontSize: 13,
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
