import { expect, type Page } from "@playwright/test";

export interface PageIssueMonitor {
  assertClean: () => void;
  issues: string[];
}

export interface LayoutShiftSample {
  sources: Array<{
    currentRect: { height: number; width: number; x: number; y: number };
    node: string | null;
    previousRect: { height: number; width: number; x: number; y: number };
  }>;
  startTime: number;
  value: number;
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
        /\b401\b/.test(message.text()) &&
        /\/api\/auth\/me(?:[?#]|$)/.test(location.url);

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
    const shifts: LayoutShiftSample[] = [];
    Object.defineProperty(window, "__grapevyneLayoutShifts", {
      configurable: true,
      value: shifts,
    });

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            sources?: Array<{
              currentRect: DOMRectReadOnly;
              node: Node | null;
              previousRect: DOMRectReadOnly;
            }>;
            value?: number;
          };

          if (!layoutShift.hadRecentInput && typeof layoutShift.value === "number") {
            shifts.push({
              sources: (layoutShift.sources ?? []).map((source) => {
                const identifyNode = () => {
                  if (!(source.node instanceof Element)) return null;
                  if (source.node.id) return `#${CSS.escape(source.node.id)}`;

                  const classes = [...source.node.classList]
                    .slice(0, 2)
                    .map((className) => `.${CSS.escape(className)}`)
                    .join("");
                  return `${source.node.tagName.toLowerCase()}${classes}`;
                };
                const serializeRect = (rect: DOMRectReadOnly) => ({
                  height: rect.height,
                  width: rect.width,
                  x: rect.x,
                  y: rect.y,
                });

                return {
                  currentRect: serializeRect(source.currentRect),
                  node: identifyNode(),
                  previousRect: serializeRect(source.previousRect),
                };
              }),
              startTime: layoutShift.startTime,
              value: layoutShift.value,
            });
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
      window as Window & { __grapevyneLayoutShifts?: LayoutShiftSample[] }
    ).__grapevyneLayoutShifts;

    if (!shifts) return null;

    let currentWindowScore = 0;
    let currentWindowStart = 0;
    let lastShiftTime = 0;
    let maximumWindowScore = 0;

    for (const shift of shifts) {
      const startsNewWindow =
        currentWindowScore === 0 ||
        shift.startTime - lastShiftTime >= 1_000 ||
        shift.startTime - currentWindowStart > 5_000;

      if (startsNewWindow) {
        currentWindowScore = shift.value;
        currentWindowStart = shift.startTime;
      } else {
        currentWindowScore += shift.value;
      }

      lastShiftTime = shift.startTime;
      maximumWindowScore = Math.max(maximumWindowScore, currentWindowScore);
    }

    return maximumWindowScore;
  });
}

export async function layoutShiftSamples(page: Page): Promise<LayoutShiftSample[]> {
  return page.evaluate(
    () =>
      (
        window as Window & { __grapevyneLayoutShifts?: LayoutShiftSample[] }
      ).__grapevyneLayoutShifts ?? [],
  );
}

async function forceReportedWebGLRenderer(
  page: Page,
  reportedRenderer: string,
): Promise<void> {
  await page.addInitScript(({ renderer }) => {
    Object.defineProperties(navigator, {
      connection: { configurable: true, value: { saveData: false } },
      deviceMemory: { configurable: true, value: 8 },
      hardwareConcurrency: { configurable: true, value: 8 },
    });

    const rendererParameter = 0x9246;
    const patchPrototype = (
      constructor:
        | typeof WebGLRenderingContext
        | typeof WebGL2RenderingContext
        | undefined,
    ) => {
      if (!constructor) return;

      const prototype = constructor.prototype;
      const originalGetParameter = prototype.getParameter;
      prototype.getParameter = function getParameter(parameter: number) {
        if (parameter === rendererParameter) return renderer;
        return originalGetParameter.call(this, parameter);
      };
    };

    patchPrototype(window.WebGLRenderingContext);
    patchPrototype(window.WebGL2RenderingContext);
  }, { renderer: reportedRenderer });
}

export async function forceLiveWebGLCapability(page: Page): Promise<void> {
  await forceReportedWebGLRenderer(page, "ANGLE (NVIDIA GeForce RTX 4090)");
}

export async function forceSoftwareWebGLCapability(page: Page): Promise<void> {
  await forceReportedWebGLRenderer(
    page,
    "ANGLE (Google, Vulkan (SwiftShader Device), SwiftShader driver)",
  );
}

export async function resourceNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name),
  );
}
