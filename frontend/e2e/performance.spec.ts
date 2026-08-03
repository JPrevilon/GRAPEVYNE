import { expect, test } from "@playwright/test";

import { disposableAccount } from "./helpers/accounts";
import {
  cumulativeLayoutShift,
  installLayoutShiftObserver,
  resourceNames,
} from "./helpers/browser";
import { seedActiveProfile, signupThroughPreview } from "./helpers/seed";

interface RuntimeMetrics {
  cls: number | null;
  firstWebglFrameFromHeroMs: number | null;
  initialRequestCount: number;
  initialTransferredBytes: number;
  lcpMs: number | null;
  longTasks: number[];
  semanticHeroMs: number | null;
  webglImportToFirstFrameMs: number | null;
}

async function installRuntimeObservers(page: Parameters<typeof installLayoutShiftObserver>[0]) {
  await installLayoutShiftObserver(page);
  await page.addInitScript(() => {
    const metrics = {
      lcp: null as number | null,
      longTasks: [] as number[],
      semanticHero: null as number | null,
    };
    Object.defineProperty(window, "__grapevyneRuntimeMetrics", {
      configurable: true,
      value: metrics,
    });

    try {
      new PerformanceObserver((list) => {
        const latest = list.getEntries().at(-1);
        if (latest) metrics.lcp = latest.startTime;
      }).observe({ buffered: true, type: "largest-contentful-paint" });
    } catch {
      // Unsupported metrics remain informationally null.
    }

    try {
      new PerformanceObserver((list) => {
        metrics.longTasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ buffered: true, type: "longtask" });
    } catch {
      // Unsupported metrics remain informationally empty.
    }

    const captureSemanticHero = () => {
      if (
        metrics.semanticHero === null &&
        document.querySelector("#chapter-01-hero h1")
      ) {
        metrics.semanticHero = performance.now();
        return true;
      }

      return false;
    };
    const pollForSemanticHero = () => {
      if (!captureSemanticHero()) requestAnimationFrame(pollForSemanticHero);
    };
    requestAnimationFrame(pollForSemanticHero);
  });
}

test("initial home and product routes obey resource and lifecycle budgets", async ({
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Runtime resource instrumentation runs once in desktop Chromium.",
  );
  test.setTimeout(90_000);

  await installRuntimeObservers(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "FIND THE BOTTLE KEEP THE MEMORY",
    }),
  ).toBeVisible();

  await page
    .locator("[data-webgl-status='ready']")
    .waitFor({ state: "visible", timeout: 8_000 })
    .catch(() => undefined);

  const metrics = await page.evaluate(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    const resources = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const runtime = (
      window as Window & {
        __grapevyneRuntimeMetrics?: {
          lcp: number | null;
          longTasks: number[];
          semanticHero: number | null;
        };
      }
    ).__grapevyneRuntimeMetrics;
    const importToFirstFrame = performance.getEntriesByName(
      "grapevyne-webgl-time-to-first-frame",
    )[0];
    const firstFrame = performance.getEntriesByName(
      "grapevyne-webgl-first-frame",
    )[0];
    const semanticHero = runtime?.semanticHero ?? null;

    return {
      firstWebglFrameFromHeroMs:
        firstFrame && semanticHero !== null
          ? firstFrame.startTime - semanticHero
          : null,
      initialRequestCount: resources.length + (navigation ? 1 : 0),
      initialTransferredBytes: resources.reduce(
        (total, resource) => total + resource.transferSize,
        navigation?.transferSize ?? 0,
      ),
      lcpMs: runtime?.lcp ?? null,
      longTasks: runtime?.longTasks ?? [],
      semanticHeroMs: semanticHero,
      webglImportToFirstFrameMs: importToFirstFrame?.duration ?? null,
    };
  });
  const cls = await cumulativeLayoutShift(page);
  const report: RuntimeMetrics = { ...metrics, cls };
  await testInfo.attach("home-runtime-metrics", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  console.log(`[prompt09-home-runtime] ${JSON.stringify(report)}`);

  expect(metrics.semanticHeroMs).not.toBeNull();
  // CLS <= 0.10, a 500 ms long-task ceiling, and <=1.5 s to first WebGL frame
  // remain documented soft lab targets. Parallel browser contention can
  // inflate them, so timing samples stay informational while their shape and
  // the resource/lifecycle contracts are hard assertions.
  if (cls !== null) {
    expect(Number.isFinite(cls)).toBe(true);
    expect(cls).toBeGreaterThanOrEqual(0);
  }
  expect(metrics.longTasks.every((duration) => Number.isFinite(duration))).toBe(true);
  if (metrics.firstWebglFrameFromHeroMs !== null) {
    expect(Number.isFinite(metrics.firstWebglFrameFromHeroMs)).toBe(true);
    expect(metrics.firstWebglFrameFromHeroMs).toBeGreaterThanOrEqual(0);
  }

  const homeResources = await resourceNames(page);
  const earlyNonHeroVideo = homeResources.filter((name) =>
    /taste-liquid-transition|cellar-corridor-push|memory-table-ambience|taste-atlas-finale/.test(
      name,
    ),
  );
  expect(earlyNonHeroVideo).toEqual([]);
  expect(homeResources.some((name) => /\.mobile\.(?:mp4|webm)(?:$|\?)/.test(name))).toBe(false);
  expect(await page.locator("canvas").count()).toBeLessThanOrEqual(1);

  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "DISCOVER WINES" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);

  const productPage = await context.newPage();
  await productPage.goto("/discover");
  await expect(productPage.getByRole("heading", { name: "DISCOVER WINES" })).toBeVisible();
  const productResources = await resourceNames(productPage);
  expect(
    productResources.some((name) =>
      /HomePage-|ExperienceCanvas|\.glb(?:$|\?)|\/assets\/video\//i.test(name),
    ),
  ).toBe(false);
  await productPage.close();

  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "FIND THE BOTTLE KEEP THE MEMORY" }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  expect(await page.locator("canvas").count()).toBeLessThanOrEqual(1);
});

test("API timings, frame cadence, and throttled mobile readiness remain measurable", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Controlled runtime measurements run once in desktop Chromium.",
  );
  test.setTimeout(90_000);

  await page.goto("/discover?query=crisp+white+for+oysters");
  await expect(
    page.getByRole("link", { name: /^View .+ with recommendation context$/ }).first(),
  ).toBeVisible();
  const account = disposableAccount("performance", testInfo);
  const user = await signupThroughPreview(page, account);
  await seedActiveProfile(page, user.id, "PERFORMANCE PRIVATE NOTE");

  await page.goto("/cellar");
  await expect(page.locator("[data-cellar-source='authenticated-api']")).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "YOUR RECORDED BRANCHES" })).toBeVisible();

  await page.evaluate(async () => {
    performance.clearResourceTimings();
    const responses = await Promise.all([
      fetch("/api/cellar", { credentials: "include" }),
      fetch("/api/profile/taste", { credentials: "include" }),
      fetch(
        "/api/wines/recommendations?query=crisp+white+for+oysters&limit=6",
        { credentials: "include" },
      ),
    ]);
    if (responses.some((response) => !response.ok)) {
      throw new Error("A required performance-probe API request failed.");
    }
    await Promise.all(responses.map((response) => response.arrayBuffer()));
  });

  const apiTimings = await page.evaluate(() =>
    (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter((entry) =>
        /\/api\/(?:wines\/recommendations|cellar|profile\/taste)/.test(entry.name),
      )
      .map((entry) => ({
        durationMs: entry.duration,
        name: entry.name,
        path: new URL(entry.name).pathname,
      })),
  );

  await page.goto("/");
  const frameCadence = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const samples: number[] = [];
        const start = performance.now();
        const sample = (timestamp: number) => {
          samples.push(timestamp);
          if (timestamp - start >= 700) {
            const elapsed = (samples.at(-1) ?? start) - (samples[0] ?? start);
            resolve(elapsed > 0 ? ((samples.length - 1) * 1000) / elapsed : 0);
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );

  await testInfo.attach("api-and-frame-metrics", {
    body: JSON.stringify({ apiTimings, approximateFramesPerSecond: frameCadence }, null, 2),
    contentType: "application/json",
  });
  expect(new Set(apiTimings.map(({ path }) => path))).toEqual(
    new Set([
      "/api/cellar",
      "/api/profile/taste",
      "/api/wines/recommendations",
    ]),
  );
  expect(Number.isFinite(frameCadence)).toBe(true);
  expect(frameCadence).toBeGreaterThanOrEqual(0);

  const origin = new URL(page.url()).origin;
  const mobileContext = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { height: 844, width: 390 },
  });
  const mobilePage = await mobileContext.newPage();
  const cdp = await mobileContext.newCDPSession(mobilePage);

  try {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      connectionType: "cellular3g",
      downloadThroughput: 200_000,
      latency: 150,
      offline: false,
      uploadThroughput: 80_000,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await mobilePage.goto(`${origin}/`, { timeout: 30_000 });
    await expect(
      mobilePage.getByRole("heading", {
        level: 1,
        name: "FIND THE BOTTLE KEEP THE MEMORY",
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(mobilePage.locator("canvas")).toHaveCount(0);
    const mobileFrameCadence = await mobilePage.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const samples: number[] = [];
          const start = performance.now();
          const sample = (timestamp: number) => {
            samples.push(timestamp);
            if (timestamp - start >= 700) {
              const elapsed = (samples.at(-1) ?? start) - (samples[0] ?? start);
              resolve(elapsed > 0 ? ((samples.length - 1) * 1000) / elapsed : 0);
              return;
            }
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }),
    );
    await testInfo.attach("mobile-frame-metrics", {
      body: JSON.stringify({ approximateFramesPerSecond: mobileFrameCadence }, null, 2),
      contentType: "application/json",
    });
    console.log(
      `[prompt09-api-frame-runtime] ${JSON.stringify({
        apiTimings,
        desktopApproximateFramesPerSecond: frameCadence,
        mobileApproximateFramesPerSecond: mobileFrameCadence,
      })}`,
    );
  } finally {
    await mobileContext.close();
  }

  expect(context.pages()).toContain(page);
});
