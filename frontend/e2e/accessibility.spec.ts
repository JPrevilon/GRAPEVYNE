import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { disposableAccount } from "./helpers/accounts";
import { sameOriginApi } from "./helpers/api";
import { seedActiveProfile, signupThroughPreview } from "./helpers/seed";

async function expectAxeClean(
  page: Page,
  state: string,
  testInfo: TestInfo,
): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  await testInfo.attach(`axe-${state}`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });
  expect(results.violations, `${state} WCAG A/AA violations`).toEqual([]);
}

test("representative public, private, and mobile states pass axe A/AA", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The full axe state matrix runs once in desktop Chromium.",
  );
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FIND THE BOTTLE KEEP THE MEMORY" })).toBeVisible();
  await expectAxeClean(page, "homepage", testInfo);

  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "DISCOVER WINES" })).toBeVisible();
  await expectAxeClean(page, "discover-initial", testInfo);
  await page.getByRole("searchbox", { name: "Search wines" }).fill("crisp white for oysters");
  await page.getByRole("button", { name: "Match", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /^View .+ with recommendation context$/ }).first(),
  ).toBeVisible();
  await expectAxeClean(page, "discover-results", testInfo);

  await page.goto("/wines/mock-chateau-montelena-cabernet-sauvignon-2019");
  await expect(
    page.getByRole("heading", { level: 1, name: "Estate Cabernet Sauvignon" }),
  ).toBeVisible();
  await expectAxeClean(page, "wine-detail", testInfo);

  await page.goto("/login");
  await expect(page.getByRole("form", { name: "Sign in form" })).toBeVisible();
  await expectAxeClean(page, "login", testInfo);
  await page.goto("/signup");
  await expect(page.getByRole("form", { name: "Create account form" })).toBeVisible();
  await expectAxeClean(page, "signup", testInfo);

  await page.goto("/demo/cellar");
  await expect(page.getByLabel("Search the fictional collection")).toBeVisible();
  await expectAxeClean(page, "demo-cellar", testInfo);

  const account = disposableAccount("axe", testInfo);
  const user = await signupThroughPreview(page, account);
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "YOUR ATLAS IS READY FOR ITS FIRST BRANCH" }),
  ).toBeVisible();
  await expectAxeClean(page, "profile-empty", testInfo);

  const privateSentinel = "AXE PRIVATE NOTE MUST STAY OUT OF PROFILE";
  const entries = await seedActiveProfile(page, user.id, privateSentinel);
  await page.goto("/cellar");
  await expect(page.locator("[data-cellar-source='authenticated-api']")).toBeVisible();
  await expectAxeClean(page, "cellar-populated", testInfo);
  await page.locator(`#cellar-entry-${entries[0]?.id}-trigger`).click();
  await expect(page.getByRole("heading", { name: "EDIT THE MEMORY" })).toBeVisible();
  await expectAxeClean(page, "memory-editor", testInfo);

  const profileResponse = await sameOriginApi(page, "/api/profile/taste");
  expect(JSON.stringify(profileResponse.body)).not.toContain(privateSentinel);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "YOUR RECORDED BRANCHES" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "THE SAME PATTERNS, IN TEXT" })).toBeVisible();
  expect(await page.locator("main").innerText()).not.toContain(privateSentinel);
  const adjacentRecommendation = page.getByRole("link", {
    name: /View this catalog wine/i,
  });
  await expect(adjacentRecommendation).toBeVisible();
  await expect(adjacentRecommendation).toHaveAttribute("href", /^\/wines\//);
  const firstNode = page
    .getByRole("button", { name: /strength \d+ out of 100/ })
    .first();
  await firstNode.focus();
  await page.keyboard.press("Space");
  await expect(firstNode).toHaveAttribute("aria-pressed", "true");
  await expectAxeClean(page, "profile-active", testInfo);

  await adjacentRecommendation.click();
  await expect(page).toHaveURL(/\/wines\/[^/?#]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "YOUR RECORDED BRANCHES" })).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await expectAxeClean(page, "mobile-drawer", testInfo);
});
