import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  loadFinalMediaManifest,
  loadMeshyModelManifest,
  loadStoryMediaManifest,
  loadWebGLAssetManifest,
  parsePngContract,
  parseStorySubjectMap,
  verifyAssets,
} from "./verify-assets.mjs";

const fixtureRoots = [];
const sourceRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function createFixtureRepository() {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "grapevyne-media-verifier-"),
  );
  fixtureRoots.push(repositoryRoot);
  const sourceManifest = await loadFinalMediaManifest();
  const sourceWebGLManifest = await loadWebGLAssetManifest();
  const sourceStoryManifest = await loadStoryMediaManifest();
  const sourceMeshyManifest = await loadMeshyModelManifest();
  const files = [];
  const storyFiles = [];

  for (const file of sourceManifest.files) {
    const content = Buffer.from(`fixture:${file.relativeRepositoryPath}`);
    const absolutePath = path.join(repositoryRoot, file.relativeRepositoryPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
    files.push({
      ...file,
      byteSize: content.byteLength,
      sha256: hash(content),
    });
  }

  for (const file of sourceStoryManifest.files) {
    const content = Buffer.from(`fixture:${file.relativeRepositoryPath}`);
    const absolutePath = path.join(repositoryRoot, file.relativeRepositoryPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
    storyFiles.push({
      ...file,
      byteSize: content.byteLength,
      sha256: hash(content),
    });
  }

  for (const assetPath of [
    "frontend/public/favicon.svg",
    "frontend/public/assets/brand/grapevyne-monogram.svg",
    "frontend/public/assets/brand/grapevyne-wordmark.svg",
  ]) {
    const absolutePath = path.join(repositoryRoot, assetPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, "fixture");
  }

  for (const asset of sourceWebGLManifest.assets) {
    const absolutePath = path.join(repositoryRoot, asset.assetPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await copyFile(
      path.join(sourceRepositoryRoot, asset.assetPath),
      absolutePath,
    );
  }

  for (const asset of sourceMeshyManifest.assets) {
    const absolutePath = path.join(
      repositoryRoot,
      asset.production.assetPath,
    );
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await copyFile(
      path.join(sourceRepositoryRoot, asset.production.assetPath),
      absolutePath,
    );
  }

  const grapeFallback = sourceMeshyManifest.staticFallbacks.find(
    (fallback) => fallback.assetPath?.endsWith("grapevyne-meshy-grapes.png"),
  );
  if (!grapeFallback) throw new Error("Expected the grape fallback manifest entry.");
  const grapeFallbackPath = path.join(
    repositoryRoot,
    grapeFallback.assetPath,
  );
  await mkdir(path.dirname(grapeFallbackPath), { recursive: true });
  await copyFile(
    path.join(sourceRepositoryRoot, grapeFallback.assetPath),
    grapeFallbackPath,
  );

  const acceptedManifestPath = "docs/v2/04a-final-media-manifest.json";
  await mkdir(path.join(repositoryRoot, "docs/v2"), { recursive: true });
  await copyFile(
    path.join(sourceRepositoryRoot, acceptedManifestPath),
    path.join(repositoryRoot, acceptedManifestPath),
  );

  const storyChaptersPath = path.join(
    repositoryRoot,
    "frontend/src/experience/storyChapters.ts",
  );
  await mkdir(path.dirname(storyChaptersPath), { recursive: true });
  await writeFile(
    storyChaptersPath,
    `export const STORY_CHAPTERS = [
      { key: "hero", subject: "bottle" },
      { key: "discovery", subject: "grapes" },
      { key: "match", subject: "none" },
      { key: "taste", subject: "none" },
      { key: "portal", subject: "bottle" },
      { key: "cellar", subject: "none" },
      { key: "memory", subject: "none" },
      { key: "atlas", subject: "bottle" },
      { key: "finale", subject: "none" },
    ] as const;`,
  );

  return {
    manifest: {
      ...sourceManifest,
      files,
      totalBytes: files.reduce((total, file) => total + file.byteSize, 0),
    },
    storyManifest: {
      ...sourceStoryManifest,
      files: storyFiles,
      scope: {
        ...sourceStoryManifest.scope,
        totalNewBytes: storyFiles.reduce(
          (total, file) => total + file.byteSize,
          0,
        ),
      },
    },
    meshyManifest: sourceMeshyManifest,
    webglManifest: sourceWebGLManifest,
    repositoryRoot,
  };
}

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("final-media asset verification failures", () => {
  it("reports a changed production-media hash", async () => {
    const fixture = await createFixtureRepository();
    const target = fixture.manifest.files[0];
    const absolutePath = path.join(
      fixture.repositoryRoot,
      target.relativeRepositoryPath,
    );
    const original = await readFile(absolutePath);
    const changed = Buffer.from(original);
    changed[0] = changed[0] === 0 ? 1 : changed[0] - 1;
    await writeFile(absolutePath, changed);

    const result = await verifyAssets(fixture);

    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${target.relativeRepositoryPath}: SHA-256 mismatch`),
      ]),
    );
  });

  it("reports a missing production-media file", async () => {
    const fixture = await createFixtureRepository();
    const target = fixture.manifest.files[1];
    await unlink(path.join(fixture.repositoryRoot, target.relativeRepositoryPath));

    const result = await verifyAssets(fixture);

    expect(result.failures).toEqual(
      expect.arrayContaining([
        `${target.relativeRepositoryPath}: missing`,
        expect.stringContaining(
          "expected exactly 74 accepted-plus-additive files, found 73",
        ),
      ]),
    );
  });

  it("rejects an unexpected prototype filename", async () => {
    const fixture = await createFixtureRepository();
    const prototypePath = path.join(
      fixture.repositoryRoot,
      "frontend/public/assets/video/prototype-loops/hero.prototype-loop.mp4",
    );
    await mkdir(path.dirname(prototypePath), { recursive: true });
    await writeFile(prototypePath, "prototype");

    const result = await verifyAssets(fixture);

    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("unexpected production-media file"),
        expect.stringContaining("prohibited production filename"),
      ]),
    );
  });

  it("rejects scene metadata that does not match the production path", async () => {
    const fixture = await createFixtureRepository();
    const target = fixture.manifest.files.find(
      (file) => file.sceneId === "cellar" && file.kind === "mp4",
    );
    if (!target) throw new Error("Expected a cellar MP4 fixture.");

    target.sceneId = "hero";
    target.requiredPlaybackMode = "loop";
    target.pairedPosterPath =
      `frontend/public/assets/video/posters/${target.device}/hero-bottle-macro.${target.device}.jpg`;
    target.pairedFallbackVideoPath =
      `frontend/public/assets/video/${target.device}/hero-bottle-macro.${target.device}.mp4`;

    const result = await verifyAssets(fixture);

    expect(result.failures).toContain(
      `${target.relativeRepositoryPath}: path does not match scene/device/kind metadata`,
    );
  });
});

describe("WebGL asset verification failures", () => {
  it("reports a changed approved label hash", async () => {
    const fixture = await createFixtureRepository();
    const target = fixture.webglManifest.assets.find(
      (asset) => asset.labelVariant === "red",
    );
    if (!target) throw new Error("Expected the red label fixture.");
    const absolutePath = path.join(fixture.repositoryRoot, target.assetPath);
    const changed = await readFile(absolutePath);
    changed[0] = changed[0] === 0 ? 1 : changed[0] - 1;
    await writeFile(absolutePath, changed);

    const result = await verifyAssets(fixture);

    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${target.assetPath}: SHA-256 mismatch`),
      ]),
    );
  });

  it("reports a missing required node and geometry in an approved GLB", async () => {
    const fixture = await createFixtureRepository();
    const target = fixture.webglManifest.assets.find(
      (asset) => asset.modelTier === "high",
    );
    if (!target) throw new Error("Expected the high-tier model fixture.");
    const absolutePath = path.join(fixture.repositoryRoot, target.assetPath);
    const changed = await readFile(absolutePath);
    const requiredName = Buffer.from("Condensation");
    const replacement = Buffer.from("Condensatiox");
    let matchIndex = changed.indexOf(requiredName);

    if (matchIndex < 0) {
      throw new Error("Expected Condensation in the GLB JSON chunk.");
    }
    while (matchIndex >= 0) {
      replacement.copy(changed, matchIndex);
      matchIndex = changed.indexOf(requiredName, matchIndex + replacement.length);
    }
    await writeFile(absolutePath, changed);

    const result = await verifyAssets(fixture);

    expect(result.failures).toEqual(
      expect.arrayContaining([
        `${target.assetPath}: missing required GLB node Condensation`,
        `${target.assetPath}: missing required GLB geometry Condensation`,
      ]),
    );
  });

  it("rejects an approved model that exceeds its tier budget", async () => {
    const fixture = await createFixtureRepository();
    const target = fixture.webglManifest.assets.find(
      (asset) => asset.modelTier === "standard",
    );
    if (!target) throw new Error("Expected the standard-tier model fixture.");
    const absolutePath = path.join(fixture.repositoryRoot, target.assetPath);
    const original = await readFile(absolutePath);
    const overBudget = Buffer.concat([
      original,
      Buffer.alloc(target.maxByteSize + 1 - original.byteLength),
    ]);
    await writeFile(absolutePath, overBudget);

    const result = await verifyAssets(fixture);

    expect(result.failures).toContain(
      `${target.assetPath}: exceeds standard model budget of ${target.maxByteSize} bytes`,
    );
  });

  it("rejects an unexpected GLTF model", async () => {
    const fixture = await createFixtureRepository();
    const unexpectedPath =
      "frontend/public/assets/models/unapproved-bottle.gltf";
    const absolutePath = path.join(fixture.repositoryRoot, unexpectedPath);
    await writeFile(absolutePath, "{}");

    const result = await verifyAssets(fixture);

    expect(result.failures).toEqual(
      expect.arrayContaining([
        `${unexpectedPath}: unexpected GLB/GLTF model`,
        `${unexpectedPath}: prohibited media/model outside approved directory`,
      ]),
    );
  });

  it("rejects remote model and HDRI URLs in application source", async () => {
    const fixture = await createFixtureRepository();
    const sourcePath = "frontend/src/remote-assets.ts";
    const absolutePath = path.join(fixture.repositoryRoot, sourcePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(
      absolutePath,
      [
        'export const model = "https://cdn.example.test/bottle.glb";',
        'export const environment = "https://cdn.example.test/studio.hdr";',
      ].join("\n"),
    );

    const result = await verifyAssets(fixture);

    expect(result.failures).toEqual(
      expect.arrayContaining([
        `${sourcePath}: remote model URL is prohibited`,
        `${sourcePath}: remote environment/HDRI URL is prohibited`,
      ]),
    );
  });
});

describe("Prompt 10A1 additive asset verification", () => {
  it("reports a changed additive story-media hash", async () => {
    const fixture = await createFixtureRepository();
    const target = fixture.storyManifest.files[0];
    const absolutePath = path.join(
      fixture.repositoryRoot,
      target.relativeRepositoryPath,
    );
    const changed = await readFile(absolutePath);
    changed[0] = changed[0] === 0 ? 1 : changed[0] - 1;
    await writeFile(absolutePath, changed);

    const result = await verifyAssets(fixture);

    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          `${target.relativeRepositoryPath}: SHA-256 mismatch`,
        ),
      ]),
    );
  });

  it("reports a changed optimized Meshy model hash", async () => {
    const fixture = await createFixtureRepository();
    const target = fixture.meshyManifest.assets[0].production;
    const absolutePath = path.join(fixture.repositoryRoot, target.assetPath);
    const changed = await readFile(absolutePath);
    changed[changed.byteLength - 1] ^= 1;
    await writeFile(absolutePath, changed);

    const result = await verifyAssets(fixture);

    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${target.assetPath}: SHA-256 mismatch`),
      ]),
    );
  });

  it("requires the exact transparent grape fallback", async () => {
    const fixture = await createFixtureRepository();
    const target = fixture.meshyManifest.staticFallbacks.find(
      (fallback) => fallback.subject === "grapes",
    );
    if (!target) throw new Error("Expected the grape fallback fixture.");
    await unlink(path.join(fixture.repositoryRoot, target.assetPath));

    const result = await verifyAssets(fixture);

    expect(result.failures).toContain(`${target.assetPath}: missing`);
  });

  it("enforces the locked chapter-subject map", async () => {
    const fixture = await createFixtureRepository();
    const storyChaptersPath = path.join(
      fixture.repositoryRoot,
      "frontend/src/experience/storyChapters.ts",
    );
    const source = await readFile(storyChaptersPath, "utf8");
    await writeFile(
      storyChaptersPath,
      source.replace(
        '{ key: "match", subject: "none" }',
        '{ key: "match", subject: "bottle" }',
      ),
    );

    const result = await verifyAssets(fixture);

    expect(result.failures).toContain(
      "frontend/src/experience/storyChapters.ts: locked chapter-subject map mismatch",
    );
  });

  it("rejects remote texture URLs and reference production filenames", async () => {
    const fixture = await createFixtureRepository();
    const sourcePath = "frontend/src/remote-texture.ts";
    const absoluteSourcePath = path.join(fixture.repositoryRoot, sourcePath);
    await writeFile(
      absoluteSourcePath,
      'export const texture = "https://cdn.example.test/grapes.webp";',
    );
    const referencePath =
      "frontend/public/assets/video/reference/grape-reel.reference.mp4";
    const absoluteReferencePath = path.join(
      fixture.repositoryRoot,
      referencePath,
    );
    await mkdir(path.dirname(absoluteReferencePath), { recursive: true });
    await writeFile(absoluteReferencePath, "reference");

    const result = await verifyAssets(fixture);

    expect(result.failures).toEqual(
      expect.arrayContaining([
        `${sourcePath}: remote texture URL is prohibited`,
        `${referencePath}: prohibited production filename`,
      ]),
    );
  });

  it("parses the production fallback and nested story objects behaviorally", async () => {
    const png = parsePngContract(
      await readFile(
        path.join(
          sourceRepositoryRoot,
          "frontend/public/assets/models/fallbacks/grapevyne-meshy-grapes.png",
        ),
      ),
    );
    expect(png).toEqual({
      bitDepth: 8,
      colorType: 6,
      height: 1200,
      width: 1024,
    });

    const subjects = parseStorySubjectMap(`
      export const STORY_CHAPTERS = [
        { key: "hero", headingSegments: [{ text: "Bottle" }], subject: "bottle" },
        { key: "discovery", subject: "grapes" },
      ] as const;
    `);
    expect(subjects).toEqual([
      ["hero", "bottle"],
      ["discovery", "grapes"],
    ]);
  });
});
