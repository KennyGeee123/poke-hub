import { describe, expect, it } from "bun:test";
import { stickToVector, keysToVector, stepVelocity, easeToward, throwRating, pathTurn, clampUnit } from "./adventure-motion";

describe("adventure motion", () => {
  it("deadzone swallows tiny stick offsets", () => {
    expect(stickToVector(3, 2, 50)).toEqual({ x: 0, y: 0 });
  });
  it("full deflection is magnitude 1 and clamps past the rim", () => {
    const v = stickToVector(200, 0, 50);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
  });
  it("partial deflection is analog and below 1", () => {
    const m = Math.hypot(...Object.values(stickToVector(20, 20, 50)) as [number, number]);
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThan(1);
  });
  it("keyboard diagonals are normalised", () => {
    const v = keysToVector(true, false, false, true);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(keysToVector(true, true, false, false)).toEqual({ x: 0, y: 0 });
  });
  it("accelerates over ~accelSec regardless of frame rate", () => {
    const run = (hz: number) => {
      let v = { x: 0, y: 0 };
      for (let i = 0; i < hz * 0.11; i++) v = stepVelocity(v, { x: 1, y: 0 }, 1 / hz, 0.22, 0.16);
      return v.x;
    };
    expect(run(60)).toBeCloseTo(run(120), 1);
    expect(run(60)).toBeGreaterThan(0.4);
    expect(run(60)).toBeLessThan(0.6);
  });
  it("decelerates to an exact stop", () => {
    let v = { x: 1, y: 0 };
    for (let i = 0; i < 30; i++) v = stepVelocity(v, { x: 0, y: 0 }, 1 / 60);
    expect(v).toEqual({ x: 0, y: 0 });
  });
  it("camera ease converges and snaps", () => {
    let c = 100;
    for (let i = 0; i < 120; i++) c = easeToward(c, 0, 1 / 60);
    expect(c).toBe(0);
  });
  it("throw ratings by ring size", () => {
    expect(throwRating(0.3)).toBe("excellent");
    expect(throwRating(0.6)).toBe("great");
    expect(throwRating(0.95)).toBe("nice");
  });
  it("detects spin for curveballs", () => {
    const pts = Array.from({ length: 40 }, (_, i) => ({ x: Math.cos(i / 4) * 30, y: Math.sin(i / 4) * 30 }));
    expect(Math.abs(pathTurn(pts))).toBeGreaterThan(Math.PI * 2);
    expect(Math.abs(pathTurn([{ x: 0, y: 0 }, { x: 0, y: -10 }, { x: 0, y: -20 }]))).toBe(0);
  });
  it("clampUnit", () => {
    expect(Math.hypot(...Object.values(clampUnit({ x: 3, y: 4 })) as [number, number])).toBeCloseTo(1);
  });
});

import { tiltProject, untiltPoint } from "./adventure-motion";
describe("tilt camera", () => {
  it("untilt inverts the projection", () => {
    for (const [x, y] of [[0, 0], [120, -200], [-80, 160], [200, 250]]) {
      const s = tiltProject(x, y);
      const back = untiltPoint(s.x, s.y);
      expect(back.x).toBeCloseTo(x, 4);
      expect(back.y).toBeCloseTo(y, 4);
    }
  });
});
