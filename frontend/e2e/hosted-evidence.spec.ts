import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { disposableAccount } from "./helpers/accounts";
import { sameOriginApi } from "./helpers/api";
import {
  forceLiveWebGLCapability,
  forceSoftwareWebGLCapability,
} from "./helpers/browser";
import { isHostedPreviewMode } from "./helpers/hosted";
import { seedActiveProfile, signupThroughPreview } from "./helpers/seed";

const evidenceRoot = path.resolve(
  process.cwd(),
  "..",
  "docs",
  "screenshots",
  "prompt-10a",
);

const routes = {
  cellar: "/cellar",
  discover: "/discover",
  finale: "/",
  hero: "/",
  login: "/login",
  memory: "/",
  notFound: "/an-intentional-404",
  profile: "/profile",
  recommendation:
    "/discover?query=bold+red+under+%2460+for+steak+night",
  signup: "/signup",
  demoCellar: "/demo/cellar",
  wineDetail: "/wines/mock-chateau-montelena-cabernet-sauvignon-2019",
} as const;

type AllowlistedRoute = (typeof routes)[keyof typeof routes];

async function gotoAllowlistedRoute(
  page: Page,
  route: AllowlistedRoute,
): Promise<void> {
  await page.goto(route);
  await expect
    .poll(() =>
      page.evaluate(
        () => `${window.location.pathname}${window.location.search}`,
      ),
    )
    .toBe(route);
}

async function capture(page: Page, filename: string): Promise<void> {
  await expect(page.locator("main")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  });
  await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    mask: [page.locator('input[type="password"]')],
    maskColor: "#15110f",
    path: path.join(evidenceRoot, filename),
  });
}

test.describe("hosted Prompt 10A screenshot evidence", () => {
  test.skip(
    !isHostedPreviewMode(),
    "Prompt 10A screenshots run only through the explicit hosted Preview runner.",
  );
  test.describe.configure({ mode: "serial" });

  test("capture the hosted Chromium review matrix", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "The hosted evidence matrix runs once in desktop Chromium.",
    );
    test.setTimeout(240_000);

    await mkdir(evidenceRoot, { recursive: true });
    await forceLiveWebGLCapability(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });

    await page.setViewportSize({ height: 900, width: 1440 });
    await gotoAllowlistedRoute(page, routes.hero);
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
    await capture(page, "01-hero-desktop-1440x900.png");

    await page.setViewportSize({ height: 1080, width: 1920 });
    await gotoAllowlistedRoute(page, routes.hero);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "FIND THE BOTTLE KEEP THE MEMORY",
      }),
    ).toBeVisible();
    await expect(page.locator("[data-webgl-status='ready']")).toBeVisible({
      timeout: 15_000,
    });
    await capture(page, "02-hero-desktop-1920x1080.png");

    await page.setViewportSize({ height: 844, width: 390 });
    await gotoAllowlistedRoute(page, routes.hero);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "FIND THE BOTTLE KEEP THE MEMORY",
      }),
    ).toBeVisible();
    await expect(page.locator("[data-webgl-status='ready']")).toBeVisible({
      timeout: 15_000,
    });
    await capture(page, "03-hero-mobile-390x844.png");

    await page.setViewportSize({ height: 900, width: 1440 });
    await gotoAllowlistedRoute(page, routes.discover);
    await expect(
      page.getByRole("heading", { level: 1, name: "DISCOVER WINES" }),
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "Search wines" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "FIND A BOTTLE WITH REASONS YOU CAN INSPECT",
      }),
    ).toBeVisible();
    await capture(page, "04-discovery-desktop-1440x900.png");

    await gotoAllowlistedRoute(page, routes.recommendation);
    await expect(
      page.getByRole("heading", { name: "WHAT THE ENGINE UNDERSTOOD" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("link", {
          name: /^View .+ with recommendation context$/,
        })
        .first(),
    ).toBeVisible();
    await capture(
      page,
      "05-explainable-recommendation-desktop-1440x900.png",
    );

    await gotoAllowlistedRoute(page, routes.wineDetail);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Estate Cabernet Sauvignon",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in to save" })).toBeVisible();
    await capture(page, "06-wine-detail-desktop-1440x900.png");

    await gotoAllowlistedRoute(page, routes.demoCellar);
    await expect(
      page.getByRole("heading", {
        name: "VISIBLE FICTION, NEVER PRIVATE ACCOUNT DATA",
      }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Search the fictional collection"),
    ).toBeVisible();
    await capture(page, "07-demo-cellar-desktop-1440x900.png");

    const account = disposableAccount("prompt-10a-hosted-evidence", testInfo);
    const user = await signupThroughPreview(page, account);
    const entries = await seedActiveProfile(
      page,
      user.id,
      "PROMPT 10A DISPOSABLE NOTE — MUST NOT APPEAR",
    );

    for (const entry of entries) {
      const clearNoteResponse = await sameOriginApi(
        page,
        `/api/cellar/${entry.id}`,
        {
          body: { notes: null },
          expectedUserId: user.id,
          method: "PATCH",
        },
      );
      expect(clearNoteResponse.status).toBe(200);
    }

    await gotoAllowlistedRoute(page, routes.cellar);
    await expect(
      page.getByRole("heading", { level: 1, name: "YOUR CELLAR" }),
    ).toBeVisible();
    await expect(
      page.locator("[data-cellar-source='authenticated-api']"),
    ).toBeVisible();
    await expect(
      page.locator(`#cellar-entry-${entries[0]?.id}-trigger`),
    ).toBeVisible();
    await capture(page, "08-authenticated-cellar-desktop-1440x900.png");

    await page.locator(`#cellar-entry-${entries[0]?.id}-trigger`).click();
    await expect(
      page.getByRole("heading", { name: "EDIT THE MEMORY" }),
    ).toBeVisible();
    const privateNote = page.getByLabel("Private tasting note");
    await expect(privateNote).toHaveValue("");
    await privateNote.scrollIntoViewIfNeeded();
    await expect(privateNote).toBeVisible();
    await capture(
      page,
      "09-tasting-memory-editor-empty-note-desktop-1440x900.png",
    );

    await gotoAllowlistedRoute(page, routes.profile);
    await expect(
      page.locator("[data-profile-source='authenticated-api']"),
    ).toBeVisible();
    await expect(page.getByText("Active profile", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "YOUR RECORDED BRANCHES" }),
    ).toBeVisible();
    await capture(page, "10-active-taste-profile-desktop-1440x900.png");

    await page.setViewportSize({ height: 844, width: 390 });
    await gotoAllowlistedRoute(page, routes.profile);
    const tasteAtlasHeading = page.getByRole("heading", {
      name: "YOUR RECORDED BRANCHES",
    });
    await expect(tasteAtlasHeading).toBeVisible();
    await tasteAtlasHeading.scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("group", { name: "Taste Atlas preference clusters" }),
    ).toBeVisible();
    await capture(page, "11-taste-atlas-mobile-390x844.png");

    const logoutResponse = await sameOriginApi(page, "/api/auth/logout", {
      method: "POST",
    });
    expect(logoutResponse.status).toBe(200);

    await gotoAllowlistedRoute(page, routes.login);
    const loginForm = page.getByRole("form", { name: "Sign in form" });
    await expect(loginForm).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("");
    await expect(page.getByLabel("Password")).toHaveValue("");
    await capture(page, "12-login-empty-form-mobile-390x844.png");

    await page.setViewportSize({ height: 900, width: 1440 });
    await gotoAllowlistedRoute(page, routes.signup);
    const signupForm = page.getByRole("form", {
      name: "Create account form",
    });
    await expect(signupForm).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("");
    await expect(page.getByLabel("Email")).toHaveValue("");
    await expect(page.getByLabel("Password")).toHaveValue("");
    await capture(page, "13-signup-empty-form-desktop-1440x900.png");

    await gotoAllowlistedRoute(page, routes.memory);
    const memoryChapter = page.locator("#chapter-07-memory");
    await memoryChapter.evaluate((chapter) => {
      chapter.scrollIntoView({ block: "start" });
    });
    await expect(
      memoryChapter.getByRole("heading", { name: "REMEMBER THE POUR" }),
    ).toBeVisible();
    await expect(
      memoryChapter.getByRole("heading", { name: "CELEBRATION DINNER" }),
    ).toBeVisible();
    await capture(page, "14-homepage-memory-chapter-desktop-1440x900.png");

    await gotoAllowlistedRoute(page, routes.finale);
    const finaleChapter = page.locator("#chapter-09-finale");
    await finaleChapter.evaluate((chapter) => {
      chapter.scrollIntoView({ block: "start" });
    });
    await expect(
      finaleChapter.getByRole("heading", { name: "KEEP THE STORY" }),
    ).toBeVisible();
    await expect(
      finaleChapter.getByRole("link", { name: "Create your cellar" }),
    ).toBeVisible();
    await capture(page, "15-homepage-finale-chapter-desktop-1440x900.png");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoAllowlistedRoute(page, routes.hero);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "FIND THE BOTTLE KEEP THE MEMORY",
      }),
    ).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.locator(".gv-hero-bottle")).toBeVisible();
    await capture(page, "16-reduced-motion-hero-desktop-1440x900.png");

    await forceSoftwareWebGLCapability(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await gotoAllowlistedRoute(page, routes.hero);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "FIND THE BOTTLE KEEP THE MEMORY",
      }),
    ).toBeVisible();
    await expect(page.locator(".gv-hero-bottle")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator("[data-webgl-status]")).toHaveCount(0);
    await capture(page, "17-webgl-fallback-hero-desktop-1440x900.png");

    await gotoAllowlistedRoute(page, routes.notFound);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "THIS PAGE IS NOT IN THE DIRECTORY",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Return to the beginning" }),
    ).toBeVisible();
    await capture(page, "18-intentional-404-desktop-1440x900.png");

    // The explicit hosted runner owns cleanup of the dedicated Preview data.
    // This spec never targets Production and does not persist browser state.
  });
});
