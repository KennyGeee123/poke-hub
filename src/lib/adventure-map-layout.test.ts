import { describe, expect, it } from "bun:test";
import { declutter } from "./adventure-map-layout";

describe("declutter", () => {
  it("leaves spaced markers alone", () => {
    const r = declutter([{ id: "a", x: 0, y: 0 }, { id: "b", x: 200, y: 0 }]);
    expect(r.a).toEqual({ dx: 0, dy: 0 });
    expect(r.b).toEqual({ dx: 0, dy: 0 });
  });
  it("separates overlapping and stacked markers to >= minDist", () => {
    const pts = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 10, y: 5 }, { id: "c", x: 10, y: 5 }];
    const r = declutter(pts, 60, 20);
    const pos = pts.map((p) => ({ x: p.x + r[p.id].dx, y: p.y + r[p.id].dy }));
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++)
        expect(Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y)).toBeGreaterThan(55);
  });
  it("is deterministic regardless of input order", () => {
    const a = declutter([{ id: "x", x: 0, y: 0 }, { id: "y", x: 3, y: 0 }]);
    const b = declutter([{ id: "y", x: 3, y: 0 }, { id: "x", x: 0, y: 0 }]);
    expect(a).toEqual(b);
  });
});
