import { expect, test, type Page } from "@playwright/test";

import { disposableAccount, type DisposableAccount } from "./helpers/accounts";
import {
  envelopeData,
  sameOriginApi,
  type ApiEnvelope,
  type ApiErrorEnvelope,
  type AuthenticatedUserData,
  type CellarEntryData,
  type CellarListData,
} from "./helpers/api";
import {
  expectNoHorizontalOverflow,
  monitorPageIssues,
} from "./helpers/browser";
import { createCellarEntryThroughPreview } from "./helpers/seed";

const storyHeadings = [
  "FIND THE BOTTLE KEEP THE MEMORY",
  "DESCRIBE THE MOMENT",
  "WHY IT FITS",
  "TASTE TAKES SHAPE",
  "OPEN THE CELLAR",
  "BUILD THE COLLECTION",
  "REMEMBER THE POUR",
  "YOUR TASTE ATLAS",
  "KEEP THE STORY",
] as const;

async function completeSignup(page: Page, account: DisposableAccount) {
  await page.getByLabel("Name").fill(account.name);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/signup") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  return response;
}

async function completeLogin(page: Page, account: DisposableAccount) {
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await responsePromise).status()).toBe(200);
}

async function logoutThroughUi(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/logout") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Logout" }).click();
  expect((await responsePromise).status()).toBe(200);
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toMatch(/^\/(?:login)?$/);
}

async function expectExactLocation(page: Page, expected: string) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          `${window.location.pathname}${window.location.search}${window.location.hash}`,
      ),
    )
    .toBe(expected);
}

test.describe("hosted Preview release contract", () => {
  test.skip(
    process.env.GRAPEVYNE_E2E_MODE !== "hosted-preview",
    "Hosted checks run only through the explicit Preview runner.",
  );
  test.describe.configure({ mode: "serial" });

  test("@hosted direct routes and public APIs stay on the inspected Preview origin", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "The full hosted route contract runs once in desktop Chromium.",
    );
    test.setTimeout(120_000);

    const monitor = monitorPageIssues(page);
    const baseOrigin = new URL(testInfo.project.use.baseURL as string).origin;
    const crossOriginApiRequests: string[] = [];
    const crossOriginApprovedAssets: string[] = [];

    page.on("request", (request) => {
      const url = new URL(request.url());

      if (url.pathname.startsWith("/api/") && url.origin !== baseOrigin) {
        crossOriginApiRequests.push(url.origin);
      }

      if (
        /\.(?:glb|jpe?g|mp4|png|svg|webm|woff2?)(?:$|\?)/i.test(url.pathname) &&
        url.origin !== baseOrigin
      ) {
        crossOriginApprovedAssets.push(url.origin);
      }
    });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("section[data-story-chapter]")).toHaveCount(9);
    for (const heading of storyHeadings) {
      await expect(page.getByRole("heading", { name: heading })).toBeAttached();
    }

    await page.setViewportSize({ height: 1080, width: 1920 });
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ height: 932, width: 430 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: storyHeadings[0] }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ height: 900, width: 1440 });

    await page.goto("/discover");
    await expect(
      page.getByRole("heading", { level: 1, name: "DISCOVER WINES" }),
    ).toBeVisible();
    await page.goto(
      "/wines/mock-chateau-montelena-cabernet-sauvignon-2019",
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Estate Cabernet Sauvignon",
      }),
    ).toBeVisible();
    await page.goto("/demo/cellar");
    await expect(page.getByLabel("Search the fictional collection")).toBeVisible();
    await page.goto("/demo/taste-atlas");
    await expect(
      page.getByRole("heading", {
        name: "ILLUSTRATIVE PATTERNS—NOT A VISITOR PROFILE",
      }),
    ).toBeVisible();
    await page.goto("/login");
    await expect(page.getByRole("form", { name: "Sign in form" })).toBeVisible();
    await page.goto("/signup");
    await expect(
      page.getByRole("form", { name: "Create account form" }),
    ).toBeVisible();
    await page.goto("/cellar");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/an-intentional-404");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "THIS PAGE IS NOT IN THE DIRECTORY",
      }),
    ).toBeVisible();

    const health = await page.request.get("/api/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({
      data: { service: "grapevyne-api", status: "ok" },
    });
    const signedOutMe = await page.request.get("/api/auth/me");
    expect(signedOutMe.status()).toBe(401);
    expect(await signedOutMe.json()).toMatchObject({
      error: { code: "authentication_required" },
    });
    const search = await page.request.get("/api/wines/search?query=steak");
    expect(search.status()).toBe(200);
    const recommendations = await page.request.get(
      "/api/wines/recommendations?query=bold%20red%20under%2060%20for%20steak",
    );
    expect(recommendations.status()).toBe(200);
    const recommendationHeaders = recommendations.headers();
    expect(recommendationHeaders["cache-control"]).toBe("private, no-store");
    expect(recommendationHeaders.vary?.toLowerCase()).toContain("cookie");
    expect(recommendationHeaders["access-control-allow-origin"] === "*").toBe(
      false,
    );

    expect(crossOriginApiRequests).toEqual([]);
    expect(crossOriginApprovedAssets).toEqual([]);
    monitor.assertClean();
  });

  test("@hosted HTTPS sessions, private writes, and owner isolation survive the edge", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "The stateful hosted contract runs once in desktop Chromium.",
    );
    test.setTimeout(180_000);

    const accountA = disposableAccount("hosted-owner-a", testInfo);
    const accountB = disposableAccount("hosted-owner-b", testInfo);
    const wineId = "mock-chateau-montelena-cabernet-sauvignon-2019";
    const signupReturn =
      `/wines/${wineId}?request=bold+red+under+%2460+for+steak#hosted-signup`;
    const loginReturn =
      `/wines/${wineId}?request=Cabernet+for+anniversary#hosted-login`;

    await page.goto(signupReturn);
    await page.getByRole("button", { name: "Sign in to save" }).click();
    await page.getByRole("link", { name: "Create an account" }).click();
    const signupResponse = await completeSignup(page, accountA);
    await expectExactLocation(page, signupReturn);
    expect(Boolean(await signupResponse.headerValue("set-cookie"))).toBe(true);

    const sessionCookie = (await context.cookies()).find(
      (cookie) => cookie.name === "session",
    );
    expect(Boolean(sessionCookie)).toBe(true);
    if (!sessionCookie) throw new Error("The session cookie was not stored.");
    expect(sessionCookie.httpOnly).toBe(true);
    expect(sessionCookie.secure).toBe(true);
    expect(sessionCookie.sameSite).toBe("Lax");

    const meResponse = await sameOriginApi<ApiEnvelope<AuthenticatedUserData>>(
      page,
      "/api/auth/me",
    );
    const userA = envelopeData(meResponse).user;
    await page.reload();
    await expectExactLocation(page, signupReturn);
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();

    await page.goto("/profile");
    await expect(
      page.getByRole("heading", {
        name: "YOUR ATLAS IS READY FOR ITS FIRST BRANCH",
      }),
    ).toBeVisible();

    await page.goto(signupReturn);
    const firstSavePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/cellar") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save to my cellar" }).click();
    const firstSave = await firstSavePromise;
    expect(firstSave.status()).toBe(201);
    const firstSaveBody = (await firstSave.json()) as ApiEnvelope<CellarEntryData>;
    const entry = firstSaveBody.data.entry;

    await page.reload();
    const duplicateSavePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/cellar") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save to my cellar" }).click();
    expect((await duplicateSavePromise).status()).toBe(409);
    await expect(page.getByRole("button", { name: "Already in cellar" })).toBeDisabled();

    await page.goto("/cellar");
    await page.locator(`#cellar-entry-${entry.id}-trigger`).click();
    await page.getByLabel("Memory title").fill("Hosted anniversary memory");
    await page.getByLabel("Personal rating").selectOption("5");
    await page.getByLabel("Cellar status").selectOption("buy_again");
    await page
      .getByLabel("Private tasting note")
      .fill("Disposable Preview note for hosted verification.");
    await page.getByRole("radio", { name: "Yes", exact: true }).check();
    await page.getByRole("checkbox", { name: "Mark as favorite" }).check();
    const updatePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/cellar/${entry.id}`) &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save tasting memory" }).click();
    expect((await updatePromise).status()).toBe(200);

    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: "YOUR TASTE PROFILE IS STILL LIMITED" }),
    ).toBeVisible();

    await createCellarEntryThroughPreview(
      page,
      userA.id,
      "mock-argyle-reserve-pinot-noir-2021",
      { favorite: true, status: "tasted", userRating: 4, wouldBuyAgain: true },
    );
    await createCellarEntryThroughPreview(
      page,
      userA.id,
      "mock-frogs-leap-estate-sauvignon-blanc-2022",
      { favorite: false, status: "buy_again", userRating: 5, wouldBuyAgain: true },
    );
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: "YOUR RECORDED BRANCHES" }),
    ).toBeVisible();

    const rejectedCrossSite = await page.request.post("/api/auth/logout", {
      headers: {
        Origin: "https://attacker-preview.vercel.app",
        "Sec-Fetch-Site": "cross-site",
      },
    });
    expect(rejectedCrossSite.status()).toBe(403);
    expect(await rejectedCrossSite.json()).toMatchObject({
      error: { code: "csrf_origin_rejected" },
    });
    expect(
      rejectedCrossSite.headers()["access-control-allow-origin"] === "*",
    ).toBe(false);

    const previewHost = new URL(testInfo.project.use.baseURL as string).hostname;
    const rejectedHttpOrigin = await page.request.post("/api/auth/logout", {
      headers: {
        Origin: `http://${previewHost}`,
        "Sec-Fetch-Site": "same-origin",
      },
    });
    expect(rejectedHttpOrigin.status()).toBe(403);

    const authenticatedMe = await page.request.get("/api/auth/me");
    expect(authenticatedMe.status()).toBe(200);
    const privateHeaders = authenticatedMe.headers();
    expect(privateHeaders["cache-control"]).toBe("private, no-store");
    expect(privateHeaders.vary?.toLowerCase()).toContain("cookie");
    expect(
      ["HIT", "STALE"].includes(
        privateHeaders["x-vercel-cache"]?.toUpperCase() ?? "",
      ),
    ).toBe(false);

    await logoutThroughUi(page);
    await page.goto(loginReturn);
    await page.getByRole("button", { name: "Sign in to save" }).click();
    await completeLogin(page, accountA);
    await expectExactLocation(page, loginReturn);

    await logoutThroughUi(page);
    await page.goto("/signup");
    await completeSignup(page, accountB);
    const meB = await sameOriginApi<ApiEnvelope<AuthenticatedUserData>>(
      page,
      "/api/auth/me",
    );
    const userB = envelopeData(meB).user;
    expect(userB.id).not.toBe(userA.id);

    for (const response of await Promise.all([
      sameOriginApi<ApiErrorEnvelope>(page, `/api/cellar/${entry.id}`),
      sameOriginApi<ApiErrorEnvelope>(page, `/api/cellar/${entry.id}`, {
        body: { notes: "Attempted hosted overwrite" },
        expectedUserId: userB.id,
        method: "PATCH",
      }),
      sameOriginApi<ApiErrorEnvelope>(page, `/api/cellar/${entry.id}`, {
        expectedUserId: userB.id,
        method: "DELETE",
      }),
    ])) {
      expect(response.status).toBe(404);
      expect(response.body?.error.code).toBe("cellar_entry_not_found");
    }

    const ownerBList = await sameOriginApi<ApiEnvelope<CellarListData>>(
      page,
      "/api/cellar",
    );
    expect(envelopeData(ownerBList).count).toBe(0);
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", {
        name: "YOUR ATLAS IS READY FOR ITS FIRST BRANCH",
      }),
    ).toBeVisible();

    await logoutThroughUi(page);
    await page.goto("/login");
    await completeLogin(page, accountA);
    await page.goto("/cellar");
    await page.locator(`#cellar-entry-${entry.id}-trigger`).click();
    await expect(page.getByLabel("Memory title")).toHaveValue(
      "Hosted anniversary memory",
    );
    await expect(page.getByLabel("Private tasting note")).toHaveValue(
      "Disposable Preview note for hosted verification.",
    );

    const ownerAList = await sameOriginApi<ApiEnvelope<CellarListData>>(
      page,
      "/api/cellar",
    );
    for (const ownerEntry of envelopeData(ownerAList).entries) {
      const deleted = await sameOriginApi<ApiEnvelope<{ deletedId: number }>>(
        page,
        `/api/cellar/${ownerEntry.id}`,
        { expectedUserId: userA.id, method: "DELETE" },
      );
      expect(envelopeData(deleted).deletedId).toBe(ownerEntry.id);
    }
    await logoutThroughUi(page);
  });
});
