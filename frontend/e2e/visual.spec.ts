import { expect, test, type Page } from "@playwright/test";

import { disposableAccount } from "./helpers/accounts";
import { sameOriginApi } from "./helpers/api";
import { seedActiveProfile, signupThroughPreview } from "./helpers/seed";

const strictScreenshot = {
  animations: "disabled" as const,
  maxDiffPixels: 0,
};

async function settleVisualState(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main")).toBeVisible();
}

test("approved deterministic visual matrix", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "reduced-motion-chromium",
    "Visual baselines use the fixed reduced-motion Chromium project.",
  );
  test.skip(
    process.env.GRAPEVYNE_VISUAL_BASELINES !== "1",
    "Strict approved snapshots run separately through npm run test:visual.",
  );
  test.setTimeout(120_000);

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
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("01-homepage-hero-desktop.png", strictScreenshot);

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("02-homepage-hero-mobile.png", strictScreenshot);

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/discover?query=bold+red+under+%2460+for+steak+night");
  await expect(
    page.getByRole("link", { name: /^View .+ with recommendation context$/ }).first(),
  ).toBeVisible();
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("03-discover-results.png", strictScreenshot);

  await page.goto("/wines/mock-chateau-montelena-cabernet-sauvignon-2019");
  await expect(
    page.getByRole("heading", { level: 1, name: "Estate Cabernet Sauvignon" }),
  ).toBeVisible();
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("04-wine-detail.png", strictScreenshot);

  await page.goto("/demo/cellar");
  const account = disposableAccount("visual", testInfo);
  const user = await signupThroughPreview(page, account);

  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "YOUR ATLAS IS READY FOR ITS FIRST BRANCH" }),
  ).toBeVisible();
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("07-profile-empty.png", {
    ...strictScreenshot,
    mask: [page.locator(".profile-summary"), page.locator(".gv-nav__user")],
  });

  const entries = await seedActiveProfile(page, user.id, "VISUAL PRIVATE NOTE");
  await page.goto("/cellar");
  await expect(page.locator("[data-cellar-source='authenticated-api']")).toBeVisible();
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("05-cellar-populated.png", {
    ...strictScreenshot,
    mask: [page.locator(".gv-cellar-bottle__meta"), page.locator(".gv-nav__user")],
  });

  await page.locator(`#cellar-entry-${entries[0]?.id}-trigger`).click();
  await expect(page.getByRole("heading", { name: "EDIT THE MEMORY" })).toBeVisible();
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("06-memory-editor.png", {
    ...strictScreenshot,
    mask: [
      page.locator(".gv-cellar-bottle__meta"),
      page.locator(".gv-nav__user"),
      page.getByLabel("Private tasting note"),
    ],
  });

  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "YOUR RECORDED BRANCHES" })).toBeVisible();
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("08-profile-active.png", {
    ...strictScreenshot,
    mask: [page.locator(".profile-summary"), page.locator(".gv-nav__user")],
  });

  await sameOriginApi(page, "/api/auth/logout", { method: "POST" });
  await page.goto("/login");
  await expect(page.getByRole("form", { name: "Sign in form" })).toBeVisible();
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("09-login.png", strictScreenshot);

  await page.goto("/signup");
  await expect(page.getByRole("form", { name: "Create account form" })).toBeVisible();
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("10-signup.png", strictScreenshot);

  await page.goto("/demo/cellar");
  await expect(page.getByLabel("Search the fictional collection")).toBeVisible();
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("11-demo-cellar.png", strictScreenshot);
});
