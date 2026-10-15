/**
 * Map marker declutter: nudges markers that would overlap on screen apart,
 * deterministically (same input → same layout, so markers don't jitter).
 */
export type ScreenPt = { id: string; x: number; y: number };

export function declutter(points: ScreenPt[], minDist = 64, iterations = 6): Record<string, { dx: number; dy: number }> {
  const pts = [...points].sort((a, b) => a.id.localeCompare(b.id)).map((p) => ({ ...p, ox: p.x, oy: p.y }));
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i];
        const b = pts[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < 1e-6) {
          // Exactly stacked: split along a stable angle derived from index.
          const ang = (j * 2.399963) % (Math.PI * 2);
          dx = Math.cos(ang);
          dy = Math.sin(ang);
          d = 1;
        }
        const push = (minDist - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const out: Record<string, { dx: number; dy: number }> = {};
  for (const p of pts) out[p.id] = { dx: p.x - p.ox, dy: p.y - p.oy };
  return out;
}
