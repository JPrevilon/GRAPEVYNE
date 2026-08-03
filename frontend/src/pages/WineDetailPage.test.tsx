import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { saveWineToCellar } from "@/api/cellar";
import { ApiError } from "@/api/client";
import { getWineRecommendations } from "@/api/recommendations";
import { getWineDetail } from "@/api/wines";
import { useToast } from "@/components/ui/useToast.js";
import type { AuthContextValue } from "@/features/auth/authContextValue";
import { useAuth } from "@/features/auth/useAuth";
import type {
  CellarEntry,
  RecommendationDimension,
  RecommendationResponse,
  User,
  Wine,
  WineDetailResult,
} from "@/types/domain";

import WineDetailPage from "./WineDetailPage";

vi.mock("@/api/cellar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/cellar")>()),
  saveWineToCellar: vi.fn(),
}));

vi.mock("@/api/wines", () => ({
  getWineDetail: vi.fn(),
}));

vi.mock("@/api/recommendations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/recommendations")>()),
  getWineRecommendations: vi.fn(),
}));

vi.mock("@/components/ui/useToast.js", () => ({
  useToast: vi.fn(),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockedGetWineDetail = vi.mocked(getWineDetail);
const mockedGetWineRecommendations = vi.mocked(getWineRecommendations);
const mockedSaveWineToCellar = vi.mocked(saveWineToCellar);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseToast = vi.mocked(useToast);
const showToast = vi.fn();

const EXTERNAL_WINE_ID = "mock-argyle-reserve-pinot-noir-2021";

const user: User = {
  createdAt: "2026-01-17T12:00:00+00:00",
  email: "cellar@example.test",
  id: 17,
  name: "Cellar Owner",
  updatedAt: "2026-01-17T12:00:00+00:00",
};

function wine(overrides: Partial<Wine> = {}): Wine {
  return {
    acidity: "bright",
    averageRating: 4.3,
    body: "medium",
    country: "United States",
    createdAt: null,
    description: "Red cherry, rose petal, and a clean mineral line.",
    externalApiId: null,
    externalWineId: EXTERNAL_WINE_ID,
    id: null,
    imageUrl: null,
    name: "Reserve Pinot Noir",
    occasion: "date night dinner",
    pairings: ["salmon", "mushroom risotto"],
    priceCents: 4200,
    region: "Willamette Valley",
    servingTemp: "55-60 F",
    source: "mock",
    sweetness: "dry",
    tastingNotes: ["red cherry", "rose petal"],
    updatedAt: null,
    varietal: "Pinot Noir",
    vintage: "2021",
    winery: "Argyle",
    ...overrides,
  };
}

const fullWine = wine();

const savedEntry: CellarEntry = {
  createdAt: "2026-08-02T12:00:00+00:00",
  favorite: false,
  id: 91,
  notes: null,
  occasion: null,
  savedAt: "2026-08-02T12:00:00+00:00",
  status: "saved",
  tags: [],
  updatedAt: "2026-08-02T12:00:00+00:00",
  userId: user.id,
  userRating: null,
  wine: wine({
    createdAt: "2026-08-02T12:00:00+00:00",
    externalApiId: EXTERNAL_WINE_ID,
    id: 44,
    occasion: null,
    pairings: [],
    servingTemp: null,
    tastingNotes: [],
    updatedAt: "2026-08-02T12:00:00+00:00",
  }),
  wineId: 44,
};

function authValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    error: null,
    handleAuthenticationRequired: vi.fn().mockResolvedValue(true),
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    signup: vi.fn(),
    status: "ready",
    user,
    ...overrides,
  };
}

function detailResult(value: Wine = fullWine): WineDetailResult {
  return { source: "mock", wine: value };
}

function recommendationContext(): RecommendationResponse {
  const names: RecommendationDimension["dimension"][] = [
    "pairing",
    "personal_taste",
    "requested_style",
    "budget",
    "occasion",
    "source_confidence",
    "discovery_balance",
  ];
  const weights: Record<RecommendationDimension["dimension"], number> = {
    budget: 10,
    discovery_balance: 5,
    occasion: 10,
    pairing: 30,
    personal_taste: 25,
    requested_style: 15,
    source_confidence: 5,
  };
  const breakdown: RecommendationDimension[] = names.map((dimension) => ({
    availablePoints: dimension === "pairing" ? 30 : 0,
    dimension,
    earnedPoints: dimension === "pairing" ? 30 : 0,
    evidence:
      dimension === "pairing"
        ? ["MATCH: Catalog pairing matches salmon."]
        : [],
    normalizedContribution: dimension === "pairing" ? 100 : 0,
    unavailableReason:
      dimension === "pairing" ? null : "This dimension was unavailable.",
    weight: weights[dimension],
  }));

  return {
    catalog: {
      candidateCount: 6,
      isDemonstrationCatalog: true,
      limitations: "Limited demonstration catalog.",
      provider: "mock",
    },
    intent: {
      acidities: [],
      bodies: [],
      budget: null,
      categories: [],
      countries: [],
      evidence: [],
      excludedSweetness: [],
      flavors: [],
      novelty: null,
      occasions: [],
      pairings: ["salmon"],
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
    query: "something light for salmon",
    results: [
      {
        match: {
          breakdown,
          cautions: [],
          confidence: "medium",
          matchedTags: ["salmon"],
          missingDataDisclosures: [],
          reasons: ["Catalog pairing matches salmon."],
          score: 88,
          scoreBasis: "request_only",
        },
        wine: fullWine,
      },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function LoginProbe() {
  const location = useLocation();
  const state = location.state as { from?: string } | null;

  return (
    <>
      <h1>Login destination</h1>
      <output data-testid="login-return-path">{state?.from ?? ""}</output>
    </>
  );
}

function renderDetail(
  route = `/wines/${EXTERNAL_WINE_ID}`,
  currentAuth: AuthContextValue = authValue(),
) {
  mockedUseAuth.mockReturnValue(currentAuth);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
    },
  });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const detailTree = () => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[route]}
      >
        <Routes>
          <Route path="/wines/:wineId" element={<WineDetailPage />} />
          <Route path="/login" element={<LoginProbe />} />
          <Route path="/discover" element={<h1>Discover destination</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(detailTree());

  return {
    ...view,
    invalidateQueries,
    queryClient,
    rerenderAuth: (nextAuth: AuthContextValue) => {
      mockedUseAuth.mockReturnValue(nextAuth);
      view.rerender(detailTree());
    },
    unmount: () => {
      view.unmount();
      queryClient.clear();
    },
  };
}

beforeEach(() => {
  mockedGetWineDetail.mockResolvedValue(detailResult());
  mockedGetWineRecommendations.mockResolvedValue(recommendationContext());
  mockedSaveWineToCellar.mockResolvedValue(savedEntry);
  mockedUseAuth.mockReturnValue(authValue());
  mockedUseToast.mockReturnValue({
    clearToasts: vi.fn(),
    dismissToast: vi.fn(),
    showToast,
  });
});

afterEach(() => {
  cleanup();
  mockedGetWineDetail.mockReset();
  mockedGetWineRecommendations.mockReset();
  mockedSaveWineToCellar.mockReset();
  mockedUseAuth.mockReset();
  mockedUseToast.mockReset();
  showToast.mockReset();
});

describe("WineDetailPage", () => {
  it("shows a loading state, passes the real route identifier, and consumes the abort signal", async () => {
    let receivedSignal: AbortSignal | undefined;
    mockedGetWineDetail.mockImplementation((_wineId, signal) => {
      receivedSignal = signal;
      return new Promise<WineDetailResult>(() => undefined);
    });

    const view = renderDetail();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "BRINGING THE BOTTLE FORWARD",
      }),
    ).toBeInTheDocument();
    expect(mockedGetWineDetail).toHaveBeenCalledWith(
      EXTERNAL_WINE_ID,
      expect.any(AbortSignal),
    );

    view.unmount();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("renders every available source-backed field", async () => {
    renderDetail();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Reserve Pinot Noir",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Catalog source: mock")).toBeInTheDocument();
    expect(screen.getByText("Argyle")).toBeInTheDocument();
    expect(
      screen.getByText("Red cherry, rose petal, and a clean mineral line."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Willamette Valley, United States"),
    ).toBeInTheDocument();
    expect(screen.getByText("2021")).toBeInTheDocument();
    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("$42")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "TASTING NOTES" })).toBeInTheDocument();
    expect(screen.getByText("red cherry")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "PAIRINGS AND OCCASION" }),
    ).toBeInTheDocument();
    expect(screen.getByText("salmon")).toBeInTheDocument();
    expect(screen.getByText("date night dinner")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "AVAILABLE CHARACTERISTICS" }),
    ).toBeInTheDocument();
    expect(screen.getByText("55-60 F")).toBeInTheDocument();
  });

  it("omits optional fact and characteristic sections when fields are absent", async () => {
    mockedGetWineDetail.mockResolvedValue(
      detailResult(
        wine({
          acidity: null,
          averageRating: null,
          body: null,
          country: null,
          description: null,
          occasion: null,
          pairings: [],
          priceCents: null,
          region: null,
          servingTemp: null,
          sweetness: null,
          tastingNotes: [],
          varietal: null,
          vintage: null,
          winery: null,
        }),
      ),
    );
    renderDetail();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Reserve Pinot Noir" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Origin")).not.toBeInTheDocument();
    expect(screen.queryByText("Vintage")).not.toBeInTheDocument();
    expect(screen.queryByText("Catalog rating")).not.toBeInTheDocument();
    expect(screen.queryByText("Listed price")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "TASTING NOTES" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "PAIRINGS AND OCCASION" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "AVAILABLE CHARACTERISTICS" }),
    ).not.toBeInTheDocument();
  });

  it("reconstructs safe recommendation context without making it part of the bottle contract", async () => {
    renderDetail(
      `/wines/${EXTERNAL_WINE_ID}?request=something%20light%20for%20salmon`,
      authValue({ isAuthenticated: false, user: null }),
    );

    expect(
      await screen.findByText("“something light for salmon”"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "WHY IT FITS THIS REQUEST" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".gv-recommendation-score")).toHaveTextContent(
      "88/ 100 match",
    );
    expect(screen.getByText("Catalog pairing matches salmon.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Recommendation context is ready for Reserve Pinot Noir.",
    );
    expect(mockedGetWineRecommendations).toHaveBeenCalledWith(
      "something light for salmon",
      { limit: 6, signal: expect.any(AbortSignal) },
    );
    expect(screen.getByRole("link", { name: "Back to discovery" })).toHaveAttribute(
      "href",
      "/discover?query=something+light+for+salmon",
    );
  });

  it("keeps direct Wine Detail independent from recommendation context", async () => {
    renderDetail();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Reserve Pinot Noir" }),
    ).toBeInTheDocument();
    expect(mockedGetWineRecommendations).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "WHY IT FITS THIS REQUEST" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the bottle usable when reconstructed context fails", async () => {
    mockedGetWineRecommendations.mockRejectedValue(
      new ApiError("Recommendation service unavailable.", {
        code: "wine_service_unavailable",
        status: 503,
      }),
    );
    renderDetail(
      `/wines/${EXTERNAL_WINE_ID}?request=something%20light%20for%20salmon`,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Reserve Pinot Noir" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/recommendation context could not be reconstructed/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to my cellar" })).toBeEnabled();
  });

  it("renders the backend not-found contract without substituting another wine", async () => {
    mockedGetWineDetail.mockRejectedValue(
      new ApiError("Wine was not found.", {
        code: "wine_not_found",
        status: 404,
      }),
    );
    renderDetail("/wines/does-not-exist");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "THIS BOTTLE IS NOT IN THE CURRENT CATALOG",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Wine was not found.")).toBeInTheDocument();
    expect(screen.queryByText("Reserve Pinot Noir")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to discovery" })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(mockedGetWineDetail).toHaveBeenCalledWith(
      "does-not-exist",
      expect.any(AbortSignal),
    );
  });

  it("preserves pathname, search, and hash when a signed-out visitor saves", async () => {
    renderDetail(
      `/wines/${EXTERNAL_WINE_ID}?from=discover#tasting-notes`,
      authValue({ isAuthenticated: false, user: null }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Sign in to save" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Login destination" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("login-return-path")).toHaveTextContent(
      `/wines/${EXTERNAL_WINE_ID}?from=discover#tasting-notes`,
    );
    expect(mockedSaveWineToCellar).not.toHaveBeenCalled();
  });

  it("does not permit a stale authenticated identity to save when session verification failed", async () => {
    renderDetail(
      `/wines/${EXTERNAL_WINE_ID}`,
      authValue({
        error: new Error("Could not reach the GrapeVyne API."),
        isLoading: false,
        status: "error",
      }),
    );

    const saveButton = await screen.findByRole("button", {
      name: "Save to my cellar",
    });
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);

    expect(mockedSaveWineToCellar).not.toHaveBeenCalled();
  });

  it("keeps save pending until backend confirmation, then invalidates only the user's private cellar and recommendations", async () => {
    const pendingSave = deferred<CellarEntry>();
    mockedSaveWineToCellar.mockReturnValue(pendingSave.promise);
    const { invalidateQueries, queryClient } = renderDetail();

    fireEvent.click(
      await screen.findByRole("button", { name: "Save to my cellar" }),
    );

    const pendingButton = await screen.findByRole("button", {
      name: "Saving bottle…",
    });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute("aria-busy", "true");
    expect(mockedSaveWineToCellar).toHaveBeenCalledWith(
      { externalWineId: EXTERNAL_WINE_ID },
      user.id,
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();

    await act(async () => {
      pendingSave.resolve(savedEntry);
      await pendingSave.promise;
    });

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent("Saved to your private cellar.");
    expect(screen.getByRole("button", { name: "Saved to cellar" })).toBeDisabled();
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["private", user.id, "cellar"],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["private", user.id, "wine-recommendations"],
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(
      queryClient.getMutationCache().getAll()[0]?.options.mutationKey,
    ).toEqual(["private", user.id, "cellar", "save", EXTERNAL_WINE_ID]);
    expect(showToast).toHaveBeenCalledWith({
      message: "Reserve Pinot Noir is now in your private cellar.",
      title: "Bottle saved",
    });
  });

  it("invalidates confirmed owner caches but suppresses feedback after unmount", async () => {
    const pendingSave = deferred<CellarEntry>();
    mockedSaveWineToCellar.mockReturnValue(pendingSave.promise);
    const { invalidateQueries, unmount } = renderDetail();

    fireEvent.click(
      await screen.findByRole("button", { name: "Save to my cellar" }),
    );
    unmount();

    await act(async () => {
      pendingSave.resolve(savedEntry);
      await pendingSave.promise;
    });
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(2));

    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["private", user.id, "cellar"],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["private", user.id, "wine-recommendations"],
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("suppresses private save feedback when revalidation starts during cache refresh", async () => {
    const pendingSave = deferred<CellarEntry>();
    const pendingInvalidation = deferred<void>();
    mockedSaveWineToCellar.mockReturnValue(pendingSave.promise);
    const { invalidateQueries, rerenderAuth } = renderDetail();
    invalidateQueries.mockReturnValue(pendingInvalidation.promise);

    fireEvent.click(
      await screen.findByRole("button", { name: "Save to my cellar" }),
    );
    await act(async () => {
      pendingSave.resolve(savedEntry);
      await pendingSave.promise;
    });
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(2));

    rerenderAuth(authValue({ isLoading: true, status: "loading" }));
    await act(async () => {
      pendingInvalidation.resolve();
      await pendingInvalidation.promise;
    });

    expect(screen.queryByText("Saved to your private cellar.")).not.toBeInTheDocument();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("reports the backend duplicate contract without claiming a new save", async () => {
    mockedSaveWineToCellar.mockRejectedValue(
      new ApiError("This wine is already in your cellar.", {
        code: "cellar_entry_exists",
        details: { entry: savedEntry },
        status: 409,
      }),
    );
    const { invalidateQueries } = renderDetail();

    fireEvent.click(
      await screen.findByRole("button", { name: "Save to my cellar" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "This bottle is already in your cellar.",
    );
    expect(screen.getByRole("button", { name: "Already in cellar" })).toBeDisabled();
    expect(mockedSaveWineToCellar).toHaveBeenCalledWith(
      { externalWineId: EXTERNAL_WINE_ID },
      user.id,
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      message: "This bottle is already in your cellar.",
      title: "Already saved",
    });
  });

  it("revalidates instead of claiming a duplicate owned by another session", async () => {
    const handleAuthenticationRequired = vi.fn().mockResolvedValue(true);
    mockedSaveWineToCellar.mockRejectedValue(
      new ApiError("This wine is already in your cellar.", {
        code: "cellar_entry_exists",
        details: { entry: { ...savedEntry, userId: 99 } },
        status: 409,
      }),
    );
    const { invalidateQueries } = renderDetail(
      `/wines/${EXTERNAL_WINE_ID}`,
      authValue({ handleAuthenticationRequired }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Save to my cellar" }),
    );

    await waitFor(() => {
      expect(handleAuthenticationRequired).toHaveBeenCalledWith(user.id);
    });
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(screen.queryByText("This bottle is already in your cellar.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to my cellar" })).toBeEnabled();
  });

  it("renders a failed save as an alert and leaves retry available", async () => {
    mockedSaveWineToCellar.mockRejectedValue(
      new ApiError("A database error occurred.", {
        code: "database_error",
        status: 500,
      }),
    );
    const { invalidateQueries } = renderDetail();

    fireEvent.click(
      await screen.findByRole("button", { name: "Save to my cellar" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A database error occurred.",
    );
    expect(screen.getByRole("button", { name: "Save to my cellar" })).toBeEnabled();
    expect(mockedSaveWineToCellar).toHaveBeenCalledWith(
      { externalWineId: EXTERNAL_WINE_ID },
      user.id,
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      message: "A database error occurred.",
      title: "Save failed",
      tone: "error",
    });
  });

  it("renders a production origin rejection honestly without a false save", async () => {
    mockedSaveWineToCellar.mockRejectedValue(
      new ApiError("This request did not come from a trusted application origin.", {
        code: "csrf_origin_rejected",
        status: 403,
      }),
    );
    const { invalidateQueries } = renderDetail();

    fireEvent.click(
      await screen.findByRole("button", { name: "Save to my cellar" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This request did not come from a trusted application origin.",
    );
    expect(screen.getByRole("button", { name: "Save to my cellar" })).toBeEnabled();
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      message: "This request did not come from a trusted application origin.",
      title: "Save failed",
      tone: "error",
    });
  });

  it("revalidates the current owner when save reports session expiry", async () => {
    const handleAuthenticationRequired = vi.fn().mockResolvedValue(true);
    mockedSaveWineToCellar.mockRejectedValue(
      new ApiError("Authentication is required.", {
        code: "authentication_required",
        status: 401,
      }),
    );
    const { invalidateQueries } = renderDetail(
      `/wines/${EXTERNAL_WINE_ID}`,
      authValue({ handleAuthenticationRequired }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Save to my cellar" }),
    );

    await waitFor(() => {
      expect(handleAuthenticationRequired).toHaveBeenCalledWith(user.id);
    });
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rejects a save response owned by another user before cache or success feedback", async () => {
    const handleAuthenticationRequired = vi.fn().mockResolvedValue(true);
    mockedSaveWineToCellar.mockResolvedValue({
      ...savedEntry,
      userId: 99,
    });
    const { invalidateQueries } = renderDetail(
      `/wines/${EXTERNAL_WINE_ID}`,
      authValue({ handleAuthenticationRequired }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Save to my cellar" }),
    );

    await waitFor(() => {
      expect(handleAuthenticationRequired).toHaveBeenCalledWith(user.id);
    });
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(screen.queryByText("Saved to your private cellar.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to my cellar" })).toBeEnabled();
  });
});
