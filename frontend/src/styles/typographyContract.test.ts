import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const mainSource = readFileSync(path.resolve(projectRoot, "src/main.tsx"), "utf8");
const globalCss = readFileSync(
  path.resolve(projectRoot, "src/styles/global.css"),
  "utf8",
);
const designSystemCss = readFileSync(
  path.resolve(projectRoot, "src/styles/design-system.css"),
  "utf8",
);
const productRoutesCss = readFileSync(
  path.resolve(projectRoot, "src/styles/product-routes.css"),
  "utf8",
);
const scrollStoryCss = readFileSync(
  path.resolve(projectRoot, "src/styles/scroll-story.css"),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(path.resolve(projectRoot, "package.json"), "utf8"),
) as { dependencies: Record<string, string> };
const packageLock = JSON.parse(
  readFileSync(path.resolve(projectRoot, "package-lock.json"), "utf8"),
) as {
  packages: Record<string, { dependencies?: Record<string, string>; version?: string }>;
};

const authoredTypography = [
  mainSource,
  globalCss,
  designSystemCss,
  productRoutesCss,
  scrollStoryCss,
].join("\n");

describe("Prompt 06A typography contract", () => {
  it("pins and imports only the approved local variable-weight families", () => {
    expect(packageJson.dependencies).toMatchObject({
      "@fontsource-variable/jost": "5.3.0",
      "@fontsource-variable/raleway": "5.3.0",
    });
    expect(packageJson.dependencies).not.toHaveProperty("@fontsource/archivo-black");
    expect(packageJson.dependencies).not.toHaveProperty(
      "@fontsource-variable/archivo",
    );
    expect(packageJson.dependencies).not.toHaveProperty(
      "@fontsource/barlow-condensed",
    );
    expect(packageLock.packages["node_modules/@fontsource-variable/jost"]?.version).toBe(
      "5.3.0",
    );
    expect(
      packageLock.packages["node_modules/@fontsource-variable/raleway"]?.version,
    ).toBe("5.3.0");

    expect(mainSource).toContain('@fontsource-variable/raleway/wght.css');
    expect(mainSource).toContain('@fontsource-variable/jost/wght.css');
    expect(mainSource.match(/@fontsource[^"']+/g)).toHaveLength(2);
    expect(authoredTypography).not.toMatch(/Archivo|Barlow Condensed/i);
  });

  it("centralizes the light precision-index scale without a remote font source", () => {
    expect(designSystemCss).toContain(
      '--font-display: "Raleway Variable", "Raleway", "Helvetica Neue", Arial, sans-serif',
    );
    expect(designSystemCss).toContain(
      '--font-body: "Jost Variable", "Jost", "Helvetica Neue", Arial, sans-serif',
    );
    expect(designSystemCss).toContain(
      '--font-directory: "Jost Variable", "Jost", "Helvetica Neue", Arial, sans-serif',
    );
    expect(designSystemCss).toContain(
      "--size-directory-hero-large: clamp(3.35rem, 6.1vw, 6.15rem)",
    );
    expect(designSystemCss).toContain(
      "--size-directory-chapter-large: clamp(2.4rem, 4.3vw, 4.35rem)",
    );
    expect(designSystemCss).toContain(
      "--size-directory-product-large: clamp(2.7rem, 4.8vw, 5rem)",
    );
    expect(designSystemCss).toContain(
      "--directory-large: clamp(2.5rem, 12vw, 3.9rem)",
    );
    expect(designSystemCss).toContain(
      "--directory-large: clamp(2rem, 9.5vw, 3.25rem)",
    );
    expect(designSystemCss).toMatch(/font-synthesis:\s*none/);
    expect(designSystemCss).toMatch(/font-optical-sizing:\s*auto/);
    expect(designSystemCss).toMatch(/text-rendering:\s*optimizeLegibility/);
    expect(designSystemCss).toMatch(
      /\.gv-directory-heading__segment--weight-light\s*{\s*font-weight:\s*300;/,
    );
    expect(designSystemCss).toMatch(
      /\.gv-directory-heading__segment--accent\s*{\s*color:\s*var\(--color-champagne\);/,
    );
    expect(designSystemCss).toMatch(
      /\.gv-eyebrow--data\s*{[^}]*text-transform:\s*none/s,
    );
    expect(designSystemCss).toMatch(
      /\.gv-bottle__label small\s*{[^}]*text-transform:\s*none/s,
    );
    expect(scrollStoryCss).toContain("font-family: var(--font-body)");
    expect(productRoutesCss).toContain("font-family: var(--font-directory)");

    expect(authoredTypography).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/i);
    expect(authoredTypography).not.toMatch(/@import\s+url\(/i);
    expect(authoredTypography).not.toMatch(/font-weight:\s*(?:6[5-9]0|[789]00)/);
    expect(authoredTypography).not.toMatch(/letter-spacing:\s*-/);
    expect(authoredTypography).not.toMatch(/font-variation-settings/i);
  });
});
