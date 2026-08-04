import { expect, test, type Page } from "@playwright/test";

import { disposableAccount } from "./helpers/accounts";
import {
  expectNoHorizontalOverflow,
  forceSoftwareWebGLCapability,
  monitorPageIssues,
  resourceNames,
} from "./helpers/browser";
import { DESKTOP_BROWSER_PROJECTS, projectIs } from "./helpers/projects";
import { signupThroughPreview } from "./helpers/seed";

const chapters = [
  {
    id: "chapter-01-hero",
    key: "hero",
    label: "DISCOVERY",
    media: "hero-bottle-macro",
    number: "01",
    productionDirectory: "scrub",
    subject: "bottle",
    title: "FIND THE BOTTLE KEEP THE MEMORY",
  },
  {
    id: "chapter-02-discovery",
    key: "discovery",
    label: "VINEYARD",
    media: "vineyard-flight",
    number: "02",
    productionDirectory: null,
    subject: "grapes",
    title: "DESCRIBE THE MOMENT",
  },
  {
    id: "chapter-03-match",
    key: "match",
    label: "TABLE",
    media: "date-night-table-pan",
    number: "03",
    productionDirectory: null,
    subject: "none",
    title: "WHY IT FITS",
  },
  {
    id: "chapter-04-taste",
    key: "taste",
    label: "TASTE SIGNALS",
    media: "taste-liquid-transition",
    number: "04",
    productionDirectory: "scrub",
    subject: "none",
    title: "TASTE TAKES SHAPE",
  },
  {
    id: "chapter-05-portal",
    key: "portal",
    label: "PRIVATE CELLAR",
    media: "cellar-corridor-push",
    number: "05",
    productionDirectory: "scrub",
    subject: "bottle",
    title: "OPEN THE CELLAR",
  },
  {
    id: "chapter-06-cellar",
    key: "cellar",
    label: "COLLECTION",
    media: "barrel-house-pan",
    number: "06",
    productionDirectory: null,
    subject: "none",
    title: "BUILD THE COLLECTION",
  },
  {
    id: "chapter-07-memory",
    key: "memory",
    label: "MEMORY",
    media: "memory-table-ambience",
    number: "07",
    productionDirectory: "scrub",
    subject: "none",
    title: "REMEMBER THE POUR",
  },
  {
    id: "chapter-08-atlas",
    key: "atlas",
    label: "TASTE ATLAS",
    media: "taste-atlas-finale",
    number: "08",
    productionDirectory: "scrub",
    subject: "bottle",
    title: "FOLLOW YOUR TASTE",
  },
  {
    id: "chapter-09-finale",
    key: "finale",
    label: "JOURNEY",
    media: "ocean-wine-voyage",
    number: "09",
    productionDirectory: null,
    subject: "none",
    title: "KEEP THE STORY",
  },
] as const;

type ChapterKey = (typeof chapters)[number]["key"];

interface StoryNetworkMonitor {
  assertClean: () => void;
}

function monitorStoryNetwork(page: Page): StoryNetworkMonitor {
  const errors: string[] = [];

  page.on("response", (response) => {
    const url = new URL(response.url());
    const isStoryAsset = url.pathname.startsWith("/assets/");
    const isServerFailure =
      url.pathname.startsWith("/api/") && response.status() >= 500;

    if ((isStoryAsset && response.status() >= 400) || isServerFailure) {
      errors.push(`${response.status()} ${url.pathname}`);
    }
  });

  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    const failure = request.failure()?.errorText ?? "unknown failure";

    // Releasing distant media and rejecting one codec before trying the next
    // declared source are expected. Surface genuine same-origin failures.
    if (
      url.pathname.startsWith("/assets/") &&
      !/ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_PARSED_DATA_CACHED|cancelled/i.test(
        failure,
      )
    ) {
      errors.push(`${failure} ${url.pathname}`);
    }
  });

  return {
    assertClean: () =>
      expect(errors, "story assets and same-origin APIs must load cleanly").toEqual([]),
  };
}

function expectedPreparedKeys(index: number): ChapterKey[] {
  return chapters
    .slice(Math.max(0, index - 1), Math.min(chapters.length, index + 2))
    .map(({ key }) => key);
}

async function moveToChapterProgress(
  page: Page,
  key: ChapterKey,
  progress: number,
): Promise<void> {
  await page.locator(`[data-story-chapter="${key}"]`).evaluate(
    (section, requestedProgress) => {
      const bounds = section.getBoundingClientRect();
      const documentTop = window.scrollY + bounds.top;
      const target =
        documentTop + bounds.height * requestedProgress - window.innerHeight / 2;
      window.scrollTo({ behavior: "instant", top: Math.max(0, target) });
    },
    progress,
  );

  // Native scroll observation and the story's scheduled metric update both
  // settle on animation frames. Let them agree before asserting React state.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      }),
  );

  const chapter = chapters.find((candidate) => candidate.key === key);
  if (!chapter) throw new Error(`Unknown story chapter: ${key}`);

  await expect(
    page.getByRole("progressbar", {
      name: `${chapter.number} of 09 — ${chapter.label}`,
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".gv-story").evaluate((root) =>
        Number.parseFloat(
          root.style.getPropertyValue("--chapter-progress") || "0",
        ),
      ),
    )
    .toBeCloseTo(progress, 1);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      }),
  );
}

async function preparedMediaKeys(page: Page): Promise<string[]> {
  return page
    .locator('[data-media-prepared="true"]')
    .evaluateAll((layers) =>
      layers.map((layer) => layer.getAttribute("data-media-chapter") ?? ""),
    );
}

async function subjectOpacities(page: Page) {
  return page.locator("[data-story-stage]").evaluate((stage) => {
    const styles = getComputedStyle(stage);
    return {
      bottle: Number.parseFloat(
        styles.getPropertyValue("--story-bottle-opacity") || "0",
      ),
      grapes: Number.parseFloat(
        styles.getPropertyValue("--story-grape-opacity") || "0",
      ),
      veil: Number.parseFloat(
        styles.getPropertyValue("--story-veil-opacity") || "0",
      ),
    };
  });
}

async function expectStaticSubjectMap(page: Page): Promise<void> {
  for (const chapter of chapters) {
    const section = page.locator(`#${chapter.id}`);
    const bottles = section.locator(".gv-story-static-subject--bottle");
    const grapes = section.locator(".gv-story-static-subject--grapes");

    await expect(bottles).toHaveCount(chapter.subject === "bottle" ? 1 : 0);
    await expect(grapes).toHaveCount(chapter.subject === "grapes" ? 1 : 0);
  }

  const grapeFallback = page.locator(
    "#chapter-02-discovery img.gv-story-static-subject--grapes",
  );
  await grapeFallback.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      grapeFallback.evaluate(
        (image) => (image as HTMLImageElement).naturalWidth,
      ),
    )
    .toBeGreaterThan(0);
}

test("@smoke full-motion Home uses one fixed story stage and bounded media preparation", async ({
  page,
}, testInfo) => {
  test.skip(
    !projectIs(testInfo, DESKTOP_BROWSER_PROJECTS),
    "The fixed-stage smoke contract targets desktop browser engines.",
  );
  test.setTimeout(90_000);

  await forceSoftwareWebGLCapability(page);
  const runtimeMonitor = monitorPageIssues(page);
  const networkMonitor = monitorStoryNetwork(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");

  const root = page.locator(".gv-story");
  const stage = page.locator("[data-story-stage]");
  const track = page.locator("[data-story-track]");
  await expect(root).toHaveAttribute("data-story-mode", "scrub");
  await expect(stage).toHaveCount(1);
  await expect(track).toHaveCount(1);
  await expect(page.locator("section[data-story-chapter]")).toHaveCount(9);
  await expect(page.locator("[data-story-media-stack]")).toHaveCount(1);

  const order = await page
    .locator("section[data-story-chapter]")
    .evaluateAll((sections) =>
      sections.map((section) => section.getAttribute("data-story-chapter")),
    );
  expect(order).toEqual(chapters.map(({ key }) => key));

  for (const chapter of chapters) {
    await expect(
      page.locator(`#${chapter.id}`).getByRole("heading", {
        name: chapter.title,
      }),
    ).toBeAttached();
  }

  const geometry = await stage.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    return {
      height: bounds.height,
      overflowY: styles.overflowY,
      pointerEvents: styles.pointerEvents,
      position: styles.position,
      top: bounds.top,
      width: bounds.width,
    };
  });
  expect(geometry.position).toBe("sticky");
  expect(geometry.pointerEvents).toBe("none");
  expect(geometry.overflowY).not.toMatch(/auto|scroll/);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.height).toBeGreaterThan(760);
  expect(geometry.height).toBeLessThanOrEqual(900);
  expect(geometry.width).toBeCloseTo(1440, 0);
  await expectNoHorizontalOverflow(page);

  await expect(page.locator("video[data-scrub-video]")).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator("video[data-scrub-video]")
        .evaluateAll((videos) =>
          videos.every(
            (video) =>
              (video as HTMLVideoElement).readyState >= 1 &&
              Boolean((video as HTMLVideoElement).currentSrc),
          ),
        ),
    )
    .toBe(true);
  expect(await preparedMediaKeys(page)).toEqual(["hero", "discovery"]);
  const videoContract = await page
    .locator("video[data-scrub-video]")
    .evaluateAll((videos) =>
      videos.map((video) => {
        const element = video as HTMLVideoElement;
        return {
          autoplay: element.autoplay,
          controls: element.controls,
          loop: element.loop,
          muted: element.muted,
          paused: element.paused,
          playsInline: element.hasAttribute("playsinline"),
          sources: [...element.querySelectorAll("source")].map((source) =>
            source.getAttribute("src"),
          ),
        };
      }),
    );
  expect(videoContract).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        autoplay: false,
        controls: false,
        loop: false,
        muted: true,
        paused: true,
        playsInline: true,
      }),
    ]),
  );
  expect(
    videoContract.flatMap(({ sources }) => sources).every((source) =>
      source?.includes(".desktop."),
    ),
  ).toBe(true);

  const chapterNavigation = page.getByRole("navigation", {
    name: "From Vine to Memory chapters",
  });
  const menuButton = chapterNavigation.locator(
    ".gv-chapter-progress__trigger",
  );
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(chapterNavigation.getByRole("link")).toHaveCount(9);
  await expect(
    chapterNavigation.getByRole("link", { name: "DISCOVERY" }),
  ).toHaveAttribute("aria-current", "step");
  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toBeFocused();

  runtimeMonitor.assertClean();
  networkMonitor.assertClean();
});

test("scroll progress deterministically scrubs forward and backward through the exact media and subject map", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The deterministic timeline probe runs once in Chromium.",
  );
  test.setTimeout(120_000);

  await forceSoftwareWebGLCapability(page);
  const runtimeMonitor = monitorPageIssues(page);
  const networkMonitor = monitorStoryNetwork(page);
  // At 1024px the accepted native-scroll path is used while desktop media is
  // retained, removing smooth-scroll timing from this deterministic probe.
  await page.setViewportSize({ height: 768, width: 1024 });
  await page.goto("/");

  const heroVideo = page.locator('video[data-scrub-video="hero"]');
  await expect(heroVideo).toHaveCount(1);
  await expect
    .poll(() =>
      heroVideo.evaluate((video) => {
        const media = video as HTMLVideoElement;
        return media.readyState >= 1 && Number.isFinite(media.duration);
      }),
    )
    .toBe(true);

  await moveToChapterProgress(page, "hero", 0.36);
  const earlyTime = await heroVideo.evaluate(
    (video) => (video as HTMLVideoElement).currentTime,
  );
  await moveToChapterProgress(page, "hero", 0.58);
  await expect
    .poll(() =>
      heroVideo.evaluate((video) => (video as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(earlyTime + 0.5);
  const forwardTime = await heroVideo.evaluate(
    (video) => (video as HTMLVideoElement).currentTime,
  );
  await page.waitForTimeout(250);
  const heldTime = await heroVideo.evaluate(
    (video) => (video as HTMLVideoElement).currentTime,
  );
  expect(Math.abs(heldTime - forwardTime)).toBeLessThan(0.05);

  await moveToChapterProgress(page, "hero", 0.32);
  await expect
    .poll(() =>
      heroVideo.evaluate((video) => (video as HTMLVideoElement).currentTime),
    )
    .toBeLessThan(forwardTime - 0.5);
  await expect(heroVideo).toHaveJSProperty("paused", true);

  for (const [index, chapter] of chapters.entries()) {
    await moveToChapterProgress(page, chapter.key, 0.45);
    expect(await preparedMediaKeys(page)).toEqual(expectedPreparedKeys(index));

    const activeVideo = page.locator(
      `video[data-scrub-video="${chapter.key}"]`,
    );
    await expect(activeVideo).toHaveCount(1);
    const directory = chapter.productionDirectory
      ? `/${chapter.productionDirectory}`
      : "";
    await expect(
      activeVideo.locator('source[type="video/mp4"]'),
    ).toHaveAttribute(
      "src",
      `/assets/video${directory}/desktop/${chapter.media}.desktop.mp4`,
    );
    await expect(
      activeVideo.locator('source[type="video/webm"]'),
    ).toHaveAttribute(
      "src",
      `/assets/video${directory}/desktop/${chapter.media}.desktop.webm`,
    );

    const opacity = await subjectOpacities(page);
    if (chapter.subject === "bottle") {
      expect(opacity.bottle).toBeGreaterThan(0.99);
      expect(opacity.grapes).toBeLessThanOrEqual(0.001);
    } else if (chapter.subject === "grapes") {
      expect(opacity.grapes).toBeGreaterThan(0.99);
      expect(opacity.bottle).toBeLessThanOrEqual(0.001);
    } else {
      expect(opacity.bottle).toBeLessThanOrEqual(0.001);
      expect(opacity.grapes).toBeLessThanOrEqual(0.001);
    }
  }

  // The center-band IntersectionObserver intentionally hands ownership to the
  // next chapter just before 1.0, so 0.99 is not a stable current-chapter E2E
  // coordinate. The pure transition boundary at 1.0 is covered by unit tests.
  for (const progress of [0.68, 0.74, 0.82, 0.86, 0.9, 0.95]) {
    await moveToChapterProgress(page, "hero", progress);
    const opacity = await subjectOpacities(page);
    expect(
      opacity.bottle > 0.001 && opacity.grapes > 0.001,
      `bottle/grapes overlap at hero progress ${progress}`,
    ).toBe(false);

    if (progress === 0.86) {
      expect(opacity.bottle).toBeLessThanOrEqual(0.001);
      expect(opacity.grapes).toBeLessThanOrEqual(0.001);
      expect(opacity.veil).toBeGreaterThan(0.7);
    }
  }

  await page.goto("/discover");
  await expect(page.locator("[data-story-stage]")).toHaveCount(0);
  await expect(page.locator("video[data-scrub-video]")).toHaveCount(0);
  runtimeMonitor.assertClean();
  networkMonitor.assertClean();
});

test("direct chapter hashes restore the chapter and remain history-safe", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The chapter history contract runs once in desktop Chromium.",
  );

  await forceSoftwareWebGLCapability(page);
  const runtimeMonitor = monitorPageIssues(page);
  const networkMonitor = monitorStoryNetwork(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/#chapter-05-portal");

  await expect(page).toHaveURL(/\/#chapter-05-portal$/);
  await expect(
    page.getByRole("progressbar", {
      name: "05 of 09 — PRIVATE CELLAR",
    }),
  ).toBeVisible();
  await expect(page.locator("#chapter-05-portal")).toBeInViewport();

  await page.evaluate(() => {
    window.location.hash = "chapter-08-atlas";
  });
  await expect(page).toHaveURL(/\/#chapter-08-atlas$/);
  await expect(
    page.getByRole("progressbar", {
      name: "08 of 09 — TASTE ATLAS",
    }),
  ).toBeVisible();
  await expect(page.locator("#chapter-08-atlas")).toBeInViewport();

  await page.goBack();
  await expect(page).toHaveURL(/\/#chapter-05-portal$/);
  await expect(
    page.getByRole("progressbar", {
      name: "05 of 09 — PRIVATE CELLAR",
    }),
  ).toBeVisible();
  await expect(page.locator("#chapter-05-portal")).toBeInViewport();

  runtimeMonitor.assertClean();
  networkMonitor.assertClean();
});

test("the single Chapter 02 search validates, trims, and preserves the encoded query", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "reduced-motion-chromium",
    "The semantic search contract runs once without cinematic timing.",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const chapter = page.locator("#chapter-02-discovery");
  await chapter.scrollIntoViewIfNeeded();
  const search = chapter.getByRole("searchbox", { name: "Describe the moment" });
  await search.fill("   ");
  await chapter.getByRole("button", { name: "SEARCH WINES" }).click();
  await expect(chapter.getByRole("alert")).toHaveText(
    "Describe a wine, meal, mood, or occasion to begin.",
  );
  await expect(page).toHaveURL(/\/$/);

  await search.fill("  Cabernet & steak  ");
  await chapter.getByRole("button", { name: "SEARCH WINES" }).click();
  await expect(page).toHaveURL(/\/discover\?query=/);
  const location = new URL(page.url());
  expect(location.searchParams.get("query")).toBe("Cabernet & steak");
});

test("reduced motion is a nine-poster semantic flow with an explicit motionless interactive viewer", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "reduced-motion-chromium",
    "This contract belongs to the dedicated reduced-motion project.",
  );

  const runtimeMonitor = monitorPageIssues(page);
  const networkMonitor = monitorStoryNetwork(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".gv-story")).toHaveAttribute(
    "data-story-mode",
    "reduced-motion",
  );
  await expect(page.locator("[data-story-stage]")).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".gv-story-static-visual picture")).toHaveCount(9);
  await expectStaticSubjectMap(page);
  const initialResources = await resourceNames(page);
  expect(
    initialResources.some((name) => /\.(?:mp4|webm|glb)(?:$|\?)/i.test(name)),
  ).toBe(false);

  const inspect = page.getByRole("button", { name: "INSPECT BOTTLE" });
  await inspect.click();
  const dialog = page.getByRole("dialog", { name: "INSPECT THE BOTTLE" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-viewer-mode="interactive"]')).toBeVisible();
  await expect(dialog.locator("canvas")).toHaveCount(1);
  await expect(dialog.locator(".gv-bottle-inspector__viewport")).toHaveClass(
    /\bis-ready\b/,
    { timeout: 20_000 },
  );
  await expect(dialog.getByRole("button", { name: "RESET VIEW" })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "CLOSE" })).toBeFocused();
  expect(
    await page
      .locator(".app-shell")
      .evaluate((shell) => (shell as HTMLElement & { inert: boolean }).inert),
  ).toBe(true);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(inspect).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

  runtimeMonitor.assertClean();
  networkMonitor.assertClean();
});

test("Save-Data uses posters and only the chapter-approved static bottle and grapes", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Save-Data is simulated once in desktop Chromium.",
  );

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
  });
  const runtimeMonitor = monitorPageIssues(page);
  const networkMonitor = monitorStoryNetwork(page);
  await page.goto("/");
  await expect(page.locator(".gv-story")).toHaveAttribute(
    "data-story-mode",
    "save-data",
  );
  await expect(page.locator("[data-story-stage]")).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expectStaticSubjectMap(page);

  await page.getByRole("button", { name: "INSPECT BOTTLE" }).click();
  const dialog = page.getByRole("dialog", { name: "INSPECT THE BOTTLE" });
  await expect(dialog.locator('[data-viewer-mode="save-data"]')).toBeVisible();
  await expect(dialog.locator("canvas")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "RESET VIEW" })).toBeDisabled();
  await page.keyboard.press("Escape");

  const resources = await resourceNames(page);
  expect(
    resources.some((name) => /\.(?:mp4|webm|glb)(?:$|\?)/i.test(name)),
  ).toBe(false);
  runtimeMonitor.assertClean();
  networkMonitor.assertClean();
});

test("mobile full motion keeps 9:16 media, compact geometry, and scroll-safe controls", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "The touch geometry contract runs once in mobile Chromium.",
  );

  await forceSoftwareWebGLCapability(page);
  const runtimeMonitor = monitorPageIssues(page);
  const networkMonitor = monitorStoryNetwork(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  await expect(page.locator(".gv-story")).toHaveAttribute(
    "data-story-mode",
    "scrub",
  );
  await expectNoHorizontalOverflow(page);

  const stageGeometry = await page.locator("[data-story-stage]").evaluate((stage) => {
    const bounds = stage.getBoundingClientRect();
    const styles = getComputedStyle(stage);
    return {
      height: bounds.height,
      overflowY: styles.overflowY,
      pointerEvents: styles.pointerEvents,
      position: styles.position,
      width: bounds.width,
    };
  });
  expect(stageGeometry.position).toBe("sticky");
  expect(stageGeometry.pointerEvents).toBe("none");
  expect(stageGeometry.overflowY).not.toMatch(/auto|scroll/);
  expect(stageGeometry.width).toBeCloseTo(390, 0);
  expect(stageGeometry.height).toBeGreaterThan(700);
  expect(stageGeometry.height).toBeLessThanOrEqual(844);

  const chapterHeights = await page
    .locator("section[data-story-chapter]")
    .evaluateAll((sections) => sections.map((section) => section.getBoundingClientRect().height));
  expect(chapterHeights.every((height) => height >= 844 && height <= 1_200)).toBe(
    true,
  );

  await moveToChapterProgress(page, "discovery", 0.45);
  const discoveryVideo = page.locator(
    'video[data-scrub-video="discovery"]',
  );
  await expect(
    discoveryVideo.locator('source[type="video/mp4"]'),
  ).toHaveAttribute(
    "src",
    "/assets/video/mobile/vineyard-flight.mobile.mp4",
  );
  await expect(
    discoveryVideo.locator('source[type="video/webm"]'),
  ).toHaveAttribute(
    "src",
    "/assets/video/mobile/vineyard-flight.mobile.webm",
  );
  const search = page.getByRole("searchbox", { name: "Describe the moment" });
  await expect(search).toBeVisible();
  const searchBounds = await search.boundingBox();
  expect(searchBounds).not.toBeNull();
  expect(searchBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((searchBounds?.x ?? 0) + (searchBounds?.width ?? 0)).toBeLessThanOrEqual(
    390,
  );

  const grapeBounds = await page
    .locator(".gv-story-fallback-subject--grapes")
    .boundingBox();
  expect(grapeBounds).not.toBeNull();
  if (grapeBounds && searchBounds) {
    const overlaps = !(
      grapeBounds.x + grapeBounds.width <= searchBounds.x ||
      grapeBounds.x >= searchBounds.x + searchBounds.width ||
      grapeBounds.y + grapeBounds.height <= searchBounds.y ||
      grapeBounds.y >= searchBounds.y + searchBounds.height
    );
    expect(overlaps, "the Chapter 02 grapes must not cover its search field").toBe(
      false,
    );
  }

  const resources = await resourceNames(page);
  expect(
    resources.some((name) => /\.desktop\.(?:mp4|webm)(?:$|\?)/.test(name)),
  ).toBe(false);
  runtimeMonitor.assertClean();
  networkMonitor.assertClean();
});

test("the bottle inspector traps focus, locks page scroll, accepts drag/reset, and returns focus", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The live bottle viewer interaction runs once in desktop Chromium.",
  );
  test.setTimeout(90_000);

  // Keep the passive story canvas on its static fallback while preserving the
  // dedicated viewer's interactive Canvas path.
  await forceSoftwareWebGLCapability(page);
  const runtimeMonitor = monitorPageIssues(page);
  const networkMonitor = monitorStoryNetwork(page);
  await page.goto("/");
  const inspect = page.getByRole("button", { name: "INSPECT BOTTLE" });
  await inspect.click();

  const dialog = page.getByRole("dialog", { name: "INSPECT THE BOTTLE" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "CLOSE" })).toBeFocused();
  await expect(dialog.locator('[data-viewer-mode="interactive"]')).toBeVisible();
  const canvas = dialog.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await expect(dialog.locator(".gv-bottle-inspector__viewport")).toHaveClass(
    /\bis-ready\b/,
    { timeout: 20_000 },
  );
  await expect(canvas).toBeVisible();
  expect(
    await canvas.evaluate((element) => {
      const touchActions: string[] = [];
      let current: Element | null = element;
      while (current) {
        touchActions.push(getComputedStyle(current).touchAction);
        current = current.parentElement;
      }
      return touchActions;
    }),
  ).toContain("none");
  const reset = dialog.getByRole("button", { name: "RESET VIEW" });
  await expect(reset).toBeEnabled();
  expect(
    await page
      .locator(".app-shell")
      .evaluate((shell) => (shell as HTMLElement & { inert: boolean }).inert),
  ).toBe(true);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  const scrollBefore = await page.evaluate(() => window.scrollY);
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds) {
    await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.5, {
      steps: 8,
    });
    await page.mouse.up();
    await page.mouse.wheel(0, -240);
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await reset.click();
  await reset.focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "CLOSE" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(inspect).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  runtimeMonitor.assertClean();
  networkMonitor.assertClean();
});

test("the Chapter 05 action remains auth-aware and reaches the owner-scoped cellar", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The Home-to-cellar integration runs once in desktop Chromium.",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const portal = page.locator("#chapter-05-portal");
  await expect(
    portal.getByRole("link", { name: "CREATE CELLAR" }),
  ).toHaveAttribute("href", "/signup");

  const account = disposableAccount("home-cellar", testInfo);
  await signupThroughPreview(page, account);
  await page.goto("/");
  const openCellar = page
    .locator("#chapter-05-portal")
    .getByRole("link", { name: "OPEN CELLAR" });
  await expect(openCellar).toHaveAttribute("href", "/cellar");
  await openCellar.click();
  await expect(page).toHaveURL(/\/cellar$/);
  await expect(page.locator("[data-cellar-source='authenticated-api']")).toBeVisible();
});
