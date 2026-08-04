import { expect, test, type Page } from "@playwright/test";

import {
  forceLiveWebGLCapability,
  forceSoftwareWebGLCapability,
  monitorPageIssues,
  resourceNames,
} from "./helpers/browser";
import {
  DESKTOP_BROWSER_PROJECTS,
  projectIs,
} from "./helpers/projects";

const chapters = [
  { key: "hero", label: "DISCOVERY", number: "01", subject: "bottle" },
  { key: "discovery", label: "VINEYARD", number: "02", subject: "grapes" },
  { key: "match", label: "TABLE", number: "03", subject: "none" },
  { key: "taste", label: "TASTE SIGNALS", number: "04", subject: "none" },
  { key: "portal", label: "PRIVATE CELLAR", number: "05", subject: "bottle" },
  { key: "cellar", label: "COLLECTION", number: "06", subject: "none" },
  { key: "memory", label: "MEMORY", number: "07", subject: "none" },
  { key: "atlas", label: "TASTE ATLAS", number: "08", subject: "bottle" },
  { key: "finale", label: "JOURNEY", number: "09", subject: "none" },
] as const;

type ChapterKey = (typeof chapters)[number]["key"];

interface TransitionSample {
  activeMedia: string;
  activeSections: string[];
  activeSubject: string;
  bottleOpacity: number;
  boundary: string;
  controls: number;
  gate: number;
  grapeOpacity: number;
  layers: Array<{
    chapter: string;
    frameReadiness: string;
    opacity: number;
    visibility: string;
    zIndex: string;
  }>;
  owner: string;
  phase: string;
}

async function settleFrames(page: Page, count = 3): Promise<void> {
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
      const activation =
        window.scrollY + bounds.top - viewportHeight / 2;
      return Math.min(1, Math.max(0, (activation - rootTop) / distance));
    });
  });
}

async function scrollToOverallProgress(
  page: Page,
  overallProgress: number,
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
  await settleFrames(page, 4);
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
    chapterIndex === chapters.length - 1
      ? lower + (1 - lower) * 0.4
      : lower + (upper - lower) * 0.4;
  await scrollToOverallProgress(page, progress);
  await expect
    .poll(() => page.locator(".gv-story").getAttribute("data-story-owner"))
    .toBe(chapters[chapterIndex]?.key);
  await expect
    .poll(() =>
      page.locator(".gv-story").getAttribute("data-story-transition-phase"),
    )
    .toBe("stable");
}

async function sampleTransition(page: Page): Promise<TransitionSample> {
  return page.locator(".gv-story").evaluate((root) => {
    const stage = root.querySelector<HTMLElement>("[data-story-stage]");
    const styles = stage ? getComputedStyle(stage) : null;
    return {
      activeMedia:
        root.querySelector<HTMLElement>("[data-story-media-stack]")?.dataset
          .activeMedia ?? "none",
      activeSections: [
        ...root.querySelectorAll<HTMLElement>(
          "[data-story-chapter].is-active",
        ),
      ].map((section) => section.dataset.storyChapter ?? ""),
      activeSubject:
        root.querySelector<HTMLElement>("[data-story-media-stack]")?.dataset
          .activeSubject ?? "none",
      bottleOpacity: Number.parseFloat(
        styles?.getPropertyValue("--story-bottle-opacity") || "0",
      ),
      boundary: (root as HTMLElement).dataset.storyTransitionBoundary ?? "",
      controls: root.querySelectorAll("[data-story-subject-control]").length,
      gate: Number.parseFloat(
        styles?.getPropertyValue("--story-veil-opacity") || "0",
      ),
      grapeOpacity: Number.parseFloat(
        styles?.getPropertyValue("--story-grape-opacity") || "0",
      ),
      layers: [
        ...root.querySelectorAll<HTMLElement>("[data-media-chapter]"),
      ].map((layer) => ({
        chapter: layer.dataset.mediaChapter ?? "",
        frameReadiness: layer.dataset.frameReadiness ?? "",
        opacity: Number.parseFloat(layer.dataset.mediaOpacity || "0"),
        visibility: layer.style.visibility,
        zIndex: layer.style.zIndex,
      })),
      owner: (root as HTMLElement).dataset.storyOwner ?? "",
      phase: (root as HTMLElement).dataset.storyTransitionPhase ?? "",
    };
  });
}

function expectOnlyLayerVisible(
  sample: TransitionSample,
  visibleChapter: ChapterKey | null,
) {
  for (const layer of sample.layers) {
    if (layer.chapter === visibleChapter) {
      expect(layer.opacity).toBeGreaterThan(0);
      expect(layer.visibility).toBe("visible");
      expect(layer.zIndex).toBe("2");
    } else {
      expect(layer.opacity).toBe(0);
      expect(layer.visibility).toBe("hidden");
      expect(layer.zIndex).toBe("0");
    }
  }
}

test("@smoke true-black hold resolves to the exact navigation color", async ({
  page,
}, testInfo) => {
  test.skip(
    !projectIs(testInfo, DESKTOP_BROWSER_PROJECTS),
    "The true-black computed-style contract runs in desktop engines.",
  );
  await forceSoftwareWebGLCapability(page);
  await page.setViewportSize({ height: 768, width: 1024 });
  await page.goto("/");
  await moveToTransitionPoint(page, 0, 0.5);
  await expect
    .poll(() => sampleTransition(page))
    .toMatchObject({ activeMedia: "black", gate: 1, phase: "black-hold" });

  const colors = await page.evaluate(() => {
    const color = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return getComputedStyle(element).backgroundColor;
    };
    return {
      layer: color(".gv-story-media-layer"),
      mediaStack: color(".gv-story-media-stack"),
      nav: color(".gv-nav"),
      stage: color(".gv-story-stage"),
      veil: color(".gv-story-transition-veil"),
      video: color(".gv-story-scrub-video"),
    };
  });
  expect(new Set(Object.values(colors))).toEqual(new Set(["rgb(0, 0, 0)"]));
});

test("chapter copy fades in place without sliding vertically", async ({
  page,
}, testInfo) => {
  test.skip(
    !["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
    "The animated copy contract runs in desktop and mobile Chromium.",
  );
  await forceSoftwareWebGLCapability(page);
  await page.goto("/");

  const sampleDiscoveryCopy = () =>
    page.locator("[data-story-chapter='discovery']").evaluate((section) => {
      const panel = section.querySelector<HTMLElement>(
        ".gv-story-chapter__panel",
      );
      const content = section.querySelector<HTMLElement>(
        ".gv-story-chapter__content",
      );
      if (!panel || !content) throw new Error("Missing discovery copy panel.");
      const style = getComputedStyle(panel);
      return {
        contentTop: content.getBoundingClientRect().top,
        opacity: Number(style.opacity),
        panelTop: panel.getBoundingClientRect().top,
        position: style.position,
        transform: style.transform,
      };
    });

  await moveToTransitionPoint(page, 0, 0.58);
  await expect
    .poll(() => page.locator(".gv-story").getAttribute("data-story-owner"))
    .toBe("discovery");
  const hold = await sampleDiscoveryCopy();

  await moveToTransitionPoint(page, 0, 0.8);
  await expect
    .poll(async () => (await sampleDiscoveryCopy()).opacity)
    .toBeGreaterThan(0);
  const reveal = await sampleDiscoveryCopy();

  await moveToStableChapter(page, 1);
  const stable = await sampleDiscoveryCopy();

  expect(hold.position).toBe("fixed");
  expect(hold.transform).toBe("none");
  expect(reveal.opacity).toBeGreaterThan(0);
  expect(reveal.opacity).toBeLessThan(1);
  expect(stable.opacity).toBeCloseTo(1, 2);
  expect(reveal.panelTop).toBeCloseTo(hold.panelTop, 2);
  expect(stable.panelTop).toBeCloseTo(hold.panelTop, 2);
  expect(reveal.contentTop).toBeCloseTo(hold.contentTop, 2);
  expect(stable.contentTop).toBeCloseTo(hold.contentTop, 2);
});

test("all eight boundaries remain symmetric, black-gated, decoded, and mutually exclusive", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The exhaustive transition instrumentation runs once in Chromium.",
  );
  test.setTimeout(180_000);
  await forceSoftwareWebGLCapability(page);
  await page.addInitScript(() => {
    const longTasks: number[] = [];
    Object.defineProperty(window, "__prompt10a2LongTasks", {
      configurable: true,
      value: longTasks,
    });
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration);
      }).observe({ type: "longtask" });
    } catch {
      // Unsupported browsers report no synthetic metric.
    }
  });
  const issues = monitorPageIssues(page);
  await page.setViewportSize({ height: 768, width: 1024 });
  await page.goto("/");
  await expect
    .poll(() => page.locator(".gv-story").getAttribute("data-story-owner"))
    .toBe("hero");
  await page.evaluate(() => {
    const probe = window as Window & { __prompt10a2LongTasks?: number[] };
    if (probe.__prompt10a2LongTasks) probe.__prompt10a2LongTasks.length = 0;
  });

  for (let boundary = 0; boundary < 8; boundary += 1) {
    const lower = chapters[boundary];
    const upper = chapters[boundary + 1];
    if (!lower || !upper) throw new Error(`Missing boundary ${boundary}`);

    await moveToTransitionPoint(page, boundary, 0.2);
    await expect
      .poll(() => sampleTransition(page))
      .toMatchObject({
        activeMedia: lower.key,
        activeSections: [lower.key],
        activeSubject: lower.subject,
        boundary: String(boundary + 1),
        controls: 0,
        owner: lower.key,
        phase: "outgoing-fade",
      });
    const fade = await sampleTransition(page);
    expect(fade.gate).toBeCloseTo(0.5, 1);
    if (lower.subject === "none") {
      expect(fade.bottleOpacity).toBe(0);
      expect(fade.grapeOpacity).toBe(0);
    } else {
      expect(
        lower.subject === "bottle" ? fade.bottleOpacity : fade.grapeOpacity,
      ).toBeCloseTo(0.5, 1);
    }
    expectOnlyLayerVisible(fade, lower.key);

    await moveToTransitionPoint(page, boundary, 0.58);
    await expect
      .poll(() => sampleTransition(page))
      .toMatchObject({
        activeMedia: "black",
        activeSections: [upper.key],
        activeSubject: "none",
        boundary: String(boundary + 1),
        controls: 0,
        gate: 1,
        owner: upper.key,
        phase: "black-hold",
      });
    expectOnlyLayerVisible(await sampleTransition(page), null);

    for (const noise of [0.54, 0.48, 0.55, 0.47]) {
      await moveToTransitionPoint(page, boundary, noise);
      await expect
        .poll(() => sampleTransition(page))
        .toMatchObject({
          activeMedia: "black",
          activeSubject: "none",
          bottleOpacity: 0,
          controls: 0,
          gate: 1,
          grapeOpacity: 0,
          owner: upper.key,
          phase: "black-hold",
        });
    }

    await moveToTransitionPoint(page, boundary, 0.8);
    await expect
      .poll(async () => {
        const sample = await sampleTransition(page);
        const incoming = sample.layers.find(
          ({ chapter }) => chapter === upper.key,
        );
        return {
          activeMedia: sample.activeMedia,
          frameReadiness: incoming?.frameReadiness,
          owner: sample.owner,
          phase: sample.phase,
        };
      })
      .toEqual({
        activeMedia: upper.key,
        frameReadiness: "decoded-exact",
        owner: upper.key,
        phase: "incoming-reveal",
      });
    const reveal = await sampleTransition(page);
    expect(reveal.gate).toBeLessThan(1);
    if (upper.subject === "none") {
      expect(reveal.bottleOpacity).toBe(0);
      expect(reveal.grapeOpacity).toBe(0);
    } else {
      expect(
        upper.subject === "bottle"
          ? reveal.bottleOpacity
          : reveal.grapeOpacity,
      ).toBeGreaterThan(0);
    }
    expectOnlyLayerVisible(reveal, upper.key);
    expect(reveal.activeSubject).toBe(upper.subject);
    expect(
      reveal.activeSubject === "bottle" && fade.activeSubject === "grapes",
    ).toBe(false);
  }

  for (let boundary = 7; boundary >= 0; boundary -= 1) {
    const lower = chapters[boundary];
    const upper = chapters[boundary + 1];
    if (!lower || !upper) throw new Error(`Missing boundary ${boundary}`);
    await moveToTransitionPoint(page, boundary, 0.8);
    await moveToTransitionPoint(page, boundary, 0.44);
    await expect
      .poll(() => sampleTransition(page))
      .toMatchObject({
        activeMedia: "black",
        activeSections: [lower.key],
        activeSubject: "none",
        controls: 0,
        gate: 1,
        owner: lower.key,
        phase: "black-hold",
      });
    expectOnlyLayerVisible(await sampleTransition(page), null);

    for (const noise of [0.5, 0.55, 0.49, 0.54]) {
      await moveToTransitionPoint(page, boundary, noise);
      await expect
        .poll(() => sampleTransition(page))
        .toMatchObject({
          activeMedia: "black",
          activeSubject: "none",
          bottleOpacity: 0,
          controls: 0,
          gate: 1,
          grapeOpacity: 0,
          owner: lower.key,
          phase: "black-hold",
        });
    }

    await moveToTransitionPoint(page, boundary, 0.2);
    await expect
      .poll(async () => {
        const sample = await sampleTransition(page);
        const restored = sample.layers.find(
          ({ chapter }) => chapter === lower.key,
        );
        return {
          activeMedia: sample.activeMedia,
          frameReadiness: restored?.frameReadiness,
          owner: sample.owner,
        };
      })
      .toEqual({
        activeMedia: lower.key,
        frameReadiness: "decoded-exact",
        owner: lower.key,
      });
    expectOnlyLayerVisible(await sampleTransition(page), lower.key);
  }

  for (const progress of [0.086, 0.088, 0.087, 0.089, 0.0865]) {
    await scrollToOverallProgress(page, progress);
  }
  const preparedCount = await page
    .locator('[data-media-prepared="true"]')
    .count();
  expect(preparedCount).toBeLessThanOrEqual(3);
  expect(await page.locator("canvas").count()).toBeLessThanOrEqual(1);

  const longTasks = await page.evaluate(
    () =>
      (window as Window & { __prompt10a2LongTasks?: number[] })
        .__prompt10a2LongTasks ?? [],
  );
  expect(longTasks.filter((duration) => duration > 100)).toEqual([]);
  issues.assertClean();
});

test("live bottle and grapes support projected drag, full yaw, keyboard clamps, and reset", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The live interaction path runs once in desktop Chromium.",
  );
  test.setTimeout(120_000);
  await forceLiveWebGLCapability(page);
  const issues = monitorPageIssues(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await expect(page.locator("[data-webgl-status='ready']")).toBeVisible({
    timeout: 10_000,
  });
  const bottle = page.getByRole("button", {
    name: "Rotate the GRAPEVYNE wine bottle",
  });
  await expect(bottle).toBeVisible();
  await expect(bottle).toHaveAttribute("data-projected-hit-area", "true");
  await bottle.focus();
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press("ArrowRight");
  }
  expect(Number(await bottle.getAttribute("data-target-yaw"))).toBeCloseTo(
    Math.PI * 2,
    4,
  );
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press("ArrowUp");
  }
  expect(Number(await bottle.getAttribute("data-target-pitch"))).toBeCloseTo(
    (25 * Math.PI) / 180,
    4,
  );
  await page.keyboard.press("r");
  await expect(bottle).toHaveAttribute("data-target-yaw", "0");
  await expect(bottle).toHaveAttribute("data-target-pitch", "0");

  const bottleBounds = await bottle.boundingBox();
  expect(bottleBounds).not.toBeNull();
  if (bottleBounds) {
    await page.mouse.move(
      bottleBounds.x + bottleBounds.width / 2,
      bottleBounds.y + bottleBounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bottleBounds.x + bottleBounds.width / 2 - 560,
      bottleBounds.y + bottleBounds.height / 2 - 40,
      { steps: 12 },
    );
    await page.mouse.up();
  }
  expect(Math.abs(Number(await bottle.getAttribute("data-target-yaw")))).toBeGreaterThan(
    Math.PI * 2,
  );
  await bottle.focus();
  await page.keyboard.press("Home");
  await expect(bottle).toHaveAttribute("data-target-yaw", "0");

  await moveToStableChapter(page, 1);
  const grapes = page.getByRole("button", {
    name: "Rotate the GRAPEVYNE grape cluster",
  });
  await expect(grapes).toBeVisible();
  await expect(grapes).toHaveAttribute("data-projected-hit-area", "true");
  const search = page.getByRole("searchbox", { name: "Describe the moment" });
  const [grapeBounds, searchBounds] = await Promise.all([
    grapes.boundingBox(),
    search.boundingBox(),
  ]);
  expect(grapeBounds).not.toBeNull();
  expect(searchBounds).not.toBeNull();
  if (grapeBounds && searchBounds) {
    const overlap = !(
      grapeBounds.x + grapeBounds.width <= searchBounds.x ||
      grapeBounds.x >= searchBounds.x + searchBounds.width ||
      grapeBounds.y + grapeBounds.height <= searchBounds.y ||
      grapeBounds.y >= searchBounds.y + searchBounds.height
    );
    expect(overlap).toBe(false);
  }
  await grapes.focus();
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press("ArrowLeft");
  }
  expect(Number(await grapes.getAttribute("data-target-yaw"))).toBeCloseTo(
    -Math.PI * 2,
    4,
  );
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press("ArrowDown");
  }
  expect(Number(await grapes.getAttribute("data-target-pitch"))).toBeCloseTo(
    (-30 * Math.PI) / 180,
    4,
  );
  await page.keyboard.press("R");
  await expect(grapes).toHaveAttribute("data-target-yaw", "0");
  if (grapeBounds) {
    await page.mouse.move(
      grapeBounds.x + grapeBounds.width / 2,
      grapeBounds.y + grapeBounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      grapeBounds.x + grapeBounds.width / 2 + 180,
      grapeBounds.y + grapeBounds.height / 2 + 24,
      { steps: 8 },
    );
    await page.mouse.up();
  }
  expect(Number(await grapes.getAttribute("data-target-yaw"))).toBeGreaterThan(
    0,
  );
  await grapes.focus();
  await page.keyboard.press("Home");
  await expect(grapes).toHaveAttribute("data-target-yaw", "0");

  for (const index of [2, 3, 5, 6, 8]) {
    await moveToStableChapter(page, index);
    await expect(page.locator("[data-story-subject-control]")).toHaveCount(0);
  }
  for (const index of [4, 7]) {
    await moveToStableChapter(page, index);
    await expect(
      page.getByRole("button", {
        name: "Rotate the GRAPEVYNE wine bottle",
      }),
    ).toBeVisible();
  }

  expect(await page.locator(".gv-webgl-experience canvas").count()).toBe(1);
  const resources = await resourceNames(page);
  expect(
    resources.filter((name) =>
      /grapevyne-meshy-bottle\.desktop\.glb(?:$|\?)/.test(name),
    ).length,
  ).toBeLessThanOrEqual(1);
  expect(
    resources.filter((name) =>
      /grapevyne-meshy-grapes\.desktop\.glb(?:$|\?)/.test(name),
    ).length,
  ).toBeLessThanOrEqual(1);

  await page.goto("/discover");
  await expect(page.locator("[data-story-subject-control]")).toHaveCount(0);
  await expect(page.locator("[data-story-media-stack]")).toHaveCount(0);
  await expect(page.locator(".gv-webgl-experience canvas")).toHaveCount(0);
  await page.goBack();
  await expect(page.locator(".gv-webgl-experience canvas")).toHaveCount(1, {
    timeout: 10_000,
  });
  issues.assertClean();
});

test("projected desktop hit targets remain bounded at every required desktop and tablet viewport", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The projected-region matrix runs once in desktop Chromium.",
  );
  test.setTimeout(120_000);
  await forceLiveWebGLCapability(page);

  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 1080, width: 1920 },
    { height: 1024, width: 768 },
    { height: 768, width: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("[data-webgl-status='ready']")).toBeVisible({
      timeout: 10_000,
    });
    const control = page.getByRole("button", {
      name: "Rotate the GRAPEVYNE wine bottle",
    });
    await expect(control).toHaveAttribute("data-projected-hit-area", "true");
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) continue;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(bounds.width).toBeLessThan(viewport.width * 0.55);
    expect(bounds.height).toBeLessThan(viewport.height * 0.82);

    const before = Number(await control.getAttribute("data-target-yaw"));
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width / 2 + 48,
      bounds.y + bounds.height / 2,
      { steps: 4 },
    );
    await page.mouse.up();
    expect(Number(await control.getAttribute("data-target-yaw"))).toBeGreaterThan(
      before,
    );
  }
});

test("mobile press-hold rotation preserves pre-activation scroll and restores it on release", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "The touch conflict contract runs once in touch Chromium.",
  );
  test.setTimeout(120_000);
  await forceLiveWebGLCapability(page);

  for (const viewport of [
    { height: 800, width: 360 },
    { height: 844, width: 390 },
    { height: 932, width: 430 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("[data-webgl-status='ready']")).toBeVisible({
      timeout: 10_000,
    });
    const control = page.getByRole("button", {
      name: "Rotate the GRAPEVYNE wine bottle",
    });
    await expect(control).toHaveAttribute("data-projected-hit-area", "true");
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) continue;
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;

    await control.dispatchEvent("pointerdown", {
      button: 0,
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId: 31,
      pointerType: "touch",
    });
    await control.dispatchEvent("pointermove", {
      clientX: x,
      clientY: y + 14,
      isPrimary: true,
      pointerId: 31,
      pointerType: "touch",
    });
    await page.waitForTimeout(180);
    await expect(control).toHaveAttribute("data-dragging", "false");
    await expect(control).toHaveCSS("touch-action", "pan-y");

    await control.dispatchEvent("pointerdown", {
      button: 0,
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId: 32,
      pointerType: "touch",
    });
    await page.waitForTimeout(180);
    await expect(control).toHaveAttribute("data-dragging", "true");
    const activeTouchPrevented = await page.evaluate(() => {
      const event = new TouchEvent("touchmove", {
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(activeTouchPrevented).toBe(true);
    await control.dispatchEvent("pointermove", {
      clientX: x + 120,
      clientY: y - 20,
      isPrimary: true,
      pointerId: 32,
      pointerType: "touch",
    });
    expect(Number(await control.getAttribute("data-target-yaw"))).toBeGreaterThan(0);
    await control.dispatchEvent("pointerup", {
      clientX: x + 120,
      clientY: y - 20,
      isPrimary: true,
      pointerId: 32,
      pointerType: "touch",
    });
    await expect(control).toHaveAttribute("data-dragging", "false");
    await expect(control).toHaveCSS("touch-action", "pan-y");
    const releasedTouchPrevented = await page.evaluate(() => {
      const event = new TouchEvent("touchmove", {
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(releasedTouchPrevented).toBe(false);

    const client = await page.context().newCDPSession(page);
    const scrollBeforeTouch = await page.evaluate(() => window.scrollY);
    await client.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x, y }],
      type: "touchStart",
    });
    await client.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x, y: y - 72 }],
      type: "touchMove",
    });
    await client.send("Input.dispatchTouchEvent", {
      touchPoints: [],
      type: "touchEnd",
    });
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(scrollBeforeTouch);
    await client.detach();
  }

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  await expect(page.locator("[data-webgl-status='ready']")).toBeVisible({
    timeout: 10_000,
  });
  await moveToStableChapter(page, 1);
  const grapes = page.getByRole("button", {
    name: "Rotate the GRAPEVYNE grape cluster",
  });
  await expect(grapes).toHaveAttribute("data-projected-hit-area", "true");
  const grapeBounds = await grapes.boundingBox();
  expect(grapeBounds).not.toBeNull();
  if (grapeBounds) {
    const x = grapeBounds.x + grapeBounds.width / 2;
    const y = grapeBounds.y + grapeBounds.height / 2;
    await grapes.dispatchEvent("pointerdown", {
      button: 0,
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId: 47,
      pointerType: "touch",
    });
    await page.waitForTimeout(180);
    await grapes.dispatchEvent("pointermove", {
      clientX: x - 96,
      clientY: y + 18,
      isPrimary: true,
      pointerId: 47,
      pointerType: "touch",
    });
    await grapes.dispatchEvent("pointerup", {
      clientX: x - 96,
      clientY: y + 18,
      isPrimary: true,
      pointerId: 47,
      pointerType: "touch",
    });
  }
  expect(Number(await grapes.getAttribute("data-target-yaw"))).toBeLessThan(0);
  await expect(
    page.getByRole("searchbox", { name: "Describe the moment" }),
  ).toBeVisible();
});

test("failed story decode holds black then reveals only the approved poster fallback", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Forced decode failure runs once in Chromium.",
  );
  await forceSoftwareWebGLCapability(page);
  await page.route(/\.(?:mp4|webm)(?:\?.*)?$/, (route) =>
    route.abort("failed"),
  );
  await page.setViewportSize({ height: 768, width: 1024 });
  await page.goto("/");
  await expect
    .poll(async () => {
      const hero = await page
        .locator('[data-media-chapter="hero"]')
        .getAttribute("data-frame-readiness");
      const sample = await sampleTransition(page);
      return { activeMedia: sample.activeMedia, gate: sample.gate, hero };
    })
    .toEqual({
      activeMedia: "hero",
      gate: 0,
      hero: "approved-poster-fallback",
    });
  await expect(page.locator('[data-media-chapter="hero"] video')).toHaveCount(0);
  await expect(page.locator('[data-media-chapter="hero"] img')).toBeVisible();
  await expect(page.locator("[data-story-subject-control]")).toHaveCount(0);
});

test("direct hashes and browser history keep ownership behind the black gate", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The gated history probe runs once in Chromium.",
  );
  await forceSoftwareWebGLCapability(page);
  await page.setViewportSize({ height: 768, width: 1024 });
  await page.goto("/");
  await expect
    .poll(() => page.locator(".gv-story").getAttribute("data-story-owner"))
    .toBe("hero");

  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".gv-story");
    if (!root) return;
    const samples: Array<{ gate: string; owner: string }> = [
      {
        gate:
          root.dataset.blackGateOpacity ||
          root.style.getPropertyValue("--story-veil-opacity") ||
          "",
        owner: root.dataset.storyOwner ?? "",
      },
    ];
    Object.defineProperty(window, "__prompt10a2HistorySamples", {
      configurable: true,
      value: samples,
    });
    new MutationObserver(() => {
      samples.push({
        gate:
          root.dataset.blackGateOpacity ||
          root.style.getPropertyValue("--story-veil-opacity") ||
          "",
        owner: root.dataset.storyOwner ?? "",
      });
    }).observe(root, {
      attributeFilter: [
        "data-black-gate-opacity",
        "data-story-owner",
        "style",
      ],
      attributes: true,
    });
    window.location.hash = "chapter-08-atlas";
  });
  await expect
    .poll(() => page.locator(".gv-story").getAttribute("data-story-owner"))
    .toBe("atlas");
  await expect
    .poll(() =>
      page.locator(".gv-story").getAttribute("data-story-transition-phase"),
    )
    .toBe("stable");
  await page.goBack();
  await expect
    .poll(() => page.locator(".gv-story").getAttribute("data-story-owner"))
    .toBe("hero");
  await page.goForward();
  await expect
    .poll(() => page.locator(".gv-story").getAttribute("data-story-owner"))
    .toBe("atlas");

  const samples = await page.evaluate(
    () =>
      (
        window as Window & {
          __prompt10a2HistorySamples?: Array<{
            gate: string;
            owner: string;
          }>;
        }
      ).__prompt10a2HistorySamples ?? [],
  );
  const ownerChanges = samples.filter(
    (sample, index) =>
      index > 0 && sample.owner !== samples[index - 1]?.owner,
  );
  expect(ownerChanges.length).toBeGreaterThanOrEqual(2);
  expect(
    ownerChanges.every((sample) => Number.parseFloat(sample.gate) === 1),
  ).toBe(true);
  expect(new Set(ownerChanges.map(({ owner }) => owner))).toEqual(
    new Set(["atlas", "hero"]),
  );
});
