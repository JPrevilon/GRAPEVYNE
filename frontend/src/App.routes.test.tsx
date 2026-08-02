import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import App from "@/App";
import { ToastProvider } from "@/components/ui/ToastProvider.jsx";
import { SceneProvider } from "@/experience";

const mocks = vi.hoisted(() => ({
  getCellarEntries: vi.fn(),
  getWineDetail: vi.fn(),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    signup: vi.fn(),
    status: "ready",
    user: null,
  }),
}));

vi.mock("@/api/cellar", () => ({
  deleteCellarEntry: vi.fn(),
  getCellarEntries: mocks.getCellarEntries,
  updateCellarEntry: vi.fn(),
}));

vi.mock("@/api/wines", () => ({
  getWineDetail: mocks.getWineDetail,
  searchWines: vi.fn(),
}));

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          initialEntries={[path]}
        >
          <SceneProvider>
            <App />
          </SceneProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  mocks.getCellarEntries.mockClear();
});

beforeEach(() => {
  mocks.getWineDetail.mockResolvedValue({
    source: "test",
    wine: {
      acidity: "bright",
      averageRating: 4.3,
      body: "medium",
      country: "France",
      description: "A source-backed test bottle.",
      externalApiId: "source-wine-17",
      externalWineId: "source-wine-17",
      id: "source-wine-17",
      imageUrl: null,
      name: "Direct Route Rouge",
      occasion: "Dinner",
      pairings: ["Mushrooms"],
      priceCents: 3200,
      region: "Loire Valley",
      servingTemp: "Cellar temperature",
      source: "test",
      sweetness: "dry",
      tastingNotes: ["Cherry"],
      varietal: "Cabernet Franc",
      vintage: "2021",
      winery: "Test Domaine",
    },
  });
});

describe("major route composition", () => {
  it.each([
    ["/", /Find the bottle.*Keep the memory/i],
    ["/discover", /Tell us the moment.*help find the bottle/i],
    ["/login", /Sign in to open your cellar/i],
    ["/signup", /Begin your personal wine memory/i],
    ["/demo/cellar", /A cellar designed around the moments bottles join/i],
    ["/demo/taste-atlas", /A Taste Atlas made from fixture data alone/i],
  ])("renders a direct load of %s", async (path, heading) => {
    renderRoute(path);
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("renders a direct wine-detail route from the real envelope shape", async () => {
    renderRoute("/wines/source-wine-17");
    expect(
      await screen.findByRole("heading", { name: "Direct Route Rouge" }),
    ).toBeInTheDocument();
  });

  it.each(["/cellar?status=favorite#entry-7", "/profile"])(
    "redirects signed-out protected route %s to login",
    async (path) => {
      renderRoute(path);
      expect(
        await screen.findByRole("heading", { name: /Sign in to open your cellar/i }),
      ).toBeInTheDocument();
      expect(mocks.getCellarEntries).not.toHaveBeenCalled();
    },
  );

  it("navigates between both public demos without touching the private cellar API", async () => {
    renderRoute("/demo/cellar");
    fireEvent.click(
      await screen.findByRole("link", { name: /View demo Taste Atlas/i }),
    );
    expect(
      await screen.findByRole("heading", { name: /A Taste Atlas made from fixture data alone/i }),
    ).toBeInTheDocument();
    expect(mocks.getCellarEntries).not.toHaveBeenCalled();
  });
});
