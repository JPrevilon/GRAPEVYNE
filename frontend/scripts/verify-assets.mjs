import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredForTypedFoundation = [
  "public/favicon.svg",
  "public/assets/brand/grapevyne-monogram.svg",
  "public/assets/brand/grapevyne-wordmark.svg",
];
const prohibitedExtensions = new Set([".glb", ".gltf", ".mp4", ".webm"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
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

for (const relativePath of requiredForTypedFoundation) {
  const file = await stat(path.join(frontendRoot, relativePath));
  if (!file.isFile() || file.size === 0) {
    throw new Error(`Required Prompt 02 asset is empty: ${relativePath}`);
  }
}

const foundationalAssets = await walk(path.join(frontendRoot, "public", "assets"));
const prohibitedAssets = foundationalAssets.filter((file) =>
  prohibitedExtensions.has(path.extname(file).toLowerCase()),
);

if (prohibitedAssets.length > 0) {
  throw new Error(
    `Prompt 02 must not include video or WebGL assets:\n${prohibitedAssets.join("\n")}`,
  );
}

console.log(`Verified ${requiredForTypedFoundation.length} Prompt 02 foundational assets.`);
