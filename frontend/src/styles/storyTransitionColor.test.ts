import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const designSystemCss = readFileSync(
  path.resolve(process.cwd(), "src/styles/design-system.css"),
  "utf8",
);
const scrollStoryCss = readFileSync(
  path.resolve(process.cwd(), "src/styles/scroll-story.css"),
  "utf8",
);

function ruleBlock(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  if (!match?.[1]) {
    throw new Error(`Missing CSS rule for ${selector}.`);
  }

  return match[1];
}

function zIndex(css: string, selector: string): number {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocks = [
    ...css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g")),
  ];
  const value = blocks
    .map((match) => match[1]?.match(/z-index:\s*(\d+)\s*;/)?.[1])
    .find(Boolean);

  if (!value) {
    throw new Error(`Missing numeric z-index for ${selector}.`);
  }

  return Number(value);
}

describe("Prompt 10A2 true-black transition color contract", () => {
  it("centralizes one exact black token for navigation and story transitions", () => {
    expect(designSystemCss).toContain("--color-navigation-black: #000000;");
    expect(designSystemCss).toContain(
      "--color-story-transition: var(--color-navigation-black);",
    );
    expect(ruleBlock(designSystemCss, ".gv-nav")).toContain(
      "background: var(--color-navigation-black);",
    );
  });

  it("keeps every permanent story base and the transition veil on that token", () => {
    for (const selector of [
      ".gv-story",
      ".gv-story-stage",
      ".gv-story-media-stack",
      ".gv-story-transition-veil",
    ]) {
      expect(ruleBlock(scrollStoryCss, selector)).toContain(
        "background: var(--color-story-transition);",
      );
    }

    expect(ruleBlock(scrollStoryCss, ".gv-story")).toContain(
      "--story-veil-opacity: 1;",
    );
    expect(ruleBlock(scrollStoryCss, ".gv-story-transition-veil")).not.toContain(
      "gradient",
    );
  });

  it("places the initially opaque veil above every visual-stage render layer", () => {
    const veilZIndex = zIndex(scrollStoryCss, ".gv-story-transition-veil");

    for (const selector of [
      ".gv-story-media-stack",
      ".gv-story-fallback-subjects",
      ".gv-webgl-experience",
      ".gv-story-stage__grain",
    ]) {
      expect(veilZIndex).toBeGreaterThan(zIndex(scrollStoryCss, selector));
    }
  });
});
