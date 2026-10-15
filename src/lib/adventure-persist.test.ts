import { describe, expect, it } from "bun:test";
import { getDefaultAdventureState, updatePlayerLocation, loadAdventureState } from "./adventure-engine";

describe("updatePlayerLocation persist option", () => {
  it("skips the save when persist is false, saves by default", () => {
    const s = getDefaultAdventureState();
    const before = JSON.stringify(loadAdventureState().world.playerCoords);
    updatePlayerLocation(s, { xPct: 11, yPct: 22 }, 5, undefined, { persist: false });
    expect(JSON.stringify(loadAdventureState().world.playerCoords)).toBe(before);
    updatePlayerLocation(s, { xPct: 11, yPct: 22 }, 5);
    expect(loadAdventureState().world.playerCoords).toEqual({ xPct: 11, yPct: 22 });
  });
});
