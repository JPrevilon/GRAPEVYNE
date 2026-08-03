import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";

export default defineConfig({
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.015,
    },
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
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
  retries: process.env.CI ? 1 : 0,
  snapshotPathTemplate:
    "{testDir}/__snapshots__/{testFilePath}/{projectName}/{arg}{ext}",
  testDir: "./e2e",
  timeout: 45_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  workers: process.env.CI ? 2 : undefined,
});
