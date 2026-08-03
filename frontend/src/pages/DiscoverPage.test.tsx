import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { saveWineToCellar } from "@/api/cellar";
import { ApiError } from "@/api/client";
import { getWineRecommendations } from "@/api/recommendations";
import { searchWines } from "@/api/wines";
import { useToast } from "@/components/ui/useToast.js";
import type { AuthContextValue } from "@/features/auth/authContextValue";
import { useAuth } from "@/features/auth/useAuth";
import type {
  CellarEntry,
  RecommendationResult,
  RecommendationResponse,
  User,
  Wine,
  WineSearchResult,
} from "@/types/domain";

import DiscoverPage from "./DiscoverPage";

vi.mock("@/api/recommendations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/recommendations")>()),
  getWineRecommendations: vi.fn(),
}));

vi.mock("@/api/wines", () => ({
  searchWines: vi.fn(),
}));

vi.mock("@/api/cellar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/cellar")>()),
  saveWineToCellar: vi.fn(),
}));

vi.mock("@/components/ui/useToast.js", () => ({
  useToast: vi.fn(),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/data/demoCellar", () => {
  throw new Error("Discover must not import the demonstration cellar fixture.");
});

const mockedRecommendations = vi.mocked(getWineRecommendations);
const mockedSearchWines = vi.mocked(searchWines);
const mockedSaveWine = vi.mocked(saveWineToCellar);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseToast = vi.mocked(useToast);
const showToast = vi.fn();

const user: User = {
  createdAt: null,
  email: "owner@example.test",
  id: 17,
  name: "Cellar Owner",
  updatedAt: null,
};

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    error: null,
    handleAuthenticationRequired: vi.fn().mockResolvedValue(true),
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    signup: vi.fn(),
    status: "ready",
    user: null,
    ...overrides,
  };
}

function wine(overrides: Partial<Wine> = {}): Wine {
  return {
    acidity: "high",
    averageRating: 4.1,
    body: "light",
    country: "United States",
    createdAt: null,
    description: "Bright citrus and sourced oyster pairing evidence.",
    externalApiId: null,
    externalWineId: "mock-frogs-leap-estate-sauvignon-blanc-2022",
    id: null,
    imageUrl: null,
    name: "Estate Sauvignon Blanc",
    occasion: "warm afternoon lunch",
    pairings: ["oysters"],
    priceCents: 3000,
    region: "Napa Valley",
    servingTemp: "45-50 F",
    source: "mock",
    sweetness: "dry",
    tastingNotes: ["grapefruit"],
    updatedAt: null,
    varietal: "Sauvignon Blanc",
    vintage: "2022",
    winery: "Frog's Leap",
    ...overrides,
  };
}

function recommendation(
  overrides: Partial<RecommendationResponse> = {},
): RecommendationResponse {
  return {
    catalog: {
      candidateCount: 6,
      isDemonstrationCatalog: true,
      limitations:
        "The current portfolio build uses a limited demonstration catalog.",
      provider: "mock",
    },
    intent: {
      acidities: ["high"],
      bodies: [],
      budget: null,
      categories: ["white"],
      countries: [],
      evidence: [
        { dimension: "category", matchedText: "white", value: "white" },
      ],
      excludedSweetness: [],
      flavors: [],
      novelty: null,
      occasions: [],
      pairings: ["oysters"],
      regions: [],
      sweetness: [],
      tannins: [],
      unparsedTerms: [],
      varietals: [],
      warnings: [],
    },
    personalization: {
      disclosure: "Results use only this request.",
      signalCount: 0,
      status: "anonymous",
    },
    query: "crisp white for oysters",
    results: [
      {
        match: {
          breakdown: [
            {
              availablePoints: 30,
              dimension: "pairing",
              earnedPoints: 30,
              evidence: ["MATCH: Catalog pairing matches oysters."],
              normalizedContribution: 60,
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
            {
              availablePoints: 15,
              dimension: "requested_style",
              earnedPoints: 15,
              evidence: ["MATCH: Category white satisfies white."],
              normalizedContribution: 30,
              unavailableReason: null,
              weight: 15,
            },
            {
              availablePoints: 0,
              dimension: "budget",
              earnedPoints: 0,
              evidence: [],
              normalizedContribution: 0,
              unavailableReason: "The request did not specify a budget.",
              weight: 10,
            },
            {
              availablePoints: 0,
              dimension: "occasion",
              earnedPoints: 0,
              evidence: [],
              normalizedContribution: 0,
              unavailableReason: "The request did not specify an occasion.",
              weight: 10,
            },
            {
              availablePoints: 5,
              dimension: "source_confidence",
              earnedPoints: 5,
              evidence: ["MATCH: 11 of 11 core source fields are present."],
              normalizedContribution: 10,
              unavailableReason: null,
              weight: 5,
            },
            {
              availablePoints: 0,
              dimension: "discovery_balance",
              earnedPoints: 0,
              evidence: [],
              normalizedContribution: 0,
              unavailableReason: "No novelty request was supplied.",
              weight: 5,
            },
          ],
          cautions: ["The catalog is intentionally small."],
          confidence: "high",
          matchedTags: ["oysters", "white"],
          missingDataDisclosures: [],
          reasons: [
            "Catalog pairing matches oysters.",
            "Category white satisfies white.",
          ],
          score: 100,
          scoreBasis: "request_only",
        },
        wine: wine(),
      },
    ],
    ...overrides,
  };
}

function cellarEntry(): CellarEntry {
  return {
    createdAt: null,
    favorite: false,
    id: 91,
    location: null,
    memoryTitle: null,
    notes: null,
    occasion: null,
    openedWith: null,
    pairing: null,
    savedAt: "2026-08-02T12:00:00+00:00",
    status: "saved",
    tags: [],
    tastedOn: null,
    updatedAt: null,
    userId: user.id,
    userRating: null,
    wouldBuyAgain: null,
    wine: wine({ externalApiId: wine().externalWineId, id: 44 }),
    wineId: 44,
  };
}

function recommendationResult(): RecommendationResult {
  const result = recommendation().results[0];

  if (!result) {
    throw new Error("The recommendation test fixture requires one result.");
  }

  return result;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderDiscover(initialEntry = "/discover") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[initialEntry]}
      >
        <Routes>
          <Route
            path="/discover"
            element={<><DiscoverPage /><LocationProbe /></>}
          />
          <Route path="/wines/:wineId" element={<p>Wine detail route</p>} />
          <Route path="/login" element={<p>Login route</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return {
    ...view,
    queryClient,
    unmount: () => {
      view.unmount();
      queryClient.clear();
    },
  };
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue(authValue());
  mockedUseToast.mockReturnValue({
    clearToasts: vi.fn(),
    dismissToast: vi.fn(),
    showToast,
  });
  mockedRecommendations.mockResolvedValue(recommendation());
  mockedSearchWines.mockResolvedValue({ query: "oysters", results: [wine()], source: "mock" });
  mockedSaveWine.mockResolvedValue(cellarEntry());
});

afterEach(() => {
  cleanup();
  mockedRecommendations.mockReset();
  mockedSearchWines.mockReset();
  mockedSaveWine.mockReset();
  mockedUseAuth.mockReset();
  mockedUseToast.mockReset();
  showToast.mockReset();
});

describe("DiscoverPage", () => {
  it("starts in recommendation mode with one input and no request", () => {
    renderDiscover();

    expect(screen.getByRole("heading", { level: 1, name: "DISCOVER WINES" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explainable matches" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("searchbox", { name: "Search wines" })).toHaveAttribute("maxlength", "300");
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(mockedRecommendations).not.toHaveBeenCalled();
    expect(mockedSearchWines).not.toHaveBeenCalled();
  });

  it("waits for verified auth state before choosing a recommendation cache identity", () => {
    mockedUseAuth.mockReturnValue(authValue({ isLoading: true, status: "loading" }));
    renderDiscover("/discover?query=crisp%20white%20for%20oysters");

    expect(screen.getByRole("heading", { name: "PREPARING PRIVATE CONTEXT" })).toBeInTheDocument();
    expect(mockedRecommendations).not.toHaveBeenCalled();
  });

  it("shows parsing state, forwards cancellation, and aborts on unmount", async () => {
    let receivedSignal: AbortSignal | undefined;
    mockedRecommendations.mockImplementation((_query, options) => {
      receivedSignal = options?.signal;
      return new Promise<RecommendationResponse>(() => undefined);
    });
    const view = renderDiscover("/discover?query=crisp%20white%20for%20oysters");

    expect(await screen.findByRole("heading", { name: "READING THE REQUEST" })).toBeInTheDocument();
    expect(mockedRecommendations).toHaveBeenCalledWith(
      "crisp white for oysters",
      { limit: 6, signal: expect.any(AbortSignal) },
    );
    view.unmount();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("renders parser intent, limited catalog, readable score, reasons, cautions, and an accessible breakdown", async () => {
    renderDiscover("/discover?query=crisp%20white%20for%20oysters");

    expect(await screen.findByRole("heading", { name: "WHAT THE ENGINE UNDERSTOOD" })).toBeInTheDocument();
    expect(screen.getByText("crisp white for oysters", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("white, high acidity")).toBeInTheDocument();
    expect(screen.getByText("oysters", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText(/limited demonstration catalog/i)).toBeInTheDocument();
    expect(document.querySelector(".gv-recommendation-score")).toHaveTextContent(
      "100/ 100 match",
    );
    expect(screen.getByText("Catalog pairing matches oysters.")).toBeInTheDocument();
    expect(screen.getByText("The catalog is intentionally small.")).toBeInTheDocument();
    expect(
      screen.getByText("1 explainable recommendation match is ready.", {
        selector: ".gv-assistive-status",
      }),
    ).toHaveAttribute("role", "status");
    expect(
      screen.getByRole("heading", { level: 3, name: "Estate Sauvignon Blanc" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 4, name: "Why it ranks" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".gv-recommendation-results")).not.toHaveAttribute(
      "aria-live",
    );

    const toggle = screen.getByRole("button", {
      name: "Show full score breakdown for Estate Sauvignon Blanc",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls");
    expect(toggle.tagName).toBe("BUTTON");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide full score breakdown for Estate Sauvignon Blanc" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("30 of 30 available points")).toBeInTheDocument();
    expect(screen.getByText("Pairing fit")).toBeInTheDocument();
  });

  it("renders parser warnings as non-scoring disclosure", async () => {
    mockedRecommendations.mockResolvedValue(recommendation({
      intent: {
        ...recommendation().intent,
        warnings: [{
          code: "conflicting_budget",
          message: "Multiple budget clauses were found, so budget does not affect scoring.",
        }],
      },
    }));
    renderDiscover("/discover?query=red%20under%20%2460%20and%20over%20%24100");

    expect(await screen.findByText("Parser notes")).toBeInTheDocument();
    expect(screen.getByText(/multiple budget clauses were found/i)).toBeInTheDocument();
  });

  it("preserves safe request text in the Wine Detail action", async () => {
    renderDiscover("/discover?query=crisp%20white%20for%20oysters");

    expect(await screen.findByRole("link", { name: /View Estate Sauvignon Blanc with recommendation context/ })).toHaveAttribute(
      "href",
      "/wines/mock-frogs-leap-estate-sauvignon-blanc-2022?request=crisp+white+for+oysters",
    );
  });

  it("shows an honest no-meaningful-match state without a demo substitute", async () => {
    mockedRecommendations.mockResolvedValue(recommendation({
      query: "sweet rosé",
      results: [],
    }));
    renderDiscover("/discover?query=sweet%20ros%C3%A9");

    expect(await screen.findByRole("heading", { name: "NO EXPLAINABLE MATCH FOR “sweet rosé”" })).toBeInTheDocument();
    expect(screen.queryByText("Estate Sauvignon Blanc")).not.toBeInTheDocument();
    expect(screen.getByText(/no substitute bottle has been invented/i)).toBeInTheDocument();
  });

  it("distinguishes provider failure and never substitutes demo data", async () => {
    mockedRecommendations.mockRejectedValue(new ApiError("Provider timed out.", {
      code: "wine_service_timeout",
      status: 504,
    }));
    renderDiscover("/discover?query=crisp%20white%20for%20oysters");

    expect(await screen.findByRole("heading", { name: "THE CATALOG PROVIDER COULD NOT COMPLETE THIS MATCH" })).toBeInTheDocument();
    expect(screen.getByText("Provider timed out.")).toBeInTheDocument();
    expect(screen.queryByText("Estate Sauvignon Blanc")).not.toBeInTheDocument();
  });

  it("aborts a stale recommendation and renders only the newer response", async () => {
    let staleSignal: AbortSignal | undefined;
    mockedRecommendations.mockImplementation((query, options) => {
      if (query === "crisp white for oysters") {
        staleSignal = options?.signal;
        return new Promise<RecommendationResponse>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(new DOMException("Superseded", "AbortError")));
        });
      }
      const baseResult = recommendationResult();
      return Promise.resolve(recommendation({
        query: "bold red for steak",
        results: [{
          ...baseResult,
          wine: wine({
            externalWineId: "mock-chateau-montelena-cabernet-sauvignon-2019",
            name: "Estate Cabernet Sauvignon",
            varietal: "Cabernet Sauvignon",
          }),
        }],
      }));
    });
    renderDiscover("/discover?query=crisp%20white%20for%20oysters");
    await screen.findByRole("heading", { name: "READING THE REQUEST" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search wines" }), {
      target: { value: "bold red for steak" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Match" }));

    expect(await screen.findByRole("link", { name: "Estate Cabernet Sauvignon" })).toBeInTheDocument();
    expect(staleSignal?.aborted).toBe(true);
    expect(screen.queryByText("THE MATCHING ENGINE COULD NOT COMPLETE THIS REQUEST")).not.toBeInTheDocument();
  });

  it("switches to the preserved catalog contract with one active request", async () => {
    renderDiscover("/discover?query=oysters");
    await screen.findByRole("heading", { name: "WHAT THE ENGINE UNDERSTOOD" });

    fireEvent.click(screen.getByRole("button", { name: "Catalog browse" }));

    expect(await screen.findByRole("heading", { name: "1 bottle for “oysters”" })).toBeInTheDocument();
    expect(mockedSearchWines).toHaveBeenCalledWith("oysters", expect.any(AbortSignal));
    expect(screen.getByTestId("location")).toHaveTextContent("/discover?query=oysters&mode=catalog");
    expect(screen.getByRole("button", { name: "Catalog browse" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps catalog result filters sourced only from the real search response", async () => {
    const pinot = wine({
      externalWineId: "mock-argyle-reserve-pinot-noir-2021",
      name: "Reserve Pinot Noir",
      region: "Willamette Valley",
      varietal: "Pinot Noir",
    });
    mockedSearchWines.mockResolvedValue({
      query: "dinner",
      results: [pinot, wine()],
      source: "mock",
    } satisfies WineSearchResult);
    renderDiscover("/discover?query=dinner&mode=catalog");

    const filter = await screen.findByRole("combobox", { name: "Varietal" });
    expect(within(filter).getByRole("option", { name: "Pinot Noir" })).toBeInTheDocument();
    fireEvent.change(filter, { target: { value: "Pinot Noir" } });
    expect(screen.getByRole("link", { name: "Reserve Pinot Noir" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Estate Sauvignon Blanc" })).not.toBeInTheDocument();
    expect(mockedRecommendations).not.toHaveBeenCalled();
  });

  it("preserves the catalog query contract for one-character searches", async () => {
    mockedSearchWines.mockResolvedValue({
      query: "a",
      results: [wine()],
      source: "mock",
    });
    renderDiscover("/discover?mode=catalog");
    const input = screen.getByRole("searchbox", { name: "Search wines" });

    expect(input).toHaveAttribute("maxlength", "200");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/discover?query=a&mode=catalog",
      );
    });
    expect(mockedSearchWines).toHaveBeenCalledWith("a", expect.any(AbortSignal));
    expect(mockedRecommendations).not.toHaveBeenCalled();
  });

  it("blocks catalog queries above the preserved 200-character limit", () => {
    const overlongQuery = "a".repeat(201);
    renderDiscover(
      `/discover?query=${encodeURIComponent(overlongQuery)}&mode=catalog`,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use 1 to 200 characters to search the current catalog.",
    );
    expect(mockedSearchWines).not.toHaveBeenCalled();
    expect(mockedRecommendations).not.toHaveBeenCalled();
  });

  it("validates blank input locally and submits a trimmed encoded request", async () => {
    renderDiscover();
    const input = screen.getByRole("searchbox", { name: "Search wines" });
    fireEvent.change(input, { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Match" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Use 2 to 300 plain-text characters");
    expect(mockedRecommendations).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "  crisp white for oysters  " } });
    fireEvent.click(screen.getByRole("button", { name: "Match" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/discover?query=crisp+white+for+oysters"));
    expect(mockedRecommendations).toHaveBeenCalledWith(
      "crisp white for oysters",
      { limit: 6, signal: expect.any(AbortSignal) },
    );
  });

  it("shows active personalization honestly and uses the real save contract", async () => {
    mockedUseAuth.mockReturnValue(authValue({
      isAuthenticated: true,
      user,
    }));
    const baseResult = recommendationResult();
    mockedRecommendations.mockResolvedValue(recommendation({
      personalization: {
        disclosure: "Taste fit uses aggregate attributes from this signed-in cellar.",
        signalCount: 4,
        status: "active",
      },
      results: [{
        ...baseResult,
        match: {
          ...baseResult.match,
          scoreBasis: "personalized",
        },
      }],
    }));
    renderDiscover("/discover?query=crisp%20white%20for%20oysters");

    expect(await screen.findByText("4 owner-scoped signals active")).toBeInTheDocument();
    expect(screen.getByText("Request + cellar signals")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save to my cellar" }));

    await waitFor(() => {
      expect(mockedSaveWine).toHaveBeenCalledWith(
        { externalWineId: "mock-frogs-leap-estate-sauvignon-blanc-2022" },
        user.id,
      );
    });
    await act(async () => undefined);
    expect(
      await screen.findByText("Saved to your private cellar.", {
        selector: "p[role='status']",
      }),
    ).toBeInTheDocument();
  });
});
