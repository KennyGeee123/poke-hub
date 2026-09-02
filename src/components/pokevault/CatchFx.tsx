import { useEffect, useState } from "react";

export type CatchPhase = "throw" | "shake" | "caught" | "broke";

const VIDEO: Record<CatchPhase, string> = {
  throw: "/fx/ball-throw.mp4",
  shake: "",
  caught: "/fx/ball-caught.mp4",
  broke: "/fx/ball-broke.mp4",
};

export function CatchFx({ phase }: { phase: CatchPhase | null }) {
  const [videoOk, setVideoOk] = useState(true);
  useEffect(() => { setVideoOk(true); }, [phase]);
  if (!phase) return null;
  const src = VIDEO[phase];
  return (
    <div className={`pv-catch pv-catch-${phase}`} aria-hidden>
      {src && videoOk && (
        <video
          className="pv-catch-video"
          src={src}
          autoPlay
          muted
          playsInline
          onError={() => setVideoOk(false)}
        />
      )}
      <div className="pv-ball-wrap">
        <div className="pv-ball">
          <div className="pv-ball-top" />
          <div className="pv-ball-band" />
          <div className="pv-ball-btn" />
        </div>
      </div>
      {phase === "caught" && <div className="pv-catch-stars" />}
      {phase === "caught" && <div className="pv-catch-label">GOTCHA!</div>}
      {phase === "broke" && <div className="pv-catch-burst" />}
    </div>
  );
}
