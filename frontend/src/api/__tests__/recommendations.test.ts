import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/api/client";
import {
  ApiContractError,
  normalizeRecommendationResponse,
} from "@/api/normalizers";
import { recommendationQueryKey } from "@/api/recommendationQueryKeys";
import { getWineRecommendations } from "@/api/recommendations";
import { isPrivateQueryKey } from "@/features/auth/privateQueryKeys";

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();

  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

const rawRecommendation = {
  catalog: {
    candidateCount: 6,
    isDemonstrationCatalog: true,
    limitations: "The available candidate set is intentionally small.",
    provider: "mock",
  },
  intent: {
    acidities: [],
    bodies: ["full"],
    budget: { maximumCents: 6000, minimumCents: null },
    categories: ["red"],
    countries: [],
    evidence: [
      { dimension: "body", matchedText: "bold", value: "full" },
    ],
    excludedSweetness: ["sweet"],
    flavors: [],
    novelty: null,
    occasions: ["dinner"],
    pairings: ["steak"],
    regions: [],
    sweetness: [],
    tannins: [],
    unparsedTerms: ["night"],
    varietals: [],
    warnings: [
      { code: "limited_catalog", message: "Catalog coverage is limited." },
    ],
  },
  personalization: {
    disclosure: "Results use only this request.",
    signalCount: 0,
    status: "anonymous",
  },
  query: "a bold red under $60 for steak night",
  results: [
    {
      match: {
        breakdown: [
          {
            availablePoints: 30,
            dimension: "pairing",
            earnedPoints: 30,
            evidence: ["MATCH: Catalog pairing matches steak."],
            normalizedContribution: 42.9,
            unavailableReason: null,
            weight: 30,
          },
          {
            availablePoints: 0,
            dimension: "personal_taste",
            earnedPoints: 0,
            evidence: [],
            normalizedContribution: 0,
            unavailableReason: "Personalization is anonymous.",
            weight: 25,
          },
        ],
        cautions: ["The listed price exceeds the requested maximum."],
        confidence: "medium",
        matchedTags: ["steak", "full"],
        missingDataDisclosures: ["This source record has no tannin value."],
        reasons: ["Catalog pairing matches steak."],
        score: 71,
        scoreBasis: "request_only",
      },
      wine: {
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
      },
    },
  ],
};

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe("recommendation response normalization", () => {
  it("normalizes the complete explainable result without flattening score evidence", () => {
    const result = normalizeRecommendationResponse(rawRecommendation);

    expect(result).toMatchObject({
      catalog: { candidateCount: 6, isDemonstrationCatalog: true },
      intent: {
        bodies: ["full"],
        excludedSweetness: ["sweet"],
        pairings: ["steak"],
      },
      personalization: { signalCount: 0, status: "anonymous" },
      results: [
        {
          match: {
            confidence: "medium",
            missingDataDisclosures: [
              "This source record has no tannin value.",
            ],
            score: 71,
            scoreBasis: "request_only",
          },
          wine: { externalWineId: "mock-estate-cabernet-2019" },
        },
      ],
    });
    expect(result.results[0]?.match.breakdown[0]).toMatchObject({
      availablePoints: 30,
      dimension: "pairing",
      earnedPoints: 30,
      weight: 30,
    });
  });

  it("rejects incomplete or unsupported scoring contracts", () => {
    const missingWeight = structuredClone(rawRecommendation);
    delete (missingWeight.results[0]?.match.breakdown[0] as Record<
      string,
      unknown
    >).weight;

    expect(() => normalizeRecommendationResponse(missingWeight)).toThrow(
      ApiContractError,
    );

    const unsupportedStatus = structuredClone(rawRecommendation);
    unsupportedStatus.personalization.status = "estimated";

    expect(() => normalizeRecommendationResponse(unsupportedStatus)).toThrow(
      "recommendation.personalization.status is not supported",
    );

    const missingDisclosures = structuredClone(rawRecommendation);
    delete (missingDisclosures.results[0]?.match as Record<string, unknown>)
      .missingDataDisclosures;

    expect(() => normalizeRecommendationResponse(missingDisclosures)).toThrow(
      "missingDataDisclosures must be an array",
    );
  });

  it("rejects contradictory budgets and invalid point arithmetic", () => {
    const reversedBudget = structuredClone(rawRecommendation);
    const budget = reversedBudget.intent.budget as {
      maximumCents: number | null;
      minimumCents: number | null;
    };
    budget.maximumCents = 4000;
    budget.minimumCents = 7500;

    expect(() => normalizeRecommendationResponse(reversedBudget)).toThrow(
      "minimum cannot exceed its maximum",
    );

    const excessCredit = structuredClone(rawRecommendation);
    const pairing = excessCredit.results[0]?.match.breakdown[0];
    if (pairing) pairing.earnedPoints = 31;

    expect(() => normalizeRecommendationResponse(excessCredit)).toThrow(
      "earnedPoints must be between 0 and 30",
    );
  });
});

describe("recommendation API client", () => {
  it("encodes a trimmed query, validates its limit, and forwards cancellation", async () => {
    const controller = new AbortController();
    mockedApiRequest.mockResolvedValue({ data: rawRecommendation });

    await expect(
      getWineRecommendations("  a bold red under $60 for steak night  ", {
        limit: 3,
        signal: controller.signal,
      }),
    ).resolves.toMatchObject({
      personalization: { status: "anonymous" },
      results: [{ match: { score: 71 } }],
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "/wines/recommendations?query=a+bold+red+under+%2460+for+steak+night&limit=3",
      { signal: controller.signal },
    );
  });

  it("rejects invalid queries and limits before making a request", async () => {
    await expect(getWineRecommendations(" ")).rejects.toMatchObject({
      code: "missing_query",
      status: 400,
    });
    await expect(getWineRecommendations("a")).rejects.toMatchObject({
      code: "validation_error",
    });
    await expect(getWineRecommendations("<wine>")).rejects.toMatchObject({
      code: "validation_error",
    });
    await expect(
      getWineRecommendations("valid request", { limit: 1.5 }),
    ).rejects.toMatchObject({ code: "validation_error" });
    await expect(
      getWineRecommendations("valid request", { limit: 13 }),
    ).rejects.toMatchObject({ code: "validation_error" });

    expect(mockedApiRequest).not.toHaveBeenCalled();
  });
});

describe("recommendation query keys", () => {
  it("uses a public key for anonymous output and normalizes cache inputs", () => {
    expect(recommendationQueryKey("  crisp white for oysters  ")).toEqual([
      "public",
      "wine-recommendations",
      "crisp white for oysters",
      6,
    ]);
  });

  it("uses the authenticated identity in a private key", () => {
    const key = recommendationQueryKey("celebration bottle", 4, 27);

    expect(key).toEqual([
      "private",
      27,
      "wine-recommendations",
      "celebration bottle",
      4,
    ]);
    expect(isPrivateQueryKey(key)).toBe(true);
    expect(() => recommendationQueryKey("celebration bottle", 4, 0)).toThrow(
      "positive integer",
    );
  });
});
