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
  renderWebGLExperience: vi.fn(),
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

vi.mock("@/experience/webgl/WebGLExperience", () => ({
  default: () => {
    mocks.renderWebGLExperience();
    return <div aria-hidden="true" data-testid="webgl-home-loader" />;
  },
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
  mocks.renderWebGLExperience.mockClear();
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
    ["/", "FIND THE BOTTLE KEEP THE MEMORY"],
    ["/discover", "DISCOVER WINES"],
    ["/login", "RETURN TO YOUR CELLAR"],
    ["/signup", "CREATE YOUR CELLAR"],
    ["/demo/cellar", "DEMO CELLAR"],
    ["/demo/taste-atlas", "DEMO TASTE ATLAS"],
  ])("renders a direct load of %s", async (path, heading) => {
    const view = renderRoute(path);
    const routeHeading = await screen.findByRole("heading", {
      level: 1,
      name: heading,
    });

    expect(routeHeading).toBeInTheDocument();
    expect(routeHeading).toHaveAccessibleName(heading);
    expect(routeHeading.getAttribute("aria-label") ?? routeHeading.textContent).not.toMatch(
      /[.!?]$/,
    );
    expect(view.container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("renders a direct wine-detail route from the real envelope shape", async () => {
    renderRoute("/wines/source-wine-17");
    expect(
      await screen.findByRole("heading", { name: "Direct Route Rouge" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["/discover", "DISCOVER WINES"],
    ["/login", "RETURN TO YOUR CELLAR"],
    ["/demo/cellar", "DEMO CELLAR"],
    ["/demo/taste-atlas", "DEMO TASTE ATLAS"],
    ["/wines/source-wine-17", "Direct Route Rouge"],
  ])("does not render the Home WebGL loader or a canvas on %s", async (path, heading) => {
    const view = renderRoute(path);

    expect(
      await screen.findByRole("heading", { name: heading }),
    ).toBeInTheDocument();
    expect(mocks.renderWebGLExperience).not.toHaveBeenCalled();
    expect(screen.queryByTestId("webgl-home-loader")).not.toBeInTheDocument();
    expect(view.container.querySelector("canvas")).not.toBeInTheDocument();
  });

  it.each(["/cellar?status=favorite#entry-7", "/profile"])(
    "redirects signed-out protected route %s to login",
    async (path) => {
      renderRoute(path);
      expect(
        await screen.findByRole("heading", { name: "RETURN TO YOUR CELLAR" }),
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
      await screen.findByRole("heading", { name: "DEMO TASTE ATLAS" }),
    ).toBeInTheDocument();
    expect(mocks.getCellarEntries).not.toHaveBeenCalled();
  });
});
