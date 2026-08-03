import { expect, test } from "@playwright/test";

import { disposableAccount } from "./helpers/accounts";
import {
  envelopeData,
  sameOriginApi,
  type ApiEnvelope,
  type CellarEntryData,
} from "./helpers/api";
import { resourceNames } from "./helpers/browser";
import {
  createCellarEntryThroughPreview,
  signupThroughPreview,
} from "./helpers/seed";

const chapterOrder = [
  "hero",
  "discovery",
  "match",
  "taste",
  "portal",
  "cellar",
  "memory",
  "atlas",
  "finale",
];

test("reduced motion keeps the complete story semantic and poster-based", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "reduced-motion-chromium",
    "This contract belongs to the dedicated reduced-motion project.",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("section[data-story-chapter]")).toHaveCount(9);
  const renderedOrder = await page
    .locator("section[data-story-chapter]")
    .evaluateAll((chapters) => chapters.map((chapter) => chapter.getAttribute("data-story-chapter")));
  expect(renderedOrder).toEqual(chapterOrder);
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("#chapter-09-finale")).toBeAttached();
  await expect(page.locator("#chapter-08-atlas img")).toHaveAttribute(
    "src",
    /taste-atlas-finale\.desktop\.jpg$/,
  );

  const chapterNavigation = page.getByRole("navigation", {
    name: "From Vine to Memory chapters",
  });
  await chapterNavigation.getByRole("link", { name: "GRAPEVYNE" }).click();
  await expect(page).toHaveURL(/#chapter-09-finale$/);

  await page.locator("#chapter-01-hero").scrollIntoViewIfNeeded();
  await page.getByLabel("What is the bottle for?").fill("Cabernet for steak");
  await page.getByRole("button", { name: "Discover" }).first().click();
  await expect(page).toHaveURL(/\/discover\?query=/);
  expect(new URL(page.url()).searchParams.get("query")).toBe("Cabernet for steak");
  await page.goBack();
  await expect(page).toHaveURL(/\/#chapter-09-finale$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/discover\?query=/);
  expect(new URL(page.url()).searchParams.get("query")).toBe("Cabernet for steak");

  const resources = await resourceNames(page);
  expect(resources.some((name) => /ExperienceCanvas|\.glb(?:$|\?)/i.test(name))).toBe(false);
});

test("disabled WebGL and Save-Data retain the CSS bottle without 3D requests", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Capability fallback is simulated once in desktop Chromium.",
  );

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
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
  });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "FIND THE BOTTLE KEEP THE MEMORY",
    }),
  ).toBeVisible();
  await expect(page.locator(".gv-hero-bottle")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("[data-webgl-status]")).toHaveCount(0);
  const resources = await resourceNames(page);
  expect(resources.some((name) => /ExperienceCanvas|\.glb(?:$|\?)/i.test(name))).toBe(false);
});

test("a rejected autoplay falls back to the final hero poster", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Autoplay rejection is simulated once in desktop Chromium.",
  );

  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () =>
      Promise.reject(new DOMException("Autoplay blocked for E2E.", "NotAllowedError"));
  });
  await page.goto("/");
  await expect(page.locator("#chapter-01-hero img.gv-story-media__visual")).toBeVisible();
  await expect(page.locator("#chapter-01-hero video")).toHaveCount(0);
});

test("live WebGL visual smoke retains one ready, nonblank bottle frame", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The live renderer visual smoke runs once in desktop Chromium.",
  );
  test.setTimeout(30_000);

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "FIND THE BOTTLE KEEP THE MEMORY",
    }),
  ).toBeVisible();

  const layer = page.locator("[data-webgl-status='ready']");
  await expect(layer).toBeVisible({ timeout: 8_000 });
  await expect(layer).toHaveCSS("opacity", "1");
  const canvas = layer.locator("canvas");
  await expect(canvas).toHaveCount(1);
  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds).not.toBeNull();
  expect(canvasBounds?.width).toBeGreaterThanOrEqual(1_400);
  expect(canvasBounds?.height).toBeGreaterThanOrEqual(880);
  await expect(page.locator(".gv-hero-bottle")).toHaveCSS("opacity", "0");

  const screenshot = await page.screenshot({ animations: "disabled" });
  expect(screenshot.byteLength).toBeGreaterThan(100_000);
  await testInfo.attach("live-webgl-label-forward-visual-smoke", {
    body: screenshot,
    contentType: "image/png",
  });
});

test("WebGL context loss restores the CSS fallback after one recovery attempt", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Renderer lifecycle runs once in desktop Chromium.",
  );

  await page.goto("/");
  const canvas = page.locator(".gv-webgl-experience canvas");

  try {
    await expect(canvas).toHaveCount(1, { timeout: 8_000 });
    await expect(page.locator("[data-webgl-status='ready']")).toBeVisible({
      timeout: 8_000,
    });
  } catch {
    test.skip(true, "The local Chromium renderer exposes no usable WebGL context.");
  }

  await canvas.dispatchEvent("webglcontextlost", {
    bubbles: false,
    cancelable: true,
  });
  await expect(page.locator("[data-webgl-status='recovering']")).toBeVisible();
  await canvas.dispatchEvent("webglcontextrestored");
  await expect(page.locator("[data-webgl-status='ready']")).toBeVisible();
  await canvas.dispatchEvent("webglcontextlost", {
    bubbles: false,
    cancelable: true,
  });
  await expect(page.locator("[data-webgl-status]")).toHaveCount(0);
  await expect(page.locator(".gv-hero-bottle")).toBeVisible();
});

test("auth boot failure recovers without exposing protected content", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Auth boot recovery runs once in desktop Chromium.",
  );

  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: { error: { code: "forced_failure", message: "Forced auth outage." } },
      status: 503,
    }),
  );
  await page.goto("/cellar");
  await expect(
    page.getByRole("heading", { name: "YOUR PRIVATE SESSION COULD NOT BE VERIFIED" }),
  ).toBeVisible();
  await expect(page.locator("[data-cellar-source='authenticated-api']")).toHaveCount(0);

  await page.unroute("**/api/auth/me");
  await page.getByRole("button", { name: "Check session again" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("Profile, PATCH, and DELETE failures never claim success or erase data", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Private mutation recovery runs once in desktop Chromium.",
  );
  test.setTimeout(60_000);

  const account = disposableAccount("failure-recovery", testInfo);
  await page.goto("/");
  const user = await signupThroughPreview(page, account);
  const entry = await createCellarEntryThroughPreview(
    page,
    user.id,
    "mock-la-rioja-alta-reserva-2018",
  );

  await page.route("**/api/profile/taste", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: { error: { code: "forced_failure", message: "Forced profile outage." } },
      status: 503,
    }),
  );
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "YOUR TASTE PROFILE IS UNAVAILABLE" }),
  ).toBeVisible();
  await page.unroute("**/api/profile/taste");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "YOUR ATLAS IS READY FOR ITS FIRST BRANCH" }),
  ).toBeVisible();

  await page.goto("/cellar");
  await page.locator(`#cellar-entry-${entry.id}-trigger`).click();
  await page.getByLabel("Memory title").fill("Must not persist yet");
  let releasePatch: (() => void) | undefined;
  const heldPatch = new Promise<void>((resolve) => {
    releasePatch = resolve;
  });
  await page.route(`**/api/cellar/${entry.id}`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    await heldPatch;
    await route.fulfill({
      contentType: "application/json",
      json: { error: { code: "forced_failure", message: "Forced PATCH failure." } },
      status: 500,
    });
  });
  await page.getByRole("button", { name: "Save tasting memory" }).click();
  await expect(page.getByRole("button", { name: "Saving memory…" })).toBeDisabled();
  releasePatch?.();
  await expect(page.locator(`#cellar-entry-${entry.id}-feedback`)).toContainText(
    "Forced PATCH failure.",
  );
  await expect(
    page.getByText("Changes saved to your private cellar.", { exact: true }),
  ).toHaveCount(0);
  await page.unroute(`**/api/cellar/${entry.id}`);

  const unchanged = await sameOriginApi<ApiEnvelope<CellarEntryData>>(
    page,
    `/api/cellar/${entry.id}`,
  );
  expect(envelopeData(unchanged).entry.memoryTitle).toBeNull();

  await page.getByRole("button", { name: "Remove bottle" }).click();
  await page.route(`**/api/cellar/${entry.id}`, async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.continue();
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      json: { error: { code: "forced_failure", message: "Forced DELETE failure." } },
      status: 500,
    });
  });
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(
    page.locator(`#cellar-entry-${entry.id}-delete-feedback`),
  ).toContainText("Forced DELETE failure.");
  await page.unroute(`**/api/cellar/${entry.id}`);

  const stillPresent = await sameOriginApi<ApiEnvelope<CellarEntryData>>(
    page,
    `/api/cellar/${entry.id}`,
  );
  expect(envelopeData(stillPresent).entry.id).toBe(entry.id);
});
