import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/api/client";
import {
  ApiContractError,
  normalizeTasteProfile,
} from "@/api/normalizers";
import { getTasteProfile } from "@/api/profile";
import { tasteProfileQueryKey } from "@/api/tasteProfileQueryKeys";
import { isPrivateQueryKey } from "@/features/auth/privateQueryKeys";

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();

  return { ...actual, apiRequest: vi.fn() };
});

const mockedApiRequest = vi.mocked(apiRequest);

const rawProfile = {
  adjacentSuggestion: {
    confidence: "limited",
    disclosure: "Limited current catalog.",
    reasons: ["It shares an observed savory flavor signal."],
    wine: {
      externalWineId: "mock-adjacent-wine",
      name: "Adjacent Catalog Wine",
      source: "mock",
    },
  },
  algorithmVersion: "taste-atlas-v1",
  catalog: {
    candidateCount: 6,
    isDemonstrationCatalog: true,
    limitations: "The candidate set is intentionally small.",
    provider: "mock",
  },
  disclosure: "Owner-scoped aggregate structured signals only.",
  evidence: {
    distinctCanonicalWines: 3,
    meaningfulEntries: 3,
    signalCount: 7,
    totalCellarEntries: 4,
  },
  lowerAffinitySignals: [],
  memoryTitle: "PRIVATE_MEMORY_MARKER",
  observedPriceRange: {
    maximumCents: 7200,
    minimumCents: 4200,
    sampleSize: 3,
  },
  privateNote: "PRIVATE_NOTE_MARKER",
  signals: [
    {
      dimension: "varietal",
      evidenceCount: 3,
      id: "varietal-varietal-pinot-noir",
      label: "Pinot Noir",
      score: 88.4,
      summary: "An observed varietal pattern across 3 recorded bottles.",
    },
  ],
  state: "active",
  summary: "Your recorded cellar currently includes a Pinot Noir signal.",
};

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe("private Taste Profile client", () => {
  it("requests the read-only endpoint, forwards cancellation, and unwraps profile", async () => {
    const controller = new AbortController();
    mockedApiRequest.mockResolvedValue({ data: { profile: rawProfile } });

    await expect(getTasteProfile(controller.signal)).resolves.toMatchObject({
      adjacentSuggestion: {
        wine: { externalWineId: "mock-adjacent-wine" },
      },
      algorithmVersion: "taste-atlas-v1",
      state: "active",
    });
    expect(mockedApiRequest).toHaveBeenCalledWith("/profile/taste", {
      signal: controller.signal,
    });
  });

  it("keeps only the typed aggregate contract and discards unexpected private text", () => {
    const normalized = normalizeTasteProfile(rawProfile);
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toContain("PRIVATE_MEMORY_MARKER");
    expect(serialized).not.toContain("PRIVATE_NOTE_MARKER");
    expect(normalized.evidence).toEqual({
      distinctCanonicalWines: 3,
      meaningfulEntries: 3,
      signalCount: 7,
      totalCellarEntries: 4,
    });
  });

  it("rejects incomplete, contradictory, or unsupported aggregate contracts", () => {
    const invalidScore = structuredClone(rawProfile);
    invalidScore.signals[0]!.score = 101;
    expect(() => normalizeTasteProfile(invalidScore)).toThrow(ApiContractError);

    const reversedPrice = structuredClone(rawProfile);
    reversedPrice.observedPriceRange.minimumCents = 9000;
    expect(() => normalizeTasteProfile(reversedPrice)).toThrow(
      "minimum cannot exceed its maximum",
    );

    const unsupportedState = structuredClone(rawProfile);
    unsupportedState.state = "estimated";
    expect(() => normalizeTasteProfile(unsupportedState)).toThrow(
      "tasteProfile.state is not supported",
    );
  });
});

describe("Taste Profile query keys", () => {
  it("always scopes the cache to a verified positive owner identity", () => {
    const key = tasteProfileQueryKey(27);

    expect(key).toEqual(["private", 27, "taste-profile"]);
    expect(isPrivateQueryKey(key)).toBe(true);
    expect(() => tasteProfileQueryKey(0)).toThrow("positive integer");
  });
});
