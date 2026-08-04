import { expect, test, type Page } from "@playwright/test";

import { disposableAccount, type DisposableAccount } from "./helpers/accounts";
import {
  envelopeData,
  sameOriginApi,
  type ApiEnvelope,
  type ApiErrorEnvelope,
  type AuthenticatedUserData,
  type CellarEntryData,
} from "./helpers/api";
import { monitorPageIssues } from "./helpers/browser";

interface RecommendationIsolationData {
  personalization: {
    signalCount: number;
    status: string;
  };
  results: Array<{
    match: {
      breakdown: Array<{
        dimension: string;
        earnedPoints: number;
      }>;
      scoreBasis: string;
    };
  }>;
}

async function completeSignup(
  page: Page,
  account: DisposableAccount,
) {
  await expect(page.getByRole("form", { name: "Create account form" })).toBeVisible();
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
}

test.describe.serial("authenticated cellar journey", () => {
  test("Chromium preserves private memories and keeps two owners isolated", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "The stateful private journey runs once in desktop Chromium.",
    );
    test.setTimeout(90_000);

    const accountA = disposableAccount("owner-a", testInfo);
    const accountB = disposableAccount("owner-b", testInfo);
    const monitor = monitorPageIssues(page);

    await test.step("protected routes preserve return-to through real UI signup", async () => {
      await page.goto("/cellar");
      await expect(page).toHaveURL(/\/login$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "RETURN TO YOUR CELLAR" }),
      ).toBeVisible();

      await page.getByRole("link", { name: "Create an account" }).click();
      await expect(page).toHaveURL(/\/signup$/);
      await completeSignup(page, accountA);
      await expect(page).toHaveURL(/\/cellar$/);
      await expect(
        page.getByRole("heading", {
          name: "YOUR CELLAR IS READY FOR ITS FIRST BOTTLE",
        }),
      ).toBeVisible();
    });

    const meResponse = await sameOriginApi<ApiEnvelope<AuthenticatedUserData>>(
      page,
      "/api/auth/me",
    );
    const userA = envelopeData(meResponse).user;

    const entry = await test.step(
      "a sourced catalog bottle is saved through the live UI",
      async () => {
        await page.goto("/wines/mock-chateau-montelena-cabernet-sauvignon-2019");
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: "Estate Cabernet Sauvignon",
          }),
        ).toBeVisible();

        const saveResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/cellar") &&
            response.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Save to my cellar" }).click();
        const response = await saveResponse;
        expect(response.status()).toBe(201);
        const payload = (await response.json()) as ApiEnvelope<CellarEntryData>;
        const savedEntry = payload.data.entry;

        expect(savedEntry.userId).toBe(userA.id);
        await expect(
          page.getByText("Saved to your private cellar.", { exact: true }),
        ).toBeVisible();
        return savedEntry;
      },
    );

    await test.step("the complete tasting-memory form persists after refresh", async () => {
      await page.goto("/cellar");
      const bottleButton = page.getByRole("button", {
        name: new RegExp(entry.wine.name, "i"),
      });
      await expect(bottleButton).toBeVisible();
      await bottleButton.click();
      await expect(
        page.getByRole("heading", { name: "EDIT THE MEMORY" }),
      ).toBeVisible();

      await page.getByLabel("Memory title").fill("Anniversary at the long table");
      await page.getByLabel("Tasted date").fill("2026-07-12");
      await page.getByLabel("Location").fill("Brooklyn, New York");
      await page.getByLabel("Pairing").fill("Pepper-crusted steak");
      await page.getByLabel("Opened with").fill("Rachel and friends");
      await page.getByLabel("Personal rating").selectOption("5");
      await page.getByLabel("Cellar status").selectOption("buy_again");
      await page.getByLabel("Occasion").fill("Anniversary dinner");
      await page.getByLabel("Tags").fill("cabernet, celebration, steak");
      await page
        .getByLabel("Private tasting note")
        .fill("Black cherry, cedar, and a finish worth revisiting.");
      await page.getByRole("radio", { name: "Yes", exact: true }).check();
      await page.getByRole("checkbox", { name: "Mark as favorite" }).check();

      const updateResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/cellar/${entry.id}`) &&
          response.request().method() === "PATCH",
      );
      await page.getByRole("button", { name: "Save tasting memory" }).click();
      expect((await updateResponse).status()).toBe(200);
      await expect(
        page.getByText("Changes saved to your private cellar.", { exact: true }),
      ).toBeVisible();

      await page.reload();
      await page
        .getByRole("button", { name: new RegExp(entry.wine.name, "i") })
        .click();
      await expect(page.getByLabel("Memory title")).toHaveValue(
        "Anniversary at the long table",
      );
      await expect(page.getByLabel("Tasted date")).toHaveValue("2026-07-12");
      await expect(page.getByLabel("Location")).toHaveValue("Brooklyn, New York");
      await expect(page.getByLabel("Pairing")).toHaveValue("Pepper-crusted steak");
      await expect(page.getByLabel("Opened with")).toHaveValue("Rachel and friends");
      await expect(page.getByLabel("Personal rating")).toHaveValue("5");
      await expect(page.getByLabel("Cellar status")).toHaveValue("buy_again");
      await expect(page.getByLabel("Occasion")).toHaveValue("Anniversary dinner");
      await expect(page.getByLabel("Tags")).toHaveValue(
        "cabernet, celebration, steak",
      );
      await expect(page.getByRole("radio", { name: "Yes", exact: true })).toBeChecked();
      await expect(
        page.getByRole("checkbox", { name: "Mark as favorite" }),
      ).toBeChecked();
      await expect(page.getByLabel("Private tasting note")).toHaveValue(
        "Black cherry, cedar, and a finish worth revisiting.",
      );
    });

    await test.step("profile state and browser history retain the owner-scoped journey", async () => {
      await page.goto("/profile");
      await expect(page.locator("[data-profile-source='authenticated-api']")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "YOUR TASTE PROFILE IS STILL LIMITED" }),
      ).toBeVisible();

      await page.goBack();
      await expect(page).toHaveURL(/\/cellar$/);
      await expect(
        page.getByRole("button", { name: new RegExp(entry.wine.name, "i") }),
      ).toBeVisible();
      await page.goForward();
      await expect(page).toHaveURL(/\/profile$/);
      await expect(page.locator("[data-profile-source='authenticated-api']")).toBeVisible();
    });

    await test.step("an independent account cannot distinguish another owner's entry", async () => {
      const origin = new URL(page.url()).origin;
      const contextB = await browser.newContext({
        reducedMotion: "reduce",
        viewport: { height: 900, width: 1440 },
      });
      const pageB = await contextB.newPage();

      try {
        await pageB.goto(`${origin}/signup`);
        await completeSignup(pageB, accountB);
        await expect(pageB).toHaveURL(/\/cellar$/);

        const meB = await sameOriginApi<ApiEnvelope<AuthenticatedUserData>>(
          pageB,
          "/api/auth/me",
        );
        const userB = envelopeData(meB).user;
        expect(userB.id).not.toBe(userA.id);

        const missing = await sameOriginApi<ApiErrorEnvelope>(
          pageB,
          "/api/cellar/999999999",
        );
        expect(missing.status).toBe(404);
        expect(missing.body?.error.code).toBe("cellar_entry_not_found");

        const crossOwnerResponses = await Promise.all([
          sameOriginApi<ApiErrorEnvelope>(pageB, `/api/cellar/${entry.id}`),
          sameOriginApi<ApiErrorEnvelope>(pageB, `/api/cellar/${entry.id}`, {
            body: { notes: "Attempted overwrite", userRating: 1 },
            expectedUserId: userB.id,
            method: "PATCH",
          }),
          sameOriginApi<ApiErrorEnvelope>(pageB, `/api/cellar/${entry.id}`, {
            expectedUserId: userB.id,
            method: "DELETE",
          }),
        ]);

        for (const response of crossOwnerResponses) {
          expect(response.status).toBe(404);
          expect(response.body).toEqual(missing.body);
        }

        const privateListB = await sameOriginApi<ApiEnvelope<{ count: number }>>(
          pageB,
          "/api/cellar",
        );
        expect(envelopeData(privateListB).count).toBe(0);

        const recommendationsB = await sameOriginApi<
          ApiEnvelope<RecommendationIsolationData>
        >(
          pageB,
          "/api/wines/recommendations?query=bold+red+for+steak&limit=6",
        );
        const recommendationDataB = envelopeData(recommendationsB);
        expect(recommendationDataB.personalization).toMatchObject({
          signalCount: 0,
          status: "insufficient_data",
        });
        expect(
          recommendationDataB.results.every(
            ({ match }) =>
              match.scoreBasis === "request_only" &&
              match.breakdown
                .filter(({ dimension }) => dimension === "personal_taste")
                .every(({ earnedPoints }) => earnedPoints === 0),
          ),
        ).toBe(true);

        await pageB.goto(`${origin}/profile`);
        await expect(
          pageB.getByRole("heading", {
            name: "YOUR ATLAS IS READY FOR ITS FIRST BRANCH",
          }),
        ).toBeVisible();

        const unchangedA = await sameOriginApi<ApiEnvelope<CellarEntryData>>(
          page,
          `/api/cellar/${entry.id}`,
        );
        expect(envelopeData(unchangedA).entry.notes).toBe(
          "Black cherry, cedar, and a finish worth revisiting.",
        );
        expect(envelopeData(unchangedA).entry.userRating).toBe(5);
      } finally {
        await contextB.close();
      }
    });

    await test.step("delete, logout, and login complete through the real UI", async () => {
      await page.goto("/cellar");
      await page
        .getByRole("button", { name: new RegExp(entry.wine.name, "i") })
        .click();
      await page.getByRole("button", { name: "Remove bottle" }).click();
      await expect(
        page.getByRole("button", { name: "Confirm removal" }),
      ).toBeFocused();
      const deleteResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/cellar/${entry.id}`) &&
          response.request().method() === "DELETE",
      );
      await page.getByRole("button", { name: "Confirm removal" }).click();
      expect((await deleteResponse).status()).toBe(200);
      await expect(
        page.getByRole("heading", {
          name: "YOUR CELLAR IS READY FOR ITS FIRST BOTTLE",
        }),
      ).toBeVisible();

      const logoutResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/auth/logout") &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Logout" }).click();
      expect((await logoutResponse).status()).toBe(200);
      await expect(page).toHaveURL(/\/login$/);

      await page.getByLabel("Email").fill(accountA.email);
      await page.getByLabel("Password").fill(accountA.password);
      const loginResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/auth/login") &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Sign in" }).click();
      expect((await loginResponse).status()).toBe(200);
      await expect(page).toHaveURL(/\/cellar$/);
      await expect(
        page.getByRole("heading", {
          name: "YOUR CELLAR IS READY FOR ITS FIRST BOTTLE",
        }),
      ).toBeVisible();
    });

    monitor.assertClean();
  });
});
