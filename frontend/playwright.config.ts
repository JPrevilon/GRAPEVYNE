import { isAbsolute } from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { isHostedPreviewMode } from "./e2e/helpers/hosted";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";
const hostedPreview = isHostedPreviewMode();
const parsedBaseURL = new URL(baseURL);
const localHosts = new Set(["127.0.0.1", "::1", "localhost"]);

if (hostedPreview) {
  if (
    !process.env.GRAPEVYNE_HOSTED_PREVIEW_DEPLOYMENT_ID?.startsWith("dpl_")
  ) {
    throw new Error(
      "Hosted Preview Playwright must be launched through run-hosted-e2e.mjs.",
    );
  }

  if (
    !process.env.GRAPEVYNE_HOSTED_PREVIEW_STORAGE_STATE ||
    !isAbsolute(process.env.GRAPEVYNE_HOSTED_PREVIEW_STORAGE_STATE)
  ) {
    throw new Error(
      "Hosted Preview Playwright requires runner-managed storage state.",
    );
  }
} else if (!localHosts.has(parsedBaseURL.hostname)) {
  throw new Error(
    "External Playwright targets require the explicit hosted Preview runner.",
  );
}

const hostedStorageState = hostedPreview
  ? process.env.GRAPEVYNE_HOSTED_PREVIEW_STORAGE_STATE
  : undefined;

export default defineConfig({
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.015,
    },
  },
  forbidOnly: Boolean(process.env.CI) || hostedPreview,
  fullyParallel: !hostedPreview,
  outputDir: "test-results/playwright",
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: "desktop-firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: "desktop-webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        viewport: { height: 844, width: 390 },
      },
    },
    {
      name: "mobile-webkit",
      use: {
        ...devices["iPhone 13"],
        viewport: { height: 844, width: 390 },
      },
    },
    {
      name: "reduced-motion-chromium",
      use: {
        ...devices["Desktop Chrome"],
        contextOptions: { reducedMotion: "reduce" },
        viewport: { height: 900, width: 1440 },
      },
    },
  ],
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "test-results/html" }],
  ],
  retries: process.env.CI || hostedPreview ? 1 : 0,
  snapshotPathTemplate:
    "{testDir}/__snapshots__/{testFilePath}/{projectName}/{arg}{ext}",
  testDir: "./e2e",
  timeout: 45_000,
  use: {
    baseURL,
    // Vercel's supported automation header prevents its feedback toolbar from
    // injecting third-party scripts into the application under test.
    extraHTTPHeaders: hostedPreview ? { "x-vercel-skip-toolbar": "1" } : undefined,
    screenshot: "only-on-failure",
    storageState: hostedStorageState,
    // Hosted state can contain a short-lived protection cookie. Never retain
    // a network trace for a hosted run, even when Preview protection is off.
    trace: hostedPreview ? "off" : "retain-on-failure",
    video: "retain-on-failure",
  },
  workers: hostedPreview ? 1 : process.env.CI ? 2 : undefined,
});
