import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { forceLiveWebGLCapability } from "./helpers/browser";

const promptEvidenceRoot = path.resolve(
  process.cwd(),
  "..",
  "docs",
  "screenshots",
  "prompt-10a2",
);
const screenshotRoot = path.join(promptEvidenceRoot, "local-public");
const walkthroughRoot = path.join(promptEvidenceRoot, "walkthroughs");

const desktopViewport = { height: 900, width: 1440 };
const mobileViewport = { height: 844, width: 390 };

const chapterKeys = [
  "hero",
  "discovery",
  "match",
  "taste",
  "portal",
  "cellar",
  "memory",
  "atlas",
  "finale",
] as const;

interface Viewport {
  height: number;
  width: number;
}

async function settleFrames(page: Page, count = 4): Promise<void> {
  await page.evaluate(
    (frameCount) =>
      new Promise<void>((resolve) => {
        let remaining = frameCount;
        const tick = () => {
          remaining -= 1;
          if (remaining <= 0) resolve();
          else window.requestAnimationFrame(tick);
        };
        window.requestAnimationFrame(tick);
      }),
    count,
  );
}

async function capture(page: Page, filename: string): Promise<void> {
  await expect(page.locator("main")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await settleFrames(page);
  await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    path: path.join(screenshotRoot, filename),
  });
}

async function storyAnchors(page: Page): Promise<number[]> {
  return page.locator(".gv-story").evaluate((root) => {
    const sections = [
      ...root.querySelectorAll<HTMLElement>("[data-story-chapter]"),
    ];
    const viewportHeight = window.innerHeight || 1;
    const rootBounds = root.getBoundingClientRect();
    const rootTop = window.scrollY + rootBounds.top;
    const distance = Math.max(rootBounds.height - viewportHeight, 1);

    return sections.map((section, index) => {
      if (index === 0) return 0;
      const bounds = section.getBoundingClientRect();
      const activation = window.scrollY + bounds.top - viewportHeight / 2;
      return Math.min(1, Math.max(0, (activation - rootTop) / distance));
    });
  });
}

async function scrollToOverallProgress(
  page: Page,
  overallProgress: number,
  frameCount = 4,
): Promise<void> {
  await page.locator(".gv-story").evaluate((root, progress) => {
    const bounds = root.getBoundingClientRect();
    const rootTop = window.scrollY + bounds.top;
    const distance = Math.max(bounds.height - window.innerHeight, 1);
    window.scrollTo({
      behavior: "instant",
      top: rootTop + distance * progress,
    });
  }, overallProgress);
  await settleFrames(page, frameCount);
}

async function moveToTransitionPoint(
  page: Page,
  boundaryIndex: number,
  transitionProgress: number,
): Promise<void> {
  const anchors = await storyAnchors(page);
  const lower = anchors[boundaryIndex] ?? 0;
  const upper = anchors[boundaryIndex + 1] ?? 1;
  const segmentProgress = 0.7 + 0.3 * transitionProgress;
  await scrollToOverallProgress(
    page,
    lower + (upper - lower) * segmentProgress,
  );
}

async function moveToStableChapter(
  page: Page,
  chapterIndex: number,
): Promise<void> {
  const anchors = await storyAnchors(page);
  const lower = anchors[chapterIndex] ?? 0;
  const upper = anchors[chapterIndex + 1] ?? 1;
  const progress =
    chapterIndex === chapterKeys.length - 1
      ? lower + (1 - lower) * 0.4
      : lower + (upper - lower) * 0.4;

  await scrollToOverallProgress(page, progress);
  await expect
    .poll(() => page.locator(".gv-story").getAttribute("data-story-owner"))
    .toBe(chapterKeys[chapterIndex]);
  await expect
    .poll(() =>
      page.locator(".gv-story").getAttribute("data-story-transition-phase"),
    )
    .toBe("stable");
}

async function waitForLiveStory(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "FIND THE BOTTLE KEEP THE MEMORY",
    }),
  ).toBeVisible();
  await expect(page.locator("[data-webgl-status='ready']")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".gv-webgl-experience canvas")).toHaveCount(1);
}

async function dragSubjectWithMouse(
  page: Page,
  control: Locator,
  deltaX: number,
  deltaY = 0,
): Promise<void> {
  const bounds = await control.boundingBox();
  if (!bounds) throw new Error("The story subject control has no hit region.");

  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height / 2;
  const previousYaw = Number(await control.getAttribute("data-target-yaw"));
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 16 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await control.getAttribute("data-target-yaw")))
    .not.toBe(previousYaw);
  await page.waitForTimeout(500);
}

async function dragSubjectWithTouch(
  page: Page,
  control: Locator,
  deltaX: number,
  deltaY = 0,
): Promise<void> {
  const bounds = await control.boundingBox();
  if (!bounds) throw new Error("The mobile story subject has no hit region.");

  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height / 2;
  const pointerId = 41;
  const previousYaw = Number(await control.getAttribute("data-target-yaw"));

  await control.dispatchEvent("pointerdown", {
    button: 0,
    clientX: startX,
    clientY: startY,
    isPrimary: true,
    pointerId,
    pointerType: "touch",
  });
  await page.waitForTimeout(190);
  await control.dispatchEvent("pointermove", {
    clientX: startX + deltaX,
    clientY: startY + deltaY,
    isPrimary: true,
    pointerId,
    pointerType: "touch",
  });
  await control.dispatchEvent("pointerup", {
    button: 0,
    clientX: startX + deltaX,
    clientY: startY + deltaY,
    isPrimary: true,
    pointerId,
    pointerType: "touch",
  });
  await expect
    .poll(async () => Number(await control.getAttribute("data-target-yaw")))
    .not.toBe(previousYaw);
  await page.waitForTimeout(500);
}

function browserContextDefaults() {
  const hostedPreview = Boolean(
    process.env.GRAPEVYNE_HOSTED_PREVIEW_DEPLOYMENT_ID,
  );

  return {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173",
    extraHTTPHeaders: hostedPreview
      ? { "x-vercel-skip-toolbar": "1" }
      : undefined,
    storageState:
      process.env.GRAPEVYNE_HOSTED_PREVIEW_STORAGE_STATE || undefined,
  };
}

async function newEvidencePage(
  browser: Browser,
  viewport: Viewport,
  options?: { hasTouch?: boolean; isMobile?: boolean; reducedMotion?: "reduce" },
) {
  const context = await browser.newContext({
    ...browserContextDefaults(),
    hasTouch: options?.hasTouch,
    isMobile: options?.isMobile,
    reducedMotion: options?.reducedMotion ?? "no-preference",
    viewport,
  });
  const page = await context.newPage();
  return { context, page };
}

async function recordClip(
  browser: Browser,
  testInfo: TestInfo,
  filename: string,
  viewport: Viewport,
  // The JS-rule layer cannot see that this callback parameter belongs to a
  // TypeScript function type rather than a runtime declaration.
  // eslint-disable-next-line no-unused-vars
  action: (page: Page) => Promise<void>,
  mobile = false,
): Promise<void> {
  const temporaryVideoDirectory = testInfo.outputPath(
    `${path.basename(filename, ".webm")}-recording`,
  );
  await mkdir(temporaryVideoDirectory, { recursive: true });
  const context = await browser.newContext({
    ...browserContextDefaults(),
    hasTouch: mobile,
    isMobile: mobile,
    recordVideo: {
      dir: temporaryVideoDirectory,
      size: mobile ? mobileViewport : { height: 600, width: 960 },
    },
    reducedMotion: "no-preference",
    viewport,
  });
  const page = await context.newPage();
  await forceLiveWebGLCapability(page);
  const video = page.video();
  if (!video) throw new Error(`Playwright did not start recording ${filename}.`);

  await action(page);
  await page.close();
  await video.saveAs(path.join(walkthroughRoot, filename));
  await context.close();

  expect((await stat(path.join(walkthroughRoot, filename))).size).toBeGreaterThan(
    50_000,
  );
}

async function recordScrollWalkthrough(
  page: Page,
  direction: "forward" | "reverse",
): Promise<void> {
  await page.goto("/");
  await waitForLiveStory(page);
  const steps = 120;
  if (direction === "reverse") {
    await scrollToOverallProgress(page, 1);
    await page.waitForTimeout(700);
  }

  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    await scrollToOverallProgress(
      page,
      direction === "forward" ? progress : 1 - progress,
      1,
    );
    await page.waitForTimeout(55);
  }
  await page.waitForTimeout(700);
}

test.beforeEach(async () => {
  test.skip(
    process.env.GRAPEVYNE_CAPTURE_PROMPT10A2 !== "1",
    "Prompt 10A2 evidence is generated only by the explicit capture command.",
  );
  await Promise.all([
    mkdir(screenshotRoot, { recursive: true }),
    mkdir(walkthroughRoot, { recursive: true }),
  ]);
});

test.describe.configure({ mode: "serial" });

test("capture the Prompt 10A2 screenshot matrix", async ({ browser, page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The Prompt 10A2 evidence matrix runs once in desktop Chromium.",
  );
  test.setTimeout(300_000);

  await forceLiveWebGLCapability(page);
  await page.goto("/");
  await waitForLiveStory(page);

  const bottle = page.getByRole("button", {
    name: "Rotate the GRAPEVYNE wine bottle",
  });
  await expect(bottle).toHaveAttribute("data-projected-hit-area", "true");
  await capture(page, "02-chapter-01-bottle-front.png");
  await dragSubjectWithMouse(page, bottle, 240, -24);
  await capture(page, "03-chapter-01-bottle-side-back-after-drag.png");

  await page.goto("/");
  await waitForLiveStory(page);
  await moveToStableChapter(page, 1);
  const grapes = page.getByRole("button", {
    name: "Rotate the GRAPEVYNE grape cluster",
  });
  await expect(grapes).toHaveAttribute("data-projected-hit-area", "true");
  await capture(page, "04-chapter-02-grapes-front.png");
  await dragSubjectWithMouse(page, grapes, -240, 18);
  await capture(page, "05-chapter-02-grapes-side-back-after-drag.png");

  await page.setViewportSize(mobileViewport);
  await page.goto("/");
  await waitForLiveStory(page);
  const mobileBottle = page.getByRole("button", {
    name: "Rotate the GRAPEVYNE wine bottle",
  });
  await dragSubjectWithTouch(page, mobileBottle, 150, -12);
  await capture(page, "06-mobile-bottle-interaction-390x844.png");

  await moveToStableChapter(page, 1);
  const mobileGrapes = page.getByRole("button", {
    name: "Rotate the GRAPEVYNE grape cluster",
  });
  await dragSubjectWithTouch(page, mobileGrapes, -150, 14);
  await capture(page, "07-mobile-grape-interaction-390x844.png");

  await page.setViewportSize(desktopViewport);
  await page.goto("/");
  await waitForLiveStory(page);
  await moveToTransitionPoint(page, 0, 0.2);
  await expect(page.locator(".gv-story")).toHaveAttribute(
    "data-story-transition-phase",
    "outgoing-fade",
  );
  await capture(page, "08-boundary-01-to-02-outgoing-fade.png");

  await moveToTransitionPoint(page, 0, 0.5);
  await expect(page.locator(".gv-story")).toHaveAttribute(
    "data-story-transition-phase",
    "black-hold",
  );
  await expect(page.locator("[data-story-media-stack]")).toHaveAttribute(
    "data-active-media",
    "black",
  );
  const blackColors = await page.evaluate(() => {
    const computedColor = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}.`);
      return getComputedStyle(element).backgroundColor;
    };
    return {
      navigation: computedColor(".gv-nav"),
      stage: computedColor(".gv-story-stage"),
      veil: computedColor(".gv-story-transition-veil"),
    };
  });
  expect(new Set(Object.values(blackColors))).toEqual(
    new Set(["rgb(0, 0, 0)"]),
  );
  await capture(page, "01-true-black-full-cover-matches-navigation.png");
  await capture(page, "09-boundary-01-to-02-full-black-hold.png");

  await moveToTransitionPoint(page, 0, 0.8);
  await expect(page.locator(".gv-story")).toHaveAttribute(
    "data-story-transition-phase",
    "incoming-reveal",
  );
  await capture(page, "10-boundary-01-to-02-incoming-reveal.png");

  for (const evidence of [
    { boundary: 1, filename: "11-boundary-02-to-03-full-black-hold.png" },
    { boundary: 3, filename: "12-boundary-04-to-05-full-black-hold.png" },
    { boundary: 6, filename: "13-boundary-07-to-08-full-black-hold.png" },
    { boundary: 7, filename: "14-boundary-08-to-09-full-black-hold.png" },
  ]) {
    await moveToTransitionPoint(page, evidence.boundary, 0.5);
    await expect(page.locator(".gv-story")).toHaveAttribute(
      "data-story-transition-phase",
      "black-hold",
    );
    await capture(page, evidence.filename);
  }

  await moveToTransitionPoint(page, 0, 0.8);
  await moveToTransitionPoint(page, 0, 0.44);
  await expect(page.locator(".gv-story")).toHaveAttribute(
    "data-story-transition-phase",
    "black-hold",
  );
  await expect(page.locator("[data-story-media-stack]")).toHaveAttribute(
    "data-active-media",
    "black",
  );
  await expect(page.locator(".gv-story")).toHaveAttribute(
    "data-story-owner",
    "hero",
  );
  await capture(page, "15-reverse-boundary-02-to-01-black-hold.png");

  const reducedMotion = await newEvidencePage(browser, mobileViewport, {
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  await reducedMotion.page.goto("/");
  await expect(reducedMotion.page.locator(".gv-story")).toHaveAttribute(
    "data-story-mode",
    "reduced-motion",
  );
  await expect(reducedMotion.page.locator("canvas")).toHaveCount(0);
  await capture(
    reducedMotion.page,
    "16-reduced-motion-mobile-390x844-fallback.png",
  );
  await reducedMotion.context.close();

  const saveData = await newEvidencePage(browser, desktopViewport);
  await saveData.page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
  });
  await saveData.page.goto("/");
  await expect(saveData.page.locator(".gv-story")).toHaveAttribute(
    "data-story-mode",
    "save-data",
  );
  await expect(saveData.page.locator("canvas")).toHaveCount(0);
  await capture(saveData.page, "17-save-data-fallback.png");
  await saveData.context.close();

  const mobileSaveData = await newEvidencePage(browser, mobileViewport, {
    hasTouch: true,
    isMobile: true,
  });
  await mobileSaveData.page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
  });
  await mobileSaveData.page.goto("/");
  await expect(mobileSaveData.page.locator(".gv-story")).toHaveAttribute(
    "data-story-mode",
    "save-data",
  );
  await expect(mobileSaveData.page.locator("canvas")).toHaveCount(0);
  await capture(
    mobileSaveData.page,
    "18-save-data-mobile-390x844-fallback.png",
  );
  await mobileSaveData.context.close();

  const webglFailure = await newEvidencePage(browser, desktopViewport);
  await webglFailure.page.addInitScript(() => {
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
  await webglFailure.page.goto("/");
  await expect(
    webglFailure.page.locator(".gv-story-fallback-subject--bottle"),
  ).toHaveCSS("opacity", "1");
  await expect(
    webglFailure.page.locator("[data-story-fallback-subjects]"),
  ).toHaveCSS("opacity", "1");
  await expect(webglFailure.page.locator("canvas")).toHaveCount(0);
  await expect(webglFailure.page.locator("[data-webgl-status]")).toHaveCount(0);
  await capture(webglFailure.page, "19-webgl-failure-fallback.png");
  await webglFailure.context.close();
});

test("record the five Prompt 10A2 walkthrough clips", async ({ browser }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The Prompt 10A2 walkthroughs record once in desktop Chromium.",
  );
  test.setTimeout(360_000);

  await recordClip(
    browser,
    testInfo,
    "20-desktop-forward-complete-walkthrough.webm",
    desktopViewport,
    (page) => recordScrollWalkthrough(page, "forward"),
  );
  await recordClip(
    browser,
    testInfo,
    "21-desktop-reverse-complete-walkthrough.webm",
    desktopViewport,
    (page) => recordScrollWalkthrough(page, "reverse"),
  );
  await recordClip(
    browser,
    testInfo,
    "22-mobile-model-interaction-walkthrough.webm",
    mobileViewport,
    async (page) => {
      await page.goto("/");
      await waitForLiveStory(page);
      const bottle = page.getByRole("button", {
        name: "Rotate the GRAPEVYNE wine bottle",
      });
      await dragSubjectWithTouch(page, bottle, 150, -12);
      await moveToStableChapter(page, 1);
      const grapes = page.getByRole("button", {
        name: "Rotate the GRAPEVYNE grape cluster",
      });
      await dragSubjectWithTouch(page, grapes, -150, 14);
      for (let index = 0; index <= 60; index += 1) {
        await scrollToOverallProgress(page, index / 60, 1);
        await page.waitForTimeout(55);
      }
      await page.waitForTimeout(500);
    },
    true,
  );
  await recordClip(
    browser,
    testInfo,
    "23-focused-bottle-direct-rotation.webm",
    desktopViewport,
    async (page) => {
      await page.goto("/");
      await waitForLiveStory(page);
      const bottle = page.getByRole("button", {
        name: "Rotate the GRAPEVYNE wine bottle",
      });
      await dragSubjectWithMouse(page, bottle, 180, -16);
      await dragSubjectWithMouse(page, bottle, 180, 12);
      await dragSubjectWithMouse(page, bottle, 180, -8);
      await page.waitForTimeout(700);
    },
  );
  await recordClip(
    browser,
    testInfo,
    "24-focused-grape-direct-rotation.webm",
    desktopViewport,
    async (page) => {
      await page.goto("/");
      await waitForLiveStory(page);
      await moveToStableChapter(page, 1);
      const grapes = page.getByRole("button", {
        name: "Rotate the GRAPEVYNE grape cluster",
      });
      await dragSubjectWithMouse(page, grapes, -180, 12);
      await dragSubjectWithMouse(page, grapes, -180, -14);
      await dragSubjectWithMouse(page, grapes, -180, 8);
      await page.waitForTimeout(700);
    },
  );
});
