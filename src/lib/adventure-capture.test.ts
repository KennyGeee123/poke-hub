import { describe, expect, it } from "bun:test";
import {
  getDefaultAdventureState,
  attemptCapture,
  captureProbability,
  CURVEBALL_MULTIPLIER,
  THROW_MULTIPLIERS,
} from "./adventure-engine";

function setup(rate: number) {
  const s = getDefaultAdventureState();
  const c = { ...s.wildCreatures[0], id: "cap-test", baseCatchRate: rate };
  s.wildCreatures = [c];
  s.inventory.captureItems.poke_ball = 5;
  return s;
}

describe("captureProbability", () => {
  it("applies throw tiers in order", () => {
    const n = captureProbability(0.2, 1, 1, "nice", false);
    const g = captureProbability(0.2, 1, 1, "great", false);
    const e = captureProbability(0.2, 1, 1, "excellent", false);
    expect(n).toBeCloseTo(0.2 * THROW_MULTIPLIERS.nice);
    expect(g).toBeGreaterThan(n);
    expect(e).toBeGreaterThan(g);
  });
  it("applies the curveball bonus exactly once", () => {
    expect(captureProbability(0.2, 1, 1, "nice", true)).toBeCloseTo(0.2 * CURVEBALL_MULTIPLIER);
    expect(captureProbability(0.2, 1.5, 1, "great", true)).toBeCloseTo(
      0.2 * 1.5 * 1.3 * CURVEBALL_MULTIPLIER,
    );
  });
  it("clamps to [0, 1]", () => {
    expect(captureProbability(0.9, 2, 2.5, "excellent", true)).toBe(1);
    expect(captureProbability(-0.5, 1, 1, "nice", false)).toBe(0);
    expect(captureProbability(Number.NaN, 1, 1, "nice", false)).toBe(0);
    expect(captureProbability(Infinity, 1, 1, "nice", false)).toBe(1);
  });
});

describe("attemptCapture with injected rng", () => {
  it("catches when rng is below the rate and escapes at/above it", () => {
    expect(attemptCapture(setup(0.5), "cap-test", "poke_ball", undefined, "nice", { rng: () => 0.49 }).success).toBe(true);
    expect(attemptCapture(setup(0.5), "cap-test", "poke_ball", undefined, "nice", { rng: () => 0.5 }).success).toBe(false);
  });
  it("curveball turns a borderline miss into a catch", () => {
    const rng = () => 0.55; // 0.5 nice = 0.5 (miss); with curve = 0.65 (catch)
    expect(attemptCapture(setup(0.5), "cap-test", "poke_ball", undefined, "nice", { rng }).success).toBe(false);
    expect(attemptCapture(setup(0.5), "cap-test", "poke_ball", undefined, "nice", { rng, curveball: true }).success).toBe(true);
  });
  it("a 0% rate never succeeds even if rng returns 0", () => {
    expect(attemptCapture(setup(0), "cap-test", "poke_ball", undefined, "excellent", { rng: () => 0, curveball: true }).success).toBe(false);
  });
  it("consumes a ball on a miss and keeps the creature", () => {
    const res = attemptCapture(setup(0.1), "cap-test", "poke_ball", undefined, "nice", { rng: () => 0.99 });
    expect(res.success).toBe(false);
    expect(res.state.inventory.captureItems.poke_ball).toBe(4);
    expect(res.state.wildCreatures.some((c) => c.id === "cap-test")).toBe(true);
  });
  it("fails without consuming anything when out of balls", () => {
    const s = setup(1);
    s.inventory.captureItems.poke_ball = 0;
    expect(attemptCapture(s, "cap-test", "poke_ball", undefined, "excellent", { rng: () => 0 }).success).toBe(false);
  });
});
