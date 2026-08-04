import { expect, test } from "@playwright/test";

test.describe("discovery reliability", () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "Discovery edge cases run once in desktop Chromium.",
    );
  });

  test("validation, empty results, disclosure, and keyboard breakdown stay truthful", async ({
    page,
  }) => {
    await page.goto("/discover");

    await page.getByRole("searchbox", { name: "Search wines" }).fill("<bad>");
    await page.getByRole("button", { name: "Match", exact: true }).click();
    await expect(
      page.getByText(
        "Use 2 to 300 plain-text characters to describe a wine, meal, region, or occasion.",
      ),
    ).toBeVisible();

    const emptyResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/wines/recommendations") &&
        new URL(response.url()).searchParams.get("query") === "a rosé",
    );
    await page.getByRole("searchbox", { name: "Search wines" }).fill("a rosé");
    await page.getByRole("button", { name: "Match", exact: true }).click();
    expect((await emptyResponse).status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /NO EXPLAINABLE MATCH FOR/i }),
    ).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Limited catalog");

    const resultResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/wines/recommendations") &&
        response.url().includes("steak"),
    );
    await page
      .getByRole("searchbox", { name: "Search wines" })
      .fill("bold red under $60 for steak night");
    await page.getByRole("button", { name: "Match", exact: true }).click();
    expect((await resultResponse).status()).toBe(200);

    const breakdownButton = page
      .getByRole("button", { name: /^Show full score breakdown for / })
      .first();
    const panelId = await breakdownButton.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    await breakdownButton.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`[aria-controls="${panelId}"]`)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.locator(`#${panelId}`)).toContainText(
      "The overall score is earned points divided by available points.",
    );
  });

  test("an unreachable API has an explicit demo escape hatch and recovers", async ({
    page,
  }) => {
    let failedRequests = 0;
    await page.route("**/api/wines/recommendations?*", async (route) => {
      failedRequests += 1;
      await route.abort("failed");
    });
    await page.goto("/discover?query=crisp%20white%20for%20oysters");

    await expect(
      page.getByRole("heading", { name: "THE GRAPEVYNE API IS OUT OF REACH" }),
    ).toBeVisible();
    expect(failedRequests).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole("link", { name: "Open read-only demo" })).toHaveAttribute(
      "href",
      "/demo/cellar",
    );

    await page.unroute("**/api/wines/recommendations?*");
    const recoveredResponse = page.waitForResponse(
      (response) => response.url().includes("/api/wines/recommendations"),
    );
    await page.getByRole("button", { name: "Try again" }).click();
    expect((await recoveredResponse).status()).toBe(200);
    await expect(
      page.getByRole("link", { name: /^View .+ with recommendation context$/ }).first(),
    ).toBeVisible();
  });

  test("superseded recommendation requests cannot replace the current query", async ({
    page,
  }) => {
    let staleResponseBody: {
      data: Record<string, unknown>;
      [key: string]: unknown;
    } | null = null;
    let releaseFirstRequest = () => {};
    const firstRequestMayContinue = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve;
    });
    let firstRequestSeen = () => {};
    const firstRequestStarted = new Promise<void>((resolve) => {
      firstRequestSeen = resolve;
    });
    let firstRequestSettled = () => {};
    const firstRequestFinished = new Promise<void>((resolve) => {
      firstRequestSettled = resolve;
    });

    await page.route("**/api/wines/recommendations?*", async (route) => {
      const query = new URL(route.request().url()).searchParams.get("query");
      const isFirstRequest = query === "bold red for steak";

      if (isFirstRequest) {
        firstRequestSeen();
        await firstRequestMayContinue;
        try {
          if (!staleResponseBody) {
            throw new Error("The deterministic stale response was not prepared.");
          }
          await route.fulfill({
            contentType: "application/json",
            json: staleResponseBody,
            status: 200,
          });
        } catch {
          // React Query is expected to abort the superseded request. If it no
          // longer does, the delayed successful response is still delivered
          // and must remain isolated from the current query.
        } finally {
          firstRequestSettled();
        }
        return;
      }

      await route.continue();
    });

    await page.goto("/discover");
    const input = page.getByRole("searchbox", { name: "Search wines" });
    await input.fill("bold red for steak");
    await page.getByRole("button", { name: "Match", exact: true }).click();
    await firstRequestStarted;

    await input.fill("crisp white for oysters");
    const secondResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/wines/recommendations") &&
        response.url().includes("crisp+white+for+oysters"),
    );
    await page.getByRole("button", { name: "Match", exact: true }).click();
    const currentResponse = await secondResponse;
    expect(currentResponse.status()).toBe(200);
    const currentResponseBody = (await currentResponse.json()) as {
      data: Record<string, unknown>;
      [key: string]: unknown;
    };
    staleResponseBody = {
      ...currentResponseBody,
      data: {
        ...currentResponseBody.data,
        query: "bold red for steak",
      },
    };
    await expect(
      page
        .getByLabel("WHAT THE ENGINE UNDERSTOOD")
        .getByText("crisp white for oysters", { exact: true }),
    ).toBeVisible();

    releaseFirstRequest();
    await firstRequestFinished;
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/query=crisp\+white\+for\+oysters/);
    await expect(
      page.getByRole("heading", { name: "WHAT THE ENGINE UNDERSTOOD" }),
    ).toBeVisible();
    await expect(page.getByText("bold red for steak", { exact: true })).toHaveCount(0);
  });
});
