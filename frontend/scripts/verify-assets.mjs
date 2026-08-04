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
const defaultStoryMediaManifestPath = path.join(
  defaultRepositoryRoot,
  "docs",
  "v2",
  "10a1-story-media-manifest.json",
);
const defaultMeshyModelManifestPath = path.join(
  defaultRepositoryRoot,
  "docs",
  "v2",
  "10a1-meshy-model-manifest.json",
);

const EXPECTED_MANIFEST_DIGEST =
  "0799b42fe1b610aa92b8cae9dc7a1dabcc368b6602df6bed0c83263a8fe55018";
const EXPECTED_MANIFEST_DIGEST_ALGORITHM =
  "SHA-256 of sorted `shasum -a 256` lines rooted at frontend/public/assets/video";
const EXPECTED_FILE_COUNT = 30;
const PRODUCTION_MEDIA_PREFIX = "frontend/public/assets/video/";
const STORY_MEDIA_FILE_COUNT = 44;
const STORY_MEDIA_DIGEST =
  "e69b316c7893d163d7cc20873357c2b6bdeb92347c097e19aa354391dd63f4c3";
const ACCEPTED_MEDIA_MANIFEST_PATH = "docs/v2/04a-final-media-manifest.json";
const ACCEPTED_MEDIA_MANIFEST_SHA256 =
  "8b71076ad992c3301099601dd34225d98e6b5e19404cab5cb43b0ea81adc9621";
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
const storyScenes = [
  {
    storyChapterKey: "hero",
    mediaKey: "hero",
    sceneId: "hero",
    slug: "hero-bottle-macro",
    sourceClass: "accepted-scrub-derivative",
  },
  {
    storyChapterKey: "discovery",
    mediaKey: "vineyard",
    sceneId: "vineyard",
    slug: "vineyard-flight",
    sourceClass: "new-story-master",
  },
  {
    storyChapterKey: "match",
    mediaKey: "dateNight",
    sceneId: "dateNight",
    slug: "date-night-table-pan",
    sourceClass: "new-story-master",
  },
  {
    storyChapterKey: "taste",
    mediaKey: "liquid",
    sceneId: "liquid",
    slug: "taste-liquid-transition",
    sourceClass: "accepted-scrub-derivative",
  },
  {
    storyChapterKey: "portal",
    mediaKey: "cellar",
    sceneId: "cellar",
    slug: "cellar-corridor-push",
    sourceClass: "accepted-scrub-derivative",
  },
  {
    storyChapterKey: "cellar",
    mediaKey: "barrelHouse",
    sceneId: "barrelHouse",
    slug: "barrel-house-pan",
    sourceClass: "new-story-master",
  },
  {
    storyChapterKey: "memory",
    mediaKey: "memory",
    sceneId: "memory",
    slug: "memory-table-ambience",
    sourceClass: "accepted-scrub-derivative",
  },
  {
    storyChapterKey: "atlas",
    mediaKey: "atlas",
    sceneId: "atlas",
    slug: "taste-atlas-finale",
    sourceClass: "accepted-scrub-derivative",
  },
  {
    storyChapterKey: "finale",
    mediaKey: "oceanVoyage",
    sceneId: "oceanVoyage",
    slug: "ocean-wine-voyage",
    sourceClass: "new-story-master",
  },
];
const lockedStorySubjects = [
  ["hero", "bottle"],
  ["discovery", "grapes"],
  ["match", "none"],
  ["taste", "none"],
  ["portal", "bottle"],
  ["cellar", "none"],
  ["memory", "none"],
  ["atlas", "bottle"],
  ["finale", "none"],
];
const expectedSourceMasters = [
  [
    "barrel-house-pan.desktop.mp4",
    45_162_789,
    "4fb3b8007c717cc523d7ff05b67a2320bbf3deb7740f07b5a7081466be716f1c",
  ],
  [
    "barrel-house-pan.mobile.mp4",
    51_760_862,
    "608b1a14676310a3b188e429a003bd8462423c4095de9e61b6d943cee86c633f",
  ],
  [
    "date-night-table-pan.desktop.mp4",
    39_172_041,
    "00a5369caecad13064f76ac4b9db69c70ee6d619992053416b6224db7e4e0c58",
  ],
  [
    "date-night-table-pan.mobile.mp4",
    30_514_260,
    "7f02b4937b38b0293dd68f26d1d0fcbf7ee40d67e85fedba698e6be65a4e49ca",
  ],
  [
    "ocean-wine-voyage.desktop.mp4",
    54_887_383,
    "2c5d2f7fff73af12e98fa04e7622a373be223f57d3a018676638f9e9ef9a46b2",
  ],
  [
    "ocean-wine-voyage.mobile.mp4",
    53_660_634,
    "2998303d23907d07d7b73264aeb347069e444c6d2b1d82647779271dba5655c2",
  ],
  [
    "vineyard-flight.desktop.mp4",
    52_508_118,
    "50a054aa95dfc0b59f53da1d89fb3435467d7f592fda598b9c89b0bf0dfe6672",
  ],
  [
    "vineyard-flight.mobile.mp4",
    43_190_827,
    "9b0cb2595ebe1aa74628dcc4c71a7be214f5297f191f70b5e239919337a4348a",
  ],
];
const MESHY_MODEL_DIGEST =
  "5f3b537986d932fb9b03369e310c9f7d6fea8d81432187858f9e40149c93bd47";
const meshyModelAssets = [
  {
    subject: "bottle",
    tier: "desktop",
    assetPath:
      "frontend/public/assets/models/grapevyne-meshy-bottle.desktop.glb",
    publicUrl: "/assets/models/grapevyne-meshy-bottle.desktop.glb",
    sha256:
      "e3a78c10bf6b6253e552a77484656d267397521f54de1c57b6afcf337165165f",
    byteSize: 3_954_456,
    targetBudget: 6_291_456,
    hardBudget: 8_388_608,
  },
  {
    subject: "bottle",
    tier: "mobile",
    assetPath:
      "frontend/public/assets/models/grapevyne-meshy-bottle.mobile.glb",
    publicUrl: "/assets/models/grapevyne-meshy-bottle.mobile.glb",
    sha256:
      "70ef18a4fd8d6ddbd20a2f84e3600a42708e1dd566ec991a2d5e668727147e25",
    byteSize: 881_628,
    targetBudget: 3_145_728,
    hardBudget: 4_194_304,
  },
  {
    subject: "grape",
    tier: "desktop",
    assetPath:
      "frontend/public/assets/models/grapevyne-meshy-grapes.desktop.glb",
    publicUrl: "/assets/models/grapevyne-meshy-grapes.desktop.glb",
    sha256:
      "2b6b475803ff1fd72d01afd6f912ba0acd558d2d668a3c5dcf18d4d280dedbb6",
    byteSize: 8_187_568,
    targetBudget: 8_388_608,
    hardBudget: 10_485_760,
  },
  {
    subject: "grape",
    tier: "mobile",
    assetPath:
      "frontend/public/assets/models/grapevyne-meshy-grapes.mobile.glb",
    publicUrl: "/assets/models/grapevyne-meshy-grapes.mobile.glb",
    sha256:
      "cccac924677f6114cca2276b859ef967e055d3eafe6ed73521fb2b7a9c3ae489",
    byteSize: 1_890_584,
    targetBudget: 4_194_304,
    hardBudget: 5_242_880,
  },
];
const meshyModelPaths = new Set(
  meshyModelAssets.map((asset) => asset.assetPath),
);
const GRAPE_FALLBACK = {
  assetPath:
    "frontend/public/assets/models/fallbacks/grapevyne-meshy-grapes.png",
  publicUrl: "/assets/models/fallbacks/grapevyne-meshy-grapes.png",
  sha256:
    "8e8c3f07d22604051a208e219d68168a9c9cf747cc01c345238cefd4b285a4d8",
  byteSize: 297_864,
  width: 1_024,
  height: 1_200,
};
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
  /prototype|preview|reel|reference|(?:^|[/_.-])source(?:[/_.-]|$)|source[-_.]?plate|source[-_.]?master|final[-_.]?masters|4k[-_.]?master/i;
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

function expectedStoryMediaRecords() {
  return storyScenes.flatMap((scene) => {
    const base = devices.flatMap((device) => {
      if (scene.sourceClass === "accepted-scrub-derivative") {
        return ["mp4", "webm"].map((kind) => ({
          ...scene,
          assetRole: "accepted-scene-scrub-derivative",
          device,
          kind,
          relativeRepositoryPath:
            `${PRODUCTION_MEDIA_PREFIX}scrub/${device}/${scene.slug}.${device}.${kind}`,
        }));
      }

      return ["mp4", "webm", "poster"].map((kind) => ({
        ...scene,
        assetRole:
          kind === "poster"
            ? "new-story-scene-poster"
            : "new-story-scene-video",
        device,
        kind,
        relativeRepositoryPath:
          kind === "poster"
            ? `${PRODUCTION_MEDIA_PREFIX}posters/${device}/${scene.slug}.${device}.jpg`
            : `${PRODUCTION_MEDIA_PREFIX}${device}/${scene.slug}.${device}.${kind}`,
      }));
    });

    return base;
  });
}

const expectedStoryRecords = expectedStoryMediaRecords();
const expectedStoryPaths = new Set(
  expectedStoryRecords.map((record) => record.relativeRepositoryPath),
);
const expectedAllMediaPaths = new Set([
  ...expectedRepositoryPaths(),
  ...expectedStoryPaths,
]);

function payloadDigest(files, pathField) {
  const checksumManifest = files
    .map((file) => `${file.sha256}  ${file[pathField]}\n`)
    .sort()
    .join("");

  return createHash("sha256").update(checksumManifest).digest("hex");
}

function meshyManifestDigest(assets) {
  return payloadDigest(
    assets.map((asset) => asset.production),
    "assetPath",
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

  const externalUris = [
    ...(Array.isArray(document.buffers) ? document.buffers : []),
    ...(Array.isArray(document.images) ? document.images : []),
  ]
    .map((resource) => resource?.uri)
    .filter((uri) => typeof uri === "string");
  const primitiveAttributes = Array.isArray(document.meshes)
    ? document.meshes.flatMap((mesh) =>
        Array.isArray(mesh?.primitives)
          ? mesh.primitives.map((primitive) =>
              Object.keys(primitive?.attributes ?? {}),
            )
          : [],
      )
    : [];

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
    animationCount: Array.isArray(document.animations)
      ? document.animations.length
      : 0,
    externalUris,
    extensionsRequired: Array.isArray(document.extensionsRequired)
      ? document.extensionsRequired
      : [],
    extensionsUsed: Array.isArray(document.extensionsUsed)
      ? document.extensionsUsed
      : [],
    imageMimeTypes: Array.isArray(document.images)
      ? document.images.map((image) => image?.mimeType)
      : [],
    materialContracts: Array.isArray(document.materials)
      ? document.materials.map((material) => ({
          alphaMode: material?.alphaMode ?? "OPAQUE",
          doubleSided: material?.doubleSided === true,
        }))
      : [],
    materialCount: Array.isArray(document.materials)
      ? document.materials.length
      : 0,
    meshCount: Array.isArray(document.meshes) ? document.meshes.length : 0,
    nodeCount: Array.isArray(document.nodes) ? document.nodes.length : 0,
    primitiveAttributes,
    primitiveModes: Array.isArray(document.meshes)
      ? document.meshes.flatMap((mesh) =>
          Array.isArray(mesh?.primitives)
            ? mesh.primitives.map((primitive) => primitive?.mode ?? 4)
            : [],
        )
      : [],
    sceneCount: Array.isArray(document.scenes) ? document.scenes.length : 0,
  };
}

export function parsePngContract(contents, displayPath = "PNG") {
  const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  if (buffer.byteLength < 33 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error(`${displayPath}: invalid PNG signature`);
  }
  if (buffer.readUInt32BE(8) !== 13 || buffer.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`${displayPath}: missing PNG IHDR`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer.readUInt8(24),
    colorType: buffer.readUInt8(25),
  };
}

export function parseStorySubjectMap(source, displayPath = "storyChapters.ts") {
  const marker = "export const STORY_CHAPTERS";
  const markerIndex = source.indexOf(marker);
  const arrayStart = source.indexOf("[", markerIndex);

  if (markerIndex < 0 || arrayStart < 0) {
    throw new Error(`${displayPath}: missing STORY_CHAPTERS array`);
  }

  const chapterObjects = [];
  let depth = 0;
  let objectStart = -1;
  let quote = null;
  let escaped = false;

  for (let index = arrayStart + 1; index < source.length; index += 1) {
    const character = source[index];

    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") {
      if (depth === 0) objectStart = index;
      depth += 1;
      continue;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        chapterObjects.push(source.slice(objectStart, index + 1));
        objectStart = -1;
      }
      continue;
    }
    if (character === "]" && depth === 0) break;
  }

  return chapterObjects.map((chapter, index) => {
    const key = chapter.match(/\bkey\s*:\s*["']([^"']+)["']/u)?.[1];
    const subject = chapter.match(/\bsubject\s*:\s*["']([^"']+)["']/u)?.[1];

    if (!key || !subject) {
      throw new Error(
        `${displayPath}: chapter ${index + 1} is missing a literal key or subject`,
      );
    }

    return [key, subject];
  });
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

function validateStoryMediaManifest(manifest, failures) {
  const label = "Prompt 10A1 story-media manifest";

  if (!manifest || typeof manifest !== "object") {
    failures.push(`${label}: invalid JSON object`);
    return [];
  }
  if (manifest.schemaVersion !== 1 || manifest.phase !== "10A1R") {
    failures.push(`${label}: schemaVersion/phase contract mismatch`);
  }
  if (
    manifest.manifestMode !== "additive" ||
    manifest.productionRoot !== "frontend/public/assets/video"
  ) {
    failures.push(`${label}: additive production-root contract mismatch`);
  }

  const scope = manifest.scope;
  if (
    !scope ||
    scope.newStoryScenes !== 4 ||
    scope.newStorySceneVariants !== 8 ||
    scope.newStorySceneVideos !== 16 ||
    scope.newStoryScenePosters !== 8 ||
    scope.acceptedSceneScrubVideos !== 20 ||
    scope.totalNewFiles !== STORY_MEDIA_FILE_COUNT ||
    scope.sha256OfSortedPayloadHashLines !== STORY_MEDIA_DIGEST
  ) {
    failures.push(`${label}: scope contract mismatch`);
  }

  const preservation = manifest.acceptedMediaPreservation;
  if (
    !preservation ||
    preservation.authoritativeManifestPath !== ACCEPTED_MEDIA_MANIFEST_PATH ||
    preservation.authoritativeManifestSha256 !==
      ACCEPTED_MEDIA_MANIFEST_SHA256 ||
    preservation.authoritativeSourceTreeDigestSha256 !==
      EXPECTED_MANIFEST_DIGEST ||
    preservation.expectedFileCount !== EXPECTED_FILE_COUNT ||
    preservation.checkedFileCount !== EXPECTED_FILE_COUNT ||
    preservation.allHashesMatch !== true ||
    preservation.existingProductionFilesOverwritten !== false
  ) {
    failures.push(`${label}: accepted Prompt 04A preservation contract mismatch`);
  }

  const scrub = manifest.scrubContract;
  if (
    !scrub ||
    scrub.frameRate !== "24/1" ||
    scrub.framesPerSecond !== 24 ||
    scrub.gopFrames !== 6 ||
    scrub.maximumKeyframeIntervalSeconds !== 0.25 ||
    scrub.firstFrameIsKeyframe !== true ||
    scrub.finalFrameIsKeyframe !== true ||
    scrub.sceneCutKeyframesDisabled !== true ||
    scrub.openGopDisabledForH264 !== true ||
    scrub.shared?.pixelFormat !== "yuv420p" ||
    scrub.shared?.colorPrimaries !== "bt709" ||
    scrub.shared?.transferCharacteristics !== "bt709" ||
    scrub.shared?.matrixCoefficients !== "bt709" ||
    scrub.shared?.colorRange !== "tv" ||
    scrub.shared?.audio !== "none"
  ) {
    failures.push(`${label}: scroll-scrub encoding contract mismatch`);
  }

  if (!Array.isArray(manifest.sceneRouting)) {
    failures.push(`${label}: sceneRouting must be an array`);
  } else if (
    manifest.sceneRouting.length !== storyScenes.length ||
    storyScenes.some((expected, index) => {
      const actual = manifest.sceneRouting[index];
      return Object.entries(expected).some(
        ([field, value]) => actual?.[field] !== value,
      );
    })
  ) {
    failures.push(`${label}: scene routing contract mismatch`);
  }

  if (!Array.isArray(manifest.sourceMasters)) {
    failures.push(`${label}: sourceMasters must be an array`);
  } else if (
    manifest.sourceMasters.length !== expectedSourceMasters.length ||
    expectedSourceMasters.some(([filename, byteSize, digest]) => {
      const actual = manifest.sourceMasters.find(
        (source) => source?.filename === filename,
      );
      return (
        !actual ||
        actual.byteSize !== byteSize ||
        actual.sha256 !== digest ||
        actual.preservedByteForByte !== true
      );
    })
  ) {
    failures.push(`${label}: source-master provenance contract mismatch`);
  }

  if (!Array.isArray(manifest.files)) {
    failures.push(`${label}: files must be an array`);
    return [];
  }
  if (manifest.files.length !== STORY_MEDIA_FILE_COUNT) {
    failures.push(
      `${label}: expected ${STORY_MEDIA_FILE_COUNT} entries, found ${manifest.files.length}`,
    );
  }

  const manifestPaths = manifest.files.map(
    (file) => file?.relativeRepositoryPath,
  );
  if (new Set(manifestPaths).size !== manifestPaths.length) {
    failures.push(`${label}: duplicate relativeRepositoryPath entry`);
  }

  for (const expected of expectedStoryRecords) {
    const file = manifest.files.find(
      (candidate) =>
        candidate?.relativeRepositoryPath === expected.relativeRepositoryPath,
    );

    if (!file) {
      failures.push(
        `${expected.relativeRepositoryPath}: missing Prompt 10A1 manifest entry`,
      );
      continue;
    }

    const expectedFilename = path.posix.basename(
      expected.relativeRepositoryPath,
    );
    const expectedFileType =
      expected.kind === "mp4"
        ? "video/mp4"
        : expected.kind === "webm"
          ? "video/webm"
          : "image/jpeg";
    const expectedDimensions =
      expected.device === "mobile" ? [1080, 1920] : [1920, 1080];
    const expectedPoster =
      `${PRODUCTION_MEDIA_PREFIX}posters/${expected.device}/${expected.slug}.${expected.device}.jpg`;
    const expectedFallback =
      expected.sourceClass === "accepted-scrub-derivative"
        ? `${PRODUCTION_MEDIA_PREFIX}scrub/${expected.device}/${expected.slug}.${expected.device}.mp4`
        : `${PRODUCTION_MEDIA_PREFIX}${expected.device}/${expected.slug}.${expected.device}.mp4`;
    const expectedWebm =
      expected.sourceClass === "accepted-scrub-derivative"
        ? `${PRODUCTION_MEDIA_PREFIX}scrub/${expected.device}/${expected.slug}.${expected.device}.webm`
        : `${PRODUCTION_MEDIA_PREFIX}${expected.device}/${expected.slug}.${expected.device}.webm`;

    for (const [field, value] of Object.entries({
      assetRole: expected.assetRole,
      device: expected.device,
      fileType: expectedFileType,
      filename: expectedFilename,
      kind: expected.kind,
      mediaKey: expected.mediaKey,
      playbackMode:
        expected.kind === "poster" ? "fallback-poster" : "scroll-scrub",
      sceneId: expected.sceneId,
      storyChapterKey: expected.storyChapterKey,
    })) {
      if (file[field] !== value) {
        failures.push(
          `${expected.relativeRepositoryPath}: ${field} metadata mismatch`,
        );
      }
    }

    if (
      file.pairedPosterPath !== expectedPoster ||
      file.pairedFallbackVideoPath !== expectedFallback ||
      file.pairedWebmPath !== expectedWebm
    ) {
      failures.push(
        `${expected.relativeRepositoryPath}: paired-media metadata mismatch`,
      );
    }
    if (!Number.isInteger(file.byteSize) || file.byteSize <= 0) {
      failures.push(`${expected.relativeRepositoryPath}: invalid byteSize metadata`);
    }
    if (!/^[a-f0-9]{64}$/u.test(file.sha256)) {
      failures.push(`${expected.relativeRepositoryPath}: invalid SHA-256 metadata`);
    }

    const probe = file.probe;
    if (
      !probe ||
      probe.width !== expectedDimensions[0] ||
      probe.height !== expectedDimensions[1] ||
      probe.hasAudio !== false
    ) {
      failures.push(
        `${expected.relativeRepositoryPath}: dimensions/audio probe mismatch`,
      );
      continue;
    }

    if (expected.kind === "poster") {
      if (
        probe.durationSeconds !== null ||
        probe.frameRate !== null ||
        probe.codec !== "mjpeg" ||
        probe.pixelFormat !== "yuvj420p" ||
        probe.frameCount !== 1
      ) {
        failures.push(
          `${expected.relativeRepositoryPath}: poster probe metadata mismatch`,
        );
      }
      continue;
    }

    if (
      typeof probe.durationSeconds !== "number" ||
      probe.durationSeconds <= 0 ||
      probe.frameRate !== "24/1" ||
      probe.codec !== (expected.kind === "mp4" ? "h264" : "vp9") ||
      probe.pixelFormat !== "yuv420p" ||
      probe.colorPrimaries !== "bt709" ||
      probe.transferCharacteristics !== "bt709" ||
      probe.matrixCoefficients !== "bt709" ||
      probe.colorRange !== "tv" ||
      !Number.isInteger(probe.frameCount) ||
      probe.frameCount <= 0 ||
      probe.firstKeyframeFrame !== 0 ||
      probe.lastKeyframeFrame !== probe.frameCount - 1 ||
      probe.maxKeyframeGapFrames > 6 ||
      probe.maxKeyframeGapSeconds > 0.25 ||
      probe.keyframesAtEverySixthFrame !== true ||
      (expected.kind === "mp4" && probe.fastStart !== true) ||
      (expected.kind === "webm" && probe.fastStart !== null)
    ) {
      failures.push(
        `${expected.relativeRepositoryPath}: scroll-scrub probe metadata mismatch`,
      );
    }
  }

  for (const filePath of manifestPaths) {
    if (typeof filePath !== "string" || !expectedStoryPaths.has(filePath)) {
      failures.push(`${String(filePath)}: unexpected Prompt 10A1 manifest path`);
    }
    if (typeof filePath === "string" && prohibitedPathPart.test(filePath)) {
      failures.push(`${filePath}: prohibited production filename`);
    }
  }

  if (
    manifest.files.length === STORY_MEDIA_FILE_COUNT &&
    manifest.files.every(
      (file) =>
        typeof file?.relativeRepositoryPath === "string" &&
        typeof file?.sha256 === "string" &&
        /^[a-f0-9]{64}$/u.test(file.sha256),
    )
  ) {
    const digest = payloadDigest(manifest.files, "relativeRepositoryPath");
    if (digest !== STORY_MEDIA_DIGEST) {
      failures.push(
        `${label}: SHA-256 table digest mismatch (expected ${STORY_MEDIA_DIGEST}, received ${digest})`,
      );
    }
  }

  const totalBytes = manifest.files.reduce(
    (total, file) => total + (Number.isInteger(file?.byteSize) ? file.byteSize : 0),
    0,
  );
  if (scope?.totalNewBytes !== totalBytes) {
    failures.push(
      `${label}: totalNewBytes ${scope?.totalNewBytes} does not equal ${totalBytes}`,
    );
  }

  return manifest.files;
}

function validateMeshyModelManifest(manifest, failures) {
  const label = "Prompt 10A1 Meshy-model manifest";

  if (!manifest || typeof manifest !== "object") {
    failures.push(`${label}: invalid JSON object`);
    return;
  }
  if (
    manifest.schemaVersion !== 1 ||
    manifest.phase !== "10A1R" ||
    manifest.assetCount !== meshyModelAssets.length
  ) {
    failures.push(`${label}: schemaVersion/phase/count contract mismatch`);
  }
  if (!Array.isArray(manifest.assets)) {
    failures.push(`${label}: assets must be an array`);
    return;
  }
  if (manifest.assets.length !== meshyModelAssets.length) {
    failures.push(
      `${label}: expected ${meshyModelAssets.length} entries, found ${manifest.assets.length}`,
    );
  }

  const manifestPaths = manifest.assets.map(
    (asset) => asset?.production?.assetPath,
  );
  if (new Set(manifestPaths).size !== manifestPaths.length) {
    failures.push(`${label}: duplicate production assetPath entry`);
  }

  for (const expected of meshyModelAssets) {
    const asset = manifest.assets.find(
      (candidate) => candidate?.production?.assetPath === expected.assetPath,
    );
    if (!asset) {
      failures.push(`${expected.assetPath}: missing Meshy manifest entry`);
      continue;
    }

    const production = asset.production;
    if (asset.subject !== expected.subject || asset.tier !== expected.tier) {
      failures.push(`${expected.assetPath}: subject/tier metadata mismatch`);
    }
    for (const field of ["publicUrl", "sha256", "byteSize"]) {
      if (production[field] !== expected[field]) {
        failures.push(`${expected.assetPath}: production ${field} mismatch`);
      }
    }
    if (
      production.targetBudgetPassed !== true ||
      production.hardBudgetPassed !== true ||
      production.byteSize > expected.targetBudget ||
      production.byteSize > expected.hardBudget
    ) {
      failures.push(`${expected.assetPath}: model budget metadata mismatch`);
    }
    if (
      !sameStringArray(production.attributes, [
        "POSITION",
        "NORMAL",
        "TEXCOORD_0",
        "TANGENT",
      ]) ||
      !Array.isArray(production.externalUris) ||
      production.externalUris.length !== 0 ||
      !production.validator ||
      Object.values(production.validator).some((value) => value !== 0) ||
      !Array.isArray(production.textures) ||
      production.textures.length !== 3 ||
      production.textures.some(
        (texture) => texture?.mimeType !== "image/webp",
      )
    ) {
      failures.push(`${expected.assetPath}: runtime model metadata mismatch`);
    }
  }

  for (const filePath of manifestPaths) {
    if (typeof filePath !== "string" || !meshyModelPaths.has(filePath)) {
      failures.push(`${String(filePath)}: unexpected Meshy manifest path`);
    }
  }

  if (
    manifest.assets.length === meshyModelAssets.length &&
    manifest.assets.every(
      (asset) =>
        typeof asset?.production?.assetPath === "string" &&
        typeof asset?.production?.sha256 === "string",
    )
  ) {
    const digest = meshyManifestDigest(manifest.assets);
    if (
      digest !== MESHY_MODEL_DIGEST ||
      manifest.aggregateSha256 !== MESHY_MODEL_DIGEST
    ) {
      failures.push(`${label}: aggregate SHA-256 contract mismatch`);
    }
  }

  const totalBytes = manifest.assets.reduce(
    (total, asset) =>
      total +
      (Number.isInteger(asset?.production?.byteSize)
        ? asset.production.byteSize
        : 0),
    0,
  );
  if (manifest.totalProductionBytes !== totalBytes) {
    failures.push(
      `${label}: totalProductionBytes ${manifest.totalProductionBytes} does not equal ${totalBytes}`,
    );
  }

  const expectedLegacyAssets = approvedWebGLAssets.filter(
    (asset) => asset.assetKind === "model",
  );
  if (
    !Array.isArray(manifest.legacyAssetsPreserved) ||
    manifest.legacyAssetsPreserved.length !== expectedLegacyAssets.length ||
    expectedLegacyAssets.some((expected) => {
      const actual = manifest.legacyAssetsPreserved.find(
        (asset) => asset?.assetPath === expected.assetPath,
      );
      return (
        !actual ||
        actual.sha256 !== expected.sha256 ||
        actual.byteSize !== expected.byteSize
      );
    })
  ) {
    failures.push(`${label}: legacy bottle preservation contract mismatch`);
  }

  const grapeFallback = Array.isArray(manifest.staticFallbacks)
    ? manifest.staticFallbacks.find(
        (fallback) => fallback?.assetPath === GRAPE_FALLBACK.assetPath,
      )
    : undefined;
  if (
    !grapeFallback ||
    grapeFallback.subject !== "grapes" ||
    grapeFallback.kind !== "transparent-model-render" ||
    grapeFallback.publicUrl !== GRAPE_FALLBACK.publicUrl ||
    grapeFallback.sha256 !== GRAPE_FALLBACK.sha256 ||
    grapeFallback.byteSize !== GRAPE_FALLBACK.byteSize ||
    grapeFallback.width !== GRAPE_FALLBACK.width ||
    grapeFallback.height !== GRAPE_FALLBACK.height ||
    grapeFallback.pixelFormat !== "RGBA" ||
    grapeFallback.sourceModel !==
      "frontend/public/assets/models/grapevyne-meshy-grapes.desktop.glb"
  ) {
    failures.push(`${label}: grape fallback contract mismatch`);
  }
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

export async function loadStoryMediaManifest(
  manifestPath = defaultStoryMediaManifestPath,
) {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

export async function loadMeshyModelManifest(
  manifestPath = defaultMeshyModelManifestPath,
) {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

export async function verifyAssets({
  manifest,
  webglManifest,
  storyManifest,
  meshyManifest,
  repositoryRoot = defaultRepositoryRoot,
} = {}) {
  const failures = [];
  const frontendRoot = path.join(repositoryRoot, "frontend");
  const publicRoot = path.join(frontendRoot, "public");
  const videoRoot = path.join(publicRoot, "assets", "video");
  const modelRoot = path.join(publicRoot, "assets", "models");
  const resolvedManifest =
    manifest ??
    (await loadFinalMediaManifest(
      path.join(repositoryRoot, ACCEPTED_MEDIA_MANIFEST_PATH),
    ));
  const resolvedWebGLManifest =
    webglManifest ??
    (await loadWebGLAssetManifest(
      path.join(repositoryRoot, "docs/v2/05-webgl-asset-manifest.json"),
    ));
  const resolvedStoryManifest =
    storyManifest ??
    (await loadStoryMediaManifest(
      path.join(repositoryRoot, "docs/v2/10a1-story-media-manifest.json"),
    ));
  const resolvedMeshyManifest =
    meshyManifest ??
    (await loadMeshyModelManifest(
      path.join(repositoryRoot, "docs/v2/10a1-meshy-model-manifest.json"),
    ));
  const manifestFiles = validateManifest(resolvedManifest, failures);
  const webglAssets = validateWebGLManifest(
    resolvedWebGLManifest,
    failures,
  );
  const storyManifestFiles = validateStoryMediaManifest(
    resolvedStoryManifest,
    failures,
  );
  validateMeshyModelManifest(resolvedMeshyManifest, failures);
  const expectedPaths = new Set(expectedRepositoryPaths());
  let verifiedWebGLAssetCount = 0;
  let verifiedStoryMediaCount = 0;
  let verifiedMeshyModelCount = 0;

  for (const assetPath of foundationalAssets) {
    await validateRequiredFile(
      path.join(frontendRoot, assetPath),
      assetPath,
      failures,
    );
  }

  const acceptedManifestAbsolutePath = path.join(
    repositoryRoot,
    ACCEPTED_MEDIA_MANIFEST_PATH,
  );
  const acceptedManifestStats = await validateRequiredFile(
    acceptedManifestAbsolutePath,
    ACCEPTED_MEDIA_MANIFEST_PATH,
    failures,
  );
  if (acceptedManifestStats?.isFile() && acceptedManifestStats.size > 0) {
    const actualManifestHash = await sha256(acceptedManifestAbsolutePath);
    if (actualManifestHash !== ACCEPTED_MEDIA_MANIFEST_SHA256) {
      failures.push(
        `${ACCEPTED_MEDIA_MANIFEST_PATH}: SHA-256 mismatch (expected ${ACCEPTED_MEDIA_MANIFEST_SHA256}, received ${actualManifestHash})`,
      );
    }
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

  for (const file of storyManifestFiles) {
    if (!expectedStoryPaths.has(file?.relativeRepositoryPath)) continue;

    const absolutePath = path.join(repositoryRoot, file.relativeRepositoryPath);
    const fileStats = await validateRequiredFile(
      absolutePath,
      file.relativeRepositoryPath,
      failures,
    );
    if (!fileStats?.isFile() || fileStats.size === 0) continue;
    verifiedStoryMediaCount += 1;

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

  for (const asset of meshyModelAssets) {
    const absolutePath = path.join(repositoryRoot, asset.assetPath);
    const fileStats = await validateRequiredFile(
      absolutePath,
      asset.assetPath,
      failures,
    );
    if (!fileStats?.isFile() || fileStats.size === 0) continue;
    verifiedMeshyModelCount += 1;

    if (fileStats.size !== asset.byteSize) {
      failures.push(
        `${asset.assetPath}: byte size mismatch (expected ${asset.byteSize}, received ${fileStats.size})`,
      );
    }
    if (fileStats.size > asset.hardBudget) {
      failures.push(
        `${asset.assetPath}: exceeds hard model budget of ${asset.hardBudget} bytes`,
      );
    }
    const actualHash = await sha256(absolutePath);
    if (actualHash !== asset.sha256) {
      failures.push(
        `${asset.assetPath}: SHA-256 mismatch (expected ${asset.sha256}, received ${actualHash})`,
      );
    }

    try {
      const contract = parseGlbContract(
        await readFile(absolutePath),
        asset.assetPath,
      );
      const requiredAttributes = [
        "POSITION",
        "NORMAL",
        "TEXCOORD_0",
        "TANGENT",
      ];
      if (
        contract.sceneCount !== 1 ||
        contract.nodeCount !== 1 ||
        contract.meshCount !== 1 ||
        contract.materialCount !== 1 ||
        contract.animationCount !== 0 ||
        !sameStringArray(contract.nodeNames, ["Mesh_0"]) ||
        !sameStringArray(contract.geometryNames, ["Mesh_0"]) ||
        contract.primitiveAttributes.length !== 1 ||
        !sameStringArray(contract.primitiveAttributes[0], requiredAttributes) ||
        !sameStringArray(contract.primitiveModes, [4]) ||
        contract.materialContracts.length !== 1 ||
        contract.materialContracts[0].alphaMode !== "OPAQUE" ||
        contract.materialContracts[0].doubleSided !== true
      ) {
        failures.push(`${asset.assetPath}: optimized Meshy GLB structure mismatch`);
      }
      if (
        contract.externalUris.length !== 0 ||
        !sameStringArray(contract.extensionsUsed, ["EXT_texture_webp"]) ||
        !sameStringArray(contract.extensionsRequired, ["EXT_texture_webp"]) ||
        contract.imageMimeTypes.length !== 3 ||
        contract.imageMimeTypes.some((mimeType) => mimeType !== "image/webp")
      ) {
        failures.push(
          `${asset.assetPath}: embedded WebP/no-remote-resource contract mismatch`,
        );
      }
    } catch (error) {
      failures.push(
        error instanceof Error
          ? error.message
          : `${asset.assetPath}: unable to parse optimized Meshy GLB`,
      );
    }
  }

  const grapeFallbackAbsolutePath = path.join(
    repositoryRoot,
    GRAPE_FALLBACK.assetPath,
  );
  const grapeFallbackStats = await validateRequiredFile(
    grapeFallbackAbsolutePath,
    GRAPE_FALLBACK.assetPath,
    failures,
  );
  if (grapeFallbackStats?.isFile() && grapeFallbackStats.size > 0) {
    if (grapeFallbackStats.size !== GRAPE_FALLBACK.byteSize) {
      failures.push(
        `${GRAPE_FALLBACK.assetPath}: byte size mismatch (expected ${GRAPE_FALLBACK.byteSize}, received ${grapeFallbackStats.size})`,
      );
    }
    const fallbackContents = await readFile(grapeFallbackAbsolutePath);
    const actualHash = createHash("sha256")
      .update(fallbackContents)
      .digest("hex");
    if (actualHash !== GRAPE_FALLBACK.sha256) {
      failures.push(
        `${GRAPE_FALLBACK.assetPath}: SHA-256 mismatch (expected ${GRAPE_FALLBACK.sha256}, received ${actualHash})`,
      );
    }
    try {
      const contract = parsePngContract(
        fallbackContents,
        GRAPE_FALLBACK.assetPath,
      );
      if (
        contract.width !== GRAPE_FALLBACK.width ||
        contract.height !== GRAPE_FALLBACK.height ||
        contract.bitDepth !== 8 ||
        contract.colorType !== 6
      ) {
        failures.push(
          `${GRAPE_FALLBACK.assetPath}: expected 1024x1200 8-bit RGBA PNG`,
        );
      }
    } catch (error) {
      failures.push(
        error instanceof Error
          ? error.message
          : `${GRAPE_FALLBACK.assetPath}: unable to parse PNG`,
      );
    }
  }

  const storyChaptersPath = path.join(
    frontendRoot,
    "src",
    "experience",
    "storyChapters.ts",
  );
  const storyChaptersStats = await validateRequiredFile(
    storyChaptersPath,
    "frontend/src/experience/storyChapters.ts",
    failures,
  );
  if (storyChaptersStats?.isFile() && storyChaptersStats.size > 0) {
    try {
      const actualSubjects = parseStorySubjectMap(
        await readFile(storyChaptersPath, "utf8"),
        "frontend/src/experience/storyChapters.ts",
      );
      if (
        actualSubjects.length !== lockedStorySubjects.length ||
        lockedStorySubjects.some(
          ([key, subject], index) =>
            actualSubjects[index]?.[0] !== key ||
            actualSubjects[index]?.[1] !== subject,
        )
      ) {
        failures.push(
          "frontend/src/experience/storyChapters.ts: locked chapter-subject map mismatch",
        );
      }
    } catch (error) {
      failures.push(
        error instanceof Error
          ? error.message
          : "frontend/src/experience/storyChapters.ts: unable to parse chapter-subject map",
      );
    }
  }

  const actualMediaFiles = await walk(videoRoot);
  const actualMediaPaths = actualMediaFiles.map((filePath) =>
    repositoryRelative(repositoryRoot, filePath),
  );

  if (actualMediaPaths.length !== expectedAllMediaPaths.size) {
    failures.push(
      `frontend/public/assets/video: expected exactly ${expectedAllMediaPaths.size} accepted-plus-additive files, found ${actualMediaPaths.length}`,
    );
  }

  for (const filePath of actualMediaPaths) {
    if (!expectedAllMediaPaths.has(filePath)) {
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
      !approvedModelPaths.has(filePath) &&
      !meshyModelPaths.has(filePath)
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
      !approvedModelPaths.has(filePath) &&
      !meshyModelPaths.has(filePath)
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
      if (/\.(?:avif|jpe?g|ktx2|png|webp)(?:[?#]|$)/iu.test(remoteUrl)) {
        failures.push(`${filePath}: remote texture URL is prohibited`);
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
    storyMediaCount: verifiedStoryMediaCount,
    webglAssetCount: verifiedWebGLAssetCount,
    meshyModelCount: verifiedMeshyModelCount,
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
    `Verified ${result.foundationalAssetCount} foundational assets, ${EXPECTED_FILE_COUNT} accepted media assets, ${result.storyMediaCount} additive story-media assets, ${result.webglAssetCount} legacy WebGL assets, ${result.meshyModelCount} optimized Meshy models, and the static grape fallback.`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await runCli();
}
