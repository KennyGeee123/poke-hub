/**
 * Analog movement model for the Adventure joystick (Pokémon GO-style feel).
 * Pure functions — no DOM — so the feel can be unit tested and tuned.
 */
export type Vec2 = { x: number; y: number };

export const MOTION = {
  /** Radial deadzone as a fraction of stick radius. */
  deadzone: 0.12,
  /** Response curve exponent (>1 = finer control near centre). */
  curve: 1.6,
  /** Time to reach full speed from rest (s). */
  accelSec: 0.22,
  /** Time to coast to a stop after release (s). */
  decelSec: 0.16,
  /** Camera follow half-life (s). */
  cameraHalfLife: 0.09,
} as const;

/** Raw stick offset (px) → unit-disc vector with radial deadzone + response curve. */
export function stickToVector(dx: number, dy: number, radius: number, deadzone: number = MOTION.deadzone, curve: number = MOTION.curve): Vec2 {
  if (!(radius > 0)) return { x: 0, y: 0 };
  const len = Math.hypot(dx, dy);
  const mag = Math.min(1, len / radius);
  if (mag <= deadzone || len === 0) return { x: 0, y: 0 };
  // Rescale so output ramps from 0 at the deadzone edge to 1 at the rim.
  const t = (mag - deadzone) / (1 - deadzone);
  const out = Math.pow(t, curve);
  return { x: (dx / len) * out, y: (dy / len) * out };
}

/** Keyboard state → unit vector (diagonals normalised so they are not √2 faster). */
export function keysToVector(up: boolean, down: boolean, left: boolean, right: boolean): Vec2 {
  const x = (right ? 1 : 0) - (left ? 1 : 0);
  const y = (down ? 1 : 0) - (up ? 1 : 0);
  const len = Math.hypot(x, y);
  return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
}

/** Clamp any vector into the unit disc. */
export function clampUnit(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  return len > 1 ? { x: v.x / len, y: v.y / len } : v;
}

/**
 * Move velocity toward target with separate accel/decel rates (units/s²
 * derived from time-to-full). Frame-rate independent for any dt.
 */
export function stepVelocity(v: Vec2, target: Vec2, dt: number, accelSec: number = MOTION.accelSec, decelSec: number = MOTION.decelSec): Vec2 {
  if (dt <= 0) return v;
  const dx = target.x - v.x;
  const dy = target.y - v.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return v;
  const speeding = Math.hypot(target.x, target.y) >= Math.hypot(v.x, v.y);
  const rate = 1 / Math.max(1e-3, speeding ? accelSec : decelSec);
  const step = Math.min(dist, rate * dt);
  const nx = v.x + (dx / dist) * step;
  const ny = v.y + (dy / dist) * step;
  // Snap tiny residuals to zero so we stop emitting moves.
  if (Math.hypot(target.x, target.y) === 0 && Math.hypot(nx, ny) < 1e-3) return { x: 0, y: 0 };
  return { x: nx, y: ny };
}

/** Exponential ease of a value toward 0 with a half-life (camera follow). */
export function easeToward(current: number, target: number, dt: number, halfLife: number = MOTION.cameraHalfLife): number {
  if (halfLife <= 0) return target;
  const k = 1 - Math.pow(0.5, dt / halfLife);
  const next = current + (target - current) * k;
  return Math.abs(next - target) < 0.05 ? target : next;
}

/** GO-style throw rating from the shrinking target ring (scale 1 = biggest). */
export function throwRating(ringScale: number): "nice" | "great" | "excellent" {
  if (ringScale <= 0.42) return "excellent";
  if (ringScale <= 0.7) return "great";
  return "nice";
}

/** Total signed turning (radians) along a pointer path — used to detect a curveball spin. */
export function pathTurn(points: Vec2[]): number {
  let total = 0;
  for (let i = 2; i < points.length; i++) {
    const a = Math.atan2(points[i - 1].y - points[i - 2].y, points[i - 1].x - points[i - 2].x);
    const b = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    total += d;
  }
  return total;
}

/** GO-style map camera tilt (applied in CSS on the world layers). */
export const MAP_TILT = { deg: 34, scale: 1.4, perspective: 900 } as const;

/** Forward-project a flat map offset (px from centre) through the tilt camera. */
export function tiltProject(x: number, y: number, t: { deg: number; scale: number; perspective: number } = MAP_TILT): Vec2 {
  const th = (t.deg * Math.PI) / 180;
  const P = t.perspective;
  const xs = x * t.scale;
  const ys = y * t.scale;
  const f = P / (P - ys * Math.sin(th));
  return { x: xs * f, y: ys * Math.cos(th) * f };
}

/** Invert a screen tap (px from centre) back onto the flat map plane. */
export function untiltPoint(sx: number, sy: number, t: { deg: number; scale: number; perspective: number } = MAP_TILT): Vec2 {
  const th = (t.deg * Math.PI) / 180;
  const P = t.perspective;
  const ys = (sy * P) / (P * Math.cos(th) + sy * Math.sin(th));
  const xs = (sx * (P - ys * Math.sin(th))) / P;
  return { x: xs / t.scale, y: ys / t.scale };
}
