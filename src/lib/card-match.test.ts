import { describe, expect, it } from "bun:test";
import { rankCardHits } from "./card-match";

const c = (id: string, name: string, number: string, printedTotal: number, setName: string, hp = "120") =>
  ({ id, name, number, hp, set: { name: setName, printedTotal } }) as any;

describe("rankCardHits", () => {
  it("picks Base Set 4/102 over newer Charizards", () => {
    const hits = [c("sv1-1", "Charizard", "25", 198, "Scarlet & Violet", "170"), c("base1-4", "Charizard", "4", 102, "Base"), c("base4-4", "Charizard", "4", 130, "Base Set 2")];
    expect(rankCardHits(hits, { name: "Charizard", hp: "120", setNumber: "4/102", setName: "Base" })[0].id).toBe("base1-4");
  });
  it("keeps API order when no hints", () => {
    const hits = [c("a", "Pikachu", "1", 10, "X"), c("b", "Pikachu", "2", 10, "Y")];
    expect(rankCardHits(hits, { name: "Pikachu" })[0].id).toBe("a");
  });
});
