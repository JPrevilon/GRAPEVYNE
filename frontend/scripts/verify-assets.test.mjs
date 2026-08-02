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
  loadWebGLAssetManifest,
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
  const files = [];

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

  return {
    manifest: {
      ...sourceManifest,
      files,
      totalBytes: files.reduce((total, file) => total + file.byteSize, 0),
    },
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
        expect.stringContaining("expected exactly 30 files, found 29"),
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
