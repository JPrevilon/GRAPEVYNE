import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REDUCED_MOTION_HEADER = "@media (prefers-reduced-motion: reduce)";
const designSystemCss = readFileSync(
  path.resolve(process.cwd(), "src/styles/design-system.css"),
  "utf8",
);
const productRoutesCss = readFileSync(
  path.resolve(process.cwd(), "src/styles/product-routes.css"),
  "utf8",
);

function extractReducedMotionBlock(css: string): string {
  const headerIndex = css.lastIndexOf(REDUCED_MOTION_HEADER);

  if (headerIndex === -1) {
    throw new Error("The stylesheet has no reduced-motion media query.");
  }

  const openingBraceIndex = css.indexOf("{", headerIndex);
  let depth = 0;

  for (let index = openingBraceIndex; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") depth -= 1;

    if (depth === 0) {
      return css.slice(openingBraceIndex + 1, index);
    }
  }

  throw new Error("The reduced-motion media query is not balanced.");
}

describe("Prompt 03 reduced-motion contract", () => {
  it("neutralizes shared button and drawer motion while retaining normal transitions", () => {
    expect(designSystemCss).toContain(
      "animation: gv-drawer-in var(--duration-slow) var(--ease-emphasized)",
    );
    expect(designSystemCss).toContain(
      "transition: transform var(--duration-fast) var(--ease-standard)",
    );

    const reducedMotionCss = extractReducedMotionBlock(designSystemCss);

    expect(reducedMotionCss).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(reducedMotionCss).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(reducedMotionCss).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(reducedMotionCss).toMatch(
      /\.gv-button:hover:not\(:disabled\)\s*{\s*transform:\s*none;/,
    );
    expect(reducedMotionCss).toMatch(
      /\.gv-nav__drawer\s*{\s*transform:\s*none;/,
    );
  });

  it("removes hover displacement from wine and demo cards without removing their content", () => {
    expect(productRoutesCss).toMatch(
      /\.gv-wine-card:hover[\s\S]*?transform:\s*translateY\(-2px\)/,
    );
    expect(productRoutesCss).toMatch(
      /\.gv-demo-bottle:hover[\s\S]*?transform:\s*translateY\(-2px\)/,
    );

    const reducedMotionCss = extractReducedMotionBlock(productRoutesCss);
    const neutralizedTransformRule =
      reducedMotionCss.match(
        /[^{}]*\.gv-wine-card:hover[^{}]*{\s*transform:\s*none;\s*}/,
      )?.[0] ?? "";

    expect(neutralizedTransformRule).toContain(".gv-wine-card:hover");
    expect(neutralizedTransformRule).toContain(".gv-demo-bottle:hover");
    expect(neutralizedTransformRule).toContain(
      '.gv-demo-bottle[aria-pressed="true"]',
    );
  });
});
