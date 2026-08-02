import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteCellarEntry,
  getCellarEntries,
  getCellarEntry,
  saveWineToCellar,
  updateCellarEntry,
} from "@/api/cellar";
import { apiRequest } from "@/api/client";
import { getWineDetail, searchWines } from "@/api/wines";

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();

  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

const rawWine = {
  averageRating: 4.2,
  country: "France",
  description: "A catalog description.",
  externalWineId: "service-pinot-2021",
  imageUrl: null,
  name: "Service Pinot Noir",
  priceCents: 4200,
  region: "Burgundy",
  source: "static",
  varietal: "Pinot Noir",
  vintage: "2021",
  winery: "Service Domaine",
};

const rawEntry = {
  createdAt: "2026-08-02T12:00:00+00:00",
  favorite: false,
  id: 19,
  notes: null,
  occasion: null,
  savedAt: "2026-08-02T12:00:00+00:00",
  status: "saved",
  tags: [],
  updatedAt: "2026-08-02T12:00:00+00:00",
  userId: 7,
  userRating: null,
  wine: { ...rawWine, externalApiId: "service-pinot-2021", id: 11 },
  wineId: 11,
};

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe("live wine client", () => {
  it("trims and URL-encodes search queries while forwarding React Query cancellation", async () => {
    const controller = new AbortController();
    mockedApiRequest.mockResolvedValue({
      data: {
        query: "steak & fries",
        results: [rawWine],
        source: "static",
      },
    });

    await expect(
      searchWines("  steak & fries  ", controller.signal),
    ).resolves.toMatchObject({
      query: "steak & fries",
      results: [{ externalWineId: "service-pinot-2021" }],
      source: "static",
    });
    expect(mockedApiRequest).toHaveBeenCalledWith(
      "/wines/search?query=steak+%26+fries",
      { signal: controller.signal },
    );
  });

  it("rejects an empty search locally and uses the real external ID for detail", async () => {
    await expect(searchWines("   ")).rejects.toMatchObject({
      code: "missing_query",
      status: 400,
    });
    expect(mockedApiRequest).not.toHaveBeenCalled();

    mockedApiRequest.mockResolvedValue({
      data: { source: "static", wine: rawWine },
    });
    await getWineDetail("provider/id 17");

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "/wines/provider%2Fid%2017",
      { signal: undefined },
    );
  });
});

describe("owner-safe cellar client", () => {
  it("uses every live CRUD endpoint and normalizes the Flask envelopes", async () => {
    const controller = new AbortController();
    mockedApiRequest
      .mockResolvedValueOnce({ data: { count: 1, entries: [rawEntry] } })
      .mockResolvedValueOnce({ data: { entry: rawEntry } })
      .mockResolvedValueOnce({ data: { entry: rawEntry } })
      .mockResolvedValueOnce({ data: { entry: { ...rawEntry, favorite: true } } })
      .mockResolvedValueOnce({ data: { deletedId: 19 } });

    await expect(getCellarEntries(controller.signal)).resolves.toMatchObject({
      count: 1,
      entries: [{ id: 19, userId: 7 }],
    });
    await expect(getCellarEntry(19, controller.signal)).resolves.toMatchObject({
      id: 19,
    });
    await expect(
      saveWineToCellar({ externalWineId: "service-pinot-2021" }, 7),
    ).resolves.toMatchObject({ id: 19 });
    await expect(
      updateCellarEntry(19, { favorite: true }, 7),
    ).resolves.toMatchObject({ favorite: true });
    await expect(deleteCellarEntry(19, 7)).resolves.toBe(19);

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, "/cellar", {
      signal: controller.signal,
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, "/cellar/19", {
      signal: controller.signal,
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(3, "/cellar", {
      body: JSON.stringify({ externalWineId: "service-pinot-2021" }),
      headers: { "X-Grapevyne-Expected-User-Id": "7" },
      method: "POST",
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(4, "/cellar/19", {
      body: JSON.stringify({ favorite: true }),
      headers: { "X-Grapevyne-Expected-User-Id": "7" },
      method: "PATCH",
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(5, "/cellar/19", {
      headers: { "X-Grapevyne-Expected-User-Id": "7" },
      method: "DELETE",
    });
  });

  it("does not forward forged ownership or unknown fields in create and update payloads", async () => {
    mockedApiRequest.mockResolvedValue({ data: { entry: rawEntry } });

    await saveWineToCellar(
      {
        account_id: 501,
        externalWineId: "service-pinot-2021",
        owner_id: 502,
        userId: 503,
      } as never,
      7,
    );
    await updateCellarEntry(
      19,
      {
        favorite: true,
        owner_id: 502,
        userId: 503,
        wineId: 999,
      } as never,
      7,
    );

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, "/cellar", {
      body: JSON.stringify({ externalWineId: "service-pinot-2021" }),
      headers: { "X-Grapevyne-Expected-User-Id": "7" },
      method: "POST",
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, "/cellar/19", {
      body: JSON.stringify({ favorite: true }),
      headers: { "X-Grapevyne-Expected-User-Id": "7" },
      method: "PATCH",
    });
  });

  it("rejects an invalid expected owner before issuing a private mutation", async () => {
    await expect(
      saveWineToCellar({ externalWineId: "service-pinot-2021" }, 0),
    ).rejects.toThrow("positive integer");
    await expect(deleteCellarEntry(19, Number.NaN)).rejects.toThrow(
      "positive integer",
    );

    expect(mockedApiRequest).not.toHaveBeenCalled();
  });
});
