import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, monitorPageIssues } from "./helpers/browser";
import { DESKTOP_BROWSER_PROJECTS, projectIs } from "./helpers/projects";

const storyHeadings = [
  "FIND THE BOTTLE KEEP THE MEMORY",
  "DESCRIBE THE MOMENT",
  "WHY IT FITS",
  "TASTE TAKES SHAPE",
  "OPEN THE CELLAR",
  "BUILD THE COLLECTION",
  "REMEMBER THE POUR",
  "FOLLOW YOUR TASTE",
  "KEEP THE STORY",
];

test("@smoke public routes remain usable in every desktop engine", async ({
  page,
}, testInfo) => {
  test.skip(
    !projectIs(testInfo, DESKTOP_BROWSER_PROJECTS),
    "The cross-browser smoke contract targets desktop browser projects.",
  );

  const monitor = monitorPageIssues(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: storyHeadings[0] }),
  ).toBeVisible();
  await expect(page.locator("section[data-story-chapter]")).toHaveCount(9);
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);

  await page.goto("/demo/cellar");
  await expect(
    page.getByRole("heading", {
      name: "VISIBLE FICTION, NEVER PRIVATE ACCOUNT DATA",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Search the fictional collection")).toBeVisible();

  await page.goto("/discover");
  await expect(
    page.getByRole("heading", { level: 1, name: "DISCOVER WINES" }),
  ).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search wines" })).toBeVisible();

  await page.goto("/an-intentional-404");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "THIS PAGE IS NOT IN THE DIRECTORY",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to the beginning" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  monitor.assertClean();
});

test("Chromium completes discovery, recommendation, detail, history, and catalog flows", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The comprehensive public journey runs once in desktop Chromium.",
  );

  const monitor = monitorPageIssues(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  for (const heading of storyHeadings) {
    await expect(page.getByRole("heading", { name: heading })).toBeAttached();
  }

  await page.getByRole("link", { name: "Discover" }).first().click();
  await expect(page).toHaveURL(/\/discover$/);

  const recommendationResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/wines/recommendations") &&
      response.request().method() === "GET",
  );
  await page
    .getByRole("button", { name: "bold red under $60 for steak night" })
    .click();
  expect((await recommendationResponse).status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "WHAT THE ENGINE UNDERSTOOD" }),
  ).toBeVisible();

  const detailLink = page
    .getByRole("link", { name: /^View .+ with recommendation context$/ })
    .first();
  const detailName = (await detailLink.getAttribute("aria-label"))
    ?.replace(/^View /, "")
    .replace(/ with recommendation context$/, "");

  expect(detailName).toBeTruthy();
  await detailLink.click();
  await expect(page).toHaveURL(/\/wines\/[^?]+\?request=/);
  await expect(page.getByRole("heading", { level: 1, name: detailName })).toBeVisible();
  await expect(page.getByRole("heading", { name: "WHY IT FITS THIS REQUEST" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to save" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/discover\?query=/);
  await expect(
    page.getByRole("heading", { name: "WHAT THE ENGINE UNDERSTOOD" }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1, name: detailName })).toBeVisible();

  await page.goto("/discover");
  await page.getByRole("button", { name: "Catalog browse" }).click();
  await page.getByRole("searchbox", { name: "Search wines" }).fill("Cabernet");
  const catalogResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/wines/search") &&
      response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  expect((await catalogResponse).status()).toBe(200);
  await expect(page.getByRole("heading", { name: /bottle for “Cabernet”/i })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^View .+/ }).first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  monitor.assertClean();
});
