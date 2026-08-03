import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { getTasteProfile } from "@/api/profile";
import type { AuthContextValue } from "@/features/auth/authContextValue";
import { useAuth } from "@/features/auth/useAuth";
import type { TasteProfile, User, Wine } from "@/types/domain";

import ProfilePage from "./ProfilePage";

vi.mock("@/api/profile", () => ({ getTasteProfile: vi.fn() }));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: vi.fn() }));

const mockedGetTasteProfile = vi.mocked(getTasteProfile);
const mockedUseAuth = vi.mocked(useAuth);

const user: User = {
  createdAt: "2026-01-17T12:00:00+00:00",
  email: "rachel@example.test",
  id: 17,
  name: "Rachel Vine",
  updatedAt: "2026-02-01T12:00:00+00:00",
};

const adjacentWine: Wine = {
  acidity: "bright",
  averageRating: 4.2,
  body: "medium",
  country: "Italy",
  createdAt: null,
  description: "A sourced catalog wine.",
  externalApiId: "mock-chianti-2020",
  externalWineId: "mock-chianti-2020",
  id: null,
  imageUrl: null,
  name: "Catalog Chianti Classico",
  occasion: "dinner",
  pairings: ["pasta"],
  priceCents: 4900,
  region: "Tuscany",
  servingTemp: null,
  source: "mock",
  sweetness: "dry",
  tastingNotes: ["cherry"],
  updatedAt: null,
  varietal: "Sangiovese",
  vintage: "2020",
  winery: "Catalog Estate",
};

function profile(
  state: TasteProfile["state"] = "active",
  overrides: Partial<TasteProfile> = {},
): TasteProfile {
  return {
    adjacentSuggestion:
      state === "active"
        ? {
            confidence: "limited",
            disclosure: "A limited-catalog adjacent suggestion.",
            reasons: ["Adds a neighboring savory red style."],
            wine: { ...adjacentWine, externalWineId: "mock-chianti-2020" },
          }
        : null,
    algorithmVersion: "taste-profile-v1",
    catalog: {
      candidateCount: 6,
      isDemonstrationCatalog: true,
      limitations: "The current provider is a limited six-record demonstration catalog.",
      provider: "mock",
    },
    disclosure: "Based only on your recorded cellar history and sourced wine facts.",
    evidence: {
      distinctCanonicalWines: state === "active" ? 3 : state === "limited" ? 1 : 0,
      meaningfulEntries: state === "active" ? 3 : state === "limited" ? 1 : 0,
      signalCount: state === "active" ? 6 : state === "limited" ? 1 : 0,
      totalCellarEntries: state === "empty" ? 0 : state === "active" ? 3 : 1,
    },
    lowerAffinitySignals: [],
    observedPriceRange: state === "active"
      ? { maximumCents: 7200, minimumCents: 4200, sampleSize: 3 }
      : null,
    signals:
      state === "empty"
        ? []
        : [
            {
              dimension: "varietal",
              evidenceCount: state === "active" ? 3 : 1,
              id: "varietal:pinot-noir",
              label: "Pinot Noir",
              score: state === "active" ? 88 : 54,
              summary: "An emerging preference based on rated sourced bottles.",
            },
            ...(state === "active"
              ? [{
                  dimension: "place" as const,
                  evidenceCount: 2,
                  id: "place:willamette-valley",
                  label: "Willamette Valley",
                  score: 72,
                  summary: "A repeated place signal in the current cellar.",
                }]
              : []),
          ],
    state,
    summary:
      state === "empty"
        ? "No meaningful tasted preference evidence is recorded yet."
        : state === "limited"
          ? "An early preference is beginning to form."
          : "Your cellar currently leans toward bright, savory reds.",
    ...overrides,
  };
}

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    error: null,
    handleAuthenticationRequired: vi.fn(),
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

function renderProfile(queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})) {
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/profile"]}
      >
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/cellar" element={<h1>Private cellar destination</h1>} />
          <Route path="/discover" element={<h1>Discover destination</h1>} />
          <Route path="/login" element={<h1>Sign-in destination</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(tree());

  return { ...view, queryClient, rerenderProfile: () => view.rerender(tree()) };
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue(authValue());
  mockedGetTasteProfile.mockResolvedValue(profile());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProfilePage", () => {
  it("uses the identity-scoped private query key and renders only safe aggregates", async () => {
    const { queryClient } = renderProfile();

    expect(await screen.findByRole("heading", { level: 1, name: "TASTE PROFILE" })).toBeInTheDocument();
    expect(screen.getByText("Rachel Vine")).toBeInTheDocument();
    expect(screen.getByText("January 17, 2026")).toBeInTheDocument();
    expect(screen.getByText(/currently leans toward bright, savory reds/i)).toBeInTheDocument();
    expect(queryClient.getQueryData(["private", 17, "taste-profile"])).toMatchObject({ state: "active" });
    expect(document.body).not.toHaveTextContent("PRIVATE_NOTE_MARKER");
  });

  it("shows a truthful loading state and forwards cancellation on unmount", () => {
    let signal: AbortSignal | undefined;
    mockedGetTasteProfile.mockImplementation((nextSignal) => {
      signal = nextSignal;
      return new Promise<TasteProfile>(() => undefined);
    });

    const view = renderProfile();
    expect(screen.getByRole("status")).toHaveTextContent("TRACING YOUR RECORDED BRANCHES");
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("renders the empty state without invented clusters or adjacent wine", async () => {
    mockedGetTasteProfile.mockResolvedValue(profile("empty"));
    renderProfile();

    expect(await screen.findByRole("heading", { name: "YOUR ATLAS IS READY FOR ITS FIRST BRANCH" })).toBeInTheDocument();
    expect(screen.getByText(/begins with the first bottle you taste, rate, or mark as a favorite/i)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Taste Atlas preference clusters" })).not.toBeInTheDocument();
    expect(screen.queryByText("Catalog Chianti Classico")).not.toBeInTheDocument();
  });

  it("renders a limited profile with an honest prompt for broader evidence", async () => {
    mockedGetTasteProfile.mockResolvedValue(profile("limited"));
    renderProfile();

    expect(await screen.findByRole("heading", { name: "YOUR TASTE PROFILE IS STILL LIMITED" })).toBeInTheDocument();
    expect(screen.getByText(/few more rated bottles across different styles/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pinot Noir, Varietals/i })).toBeInTheDocument();
  });

  it("provides keyboard-operable deterministic nodes and the equivalent text summary", async () => {
    renderProfile();
    const node = await screen.findByRole("button", { name: /Willamette Valley, Regions and countries/i });

    fireEvent.focus(node);
    expect(node).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Willamette Valley" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "THE SAME PATTERNS, IN TEXT" })).toBeInTheDocument();
    expect(screen.getAllByText("An emerging preference based on rated sourced bottles.")).not.toHaveLength(0);
    expect(
      screen.getByText(/Observed sourced price range/i).closest("p"),
    ).toHaveTextContent("$42–$72");
  });

  it("links an adjacent suggestion using its real public external wine ID", async () => {
    renderProfile();

    expect(await screen.findByRole("link", { name: /View this catalog wine/i })).toHaveAttribute(
      "href",
      "/wines/mock-chianti-2020",
    );
    expect(screen.getByText("Catalog Chianti Classico")).toBeInTheDocument();
  });

  it("shows a backend error without substituting demo profile data", async () => {
    mockedGetTasteProfile.mockRejectedValue(new Error("Taste service unavailable."));
    renderProfile();

    expect(await screen.findByRole("heading", { name: "YOUR TASTE PROFILE IS UNAVAILABLE" })).toBeInTheDocument();
    expect(screen.getByText(/No demonstration profile has been substituted/i)).toBeInTheDocument();
    expect(screen.queryByText("Pinot Noir")).not.toBeInTheDocument();
  });

  it("does not request private profile data when rendered signed out", () => {
    mockedUseAuth.mockReturnValue(authValue({ isAuthenticated: false, user: null }));
    renderProfile();

    expect(screen.getByRole("heading", { name: "THIS PROFILE NEEDS AN AUTHENTICATED SESSION" })).toBeInTheDocument();
    expect(mockedGetTasteProfile).not.toHaveBeenCalled();
  });

  it("cannot display the previous account profile while a new identity loads", async () => {
    const firstProfile = profile("active", { summary: "FIRST_ACCOUNT_PROFILE_MARKER" });
    mockedGetTasteProfile.mockResolvedValueOnce(firstProfile);
    const view = renderProfile();
    await screen.findByText("FIRST_ACCOUNT_PROFILE_MARKER");

    mockedUseAuth.mockReturnValue(authValue({
      user: { ...user, email: "second@example.test", id: 23, name: "Second User" },
    }));
    mockedGetTasteProfile.mockReturnValue(new Promise<TasteProfile>(() => undefined));
    view.rerenderProfile();

    expect(screen.getByRole("status")).toHaveTextContent("TRACING YOUR RECORDED BRANCHES");
    expect(screen.queryByText("FIRST_ACCOUNT_PROFILE_MARKER")).not.toBeInTheDocument();
    await waitFor(() => expect(mockedGetTasteProfile).toHaveBeenCalledTimes(2));
  });

  it("cancels the previous owner's request when the authenticated identity changes", async () => {
    let firstSignal: AbortSignal | undefined;
    mockedGetTasteProfile
      .mockImplementationOnce((signal) => {
        firstSignal = signal;
        return new Promise<TasteProfile>(() => undefined);
      })
      .mockResolvedValueOnce(
        profile("limited", { summary: "SECOND_ACCOUNT_PROFILE_MARKER" }),
      );
    const view = renderProfile();
    expect(screen.getByRole("status")).toHaveTextContent(
      "TRACING YOUR RECORDED BRANCHES",
    );

    mockedUseAuth.mockReturnValue(authValue({
      user: { ...user, email: "second@example.test", id: 23, name: "Second User" },
    }));
    view.rerenderProfile();

    await screen.findByText("SECOND_ACCOUNT_PROFILE_MARKER");
    expect(firstSignal?.aborted).toBe(true);
    expect(screen.getByText("Second User")).toBeInTheDocument();
  });
});
