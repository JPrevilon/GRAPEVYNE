import { describe, expect, it } from "vitest";

import type { CellarEntry, Wine } from "@/types/domain";

import { buildCellarGroups, sortCellarEntries } from "./cellarOrganization";

const wine: Wine = {
  acidity: null,
  averageRating: null,
  body: null,
  country: null,
  createdAt: null,
  description: null,
  externalApiId: "catalog-wine",
  externalWineId: "catalog-wine",
  id: 1,
  imageUrl: null,
  name: "Catalog Wine",
  occasion: null,
  pairings: [],
  priceCents: null,
  region: null,
  servingTemp: null,
  source: "mock",
  sweetness: null,
  tastingNotes: [],
  updatedAt: null,
  varietal: null,
  vintage: null,
  winery: null,
};

function entry(
  id: number,
  overrides: Partial<CellarEntry> = {},
): CellarEntry {
  return {
    createdAt: `2026-01-0${id}T12:00:00Z`,
    favorite: false,
    id,
    location: null,
    memoryTitle: null,
    notes: null,
    occasion: null,
    openedWith: null,
    pairing: null,
    savedAt: `2026-01-0${id}T12:00:00Z`,
    status: "saved",
    tags: [],
    tastedOn: null,
    updatedAt: `2026-01-0${id}T12:00:00Z`,
    userId: 7,
    userRating: null,
    wine: { ...wine, id, name: `Wine ${id}` },
    wineId: id,
    wouldBuyAgain: null,
    ...overrides,
  };
}

describe("persisted cellar organization", () => {
  it("derives every group from explicit saved values and preserves exact membership", () => {
    const entries = [
      entry(1, {
        favorite: true,
        occasion: "date night",
        pairing: "Mushroom risotto",
        userRating: 5,
        wouldBuyAgain: true,
      }),
      entry(2, {
        occasion: "birthday",
        status: "wishlist",
        userRating: 5,
      }),
      entry(3, {
        occasion: "Anniversary dinner",
        pairing: "Roast chicken",
        status: "buy_again",
        userRating: 2,
      }),
      entry(4, { favorite: true, wouldBuyAgain: false }),
    ];

    const groups = Object.fromEntries(
      buildCellarGroups(entries).map((group) => [
        group.id,
        group.entries.map(({ id }) => id),
      ]),
    );

    expect(groups).toMatchObject({
      all: [4, 3, 2, 1],
      "buy-again": [3, 1],
      celebrations: [2],
      "date-night": [1],
      "dinner-pairings": [3],
      favorites: [4, 1],
      "highest-rated": [2, 1],
      recent: [4, 3, 2, 1],
      wishlist: [2],
    });
    expect(groups["buy-again"]).not.toContain(4);
    expect(groups.celebrations).not.toContain(3);
  });

  it("omits empty inferred groups instead of inventing membership", () => {
    const groups = buildCellarGroups([entry(1)]);

    expect(groups.map(({ id }) => id)).toEqual(["all", "recent"]);
    expect(groups.every(({ entries }) => entries.length > 0)).toBe(true);
  });

  it("sorts deterministically using only persisted dates, ratings, and names", () => {
    const entries = [
      entry(1, { tastedOn: "2026-01-08", userRating: 3 }),
      entry(2, {
        tastedOn: "2026-01-09",
        userRating: 5,
        wine: { ...wine, id: 2, name: "Zinfandel" },
      }),
      entry(3, {
        tastedOn: null,
        userRating: 5,
        wine: { ...wine, id: 3, name: "Albariño" },
      }),
    ];

    expect(sortCellarEntries(entries, "rating").map(({ id }) => id)).toEqual([
      3, 2, 1,
    ]);
    expect(sortCellarEntries(entries, "tasted").map(({ id }) => id)).toEqual([
      2, 1, 3,
    ]);
    expect(sortCellarEntries(entries, "wine-name").map(({ id }) => id)).toEqual([
      3, 1, 2,
    ]);
  });
});
