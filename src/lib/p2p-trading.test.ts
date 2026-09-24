import { describe, expect, it } from "bun:test";
import { fairTradeSwap } from "./p2p-trading";

describe("Fair Trade swap", () => {
  it("calls even values FAIR within $5 or 10%", () => {
    const v = fairTradeSwap(50, 52);
    expect(v.fair).toBe(true);
    expect(v.label).toBe("FAIR");
    expect(v.youAdd).toBe(0);
  });

  it("asks you to add cash when their card is higher", () => {
    const v = fairTradeSwap(20, 80);
    expect(v.fair).toBe(false);
    expect(v.label).toBe("YOU ADD");
    expect(v.youAdd).toBe(60);
  });

  it("asks them to add cash when your card is higher", () => {
    const v = fairTradeSwap(100, 40);
    expect(v.label).toBe("THEY ADD");
    expect(v.theyAdd).toBe(60);
  });
});
