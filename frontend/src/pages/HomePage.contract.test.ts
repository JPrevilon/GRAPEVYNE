import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
  "utf8",
);
const mediaSource = readFileSync(
  path.resolve(process.cwd(), "src/experience/media.ts"),
  "utf8",
);
const webglExperienceSource = readFileSync(
  path.resolve(process.cwd(), "src/experience/webgl/WebGLExperience.tsx"),
  "utf8",
);

function importedModules(source: string) {
  return Array.from(
    source.matchAll(/from\s+["']([^"']+)["']/g),
    ([, moduleName]) => moduleName,
  ).filter((moduleName): moduleName is string => typeof moduleName === "string");
}

describe("HomePage experience boundaries", () => {
  it("does not import private cellar state or public demo fixtures as live homepage data", () => {
    const productDataImports = importedModules(homeSource).filter(
      (moduleName) =>
        moduleName.startsWith("@/data/") ||
        moduleName.startsWith("@/features/cellar/"),
    );

    expect(productDataImports).toEqual([]);
    expect(homeSource).not.toMatch(/use(?:Cellar|CellarEntry|TasteProfile)Query/);
  });

  it("keeps model loading behind the lightweight Home-only lazy boundary", () => {
    const experienceSources = `${homeSource}\n${mediaSource}`;

    expect(homeSource).toMatch(
      /from\s+["']@\/experience\/webgl\/WebGLExperience["']/,
    );
    expect(experienceSources).not.toMatch(/\.(?:glb|gltf)(?:[?"']|$)/i);
    expect(experienceSources).not.toMatch(/<model-viewer\b/i);
    expect(experienceSources).not.toMatch(/(?:useGLTF|GLTFLoader|Canvas)\b/);
    expect(webglExperienceSource).toMatch(
      /lazy\(\(\)\s*=>\s*import\(["']\.\/ExperienceCanvas["']\)\)/,
    );
    expect(webglExperienceSource).toMatch(/inspectBrowserWebGLCapability/);
    expect(webglExperienceSource).not.toMatch(/\.(?:glb|gltf)(?:[?"']|$)/i);
  });

  it("keeps title typography in the DOM instead of rendering WebGL text", () => {
    const webglRoot = path.resolve(process.cwd(), "src/experience/webgl");
    const webglSource = readdirSync(webglRoot, { recursive: true })
      .filter((entry): entry is string => typeof entry === "string")
      .filter((entry) => /\.(?:ts|tsx)$/.test(entry))
      .map((entry) => readFileSync(path.resolve(webglRoot, entry), "utf8"))
      .join("\n");

    expect(webglSource).not.toMatch(
      /import\s*{[^}]*\bText(?:3D)?\b[^}]*}\s*from\s*["']@react-three\/drei["']/s,
    );
    expect(webglSource).not.toMatch(/<Text(?:3D)?\b/);
    expect(webglSource).not.toMatch(/troika-three-text/i);
  });
});
