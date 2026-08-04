import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, monitorPageIssues } from "./helpers/browser";
import { MOBILE_BROWSER_PROJECTS, projectIs } from "./helpers/projects";

test("public demos stay read-only and never request owner-scoped data", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Demo network isolation runs once in desktop Chromium.",
  );

  const privateRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;

    if (pathname.startsWith("/api/cellar") || pathname === "/api/profile/taste") {
      privateRequests.push(`${request.method()} ${pathname}`);
    }
  });

  await page.goto("/demo/cellar");
  await expect(
    page.getByRole("heading", {
      name: "VISIBLE FICTION, NEVER PRIVATE ACCOUNT DATA",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Save|Favorite|Edit|Delete/i })).toHaveCount(0);

  await page.getByLabel("Search the fictional collection").fill("Pinot Noir");
  const demoBottle = page.getByRole("button", { name: /Willow Block Pinot Noir/i });
  await expect(demoBottle).toBeVisible();
  await demoBottle.click();
  await expect(
    page.getByRole("heading", { name: "Willow Block Pinot Noir" }),
  ).toBeVisible();
  await expect(page.getByText(/cannot be edited here/i)).toBeVisible();
  await page.getByRole("button", { name: "Close bottle details" }).click();

  await page.getByRole("link", { name: "View demo Taste Atlas" }).click();
  await expect(page).toHaveURL(/\/demo\/taste-atlas$/);
  await expect(
    page.getByRole("heading", {
      name: "ILLUSTRATIVE PATTERNS—NOT A VISITOR PROFILE",
    }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Demonstration collection overview" })).toBeVisible();
  expect(privateRequests).toEqual([]);
});

test("@smoke mobile engines expose a keyboard-safe menu and live discovery", async ({
  page,
}, testInfo) => {
  test.skip(
    !projectIs(testInfo, MOBILE_BROWSER_PROJECTS),
    "The responsive-navigation contract targets mobile projects.",
  );

  const monitor = monitorPageIssues(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("video")).toHaveCount(0);

  const menuButton = page.getByRole("button", { name: "Menu" });
  await menuButton.click();
  const menuDialog = page.getByRole("dialog", { name: "Menu" });
  await expect(menuDialog).toBeVisible();
  await expect(menuDialog.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menuDialog).toBeHidden();
  await expect(menuButton).toBeFocused();

  await menuButton.click();
  await menuDialog.getByRole("link", { name: /Discover/ }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "DISCOVER WINES" }),
  ).toBeVisible();

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/wines/recommendations") &&
      response.request().method() === "GET",
  );
  await page.getByRole("searchbox", { name: "Search wines" }).fill(
    "crisp white for oysters",
  );
  await page.getByRole("button", { name: "Match", exact: true }).click();
  expect((await responsePromise).status()).toBe(200);
  await expect(
    page.getByRole("link", { name: /^View .+ with recommendation context$/ }).first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  monitor.assertClean();
});
