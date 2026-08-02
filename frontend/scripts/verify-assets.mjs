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
const defaultWebGLManifestPath = path.join(
  defaultRepositoryRoot,
  "docs",
  "v2",
  "05-webgl-asset-manifest.json",
);

const EXPECTED_MANIFEST_DIGEST =
  "0799b42fe1b610aa92b8cae9dc7a1dabcc368b6602df6bed0c83263a8fe55018";
const EXPECTED_MANIFEST_DIGEST_ALGORITHM =
  "SHA-256 of sorted `shasum -a 256` lines rooted at frontend/public/assets/video";
const EXPECTED_FILE_COUNT = 30;
const PRODUCTION_MEDIA_PREFIX = "frontend/public/assets/video/";
const WEBGL_ASSET_COUNT = 10;
const REQUIRED_MODEL_NAMES = [
  "Bottle_Glass",
  "Wine_Liquid",
  "Cork",
  "Capsule",
  "Label_Front",
  "Label_Back",
  "Condensation",
];
const MODEL_BUDGETS_BYTES = {
  high: 2_500_000,
  standard: 1_200_000,
};
const webglAsset = ({ hasModelContract = false, ...asset }) => ({
  ...asset,
  maxByteSize: asset.maxByteSize ?? null,
  nodeNames: hasModelContract ? REQUIRED_MODEL_NAMES : [],
  geometryNames: hasModelContract ? REQUIRED_MODEL_NAMES : [],
  labelVariant: asset.labelVariant ?? null,
  copyStatus: "copied",
});
const approvedWebGLAssets = [
  webglAsset({
    assetPath:
      "frontend/public/assets/models/grapevyne-master-bottle.glb",
    sha256:
      "2304b4b89cc7a249527746c6b1f7ceb02759f6395a709b129e539941c885c05a",
    byteSize: 1_182_548,
    assetKind: "model",
    modelTier: "high",
    maxByteSize: MODEL_BUDGETS_BYTES.high,
    hasModelContract: true,
    sourceLocation:
      ".grapevyne-v2-reference/frontend/public/assets/models/grapevyne-master-bottle.glb",
  }),
  webglAsset({
    assetPath:
      "frontend/public/assets/models/grapevyne-master-bottle-mobile.glb",
    sha256:
      "1caa5eb4786326199f0f2b1fd4066590aaccda02a54da03e14bfba9bee10e3f8",
    byteSize: 1_115_844,
    assetKind: "model",
    modelTier: "standard",
    maxByteSize: MODEL_BUDGETS_BYTES.standard,
    hasModelContract: true,
    sourceLocation:
      ".grapevyne-v2-reference/frontend/public/assets/models/grapevyne-master-bottle-mobile.glb",
  }),
  webglAsset({
    assetPath: "frontend/public/assets/models/bottle-spec.json",
    sha256:
      "94573f075540f23594070997db39391a2eae992a8638378e2a491e99afe5ddaf",
    byteSize: 868,
    assetKind: "contract",
    modelTier: "all",
    sourceLocation:
      ".grapevyne-v2-reference/frontend/public/assets/models/bottle-spec.json",
  }),
  webglAsset({
    assetPath: "frontend/public/assets/models/model-validation.json",
    sha256:
      "deb4d10988c743bdf0a6b3cba8c06e9001e5f99d1a55d13491e2b283ea4c3bfd",
    byteSize: 835,
    assetKind: "contract",
    modelTier: "all",
    sourceLocation:
      ".grapevyne-v2-reference/frontend/public/assets/models/model-validation.json",
  }),
  webglAsset({
    assetPath:
      "frontend/public/assets/labels/grapevyne-label-front-red.png",
    sha256:
      "fc1e798888c59d1dc335a964309de8ddf570be68b509f47b0be396be244f4281",
    byteSize: 788_087,
    assetKind: "label",
    modelTier: "all",
    labelVariant: "red",
    sourceLocation:
      ".grapevyne-v2-reference/frontend/public/assets/labels/grapevyne-label-front-red.png",
  }),
  webglAsset({
    assetPath:
      "frontend/public/assets/labels/grapevyne-label-front-white.png",
    sha256:
      "543107978d3e46f5b60846c326079f4cae8481ebaa91994c051a77450ecfa4c3",
    byteSize: 789_205,
    assetKind: "label",
    modelTier: "all",
    labelVariant: "white",
    sourceLocation:
      ".grapevyne-v2-reference/frontend/public/assets/labels/grapevyne-label-front-white.png",
  }),
  webglAsset({
    assetPath:
      "frontend/public/assets/labels/grapevyne-label-front-sparkling.png",
    sha256:
      "79a159d2399734f60f6602dde705cfc279d31aa70cfc607538244f29b0eed3ce",
    byteSize: 830_486,
    assetKind: "label",
    modelTier: "all",
    labelVariant: "sparkling",
    sourceLocation:
      ".grapevyne-v2-reference/frontend/public/assets/labels/grapevyne-label-front-sparkling.png",
  }),
  webglAsset({
    assetPath:
      "frontend/public/assets/labels/grapevyne-label-front-rose.png",
    sha256:
      "6f4b8d61ec65a22d50c391ebe2fd1846b2651ad5f30e08f40dcb953e3a074e50",
    byteSize: 842_237,
    assetKind: "label",
    modelTier: "all",
    labelVariant: "rose",
    sourceLocation:
      ".grapevyne-v2-reference/frontend/public/assets/labels/grapevyne-label-front-rose.png",
  }),
  webglAsset({
    assetPath: "frontend/public/assets/labels/grapevyne-label-back.png",
    sha256:
      "d33586e7beeec7ef60d203a5bf74bbb8a39b9d30f21471549a6b2e7d32f791d3",
    byteSize: 290_856,
    assetKind: "label",
    modelTier: "all",
    labelVariant: "back",
    sourceLocation:
      ".grapevyne-v2-reference/frontend/public/assets/labels/grapevyne-label-back.png",
  }),
  webglAsset({
    assetPath:
      "frontend/public/assets/labels/grapevyne-label-neck-capsule.png",
    sha256:
      "63e056294a30643153444a8f33df805f715ba4a09cfeb39fe4156377cef5992e",
    byteSize: 98_787,
    assetKind: "label",
    modelTier: "all",
    labelVariant: "capsule",
    sourceLocation:
      ".grapevyne-v2-reference/frontend/public/assets/labels/grapevyne-label-neck-capsule.png",
  }),
];
const approvedWebGLPaths = new Set(
  approvedWebGLAssets.map((asset) => asset.assetPath),
);
const approvedModelPaths = new Set(
  approvedWebGLAssets
    .filter((asset) => asset.assetKind === "model")
    .map((asset) => asset.assetPath),
);
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

function sameStringArray(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function parseGlbContract(contents, displayPath = "GLB") {
  const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);

  if (buffer.byteLength < 20) {
    throw new Error(`${displayPath}: invalid GLB header`);
  }

  if (buffer.readUInt32LE(0) !== 0x46546c67) {
    throw new Error(`${displayPath}: invalid GLB magic`);
  }

  if (buffer.readUInt32LE(4) !== 2) {
    throw new Error(`${displayPath}: expected GLB version 2`);
  }

  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength !== buffer.byteLength) {
    throw new Error(
      `${displayPath}: declared GLB length ${declaredLength} does not equal ${buffer.byteLength}`,
    );
  }

  let offset = 12;
  let document;

  while (offset + 8 <= buffer.byteLength) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkEnd > buffer.byteLength) {
      throw new Error(`${displayPath}: invalid GLB chunk length`);
    }

    if (chunkType === 0x4e4f534a && document === undefined) {
      const json = buffer
        .subarray(chunkStart, chunkEnd)
        .toString("utf8")
        .trimEnd();
      document = JSON.parse(json);
    }

    offset = chunkEnd;
  }

  if (!document || typeof document !== "object") {
    throw new Error(`${displayPath}: missing GLB JSON chunk`);
  }

  return {
    nodeNames: Array.isArray(document.nodes)
      ? document.nodes
          .map((node) => node?.name)
          .filter((name) => typeof name === "string")
      : [],
    geometryNames: Array.isArray(document.meshes)
      ? document.meshes
          .map((mesh) => mesh?.name)
          .filter((name) => typeof name === "string")
      : [],
  };
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

function validateWebGLManifest(manifest, failures) {
  if (!manifest || typeof manifest !== "object") {
    failures.push("WebGL asset manifest: invalid JSON object");
    return approvedWebGLAssets;
  }

  if (manifest.schemaVersion !== 1) {
    failures.push("WebGL asset manifest: schemaVersion must be 1");
  }
  if (manifest.approvedAssetCount !== WEBGL_ASSET_COUNT) {
    failures.push(
      `WebGL asset manifest: approvedAssetCount must be ${WEBGL_ASSET_COUNT}`,
    );
  }
  if (!sameStringArray(manifest.requiredNodeNames, REQUIRED_MODEL_NAMES)) {
    failures.push("WebGL asset manifest: requiredNodeNames contract mismatch");
  }
  if (!sameStringArray(manifest.requiredGeometryNames, REQUIRED_MODEL_NAMES)) {
    failures.push("WebGL asset manifest: requiredGeometryNames contract mismatch");
  }
  if (
    !manifest.modelBudgetsBytes ||
    manifest.modelBudgetsBytes.high !== MODEL_BUDGETS_BYTES.high ||
    manifest.modelBudgetsBytes.standard !== MODEL_BUDGETS_BYTES.standard
  ) {
    failures.push("WebGL asset manifest: model byte budgets mismatch");
  }

  if (!Array.isArray(manifest.assets)) {
    failures.push("WebGL asset manifest: assets must be an array");
    return approvedWebGLAssets;
  }

  if (manifest.assets.length !== WEBGL_ASSET_COUNT) {
    failures.push(
      `WebGL asset manifest: expected ${WEBGL_ASSET_COUNT} entries, found ${manifest.assets.length}`,
    );
  }

  const manifestPaths = manifest.assets.map((asset) => asset?.assetPath);
  const uniqueManifestPaths = new Set(manifestPaths);
  if (uniqueManifestPaths.size !== manifestPaths.length) {
    failures.push("WebGL asset manifest: duplicate assetPath entry");
  }

  for (const asset of manifest.assets) {
    if (
      !asset ||
      typeof asset.assetPath !== "string" ||
      !approvedWebGLPaths.has(asset.assetPath)
    ) {
      failures.push(
        `WebGL asset manifest: unexpected asset path ${String(asset?.assetPath)}`,
      );
    }
  }

  for (const expected of approvedWebGLAssets) {
    const actual = manifest.assets.find(
      (asset) => asset?.assetPath === expected.assetPath,
    );

    if (!actual) {
      failures.push(`${expected.assetPath}: missing WebGL manifest entry`);
      continue;
    }

    for (const field of [
      "sha256",
      "byteSize",
      "assetKind",
      "modelTier",
      "maxByteSize",
      "labelVariant",
      "sourceLocation",
      "copyStatus",
    ]) {
      if (actual[field] !== expected[field]) {
        failures.push(
          `${expected.assetPath}: WebGL manifest ${field} mismatch`,
        );
      }
    }

    if (!sameStringArray(actual.nodeNames, expected.nodeNames)) {
      failures.push(
        `${expected.assetPath}: WebGL manifest nodeNames mismatch`,
      );
    }
    if (!sameStringArray(actual.geometryNames, expected.geometryNames)) {
      failures.push(
        `${expected.assetPath}: WebGL manifest geometryNames mismatch`,
      );
    }
  }

  return approvedWebGLAssets;
}

export async function loadFinalMediaManifest(
  manifestPath = defaultManifestPath,
) {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

export async function loadWebGLAssetManifest(
  manifestPath = defaultWebGLManifestPath,
) {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

export async function verifyAssets({
  manifest,
  webglManifest,
  repositoryRoot = defaultRepositoryRoot,
} = {}) {
  const failures = [];
  const frontendRoot = path.join(repositoryRoot, "frontend");
  const publicRoot = path.join(frontendRoot, "public");
  const videoRoot = path.join(publicRoot, "assets", "video");
  const modelRoot = path.join(publicRoot, "assets", "models");
  const resolvedManifest = manifest ?? (await loadFinalMediaManifest());
  const resolvedWebGLManifest =
    webglManifest ?? (await loadWebGLAssetManifest());
  const manifestFiles = validateManifest(resolvedManifest, failures);
  const webglAssets = validateWebGLManifest(
    resolvedWebGLManifest,
    failures,
  );
  const expectedPaths = new Set(expectedRepositoryPaths());
  let verifiedWebGLAssetCount = 0;

  for (const assetPath of foundationalAssets) {
    await validateRequiredFile(
      path.join(frontendRoot, assetPath),
      assetPath,
      failures,
    );
  }

  for (const asset of webglAssets) {
    const absolutePath = path.join(repositoryRoot, asset.assetPath);
    const fileStats = await validateRequiredFile(
      absolutePath,
      asset.assetPath,
      failures,
    );

    if (!fileStats?.isFile() || fileStats.size === 0) continue;
    verifiedWebGLAssetCount += 1;

    if (fileStats.size !== asset.byteSize) {
      failures.push(
        `${asset.assetPath}: byte size mismatch (expected ${asset.byteSize}, received ${fileStats.size})`,
      );
    }
    if (
      asset.maxByteSize !== null &&
      fileStats.size > asset.maxByteSize
    ) {
      failures.push(
        `${asset.assetPath}: exceeds ${asset.modelTier} model budget of ${asset.maxByteSize} bytes`,
      );
    }

    const actualHash = await sha256(absolutePath);
    if (actualHash !== asset.sha256) {
      failures.push(
        `${asset.assetPath}: SHA-256 mismatch (expected ${asset.sha256}, received ${actualHash})`,
      );
    }

    if (asset.assetKind === "model") {
      try {
        const contract = parseGlbContract(
          await readFile(absolutePath),
          asset.assetPath,
        );

        for (const requiredName of REQUIRED_MODEL_NAMES) {
          if (!contract.nodeNames.includes(requiredName)) {
            failures.push(
              `${asset.assetPath}: missing required GLB node ${requiredName}`,
            );
          }
          if (!contract.geometryNames.includes(requiredName)) {
            failures.push(
              `${asset.assetPath}: missing required GLB geometry ${requiredName}`,
            );
          }
        }
      } catch (error) {
        failures.push(
          error instanceof Error
            ? error.message
            : `${asset.assetPath}: unable to parse GLB JSON chunk`,
        );
      }
    }
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

  const modelFiles = await walk(modelRoot);
  for (const absolutePath of modelFiles) {
    const filePath = repositoryRelative(repositoryRoot, absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();

    if (
      (extension === ".glb" || extension === ".gltf") &&
      !approvedModelPaths.has(filePath)
    ) {
      failures.push(`${filePath}: unexpected GLB/GLTF model`);
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
      prohibitedOutsideMediaExtensions.has(extension) &&
      !approvedModelPaths.has(filePath)
    ) {
      failures.push(`${filePath}: prohibited media/model outside approved directory`);
    }
  }

  const sourceRoot = path.join(frontendRoot, "src");
  const sourceExtensions = new Set([
    ".css",
    ".html",
    ".js",
    ".jsx",
    ".mjs",
    ".ts",
    ".tsx",
  ]);
  for (const absolutePath of await walk(sourceRoot)) {
    if (!sourceExtensions.has(path.extname(absolutePath).toLowerCase())) {
      continue;
    }

    const filePath = repositoryRelative(repositoryRoot, absolutePath);
    const source = await readFile(absolutePath, "utf8");
    const remoteUrls = source.match(/https?:\/\/[^\s"'<>),\]}]+/giu) ?? [];

    for (const remoteUrl of remoteUrls) {
      if (/\.(?:glb|gltf)(?:[?#]|$)/iu.test(remoteUrl)) {
        failures.push(`${filePath}: remote model URL is prohibited`);
      }
      if (
        /\.(?:hdr|exr)(?:[?#]|$)/iu.test(remoteUrl) ||
        /\b(?:hdri|polyhaven)\b/iu.test(remoteUrl)
      ) {
        failures.push(`${filePath}: remote environment/HDRI URL is prohibited`);
      }
    }

    if (/<Environment\b[^>]*\bpreset\s*=/isu.test(source)) {
      failures.push(`${filePath}: remote Drei Environment preset is prohibited`);
    }
  }

  return {
    failures: [...new Set(failures)],
    foundationalAssetCount: foundationalAssets.length,
    productionMediaCount: actualMediaPaths.length,
    webglAssetCount: verifiedWebGLAssetCount,
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
    `Verified ${result.foundationalAssetCount} foundational assets, ${result.productionMediaCount} hash-locked final video/poster assets, and ${result.webglAssetCount} hash-locked WebGL assets.`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await runCli();
}
