import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultFrontendRoot = path.resolve(path.dirname(scriptPath), "..");
const defaultRepositoryRoot = path.resolve(defaultFrontendRoot, "..");
const defaultManifestPath = path.join(
  defaultRepositoryRoot,
  "docs",
  "v2",
  "04a-final-media-manifest.json",
);

const EXPECTED_MANIFEST_DIGEST =
  "0799b42fe1b610aa92b8cae9dc7a1dabcc368b6602df6bed0c83263a8fe55018";
const EXPECTED_MANIFEST_DIGEST_ALGORITHM =
  "SHA-256 of sorted `shasum -a 256` lines rooted at frontend/public/assets/video";
const EXPECTED_FILE_COUNT = 30;
const PRODUCTION_MEDIA_PREFIX = "frontend/public/assets/video/";
const sceneSlugs = {
  atlas: "taste-atlas-finale",
  cellar: "cellar-corridor-push",
  hero: "hero-bottle-macro",
  liquid: "taste-liquid-transition",
  memory: "memory-table-ambience",
};
const playbackRules = {
  atlas: "once",
  cellar: "once",
  hero: "loop",
  liquid: "loop",
  memory: "loop",
};
const devices = ["desktop", "mobile"];
const foundationalAssets = [
  "public/favicon.svg",
  "public/assets/brand/grapevyne-monogram.svg",
  "public/assets/brand/grapevyne-wordmark.svg",
];
const prohibitedPathPart =
  /prototype|preview|reel|source[-_.]?plate|source[-_.]?master|final[-_.]?masters|4k[-_.]?master/i;
const prohibitedOutsideMediaExtensions = new Set([
  ".avi",
  ".glb",
  ".gltf",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".webm",
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function repositoryRelative(repositoryRoot, filePath) {
  return toPosix(path.relative(repositoryRoot, filePath));
}

function expectedRepositoryPaths() {
  return Object.entries(sceneSlugs).flatMap(([, slug]) =>
    devices.flatMap((device) => [
      `frontend/public/assets/video/${device}/${slug}.${device}.mp4`,
      `frontend/public/assets/video/${device}/${slug}.${device}.webm`,
      `frontend/public/assets/video/posters/${device}/${slug}.${device}.jpg`,
    ]),
  );
}

async function walk(directory) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function approvedManifestDigest(files) {
  const checksumManifest = files
    .slice()
    .sort((left, right) =>
      left.relativeRepositoryPath.localeCompare(right.relativeRepositoryPath),
    )
    .map((file) => {
      const mediaRelativePath = file.relativeRepositoryPath.slice(
        PRODUCTION_MEDIA_PREFIX.length,
      );
      return `${file.sha256}  ./${mediaRelativePath}\n`;
    })
    .join("");

  return createHash("sha256").update(checksumManifest).digest("hex");
}

async function validateRequiredFile(filePath, displayPath, failures) {
  try {
    const file = await stat(filePath);

    if (!file.isFile()) {
      failures.push(`${displayPath}: not a file`);
      return undefined;
    }

    if (file.size === 0) {
      failures.push(`${displayPath}: empty`);
    }

    return file;
  } catch {
    failures.push(`${displayPath}: missing`);
    return undefined;
  }
}

function validateManifest(manifest, failures) {
  if (!manifest || typeof manifest !== "object") {
    failures.push("Final-media manifest: invalid JSON object");
    return [];
  }

  if (manifest.sourceManifestDigestSha256 !== EXPECTED_MANIFEST_DIGEST) {
    failures.push(
      `Final-media manifest: approved digest must be ${EXPECTED_MANIFEST_DIGEST}`,
    );
  }

  if (
    manifest.sourceManifestDigestAlgorithm !==
    EXPECTED_MANIFEST_DIGEST_ALGORITHM
  ) {
    failures.push(
      `Final-media manifest: digest algorithm must be ${EXPECTED_MANIFEST_DIGEST_ALGORITHM}`,
    );
  }

  if (manifest.expectedFileCount !== EXPECTED_FILE_COUNT) {
    failures.push(
      `Final-media manifest: expectedFileCount must be ${EXPECTED_FILE_COUNT}`,
    );
  }

  if (!Array.isArray(manifest.files)) {
    failures.push("Final-media manifest: files must be an array");
    return [];
  }

  if (manifest.files.length !== EXPECTED_FILE_COUNT) {
    failures.push(
      `Final-media manifest: expected ${EXPECTED_FILE_COUNT} entries, found ${manifest.files.length}`,
    );
  }

  const expectedPaths = new Set(expectedRepositoryPaths());
  const manifestPaths = manifest.files.map((file) => file.relativeRepositoryPath);
  const uniqueManifestPaths = new Set(manifestPaths);

  if (uniqueManifestPaths.size !== manifestPaths.length) {
    failures.push("Final-media manifest: duplicate relativeRepositoryPath entry");
  }

  for (const expectedPath of expectedPaths) {
    if (!uniqueManifestPaths.has(expectedPath)) {
      failures.push(`${expectedPath}: missing manifest entry`);
    }
  }

  for (const file of manifest.files) {
    const filePath = file.relativeRepositoryPath;

    if (typeof filePath !== "string" || !expectedPaths.has(filePath)) {
      failures.push(`${String(filePath)}: unexpected manifest path`);
      continue;
    }

    const expectedFilename = path.posix.basename(filePath);
    const slug = sceneSlugs[file.sceneId];
    const expectedDimensions =
      file.device === "mobile" ? [1080, 1920] : [1920, 1080];
    const expectedKind = filePath.endsWith(".mp4")
      ? "mp4"
      : filePath.endsWith(".webm")
        ? "webm"
        : "poster";
    const expectedType =
      expectedKind === "mp4"
        ? "video/mp4"
        : expectedKind === "webm"
          ? "video/webm"
          : "image/jpeg";

    if (file.filename !== expectedFilename) {
      failures.push(`${filePath}: filename metadata mismatch`);
    }
    if (!slug || !devices.includes(file.device)) {
      failures.push(`${filePath}: invalid scene or device metadata`);
      continue;
    }
    if (file.kind !== expectedKind || file.fileType !== expectedType) {
      failures.push(`${filePath}: file type metadata mismatch`);
    }

    const metadataPath =
      expectedKind === "poster"
        ? `${PRODUCTION_MEDIA_PREFIX}posters/${file.device}/${slug}.${file.device}.jpg`
        : `${PRODUCTION_MEDIA_PREFIX}${file.device}/${slug}.${file.device}.${expectedKind}`;
    if (filePath !== metadataPath) {
      failures.push(`${filePath}: path does not match scene/device/kind metadata`);
    }

    if (
      file.width !== expectedDimensions[0] ||
      file.height !== expectedDimensions[1]
    ) {
      failures.push(`${filePath}: approved dimensions metadata mismatch`);
    }
    if (file.requiredPlaybackMode !== playbackRules[file.sceneId]) {
      failures.push(`${filePath}: playback metadata mismatch`);
    }
    if (!Number.isInteger(file.byteSize) || file.byteSize <= 0) {
      failures.push(`${filePath}: invalid byteSize metadata`);
    }
    if (!/^[a-f0-9]{64}$/.test(file.sha256)) {
      failures.push(`${filePath}: invalid SHA-256 metadata`);
    }
    if (prohibitedPathPart.test(filePath)) {
      failures.push(`${filePath}: prohibited production filename`);
    }

    if (file.hasAudio !== false) {
      failures.push(`${filePath}: hasAudio metadata must be false`);
    }

    if (expectedKind === "poster") {
      if (
        file.durationSeconds !== null ||
        file.frameRate !== null ||
        file.videoCodec !== null ||
        file.pixelFormat !== "yuvj420p" ||
        file.colorPrimaries !== null ||
        file.transferCharacteristics !== null ||
        file.matrixCoefficients !== "bt470bg" ||
        file.colorRange !== "pc"
      ) {
        failures.push(`${filePath}: approved poster probe metadata mismatch`);
      }
    } else {
      const expectedCodec = expectedKind === "mp4" ? "h264" : "vp9";

      if (
        typeof file.durationSeconds !== "number" ||
        file.durationSeconds <= 0 ||
        file.frameRate !== "24/1" ||
        file.videoCodec !== expectedCodec ||
        file.pixelFormat !== "yuv420p" ||
        file.colorPrimaries !== "bt709" ||
        file.transferCharacteristics !== "bt709" ||
        file.matrixCoefficients !== "bt709" ||
        file.colorRange !== "tv"
      ) {
        failures.push(`${filePath}: approved video probe metadata mismatch`);
      }
    }

    const expectedPoster = `frontend/public/assets/video/posters/${file.device}/${slug}.${file.device}.jpg`;
    const expectedFallback = `frontend/public/assets/video/${file.device}/${slug}.${file.device}.mp4`;
    if (file.pairedPosterPath !== expectedPoster) {
      failures.push(`${filePath}: paired poster metadata mismatch`);
    }
    if (file.pairedFallbackVideoPath !== expectedFallback) {
      failures.push(`${filePath}: paired fallback metadata mismatch`);
    }
  }

  if (
    manifest.files.length === EXPECTED_FILE_COUNT &&
    manifest.files.every(
      (file) =>
        typeof file.relativeRepositoryPath === "string" &&
        file.relativeRepositoryPath.startsWith(PRODUCTION_MEDIA_PREFIX) &&
        typeof file.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(file.sha256),
    )
  ) {
    const digest = approvedManifestDigest(manifest.files);

    if (digest !== EXPECTED_MANIFEST_DIGEST) {
      failures.push(
        `Final-media manifest: SHA-256 table digest mismatch (expected ${EXPECTED_MANIFEST_DIGEST}, received ${digest})`,
      );
    }
  }

  const manifestBytes = manifest.files.reduce(
    (total, file) => total + (Number.isInteger(file.byteSize) ? file.byteSize : 0),
    0,
  );
  if (manifest.totalBytes !== manifestBytes) {
    failures.push(
      `Final-media manifest: totalBytes ${manifest.totalBytes} does not equal ${manifestBytes}`,
    );
  }

  return manifest.files;
}

export async function loadFinalMediaManifest(
  manifestPath = defaultManifestPath,
) {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

export async function verifyAssets({
  manifest,
  repositoryRoot = defaultRepositoryRoot,
} = {}) {
  const failures = [];
  const frontendRoot = path.join(repositoryRoot, "frontend");
  const publicRoot = path.join(frontendRoot, "public");
  const videoRoot = path.join(publicRoot, "assets", "video");
  const resolvedManifest = manifest ?? (await loadFinalMediaManifest());
  const manifestFiles = validateManifest(resolvedManifest, failures);
  const expectedPaths = new Set(expectedRepositoryPaths());

  for (const assetPath of foundationalAssets) {
    await validateRequiredFile(
      path.join(frontendRoot, assetPath),
      assetPath,
      failures,
    );
  }

  for (const file of manifestFiles) {
    if (!expectedPaths.has(file.relativeRepositoryPath)) continue;

    const absolutePath = path.join(repositoryRoot, file.relativeRepositoryPath);
    const fileStats = await validateRequiredFile(
      absolutePath,
      file.relativeRepositoryPath,
      failures,
    );

    if (!fileStats?.isFile() || fileStats.size === 0) continue;

    if (fileStats.size !== file.byteSize) {
      failures.push(
        `${file.relativeRepositoryPath}: byte size mismatch (expected ${file.byteSize}, received ${fileStats.size})`,
      );
    }

    const actualHash = await sha256(absolutePath);
    if (actualHash !== file.sha256) {
      failures.push(
        `${file.relativeRepositoryPath}: SHA-256 mismatch (expected ${file.sha256}, received ${actualHash})`,
      );
    }
  }

  const actualMediaFiles = await walk(videoRoot);
  const actualMediaPaths = actualMediaFiles.map((filePath) =>
    repositoryRelative(repositoryRoot, filePath),
  );

  if (actualMediaPaths.length !== EXPECTED_FILE_COUNT) {
    failures.push(
      `frontend/public/assets/video: expected exactly ${EXPECTED_FILE_COUNT} files, found ${actualMediaPaths.length}`,
    );
  }

  for (const filePath of actualMediaPaths) {
    if (!expectedPaths.has(filePath)) {
      failures.push(`${filePath}: unexpected production-media file`);
    }
    if (prohibitedPathPart.test(filePath)) {
      failures.push(`${filePath}: prohibited production filename`);
    }
  }

  const publicFiles = await walk(publicRoot);
  for (const absolutePath of publicFiles) {
    const filePath = repositoryRelative(repositoryRoot, absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();

    if (prohibitedPathPart.test(filePath)) {
      failures.push(`${filePath}: prohibited source/prototype/master path`);
    }

    if (
      !absolutePath.startsWith(`${videoRoot}${path.sep}`) &&
      prohibitedOutsideMediaExtensions.has(extension)
    ) {
      failures.push(`${filePath}: prohibited media/model outside approved directory`);
    }
  }

  return {
    failures: [...new Set(failures)],
    foundationalAssetCount: foundationalAssets.length,
    productionMediaCount: actualMediaPaths.length,
  };
}

async function runCli() {
  let result;

  try {
    result = await verifyAssets();
  } catch (error) {
    console.error(
      `Asset verification failed:\n${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return;
  }

  if (result.failures.length > 0) {
    console.error(`Asset verification failed:\n${result.failures.join("\n")}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Verified ${result.foundationalAssetCount} foundational assets and ${result.productionMediaCount} hash-locked final video/poster assets.`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await runCli();
}
