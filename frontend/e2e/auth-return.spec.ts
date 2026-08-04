import { expect, test, type Page } from "@playwright/test";

import { disposableAccount, type DisposableAccount } from "./helpers/accounts";
import {
  envelopeData,
  sameOriginApi,
  type ApiEnvelope,
  type AuthenticatedUserData,
  type CellarEntryData,
} from "./helpers/api";
import { signupThroughPreview } from "./helpers/seed";

async function completeSignup(page: Page, account: DisposableAccount) {
  await expect(page.getByRole("form", { name: "Create account form" })).toBeVisible();
  await page.getByLabel("Name").fill(account.name);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/signup") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await responsePromise).status()).toBe(201);
}

async function completeLogin(page: Page, account: DisposableAccount) {
  await expect(page.getByRole("form", { name: "Sign in form" })).toBeVisible();
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

async function expectExactInternalLocation(page: Page, expected: string) {
  await expect
    .poll(() =>
      page.evaluate(
        () => `${window.location.pathname}${window.location.search}${window.location.hash}`,
      ),
    )
    .toBe(expected);
}

test("auth return paths, duplicate feedback, and account switching stay owner-safe", async ({
  browser,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Auth return and account-switching coverage runs once in desktop Chromium.",
  );
  test.setTimeout(120_000);

  const accountA = disposableAccount("return-owner-a", testInfo);
  const accountB = disposableAccount("return-owner-b", testInfo);
  const wineId = "mock-chateau-montelena-cabernet-sauvignon-2019";
  const signupReturn =
    `/wines/${wineId}?request=bold+red+under+%2460+for+steak+night#save-control`;
  const loginReturn =
    `/wines/${wineId}?request=Cabernet+for+anniversary+dinner#login-return`;

  await test.step("signed-out save preserves path, query, and hash through UI signup", async () => {
    await page.goto(signupReturn);
    await expect(page.getByRole("button", { name: "Sign in to save" })).toBeVisible();
    await page.getByRole("button", { name: "Sign in to save" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await completeSignup(page, accountA);

    await expectExactInternalLocation(page, signupReturn);
    await expect(page.getByRole("button", { name: "Save to my cellar" })).toBeVisible();
  });

  const meA = await sameOriginApi<ApiEnvelope<AuthenticatedUserData>>(
    page,
    "/api/auth/me",
  );
  const userA = envelopeData(meA).user;
  let entryId = 0;
  let wineName = "";

  await test.step("session refresh and duplicate save feedback remain truthful", async () => {
    const firstSave = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/cellar") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save to my cellar" }).click();
    const firstResponse = await firstSave;
    expect(firstResponse.status()).toBe(201);
    const firstPayload = (await firstResponse.json()) as ApiEnvelope<CellarEntryData>;
    entryId = firstPayload.data.entry.id;
    wineName = firstPayload.data.entry.wine.name;
    await expect(page.getByRole("button", { name: "Saved to cellar" })).toBeDisabled();

    await page.reload();
    await expectExactInternalLocation(page, signupReturn);
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save to my cellar" })).toBeVisible();

    const duplicateSave = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/cellar") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save to my cellar" }).click();
    expect((await duplicateSave).status()).toBe(409);
    await expect(page.getByRole("button", { name: "Already in cellar" })).toBeDisabled();
    await expect(
      page.getByRole("status").filter({
        hasText: "This bottle is already in your cellar.",
      }).first(),
    ).toBeVisible();
  });

  await sameOriginApi<ApiEnvelope<CellarEntryData>>(
    page,
    `/api/cellar/${entryId}`,
    {
      body: {
        favorite: true,
        memoryTitle: "OWNER A ONLY MEMORY",
        notes: "OWNER A PRIVATE NOTE",
        status: "tasted",
        userRating: 5,
      },
      expectedUserId: userA.id,
      method: "PATCH",
    },
  );

  await test.step("signed-out save preserves the exact return through UI login", async () => {
    await logoutThroughUi(page);
    await page.goto(loginReturn);
    await page.getByRole("button", { name: "Sign in to save" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await completeLogin(page, accountA);
    await expectExactInternalLocation(page, loginReturn);
    await expect(page.getByRole("button", { name: "Save to my cellar" })).toBeVisible();
  });

  await test.step("an external return target falls back to the protected cellar", async () => {
    await logoutThroughUi(page);
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).hostname === "attacker.example") {
        externalRequests.push(request.url());
      }
    });
    await page.addInitScript(() => {
      if (window.location.pathname === "/login") {
        window.history.replaceState(
          {
            idx: 0,
            key: "external-return-e2e",
            usr: { from: "https://attacker.example/open-redirect" },
          },
          "",
        );
      }
    });
    await page.goto("/login");
    await completeLogin(page, accountA);
    await expect(page).toHaveURL(/\/cellar$/);
    expect(externalRequests).toEqual([]);
    await expect(page.locator("[data-cellar-source='authenticated-api']")).toBeVisible();
  });

  await test.step("switching accounts clears the previous owner's private UI", async () => {
    const origin = new URL(page.url()).origin;
    const setupContext = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { height: 900, width: 1440 },
    });
    const setupPage = await setupContext.newPage();

    try {
      await setupPage.goto(`${origin}/`);
      await signupThroughPreview(setupPage, accountB);
    } finally {
      await setupContext.close();
    }

    await expect(page.getByText("OWNER A ONLY MEMORY", { exact: true })).toBeVisible();
    await logoutThroughUi(page);
    await page.goto("/login");
    await completeLogin(page, accountB);
    await expect(page).toHaveURL(/\/cellar$/);
    await expect(
      page.getByRole("heading", {
        name: "YOUR CELLAR IS READY FOR ITS FIRST BOTTLE",
      }),
    ).toBeVisible();
    await expect(page.getByText("OWNER A ONLY MEMORY", { exact: true })).toHaveCount(0);
    await expect(page.getByText(wineName, { exact: true })).toHaveCount(0);

    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: "YOUR ATLAS IS READY FOR ITS FIRST BRANCH" }),
    ).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain("OWNER A PRIVATE NOTE");
  });
});
