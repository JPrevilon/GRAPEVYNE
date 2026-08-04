import { expect, test, type Page } from "@playwright/test";

import { disposableAccount } from "./helpers/accounts";
import { expectNoHorizontalOverflow } from "./helpers/browser";
import { seedActiveProfile, signupThroughPreview } from "./helpers/seed";

const viewportMatrix = [
  { height: 800, label: "small phone", width: 360 },
  { height: 844, label: "reference phone", width: 390 },
  { height: 932, label: "large phone", width: 430 },
  { height: 1024, label: "portrait tablet", width: 768 },
  { height: 768, label: "landscape tablet", width: 1024 },
  { height: 900, label: "desktop", width: 1440 },
  { height: 1080, label: "large desktop", width: 1920 },
  { height: 800, label: "320px reflow", width: 320 },
] as const;

async function expectCoreLandmarks(page: Page): Promise<void> {
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
}

async function expectNoPointerInterceptingCanvas(page: Page): Promise<void> {
  const canvasPointerEvents = await page.locator("canvas").evaluateAll((canvases) =>
    canvases.map((canvas) => getComputedStyle(canvas).pointerEvents),
  );

  expect(canvasPointerEvents.every((value) => value === "none")).toBe(true);
}

async function expectRouteSurfaceReflow(page: Page): Promise<void> {
  await expectCoreLandmarks(page);
  await expect(page.locator("main h1").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoPointerInterceptingCanvas(page);

  const clippedHeadings = await page.locator("main h1, main h2").evaluateAll((headings) => {
    const viewportWidth = document.documentElement.clientWidth;
    return headings
      .filter((heading) => {
        const style = getComputedStyle(heading);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((heading) => {
        const bounds = heading.getBoundingClientRect();
        return {
          left: bounds.left,
          right: bounds.right,
          text: heading.textContent?.trim() ?? "",
        };
      })
      .filter(({ left, right }) => left < -1 || right > viewportWidth + 1);
  });
  expect(clippedHeadings).toEqual([]);
}

for (const viewport of viewportMatrix) {
  test(`${viewport.label} ${viewport.width}x${viewport.height} reflows Home and Discover`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "The explicit responsive matrix runs once in desktop Chromium.",
    );

    await page.setViewportSize({ height: viewport.height, width: viewport.width });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // The complete Chromium gate creates several resource-heavy story pages
    // in parallel. Wait on the route-level readiness contract before querying
    // the lazy Home heading so machine load cannot masquerade as a reflow bug.
    await expect(page.locator(".gv-story")).toHaveAttribute(
      "data-story-mode",
      "reduced-motion",
      { timeout: 20_000 },
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "FIND THE BOTTLE KEEP THE MEMORY",
      }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("section[data-story-chapter]")).toHaveCount(9);
    await expectCoreLandmarks(page);
    await expectNoHorizontalOverflow(page);
    await expectNoPointerInterceptingCanvas(page);
    await expect(page.locator("canvas")).toHaveCount(0);

    const menuButton = page.getByRole("button", { name: "Menu" });

    if (viewport.width <= 1088) {
      await expect(menuButton).toBeVisible();
      const menuBox = await menuButton.boundingBox();
      expect(menuBox).not.toBeNull();
      expect(menuBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(44);

      await menuButton.click();
      const drawer = page.getByRole("dialog", { name: "Menu" });
      await expect(drawer).toBeVisible();
      await expect(
        drawer.getByRole("navigation", { name: "Mobile navigation" }),
      ).toBeVisible();
      const closeButton = drawer.getByRole("button", { name: "Close" });
      const closeBox = await closeButton.boundingBox();
      expect(closeBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      await drawer.getByRole("link", { name: /Discover/ }).click();
    } else {
      await expect(menuButton).toBeHidden();
      await expect(
        page.getByRole("navigation", { name: "Primary navigation" }),
      ).toBeVisible();
      await page
        .getByRole("navigation", { name: "Primary navigation" })
        .getByRole("link", { name: "Discover" })
        .click();
    }

    await expect(page).toHaveURL(/\/discover$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "DISCOVER WINES" }),
    ).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search wines" })).toBeVisible();
    await expectCoreLandmarks(page);
    await expectNoHorizontalOverflow(page);
    await expectNoPointerInterceptingCanvas(page);
  });
}

test("the completed public, auth, demo, and private route set reflows across every required viewport", async ({
  browser,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The full route/viewport matrix runs once in desktop Chromium.",
  );
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  const account = disposableAccount("responsive-routes", testInfo);
  const user = await signupThroughPreview(page, account);
  await seedActiveProfile(page, user.id, "RESPONSIVE PRIVATE NOTE");

  const anonymousContext = await browser.newContext({ reducedMotion: "reduce" });
  const anonymousPage = await anonymousContext.newPage();

  try {
    for (const viewport of viewportMatrix) {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });
      for (const route of [
        "/wines/mock-chateau-montelena-cabernet-sauvignon-2019",
        "/cellar",
        "/profile",
        "/demo/cellar",
        "/demo/taste-atlas",
        "/not-in-the-directory",
      ]) {
        await page.goto(route);
        await expectRouteSurfaceReflow(page);
      }

      await anonymousPage.setViewportSize({
        height: viewport.height,
        width: viewport.width,
      });
      for (const route of ["/login", "/signup"]) {
        await anonymousPage.goto(`${origin}${route}`);
        await expectRouteSurfaceReflow(anonymousPage);
      }
    }
  } finally {
    await anonymousContext.close();
  }
});

test("CDP page-scale factor provides an honest automated 200% zoom check", async ({
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "CDP page zoom is Chromium-specific.",
  );

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const cdp = await context.newCDPSession(page);
  await page.goto("/discover");
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });

  await expect(
    page.getByRole("heading", { level: 1, name: "DISCOVER WINES" }),
  ).toBeVisible();
  const layoutMetrics = await cdp.send("Page.getLayoutMetrics");
  const scale = layoutMetrics.cssVisualViewport.scale;
  expect(scale).toBeGreaterThanOrEqual(2);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("searchbox", { name: "Search wines" }).focus();
  await expect(page.getByRole("searchbox", { name: "Search wines" })).toBeFocused();
});

test("WCAG text spacing overrides preserve reflow and operable controls", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The text-spacing override runs once in desktop Chromium.",
  );

  await page.setViewportSize({ height: 800, width: 360 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.addStyleTag({
    content: `
      * { letter-spacing: 0.12em !important; line-height: 1.5 !important; word-spacing: 0.16em !important; }
      p { margin-bottom: 2em !important; }
    `,
  });

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "FIND THE BOTTLE KEEP THE MEMORY",
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
});

test("forced-colors emulation retains landmarks, headings, and navigation", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Forced-colors emulation runs once in desktop Chromium.",
  );

  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/discover");

  expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(
    true,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "DISCOVER WINES" }),
  ).toBeVisible();
  await expectCoreLandmarks(page);
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("searchbox", { name: "Search wines" }).fill("oysters");
  await expect(
    page.getByRole("button", { name: "Match", exact: true }),
  ).toBeEnabled();
});
