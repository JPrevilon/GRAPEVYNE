import { expect, type Page } from "@playwright/test";

export interface PageIssueMonitor {
  assertClean: () => void;
  issues: string[];
}

export function monitorPageIssues(page: Page): PageIssueMonitor {
  const issues: string[] = [];

  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      const anonymousSessionProbe =
        message.text().includes("401 (UNAUTHORIZED)") &&
        location.url.includes("/api/auth/me");

      if (anonymousSessionProbe) return;
      issues.push(`console.error: ${message.text()}`);
    }
  });

  return {
    assertClean: () => expect(issues, "unexpected browser runtime errors").toEqual([]),
    issues,
  };
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

export async function installLayoutShiftObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shifts: number[] = [];
    Object.defineProperty(window, "__grapevyneLayoutShifts", {
      configurable: true,
      value: shifts,
    });

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };

          if (!layoutShift.hadRecentInput && typeof layoutShift.value === "number") {
            shifts.push(layoutShift.value);
          }
        }
      });
      observer.observe({ buffered: true, type: "layout-shift" });
    } catch {
      // Some browser engines do not expose LayoutShift; tests treat that as
      // unsupported rather than fabricating a metric.
    }
  });
}

export async function cumulativeLayoutShift(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const shifts = (
      window as Window & { __grapevyneLayoutShifts?: number[] }
    ).__grapevyneLayoutShifts;

    return shifts ? shifts.reduce((total, value) => total + value, 0) : null;
  });
}

export async function resourceNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name),
  );
}
