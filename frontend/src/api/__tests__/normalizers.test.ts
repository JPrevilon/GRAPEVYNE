import { describe, expect, it } from "vitest";

import {
  ApiContractError,
  normalizeCellarEntry,
  normalizeTasteProfile,
  normalizeUser,
  normalizeWine,
  normalizeWineSearch,
} from "@/api/normalizers";

const camelWine = {
  acidity: "balanced",
  averageRating: 4.6,
  body: "full",
  country: "United States",
  description: "Cassis, graphite, and cedar.",
  externalWineId: "mock-estate-cabernet-2019",
  imageUrl: "/images/wines/estate-cabernet.png",
  name: "Estate Cabernet Sauvignon",
  occasion: "steakhouse dinner",
  pairings: ["steak", "short ribs"],
  priceCents: 9500,
  region: "Calistoga",
  servingTemp: "60-65 F",
  source: "mock",
  sweetness: "dry",
  tastingNotes: ["cassis", "graphite"],
  varietal: "Cabernet Sauvignon",
  vintage: "2019",
  winery: "Chateau Montelena",
};

describe("API normalizers", () => {
  it("normalizes current camelCase wine search data without inventing an ID", () => {
    const result = normalizeWineSearch({
      query: "steak",
      results: [camelWine],
      source: "mock",
    });

    expect(result.query).toBe("steak");
    expect(result.source).toBe("mock");
    expect(result.results[0]).toMatchObject({
      body: "full",
      externalWineId: "mock-estate-cabernet-2019",
      id: null,
      priceCents: 9500,
      vintage: "2019",
    });
  });

  it("maps controlled snake_case fields while preserving numeric IDs and NV", () => {
    const wine = normalizeWine({
      acidity: "lively",
      average_rating: "4.4",
      body: "light",
      country: "France",
      description: "A crisp sparkling wine.",
      external_api_id: "mock-brut-nv",
      external_wine_id: "mock-brut-nv",
      food_pairings: ["oysters"],
      id: 14,
      image_url: "/images/wines/brut.png",
      name: "Brut Champagne",
      occasion: "celebration",
      price_cents: "6400",
      region: "Champagne",
      serving_temp: "43-48 F",
      source: "mock",
      sweetness: "brut",
      tasting_notes: "green apple, brioche",
      varietal: "Champagne Blend",
      vintage: "NV",
      winery: "Veuve Clicquot",
    });

    expect(wine.id).toBe(14);
    expect(wine.externalApiId).toBe("mock-brut-nv");
    expect(wine.vintage).toBe("NV");
    expect(wine.priceCents).toBe(6400);
    expect(wine.tastingNotes).toEqual(["green apple", "brioche"]);
    expect(wine.body).toBe("light");
  });

  it("normalizes the exact protected cellar shape and status union", () => {
    const entry = normalizeCellarEntry({
      created_at: "2026-08-01T12:00:00+00:00",
      favorite: true,
      id: 9,
      location: "Brooklyn",
      memory_title: "A dinner worth remembering",
      notes: "Open with dinner.",
      occasion: "Anniversary",
      opened_with: "Friends",
      pairing: "Short ribs",
      saved_at: "2026-08-01T12:00:00+00:00",
      status: "buy_again",
      tags: ["dinner"],
      tasted_on: "2026-07-31",
      updated_at: "2026-08-02T12:00:00+00:00",
      user_id: 3,
      user_rating: 5,
      wine: {
        ...camelWine,
        externalApiId: "mock-estate-cabernet-2019",
        id: 22,
      },
      wine_id: 22,
      would_buy_again: false,
    });

    expect(entry).toMatchObject({
      id: 9,
      memoryTitle: "A dinner worth remembering",
      openedWith: "Friends",
      pairing: "Short ribs",
      status: "buy_again",
      tastedOn: "2026-07-31",
      userId: 3,
      wouldBuyAgain: false,
      wineId: 22,
    });
    expect(entry.wine.id).toBe(22);
    expect(typeof entry.id).toBe("number");
  });

  it("preserves numeric user IDs", () => {
    expect(
      normalizeUser({
        createdAt: "2026-08-01T12:00:00+00:00",
        email: "rachel@example.com",
        id: 7,
        name: "Rachel",
        updatedAt: "2026-08-01T12:00:00+00:00",
      }),
    ).toMatchObject({ id: 7, name: "Rachel" });
  });

  it("normalizes only supplied Taste Profile claims", () => {
    const profile = normalizeTasteProfile({
      profile: {
        adjacentSuggestion: null,
        algorithmVersion: "taste-profile-v1",
        catalog: {
          candidateCount: 6,
          isDemonstrationCatalog: true,
          limitations: "Limited demonstration catalog.",
          provider: "mock",
        },
        disclosure: "Based only on recorded cellar history.",
        evidence: {
          distinctCanonicalWines: 2,
          meaningfulEntries: 2,
          signalCount: 4,
          totalCellarEntries: 2,
        },
        lowerAffinitySignals: [],
        observedPriceRange: {
          maximumCents: 9500,
          minimumCents: 3500,
          sampleSize: 2,
        },
        signals: [
          {
            id: "cabernet",
            dimension: "varietal",
            evidenceCount: 2,
            label: "Cabernet",
            score: 90,
            summary: "A strong observed varietal signal.",
          },
        ],
        state: "active",
        summary: "Your saved wines lean toward structured reds.",
      },
    });

    expect(profile.observedPriceRange).toEqual({
      maximumCents: 9500,
      minimumCents: 3500,
      sampleSize: 2,
    });
    expect(profile.signals[0]).toMatchObject({
      dimension: "varietal",
      id: "cabernet",
      score: 90,
    });
  });

  it("rejects unsupported cellar statuses instead of substituting one", () => {
    expect(() =>
      normalizeCellarEntry({
        favorite: false,
        id: 1,
        savedAt: "2026-08-01T12:00:00+00:00",
        status: "cellared",
        tags: [],
        userId: 2,
        wine: camelWine,
        wineId: 3,
      }),
    ).toThrow(ApiContractError);
  });

  it("rejects malformed memory dates and non-boolean tri-state values", () => {
    const baseEntry = {
      favorite: false,
      id: 1,
      savedAt: "2026-08-01T12:00:00+00:00",
      status: "tasted",
      tags: [],
      userId: 2,
      wine: camelWine,
      wineId: 3,
    };

    expect(() =>
      normalizeCellarEntry({ ...baseEntry, tastedOn: "2026-02-30" }),
    ).toThrow("must be a valid calendar date");
    expect(() =>
      normalizeCellarEntry({ ...baseEntry, wouldBuyAgain: "yes" }),
    ).toThrow("must be a boolean");
  });
});
