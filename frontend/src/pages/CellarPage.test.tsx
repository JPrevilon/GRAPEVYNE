import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/client";
import { ToastProvider } from "@/components/ui/ToastProvider.jsx";
import type { CellarEntry, Wine } from "@/types/domain";

import CellarPage from "./CellarPage";

const mocks = vi.hoisted(() => ({
  deleteCellarEntry: vi.fn(),
  getCellarEntries: vi.fn(),
  handleAuthenticationRequired: vi.fn(),
  authStatus: "ready" as "error" | "loading" | "ready",
  updateCellarEntry: vi.fn(),
  userId: 42,
}));

vi.mock("@/api/cellar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/cellar")>()),
  deleteCellarEntry: mocks.deleteCellarEntry,
  getCellarEntries: mocks.getCellarEntries,
  updateCellarEntry: mocks.updateCellarEntry,
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    handleAuthenticationRequired: mocks.handleAuthenticationRequired,
    status: mocks.authStatus,
    user: { id: mocks.userId, email: "live@example.com", name: "Live User" },
  }),
}));

type EntryOverrides = Omit<Partial<CellarEntry>, "wine"> & {
  wine?: Partial<Wine>;
};

function createEntry(overrides: EntryOverrides = {}): CellarEntry {
  const { wine: wineOverrides, ...entryOverrides } = overrides;
  const wine: Wine = {
    acidity: null,
    averageRating: null,
    body: null,
    country: null,
    createdAt: null,
    description: null,
    externalApiId: "live-session-merlot-2022",
    externalWineId: "live-session-merlot-2022",
    id: 19,
    imageUrl: null,
    name: "Live Session Merlot",
    occasion: null,
    pairings: [],
    priceCents: null,
    region: "Sonoma",
    servingTemp: null,
    source: "mock",
    sweetness: null,
    tastingNotes: [],
    updatedAt: null,
    varietal: "Merlot",
    vintage: "2022",
    winery: "Backend Estate",
    ...wineOverrides,
  };

  return {
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
    wineId: wine.id as number,
    ...entryOverrides,
    wine,
  };
}

function renderCellar() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  const cellarTree = () => (
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CellarPage />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  const view = render(cellarTree());

  return {
    ...view,
    queryClient,
    rerenderCellar: () => view.rerender(cellarTree()),
  };
}

function entryButton(name = "Live Session Merlot") {
  return screen.getByRole("button", { name: new RegExp(name, "i") });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authStatus = "ready";
  mocks.userId = 42;
  mocks.handleAuthenticationRequired.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
});

describe("protected live cellar", () => {
  it("shows an honest loading state while the owned cellar request is pending", () => {
    mocks.getCellarEntries.mockReturnValue(new Promise(() => undefined));

    renderCellar();

    expect(
      screen.getByRole("heading", { level: 1, name: "YOUR CELLAR" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "OPENING YOUR SAVED BOTTLES" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /owned by this signed-in session/i,
    );
  });

  it("renders only authenticated API entries and omits unavailable metadata", async () => {
    mocks.getCellarEntries.mockResolvedValue({
      count: 1,
      entries: [createEntry()],
    });

    renderCellar();

    expect(await screen.findByRole("button", { name: /Live Session Merlot/i })).toBeInTheDocument();
    expect(screen.queryByText("Estate Cabernet Sauvignon")).not.toBeInTheDocument();
    expect(screen.queryByText(/unrated/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/price unavailable/i)).not.toBeInTheDocument();
    expect(mocks.getCellarEntries).toHaveBeenCalledTimes(1);
  });

  it("marks API bottle labels and varietals to preserve their source casing", async () => {
    mocks.getCellarEntries.mockResolvedValue({
      count: 1,
      entries: [
        createEntry({
          wine: {
            name: "mIxEd Case Cuvée",
            varietal: "Cabernet fRanc",
          },
        }),
      ],
    });

    const view = renderCellar();

    expect(
      await screen.findByRole("button", { name: /mIxEd Case Cuvée/i }),
    ).toBeInTheDocument();
    expect(
      view.container.querySelector(".gv-bottle__label .gv-dynamic-data"),
    ).toHaveTextContent("mIxEd Case Cuvée");
    expect(screen.getByText("Cabernet fRanc")).toHaveClass("gv-eyebrow--data");

    fireEvent.click(entryButton("mIxEd Case Cuvée"));

    expect(
      await screen.findByRole("heading", { name: "mIxEd Case Cuvée" }),
    ).toBeInTheDocument();
    screen.getAllByText("Cabernet fRanc").forEach((varietal) => {
      expect(varietal).toHaveClass("gv-eyebrow--data");
    });
  });

  it("shows an honest API error and never falls back to a demo bottle", async () => {
    mocks.getCellarEntries.mockRejectedValue(
      new Error("The live cellar service failed."),
    );

    renderCellar();

    expect(
      await screen.findByRole("heading", { name: /saved cellar is unavailable/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No demonstration bottles have been substituted/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Estate Cabernet Sauvignon")).not.toBeInTheDocument();
  });

  it("revalidates the current owner when the cellar list reports session expiry", async () => {
    mocks.getCellarEntries.mockRejectedValue(
      new ApiError("Authentication is required.", {
        code: "authentication_required",
        status: 401,
      }),
    );

    renderCellar();

    await screen.findByRole("heading", { name: /saved cellar is unavailable/i });
    await waitFor(() => {
      expect(mocks.handleAuthenticationRequired).toHaveBeenCalledWith(42);
    });
  });

  it("rejects and never caches a cellar list containing another owner's entry", async () => {
    mocks.getCellarEntries.mockResolvedValue({
      count: 1,
      entries: [createEntry({ userId: 99 })],
    });

    const { queryClient } = renderCellar();

    expect(
      await screen.findByRole("heading", { name: /saved cellar is unavailable/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Live Session Merlot/i })).not.toBeInTheDocument();
    expect(
      queryClient.getQueryData(["private", 42, "cellar"]),
    ).toBeUndefined();
    await waitFor(() => {
      expect(mocks.handleAuthenticationRequired).toHaveBeenCalledWith(42);
    });
  });

  it("shows the live empty state only after the API confirms an empty cellar", async () => {
    mocks.getCellarEntries.mockResolvedValue({ count: 0, entries: [] });

    renderCellar();

    expect(
      await screen.findByRole("heading", {
        name: "YOUR CELLAR IS READY FOR ITS FIRST BOTTLE",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discover a wine" })).toHaveAttribute(
      "href",
      "/discover",
    );
  });

  it("provides an honest no-match state for local cellar search", async () => {
    mocks.getCellarEntries.mockResolvedValue({
      count: 1,
      entries: [createEntry()],
    });

    renderCellar();
    await screen.findByRole("button", { name: /Live Session Merlot/i });

    fireEvent.change(screen.getByLabelText("Search your cellar"), {
      target: { value: "Mosel Riesling" },
    });

    expect(
      screen.getByRole("heading", { name: "NO SAVED BOTTLE MATCHES THIS SEARCH" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Live Session Merlot/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(entryButton()).toBeInTheDocument();
  });

  it("keeps repeated API entries visible and labels the integrity state", async () => {
    const repeatedEntry = createEntry({
      id: 92,
      wine: { name: "Repeated Live Session Merlot" },
      wineId: 19,
    });
    mocks.getCellarEntries.mockResolvedValue({
      count: 2,
      entries: [createEntry(), repeatedEntry],
    });

    renderCellar();

    expect(
      await screen.findByRole("heading", {
        name: "REPEATED SAVED-WINE RECORDS WERE RECEIVED",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Live Session Merlot/i }),
    ).toHaveLength(2);
    expect(document.getElementById("cellar-entry-91-trigger")).toBeInTheDocument();
    expect(document.getElementById("cellar-entry-92-trigger")).toBeInTheDocument();
  });

  it("opens the controlled side panel and sends exact PATCH fields with busy and success feedback", async () => {
    const entry = createEntry();
    const updatedEntry = createEntry({
      favorite: true,
      notes: "Black cherry and cedar.",
      occasion: "Anniversary dinner",
      status: "tasted",
      userRating: 5,
    });
    let resolveUpdate: ((value: CellarEntry) => void) | undefined;
    mocks.getCellarEntries.mockResolvedValue({ count: 1, entries: [entry] });
    mocks.updateCellarEntry.mockReturnValue(
      new Promise<CellarEntry>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    renderCellar();
    const bottleButton = await screen.findByRole("button", {
      name: /Live Session Merlot/i,
    });
    fireEvent.click(bottleButton);

    expect(bottleButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("complementary", { name: "Live Session Merlot" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Personal rating"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Cellar status"), {
      target: { value: "tasted" },
    });
    fireEvent.change(screen.getByLabelText("Occasion"), {
      target: { value: "Anniversary dinner" },
    });
    fireEvent.change(screen.getByLabelText("Private tasting note"), {
      target: { value: "Black cherry and cedar." },
    });
    fireEvent.click(screen.getByLabelText("Mark as favorite"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("button", { name: "Saving changes…" })).toBeDisabled();
    expect(screen.getByLabelText("Occasion")).toBeDisabled();
    await waitFor(() =>
      expect(mocks.updateCellarEntry).toHaveBeenCalledWith(
        91,
        {
          favorite: true,
          notes: "Black cherry and cedar.",
          occasion: "Anniversary dinner",
          status: "tasted",
          userRating: 5,
        },
        42,
      ),
    );

    await act(async () => {
      resolveUpdate?.(updatedEntry);
      await Promise.resolve();
    });

    expect(
      await screen.findByText("Changes saved to your private cellar."),
    ).toBeInTheDocument();
    expect(screen.getByText("Bottle updated")).toBeInTheDocument();
  });

  it("keeps server-confirmed cellar data unchanged when PATCH fails", async () => {
    const entry = createEntry();
    mocks.getCellarEntries.mockResolvedValue({ count: 1, entries: [entry] });
    mocks.updateCellarEntry.mockRejectedValue(
      new Error("This request did not come from a trusted application origin."),
    );

    renderCellar();
    fireEvent.click(
      await screen.findByRole("button", { name: /Live Session Merlot/i }),
    );
    fireEvent.click(screen.getByLabelText("Mark as favorite"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(
        screen.getAllByText(
          "This request did not come from a trusted application origin.",
        ),
      ).toHaveLength(2);
    });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(screen.getByText("Update failed")).toBeInTheDocument();
    expect(entry.favorite).toBe(false);
  });

  it("suppresses a PATCH result and private toast during session revalidation", async () => {
    const entry = createEntry();
    const updatedEntry = createEntry({ favorite: true });
    let resolveUpdate: ((value: CellarEntry) => void) | undefined;
    mocks.getCellarEntries.mockResolvedValue({ count: 1, entries: [entry] });
    mocks.updateCellarEntry.mockReturnValue(
      new Promise<CellarEntry>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    const { queryClient, rerenderCellar } = renderCellar();
    fireEvent.click(
      await screen.findByRole("button", { name: /Live Session Merlot/i }),
    );
    fireEvent.click(screen.getByLabelText("Mark as favorite"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.updateCellarEntry).toHaveBeenCalledOnce());

    mocks.authStatus = "loading";
    rerenderCellar();

    await act(async () => {
      resolveUpdate?.(updatedEntry);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("Bottle updated")).not.toBeInTheDocument();
    expect(
      queryClient.getQueryData<{ entries: CellarEntry[] }>([
        "private",
        42,
        "cellar",
      ])?.entries[0],
    ).toMatchObject({ favorite: true, userId: 42 });
  });

  it("revalidates the current owner when PATCH reports session expiry", async () => {
    mocks.getCellarEntries.mockResolvedValue({
      count: 1,
      entries: [createEntry()],
    });
    mocks.updateCellarEntry.mockRejectedValue(
      new ApiError("Authentication is required.", {
        code: "authentication_required",
        status: 401,
      }),
    );

    renderCellar();
    fireEvent.click(
      await screen.findByRole("button", { name: /Live Session Merlot/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mocks.handleAuthenticationRequired).toHaveBeenCalledWith(42);
    });
    expect(screen.queryByText("Bottle updated")).not.toBeInTheDocument();
  });

  it("rejects a PATCH response owned by another user before cache or success feedback", async () => {
    const originalEntry = createEntry();
    mocks.getCellarEntries.mockResolvedValue({
      count: 1,
      entries: [originalEntry],
    });
    mocks.updateCellarEntry.mockResolvedValue(
      createEntry({ favorite: true, userId: 99 }),
    );

    const { queryClient } = renderCellar();
    fireEvent.click(
      await screen.findByRole("button", { name: /Live Session Merlot/i }),
    );
    fireEvent.click(screen.getByLabelText("Mark as favorite"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mocks.handleAuthenticationRequired).toHaveBeenCalledWith(42);
    });
    expect(screen.queryByText("Bottle updated")).not.toBeInTheDocument();
    expect(
      queryClient.getQueryData<{ entries: CellarEntry[] }>([
        "private",
        42,
        "cellar",
      ])?.entries[0],
    ).toMatchObject({ favorite: false, userId: 42 });
  });

  it("requires inline confirmation before DELETE and reports the resulting empty state", async () => {
    const entry = createEntry();
    let resolveDelete: ((value: number) => void) | undefined;
    mocks.getCellarEntries.mockResolvedValue({ count: 1, entries: [entry] });
    mocks.deleteCellarEntry.mockReturnValue(
      new Promise<number>((resolve) => {
        resolveDelete = resolve;
      }),
    );

    renderCellar();
    fireEvent.click(
      await screen.findByRole("button", { name: /Live Session Merlot/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove bottle" }));

    expect(mocks.deleteCellarEntry).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm removal" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove bottle" })).toHaveFocus(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove bottle" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));

    expect(screen.getByRole("button", { name: "Removing bottle…" })).toBeDisabled();
    await waitFor(() =>
      expect(mocks.deleteCellarEntry).toHaveBeenCalledWith(91, 42),
    );

    await act(async () => {
      resolveDelete?.(91);
      await Promise.resolve();
    });

    expect(
      await screen.findByRole("heading", {
        name: "YOUR CELLAR IS READY FOR ITS FIRST BOTTLE",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bottle removed")).toBeInTheDocument();
  });

  it("reconciles a confirmed DELETE but suppresses its toast during revalidation", async () => {
    const entry = createEntry();
    let resolveDelete: ((value: number) => void) | undefined;
    mocks.getCellarEntries.mockResolvedValue({ count: 1, entries: [entry] });
    mocks.deleteCellarEntry.mockReturnValue(
      new Promise<number>((resolve) => {
        resolveDelete = resolve;
      }),
    );

    const { queryClient, rerenderCellar } = renderCellar();
    fireEvent.click(
      await screen.findByRole("button", { name: /Live Session Merlot/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove bottle" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
    await waitFor(() => expect(mocks.deleteCellarEntry).toHaveBeenCalledOnce());

    mocks.authStatus = "loading";
    rerenderCellar();
    await act(async () => {
      resolveDelete?.(91);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("Bottle removed")).not.toBeInTheDocument();
    expect(
      queryClient.getQueryData<{ entries: CellarEntry[] }>([
        "private",
        42,
        "cellar",
      ]),
    ).toMatchObject({ count: 0, entries: [] });
  });

  it("keeps the bottle visible and retryable when DELETE fails", async () => {
    const entry = createEntry();
    mocks.getCellarEntries.mockResolvedValue({ count: 1, entries: [entry] });
    mocks.deleteCellarEntry.mockRejectedValue(
      new Error("The cellar service is unavailable."),
    );

    renderCellar();
    fireEvent.click(
      await screen.findByRole("button", { name: /Live Session Merlot/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove bottle" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));

    await waitFor(() => {
      expect(
        screen.getAllByText("The cellar service is unavailable."),
      ).toHaveLength(2);
    });
    expect(entryButton()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm removal" })).toBeEnabled();
    expect(screen.getByText("Remove failed")).toBeInTheDocument();
    expect(screen.queryByText("Bottle removed")).not.toBeInTheDocument();
  });

  it("revalidates the current owner when DELETE reports session expiry", async () => {
    mocks.getCellarEntries.mockResolvedValue({
      count: 1,
      entries: [createEntry()],
    });
    mocks.deleteCellarEntry.mockRejectedValue(
      new ApiError("Authentication is required.", {
        code: "authentication_required",
        status: 401,
      }),
    );

    renderCellar();
    fireEvent.click(
      await screen.findByRole("button", { name: /Live Session Merlot/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove bottle" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));

    await waitFor(() => {
      expect(mocks.handleAuthenticationRequired).toHaveBeenCalledWith(42);
    });
    expect(entryButton()).toBeInTheDocument();
    expect(screen.queryByText("Bottle removed")).not.toBeInTheDocument();
  });
});
