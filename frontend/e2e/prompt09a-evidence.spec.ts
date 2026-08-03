import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { disposableAccount } from "./helpers/accounts";
import { forceLiveWebGLCapability } from "./helpers/browser";
import { seedActiveProfile, signupThroughPreview } from "./helpers/seed";

const evidenceRoot = path.resolve(
  process.cwd(),
  "..",
  "docs",
  "screenshots",
  "prompt-09a",
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
    process.env.GRAPEVYNE_CAPTURE_PROMPT09A !== "1",
    "Prompt 09A screenshots are generated only by the explicit evidence command.",
  );
  await mkdir(evidenceRoot, { recursive: true });
});

test("capture Prompt 09A release-blocker evidence", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The Prompt 09A evidence matrix uses desktop Chromium.",
  );
  test.setTimeout(120_000);

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "FIND THE BOTTLE KEEP THE MEMORY",
    }),
  ).toBeVisible();
  await capture(page, "01-hero-desktop-after-cls-fix.png");

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "FIND THE BOTTLE KEEP THE MEMORY",
    }),
  ).toBeVisible();
  await capture(page, "02-hero-mobile-after-cls-fix.png");

  await forceLiveWebGLCapability(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await expect(page.locator("[data-webgl-status='ready']")).toBeVisible({
    timeout: 8_000,
  });
  await expect(page.locator(".gv-webgl-experience canvas")).toHaveCount(1);
  await capture(page, "03-webgl-ready-hero.png");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
  await capture(page, "04-reduced-motion-hero.png");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/discover?query=bold+red+under+%2460+for+steak+night");
  await expect(
    page.getByRole("link", { name: /^View .+ with recommendation context$/ }).first(),
  ).toBeVisible();
  await capture(page, "05-discover.png");

  const account = disposableAccount("prompt09a-evidence", testInfo);
  const user = await signupThroughPreview(page, account);
  const entries = await seedActiveProfile(
    page,
    user.id,
    "PROMPT 09A DISPOSABLE PRIVATE NOTE",
  );

  await page.goto("/cellar");
  await expect(page.locator("[data-cellar-source='authenticated-api']")).toBeVisible();
  await page.locator(`#cellar-entry-${entries[0]?.id}-trigger`).click();
  await expect(page.getByRole("heading", { name: "EDIT THE MEMORY" })).toBeVisible();
  await page.getByLabel("Private tasting note").fill("");
  await capture(page, "06-cellar-memory-editor.png");

  await page.goto("/profile");
  const recordedBranches = page.getByRole("heading", {
    name: "YOUR RECORDED BRANCHES",
  });
  await expect(recordedBranches).toBeVisible();
  await recordedBranches.scrollIntoViewIfNeeded();
  await capture(page, "07-active-taste-profile.png");

  await page.route("**/build/NotFoundPage-*.js", (route) =>
    route.abort("failed"),
  );
  await page.goto("/prompt-09a-forced-application-error");
  await expect(
    page.getByRole("heading", { name: "THIS PAGE COULD NOT BE OPENED" }),
  ).toBeVisible();
  await capture(page, "08-error-boundary-recovery.png");

  await page.unroute("**/build/NotFoundPage-*.js");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "THIS PAGE IS NOT IN THE DIRECTORY" }),
  ).toBeVisible();
  await capture(page, "09-not-found-404.png");
});
