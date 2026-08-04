import type { TestInfo } from "@playwright/test";

export const DESKTOP_BROWSER_PROJECTS = [
  "desktop-chromium",
  "desktop-firefox",
  "desktop-webkit",
] as const;

export const MOBILE_BROWSER_PROJECTS = [
  "mobile-chromium",
  "mobile-webkit",
] as const;

export function projectIs(
  testInfo: TestInfo,
  projects: readonly string[],
): boolean {
  return projects.includes(testInfo.project.name);
}
