import { useEffect, useRef, useState } from "react";

type Track = { title: string; slug: string };
type EraPlaylist = { id: string; name: string; emoji: string; tracks: Track[] };

const radioUrl = (slug: string, format: "mp3" | "ogg" = "mp3") =>
  `/api/public/poke-radio?track=${encodeURIComponent(slug)}&format=${format}`;

const PLAYLISTS: EraPlaylist[] = [
  {
    id: "dpp", name: "Sinnoh (D/P/Pt)", emoji: "💎",
    tracks: [
      { title: "Trainer Battle", slug: "dpp-trainer" },
      { title: "Rival Battle", slug: "dpp-rival" },
    ],
  },
  {
    id: "hgss", name: "Johto / Kanto (HG/SS)", emoji: "🔔",
    tracks: [
      { title: "Johto Trainer", slug: "hgss-johto-trainer" },
      { title: "Kanto Trainer", slug: "hgss-kanto-trainer" },
    ],
  },
  {
    id: "bw", name: "Unova (B/W)", emoji: "⚫",
    tracks: [
      { title: "Trainer Battle", slug: "bw-trainer" },
      { title: "Rival Battle", slug: "bw-rival" },
      { title: "Subway Trainer", slug: "bw-subway-trainer" },
    ],
  },
  {
    id: "bw2", name: "Unova (B2/W2)", emoji: "🟣",
    tracks: [
      { title: "Rival Battle", slug: "bw2-rival" },
      { title: "Kanto Gym Leader", slug: "bw2-kanto-gym-leader" },
      { title: "Homika & Koffing", slug: "bw2-homika-dogars" },
    ],
  },
  {
    id: "xy", name: "Kalos (X/Y)", emoji: "🔷",
    tracks: [
      { title: "Trainer Battle", slug: "xy-trainer" },
      { title: "Rival Battle", slug: "xy-rival" },
    ],
  },
  {
    id: "oras", name: "Hoenn (OR/AS)", emoji: "🟢",
    tracks: [
      { title: "Trainer Battle", slug: "oras-trainer" },
      { title: "Rival Battle", slug: "oras-rival" },
    ],
  },
  {
    id: "sm", name: "Alola (S/M)", emoji: "🌞",
    tracks: [
      { title: "Trainer Battle", slug: "sm-trainer" },
      { title: "Rival Battle (Hau)", slug: "sm-rival" },
    ],
  },
  {
    id: "spinoff", name: "Spin-offs", emoji: "✨",
    tracks: [
      { title: "Colosseum — Miror B.", slug: "colosseum-miror-b" },
      { title: "XD — Miror B.", slug: "xd-miror-b" },
      { title: "Smogon — Elite Four Mix", slug: "spl-elite4" },
    ],
  },
];

export function MusicPlayer() {
  const [open, setOpen] = useState(false);
  const [eraIdx, setEraIdx] = useState(0);
  const [trackIdx, setTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [volume, setVolume] = useState(40);
  const [errored, setErrored] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<{ slug: string; format: "mp3" | "ogg" } | null>(null);

  const era = PLAYLISTS[eraIdx];
  const track = era.tracks[trackIdx];

  // Restore prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pv-music");
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.eraIdx === "number" && PLAYLISTS[p.eraIdx]) setEraIdx(p.eraIdx);
        if (typeof p.volume === "number") setVolume(Math.max(0, Math.min(100, p.volume)));
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("pv-music", JSON.stringify({ eraIdx, volume }));
  }, [eraIdx, volume]);

  // Create audio element once
  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    a.loop = false;
    a.crossOrigin = "anonymous";
    a.volume = volume / 100;
    audioRef.current = a;

    const onPlay = () => { setPlaying(true); setLoading(false); setErrored(false); };
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      setTrackIdx((i) => (i + 1) % PLAYLISTS[eraIdxRef.current].tracks.length);
    };
    const onWait = () => setLoading(true);
    const onCan = () => setLoading(false);
    const onErr = () => {
      const current = sourceRef.current;
      if (current?.format === "mp3" && audioRef.current) {
        sourceRef.current = { slug: current.slug, format: "ogg" };
        audioRef.current.src = radioUrl(current.slug, "ogg");
        audioRef.current.load();
        audioRef.current.play().catch(() => { setErrored(true); setLoading(false); setPlaying(false); });
        return;
      }
      setErrored(true); setLoading(false); setPlaying(false);
      sourceRef.current = null;
    };

    a.addEventListener("play", onPlay);
    a.addEventListener("playing", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    a.addEventListener("waiting", onWait);
    a.addEventListener("canplay", onCan);
    a.addEventListener("error", onErr);

    return () => {
      a.pause();
      a.removeEventListener("play", onPlay);
      a.removeEventListener("playing", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("waiting", onWait);
      a.removeEventListener("canplay", onCan);
      a.removeEventListener("error", onErr);
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track current era index in a ref so the 'ended' handler always reads fresh value
  const eraIdxRef = useRef(eraIdx);
  useEffect(() => { eraIdxRef.current = eraIdx; }, [eraIdx]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // Swap source when track changes (only auto-play if currently playing)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const wasPlaying = playing;
    setErrored(false);
    sourceRef.current = { slug: track.slug, format: "mp3" };
    a.src = radioUrl(track.slug);
    a.load();
    if (wasPlaying) {
      setLoading(true);
      a.play().catch(() => setErrored(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eraIdx, trackIdx]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      sourceRef.current = { slug: track.slug, format: "mp3" };
      a.src = radioUrl(track.slug);
      a.load();
      setLoading(true);
      setErrored(false);
      a.play().catch(() => { setErrored(true); setLoading(false); });
    } else {
      a.pause();
    }
  };
  const next = () => setTrackIdx((i) => (i + 1) % era.tracks.length);
  const prev = () => setTrackIdx((i) => (i - 1 + era.tracks.length) % era.tracks.length);
  const pickEra = (i: number) => { setEraIdx(i); setTrackIdx(0); };
  const pickTrack = (i: number) => {
    setTrackIdx(i);
    // ensure playback starts (user gesture)
    setTimeout(() => {
      const a = audioRef.current; if (!a) return;
      setLoading(true); setErrored(false);
      a.play().catch(() => { setErrored(true); setLoading(false); });
    }, 0);
  };

  return (
    <>
      <button
        className={`pv-music-fab ${playing ? "spin" : ""}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Pokémon music player"
        title="Poké Radio"
      />

      {open && (
        <div className="pv-music-panel" role="dialog" aria-label="Poké Radio">
          <div className="pv-music-head">
            <div className="pv-music-title">
              <span className="pv-pokeball" style={{ width: 18, height: 18 }} aria-hidden />
              <span>POKÉ RADIO</span>
            </div>
            <button className="pv-music-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>

          <div className="pv-music-eras hide-scroll">
            {PLAYLISTS.map((p, i) => (
              <button
                key={p.id}
                className={`pv-music-era ${i === eraIdx ? "on" : ""}`}
                onClick={() => pickEra(i)}
                title={p.name}
              >
                <span>{p.emoji}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>

          <div className="pv-music-now">
            <div className="pv-music-now-era">{era.emoji} {era.name}</div>
            <div className="pv-music-now-title">
              {track.title}
              {loading && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--t3)" }}>loading…</span>}
            </div>
            <div className="pv-music-now-sub">
              Track {trackIdx + 1} / {era.tracks.length}
              {errored && <span style={{ color: "#ef4444", marginLeft: 8 }}>• failed to load</span>}
            </div>
          </div>

          <div className="pv-music-ctrls">
            <button onClick={prev} aria-label="Previous">⏮</button>
            <button className="pv-music-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {loading ? "…" : playing ? "⏸" : "▶"}
            </button>
            <button onClick={next} aria-label="Next">⏭</button>
          </div>

          <div className="pv-music-vol">
            <span>🔈</span>
            <input
              type="range" min={0} max={100} value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              aria-label="Volume"
            />
            <span style={{ width: 26, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{volume}</span>
          </div>

          <div className="pv-music-list hide-scroll">
            {era.tracks.map((t, i) => (
              <button
                key={t.slug}
                className={`pv-music-row ${i === trackIdx ? "on" : ""}`}
                onClick={() => pickTrack(i)}
              >
                <span className="pv-music-row-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="pv-music-row-t">{t.title}</span>
                {i === trackIdx && <span className="pv-music-row-on">{playing ? "♫" : "•"}</span>}
              </button>
            ))}
          </div>

          <div className="pv-music-foot">
            Battle music streamed from Pokémon Showdown's public audio CDN.
          </div>
        </div>
      )}
    </>
  );
}
