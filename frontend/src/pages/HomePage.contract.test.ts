import { readFileSync } from "node:fs";
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

  it("contains no model source capable of initiating a GLB or GLTF request", () => {
    const experienceSources = `${homeSource}\n${mediaSource}`;

    expect(experienceSources).not.toMatch(/\.(?:glb|gltf)(?:[?"']|$)/i);
    expect(experienceSources).not.toMatch(/<model-viewer\b/i);
    expect(experienceSources).not.toMatch(/(?:useGLTF|GLTFLoader|Canvas)\b/);
  });
});
