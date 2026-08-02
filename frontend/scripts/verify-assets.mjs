import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const videoRoot = path.join(frontendRoot, "public", "assets", "video");

const foundationalAssets = [
  "public/favicon.svg",
  "public/assets/brand/grapevyne-monogram.svg",
  "public/assets/brand/grapevyne-wordmark.svg",
];

const approvedVideoSlugs = [
  "hero-bottle-macro",
  "taste-liquid-transition",
  "cellar-corridor-push",
  "memory-table-ambience",
  "taste-atlas-finale",
];

const approvedVideoAssets = approvedVideoSlugs.flatMap((slug) => [
  `public/assets/video/desktop/${slug}.desktop.webm`,
  `public/assets/video/desktop/${slug}.desktop.mp4`,
  `public/assets/video/mobile/${slug}.mobile.webm`,
  `public/assets/video/mobile/${slug}.mobile.mp4`,
  `public/assets/video/posters/desktop/${slug}.desktop.jpg`,
  `public/assets/video/posters/mobile/${slug}.mobile.jpg`,
]);

const expectedVideoAssets = new Set(approvedVideoAssets);
const prohibitedVideoName = /(^|[._-])(prototype|preview|source|master|reel)(?=([._-]|$))/i;
const prohibitedOutsideVideoExtensions = new Set([".glb", ".gltf", ".mp4", ".webm"]);

function relativePath(filePath) {
  return path.relative(frontendRoot, filePath).split(path.sep).join("/");
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

async function validateRequiredFile(assetPath, failures) {
  try {
    const file = await stat(path.join(frontendRoot, assetPath));

    if (!file.isFile()) {
      failures.push(`${assetPath}: not a file`);
    } else if (file.size === 0) {
      failures.push(`${assetPath}: empty`);
    }
  } catch {
    failures.push(`${assetPath}: missing`);
  }
}

const failures = [];

for (const assetPath of [...foundationalAssets, ...approvedVideoAssets]) {
  await validateRequiredFile(assetPath, failures);
}

const videoFiles = await walk(videoRoot);
const actualVideoAssets = videoFiles.map(relativePath);

for (const assetPath of actualVideoAssets) {
  if (!expectedVideoAssets.has(assetPath)) {
    failures.push(`${assetPath}: unexpected video asset`);
  }

  if (prohibitedVideoName.test(path.basename(assetPath))) {
    failures.push(`${assetPath}: prohibited production filename`);
  }
}

const publicAssets = await walk(path.join(frontendRoot, "public", "assets"));
for (const filePath of publicAssets) {
  if (
    !filePath.startsWith(`${videoRoot}${path.sep}`) &&
    prohibitedOutsideVideoExtensions.has(path.extname(filePath).toLowerCase())
  ) {
    failures.push(`${relativePath(filePath)}: prohibited asset for Prompt 04`);
  }
}

if (failures.length > 0) {
  console.error(`Asset verification failed:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(
  `Verified ${foundationalAssets.length} foundational assets and ${approvedVideoAssets.length} approved video/poster assets.`,
);
