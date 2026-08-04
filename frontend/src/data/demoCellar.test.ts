import { describe, expect, it } from "vitest";

import {
  demoCellarBottles,
  demoCellarSections,
  searchDemoCellar,
} from "./demoCellar";

describe("isolated public demo cellar fixtures", () => {
  it("contains the original 11 uniquely identified fictional bottles", () => {
    expect(demoCellarSections).toHaveLength(5);
    expect(demoCellarBottles).toHaveLength(11);
    expect(new Set(demoCellarBottles.map((bottle) => bottle.cellarEntryId)).size).toBe(11);
    expect(demoCellarBottles.every((bottle) => bottle.wineId.startsWith("demo-wine-"))).toBe(true);
    expect(demoCellarBottles.every((bottle) => bottle.cellarEntryId.startsWith("demo-entry-"))).toBe(true);
  });

  it("searches only the demo fixture deterministically and case-insensitively", () => {
    expect(searchDemoCellar("RIOJA").map((bottle) => bottle.name)).toEqual([
      "Gran Reserva Rioja",
    ]);
    expect(searchDemoCellar("not-a-demo-wine")).toEqual([]);
  });
});
