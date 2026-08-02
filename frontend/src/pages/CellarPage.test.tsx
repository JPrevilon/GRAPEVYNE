import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider.jsx";
import CellarPage from "./CellarPage";

const mocks = vi.hoisted(() => ({ getCellarEntries: vi.fn() }));

vi.mock("@/api/cellar", () => ({
  deleteCellarEntry: vi.fn(),
  getCellarEntries: mocks.getCellarEntries,
  updateCellarEntry: vi.fn(),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { id: 42, email: "live@example.com", name: "Live User" } }),
}));

function renderCellar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CellarPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  mocks.getCellarEntries.mockReset();
});

describe("protected live cellar", () => {
  it("renders only authenticated API entries", async () => {
    mocks.getCellarEntries.mockResolvedValue({
      count: 1,
      entries: [
        {
          createdAt: "2026-01-01T00:00:00Z",
          favorite: false,
          id: 91,
          notes: null,
          occasion: null,
          savedAt: "2026-01-01T00:00:00Z",
          status: "saved",
          tags: [],
          updatedAt: "2026-01-01T00:00:00Z",
          userId: 42,
          userRating: null,
          wine: {
            id: 19,
            imageUrl: null,
            name: "Live Session Merlot",
            region: "Sonoma",
            varietal: "Merlot",
            vintage: "2022",
            winery: "Backend Estate",
          },
          wineId: 19,
        },
      ],
    });

    renderCellar();

    expect(await screen.findByText("Live Session Merlot")).toBeInTheDocument();
    expect(screen.queryByText("Estate Cabernet Sauvignon")).not.toBeInTheDocument();
    expect(mocks.getCellarEntries).toHaveBeenCalledTimes(1);
  });

  it("shows an honest API error and never falls back to a demo bottle", async () => {
    mocks.getCellarEntries.mockRejectedValue(new Error("The live cellar service failed."));

    renderCellar();

    expect(
      await screen.findByRole("heading", { name: /saved cellar is unavailable/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No demonstration bottles have been substituted/i)).toBeInTheDocument();
    expect(screen.queryByText("Estate Cabernet Sauvignon")).not.toBeInTheDocument();
  });
});
