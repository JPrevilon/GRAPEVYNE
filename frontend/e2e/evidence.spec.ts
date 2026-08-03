import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { disposableAccount } from "./helpers/accounts";
import { seedActiveProfile, signupThroughPreview } from "./helpers/seed";

const evidenceRoot = path.resolve(
  process.cwd(),
  "..",
  "docs",
  "screenshots",
  "prompt-09",
);

async function capture(page: Page, filename: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidenceRoot, filename),
  });
}

test.beforeEach(async () => {
  test.skip(
    process.env.GRAPEVYNE_CAPTURE_EVIDENCE !== "1",
    "Documentation screenshots are generated only by the explicit evidence command.",
  );
  await mkdir(evidenceRoot, { recursive: true });
});

test("capture Chromium release evidence", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The primary evidence matrix uses desktop Chromium.",
  );
  test.setTimeout(120_000);

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "FIND THE BOTTLE KEEP THE MEMORY" }),
  ).toBeVisible();
  await expect(page.locator("[data-webgl-status='ready']")).toBeVisible({
    timeout: 8_000,
  });
  await expect(page.locator(".gv-webgl-experience canvas")).toHaveCount(1);
  await expect(page.locator(".gv-hero-bottle")).toHaveCSS("opacity", "0");
  await capture(page, "01-homepage-desktop-production-preview.png");

  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await capture(page, "02-homepage-mobile-production-preview.png");

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/discover?query=bold+red+under+%2460+for+steak+night");
  await expect(
    page.getByRole("link", { name: /^View .+ with recommendation context$/ }).first(),
  ).toBeVisible();
  await capture(page, "03-discover-recommendations.png");

  const account = disposableAccount("evidence", testInfo);
  const user = await signupThroughPreview(page, account);
  const entries = await seedActiveProfile(page, user.id, "EVIDENCE PRIVATE NOTE");

  await page.goto("/cellar");
  await expect(page.locator("[data-cellar-source='authenticated-api']")).toBeVisible();
  await capture(page, "04-populated-cellar.png");
  await page.locator(`#cellar-entry-${entries[0]?.id}-trigger`).click();
  await expect(page.getByRole("heading", { name: "EDIT THE MEMORY" })).toBeVisible();
  await page.getByLabel("Private tasting note").fill("");
  await capture(page, "05-memory-editor.png");

  await page.goto("/profile");
  const recordedBranches = page.getByRole("heading", { name: "YOUR RECORDED BRANCHES" });
  await expect(recordedBranches).toBeVisible();
  await recordedBranches.scrollIntoViewIfNeeded();
  await capture(page, "06-active-taste-profile.png");

  await page.getByRole("button", { name: "Logout" }).click();
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await capture(page, "07-login-mobile.png");

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await expect(page.locator("canvas")).toHaveCount(0);
  await capture(page, "08-reduced-motion-hero.png");

  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(
      this: HTMLCanvasElement,
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === "webgl" || contextId === "webgl2") return null;
      return Reflect.apply(originalGetContext, this, [contextId, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator(".gv-hero-bottle")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await capture(page, "09-disabled-webgl-fallback.png");

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  await capture(page, "10-browser-zoom-200-percent.png");
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });

  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "DISCOVER WINES" })).toBeVisible();
  await capture(page, "11-forced-colors-high-contrast.png");

  await page.emulateMedia({ forcedColors: "none", reducedMotion: "reduce" });
  await page.route("**/assets/NotFoundPage-*.js", (route) => route.abort("failed"));
  await page.goto("/forced-application-error");
  await expect(
    page.getByRole("heading", { name: "THIS PAGE COULD NOT BE OPENED" }),
  ).toBeVisible();
  await capture(page, "12-application-error-fallback.png");

  await page.unroute("**/assets/NotFoundPage-*.js");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "THIS PAGE IS NOT IN THE DIRECTORY" }),
  ).toBeVisible();
  await capture(page, "13-not-found-404.png");
});

for (const projectName of ["desktop-firefox", "desktop-webkit"] as const) {
  test(`capture ${projectName} smoke evidence`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== projectName, `This evidence belongs to ${projectName}.`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "FIND THE BOTTLE KEEP THE MEMORY" }),
    ).toBeVisible();
    await capture(page, `${projectName === "desktop-firefox" ? "14" : "15"}-${projectName}-smoke.png`);
  });
}
