import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const mainSource = readFileSync(path.resolve(projectRoot, "src/main.tsx"), "utf8");
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

describe("Prompt 04B typography contract", () => {
  it("pins and imports only the approved self-hosted Fontsource families", () => {
    expect(packageJson.dependencies).toMatchObject({
      "@fontsource/archivo-black": "5.3.0",
      "@fontsource-variable/archivo": "5.3.0",
      "@fontsource/barlow-condensed": "5.3.0",
    });
    expect(packageJson.dependencies).not.toHaveProperty("@fontsource/eb-garamond");
    expect(packageJson.dependencies).not.toHaveProperty("@fontsource/inter");

    expect(mainSource).toContain('@fontsource/archivo-black/latin-400.css');
    expect(mainSource).toContain('@fontsource-variable/archivo/wght.css');
    expect(mainSource).toContain('@fontsource/barlow-condensed/latin-600.css');
    expect(mainSource).toContain('@fontsource/barlow-condensed/latin-700.css');
    expect(mainSource).toContain('@fontsource/barlow-condensed/latin-800.css');
    expect(mainSource).not.toMatch(/@fontsource\/(?:eb-garamond|inter)/i);
  });

  it("centralizes display, body, and directory roles without a remote font CDN", () => {
    expect(designSystemCss).toContain(
      '--font-display: "Archivo Black", "Arial Black", "Helvetica Neue", sans-serif',
    );
    expect(designSystemCss).toContain(
      '--font-body: "Archivo Variable", "Archivo", "Helvetica Neue", Arial, sans-serif',
    );
    expect(designSystemCss).toContain(
      '--font-directory: "Barlow Condensed", "Arial Narrow", sans-serif',
    );
    expect(designSystemCss).toMatch(/--size-display-hero:/);
    expect(designSystemCss).toMatch(/--size-display-chapter:/);
    expect(designSystemCss).toMatch(/--size-display-page:/);
    expect(designSystemCss).toMatch(/font-synthesis:\s*none/);
    expect(designSystemCss).toMatch(
      /\.gv-eyebrow--data\s*{[^}]*text-transform:\s*none/s,
    );
    expect(designSystemCss).toMatch(
      /\.gv-bottle__label small\s*{[^}]*text-transform:\s*none/s,
    );
    expect(scrollStoryCss).toContain("font-family: var(--font-body)");
    expect(productRoutesCss).toContain("font-family: var(--font-directory)");

    const authoredTypography = `${mainSource}\n${designSystemCss}\n${productRoutesCss}\n${scrollStoryCss}`;
    expect(authoredTypography).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/i);
    expect(authoredTypography).not.toMatch(/@import\s+url\(/i);
    expect(authoredTypography).not.toMatch(/EB Garamond/i);
    expect(authoredTypography).not.toMatch(/font-family:\s*Inter\b/i);
  });
});
