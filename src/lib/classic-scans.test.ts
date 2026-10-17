import { describe, expect, it } from "bun:test";
import {
  scrydexClassicImages,
  scrydexImagesForId,
  scrydexScanUrls,
  scrydexSetCandidates,
  classicScrydexCatalog,
} from "./classic-scans";

describe("classic Scrydex ids", () => {
  it("maps all 30 prints, and the shared numbers stay on the right card", () => {
    const rows = classicScrydexCatalog();
    expect(rows).toHaveLength(30);
    expect(new Set(rows.map((r) => r.scrydexId)).size).toBe(30);
    expect(scrydexClassicImages("30th-c-001")?.scrydexId).toBe("me55c-4");
    expect(scrydexClassicImages("30th-c-1")?.scrydexId).toBe("me55c-4");
    expect(scrydexClassicImages("me55c-4")?.scrydexId).toBe("me55c-4");
    // 11 is Metagross. 11g is Genesect EX. Do not collapse them.
    expect(scrydexClassicImages("30th-c-003")?.scrydexId).toBe("me55c-11");
    expect(scrydexClassicImages("30th-c-004")?.scrydexId).toBe("me55c-11g");
    expect(scrydexClassicImages("me55c-11g")?.large).toContain("/me55c-11g/large");
    // 106 Celebi, 106m Gardevoir, 106p Palkia.
    expect(scrydexClassicImages("30th-c-022")?.scrydexId).toBe("me55c-106p");
    expect(scrydexClassicImages("30th-c-023")?.scrydexId).toBe("me55c-106m");
    expect(scrydexClassicImages("30th-c-024")?.scrydexId).toBe("me55c-106");
    expect(scrydexClassicImages("30th-c-026")?.scrydexId).toBe("me55c-114");
    expect(scrydexClassicImages("30th-c-030")?.small).toBe(
      "https://images.scrydex.com/pokemon/me55c-203/medium",
    );
    expect(scrydexClassicImages("30th-148")).toBeNull();
  });
});

describe("Scrydex ids for the rest of the box sets", () => {
  it("uses the pokemontcg set id, not the TCGdex pad", () => {
    expect(scrydexSetCandidates("sv08")).toEqual(["sv8"]);
    expect(scrydexSetCandidates("sv10.5b")[0]).toBe("zsv10pt5");
    expect(scrydexSetCandidates("sv10pt5b")[0]).toBe("zsv10pt5");
    expect(scrydexSetCandidates("sv10.5w")[0]).toBe("rsv10pt5");
    expect(scrydexScanUrls("sv10.5b", "3", "sv10.5b-3", true)[0]).toBe(
      "https://images.scrydex.com/pokemon/zsv10pt5-3/medium",
    );
    expect(scrydexSetCandidates("30th")).toEqual(["me55"]);
    expect(scrydexSetCandidates("30th-c")).toEqual([]);
    expect(scrydexSetCandidates("sm7.5")).toContain("sm75");
    expect(scrydexSetCandidates("sv03.5")).toContain("sv3pt5");
    expect(scrydexScanUrls("sv08", "001", "sv08-001", true)[0]).toBe(
      "https://images.scrydex.com/pokemon/sv8-1/medium",
    );
    expect(scrydexScanUrls("30th", "148", "30th-148", true)).toContain(
      "https://images.scrydex.com/pokemon/me55-148/medium",
    );
    expect(scrydexScanUrls("30th-c", "004", "30th-c-004", true)).toEqual([]);
    expect(scrydexImagesForId("30th-148", "30th", "148")?.scrydexId).toBe("me55-148");
    expect(scrydexImagesForId("30th-c-004", "30th-c", "004")?.scrydexId).toBe("me55c-11g");
    expect(scrydexImagesForId("sv08-001", "sv08", "001")?.small).toBe(
      "https://images.scrydex.com/pokemon/sv8-1/medium",
    );
    expect(scrydexScanUrls("swsh4.5sv", "SV001", "swsh45sv-SV001", true)[0]).toContain(
      "swsh45sv-SV001/medium",
    );
  });
});
