import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { ApiError } from "@/api/client";
import { searchWines } from "@/api/wines";
import type { Wine, WineSearchResult } from "@/types/domain";

import DiscoverPage from "./DiscoverPage";

vi.mock("@/api/wines", () => ({
  searchWines: vi.fn(),
}));

// If discovery ever imports the demo fixture as a fallback, this suite fails at
// module evaluation instead of allowing a mocked network failure to look green.
vi.mock("@/data/demoCellar", () => {
  throw new Error("Discover must not import the demonstration cellar fixture.");
});

const mockedSearchWines = vi.mocked(searchWines);

function wine(overrides: Partial<Wine> = {}): Wine {
  return {
    acidity: "bright",
    averageRating: 4.3,
    body: "medium",
    country: "United States",
    createdAt: null,
    description: "A sourced wine description.",
    externalApiId: null,
    externalWineId: "mock-argyle-reserve-pinot-noir-2021",
    id: null,
    imageUrl: null,
    name: "Reserve Pinot Noir",
    occasion: "date night dinner",
    pairings: ["salmon"],
    priceCents: 4200,
    region: "Willamette Valley",
    servingTemp: "55-60 F",
    source: "mock",
    sweetness: "dry",
    tastingNotes: ["red cherry"],
    updatedAt: null,
    varietal: "Pinot Noir",
    vintage: "2021",
    winery: "Argyle",
    ...overrides,
  };
}

const pinot = wine();
const sauvignon = wine({
  externalWineId: "mock-frogs-leap-estate-sauvignon-blanc-2022",
  name: "Estate Sauvignon Blanc",
  region: "Napa Valley",
  varietal: "Sauvignon Blanc",
  winery: "Frog's Leap",
});

function result(
  results: Wine[],
  query = "dinner",
): WineSearchResult {
  return { query, results, source: "mock" };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}

function renderDiscover(initialEntry = "/discover") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
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
            element={
              <>
                <DiscoverPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/wines/:wineId" element={<p>Wine detail route</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return {
    ...view,
    unmount: () => {
      view.unmount();
      queryClient.clear();
    },
  };
}

afterEach(() => {
  cleanup();
  mockedSearchWines.mockReset();
});

describe("DiscoverPage", () => {
  it("starts with guidance and does not search until a query is submitted", () => {
    renderDiscover();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "DISCOVER WINES",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No demonstration bottles will replace/i),
    ).toBeInTheDocument();
    expect(mockedSearchWines).not.toHaveBeenCalled();
  });

  it("shows a loading state and passes React Query's abort signal to the API", async () => {
    let receivedSignal: AbortSignal | undefined;
    mockedSearchWines.mockImplementation((_query, signal) => {
      receivedSignal = signal;
      return new Promise<WineSearchResult>(() => undefined);
    });

    const view = renderDiscover("/discover?query=steak");

    expect(await screen.findByText("FOLLOWING THE VINE")).toBeInTheDocument();
    expect(mockedSearchWines).toHaveBeenCalledWith(
      "steak",
      expect.any(AbortSignal),
    );

    view.unmount();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("renders successful API results and derives filters only from those results", async () => {
    mockedSearchWines.mockResolvedValue(result([pinot, sauvignon]));
    renderDiscover("/discover?query=dinner");

    expect(
      await screen.findByRole("heading", { name: "2 bottles for “dinner”" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Reserve Pinot Noir" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Estate Sauvignon Blanc" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Frog's Leap")).toHaveTextContent("Frog's Leap");
    expect(
      Array.from(document.querySelectorAll(".gv-wine-card__index"), (node) =>
        node.textContent?.trim(),
      ),
    ).toEqual(["01", "02"]);
    expect(screen.getByText("Source: mock")).toBeInTheDocument();

    const varietalFilter = screen.getByRole("combobox", { name: "Varietal" });
    const regionFilter = screen.getByRole("combobox", { name: "Region" });

    expect(
      within(varietalFilter).getByRole("option", { name: "Pinot Noir" }),
    ).toBeInTheDocument();
    expect(
      within(varietalFilter).getByRole("option", { name: "Sauvignon Blanc" }),
    ).toBeInTheDocument();
    expect(
      within(varietalFilter).queryByRole("option", { name: "Champagne Blend" }),
    ).not.toBeInTheDocument();
    expect(
      within(regionFilter).getByRole("option", { name: "Napa Valley" }),
    ).toBeInTheDocument();
  });

  it("shows an honest empty state when the API returns no matches", async () => {
    mockedSearchWines.mockResolvedValue(result([], "moonlight"));
    renderDiscover("/discover?query=moonlight");

    expect(
      await screen.findByRole("heading", {
        name: "NO BOTTLE MATCHED “moonlight”",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Reserve Pinot Noir")).not.toBeInTheDocument();
    expect(screen.getByText(/rather than being replaced with demo wines/i)).toBeInTheDocument();
  });

  it("distinguishes a filter-empty state from an empty API response", async () => {
    mockedSearchWines.mockResolvedValue(result([pinot, sauvignon]));
    renderDiscover("/discover?query=dinner");

    const varietalFilter = await screen.findByRole("combobox", {
      name: "Varietal",
    });
    fireEvent.change(varietalFilter, { target: { value: "Pinot Noir" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Region" }), {
      target: { value: "Napa Valley" },
    });

    expect(
      screen.getByRole("heading", {
        name: "NO CURRENT RESULT HAS THAT VARIETAL AND REGION TOGETHER",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Reserve Pinot Noir")).not.toBeInTheDocument();
    expect(screen.queryByText("Estate Sauvignon Blanc")).not.toBeInTheDocument();
  });

  it("validates an empty explicit submission without calling the API", () => {
    renderDiscover();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search wines" }), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("Describe a wine, meal, region, or occasion before searching.");
    expect(mockedSearchWines).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/discover");
  });

  it("submits a trimmed query into the URL before searching", async () => {
    mockedSearchWines.mockResolvedValue(result([], "salmon"));
    renderDiscover();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search wines" }), {
      target: { value: "  salmon  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/discover?query=salmon",
      );
    });
    expect(mockedSearchWines).toHaveBeenCalledWith(
      "salmon",
      expect.any(AbortSignal),
    );
  });

  it("shows a distinct network failure and never substitutes demo wines", async () => {
    mockedSearchWines.mockRejectedValue(
      new ApiError("Could not reach the local API.", { code: "network_error" }),
    );
    renderDiscover("/discover?query=steak");

    expect(
      await screen.findByRole("heading", {
        name: "THE GRAPEVYNE API IS OUT OF REACH",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Could not reach the local API.")).toBeInTheDocument();
    expect(screen.queryByText("Reserve Pinot Noir")).not.toBeInTheDocument();
    expect(screen.queryByText(/demo-entry-/i)).not.toBeInTheDocument();
  });

  it("renders the server message for a generic wine-source error", async () => {
    mockedSearchWines.mockRejectedValue(
      new ApiError("The configured source rejected the request.", {
        code: "provider_error",
        status: 502,
      }),
    );
    renderDiscover("/discover?query=gift");

    expect(
      await screen.findByRole("heading", {
        name: "THE WINE SOURCE COULD NOT COMPLETE THAT SEARCH",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The configured source rejected the request."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
