import { expect, test } from "@playwright/test";

import { disposableAccount } from "./helpers/accounts";
import {
  envelopeData,
  sameOriginApi,
  type ApiEnvelope,
  type AuthenticatedUserData,
  type CellarEntryData,
} from "./helpers/api";
import { DESKTOP_BROWSER_PROJECTS, projectIs } from "./helpers/projects";

test("@smoke auth, cellar writes, and Taste Profile work in every desktop engine", async ({
  page,
}, testInfo) => {
  test.skip(
    !projectIs(testInfo, DESKTOP_BROWSER_PROJECTS),
    "The cross-browser private smoke contract targets desktop projects.",
  );
  test.setTimeout(60_000);

  const account = disposableAccount("browser-smoke", testInfo);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/signup");
  await page.getByLabel("Name").fill(account.name);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  const signupResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/signup") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await signupResponse).status()).toBe(201);
  await expect(page).toHaveURL(/\/cellar$/);

  const me = await sameOriginApi<ApiEnvelope<AuthenticatedUserData>>(
    page,
    "/api/auth/me",
  );
  const user = envelopeData(me).user;
  const created = await sameOriginApi<ApiEnvelope<CellarEntryData>>(
    page,
    "/api/cellar",
    {
      body: {
        externalWineId: "mock-argyle-reserve-pinot-noir-2021",
      },
      expectedUserId: user.id,
      method: "POST",
    },
  );
  expect(created.status).toBe(201);
  const entry = envelopeData(created).entry;

  const updated = await sameOriginApi<ApiEnvelope<CellarEntryData>>(
    page,
    `/api/cellar/${entry.id}`,
    {
      body: {
        favorite: true,
        memoryTitle: "Cross-browser memory",
        notes: "Private browser smoke note",
        occasion: "Dinner",
        status: "tasted",
        userRating: 4,
        wouldBuyAgain: true,
      },
      expectedUserId: user.id,
      method: "PATCH",
    },
  );
  expect(updated.status).toBe(200);

  await page.reload();
  const card = page.locator(`#cellar-entry-${entry.id}-trigger`);
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByLabel("Memory title")).toHaveValue(
    "Cross-browser memory",
  );
  await expect(page.getByLabel("Private tasting note")).toHaveValue(
    "Private browser smoke note",
  );

  await page.goto("/profile");
  await expect(page.locator("[data-profile-source='authenticated-api']")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "YOUR TASTE PROFILE IS STILL LIMITED" }),
  ).toBeVisible();

  const deleted = await sameOriginApi<ApiEnvelope<{ deletedId: number }>>(
    page,
    `/api/cellar/${entry.id}`,
    {
      expectedUserId: user.id,
      method: "DELETE",
    },
  );
  expect(envelopeData(deleted).deletedId).toBe(entry.id);

  const logoutResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/logout") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Logout" }).click();
  expect((await logoutResponse).status()).toBe(200);
  await page.goto("/cellar");
  await expect(page).toHaveURL(/\/login$/);
});
