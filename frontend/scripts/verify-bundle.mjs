import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const manifestPath = path.join(frontendRoot, "dist", ".vite", "manifest.json");
const budgetPath = path.join(repositoryRoot, "docs", "v2", "09-performance-budget.json");

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} could not be read at ${filePath}: ${reason}`);
  }
}

function findManifestEntry(manifest, selector) {
  if (selector.type === "manifest-key") {
    return [selector.value, manifest[selector.value]];
  }

  if (selector.type === "manifest-name") {
    return (
      Object.entries(manifest).find(([, entry]) => entry.name === selector.value) ||
      [null, null]
    );
  }

  if (selector.type === "entry-css") {
    const entry = manifest[selector.value];
    const cssFile = entry?.css?.[selector.index ?? 0];
    return cssFile ? [`${selector.value}:css`, { file: cssFile }] : [null, null];
  }

  throw new Error(`Unsupported bundle selector type: ${selector.type}`);
}

async function measureEntry(manifest, selector) {
  const [manifestKey, entry] = findManifestEntry(manifest, selector);

  if (!manifestKey || !entry?.file) {
    throw new Error(`No emitted bundle matches ${JSON.stringify(selector)}.`);
  }

  const contents = await readFile(path.join(frontendRoot, "dist", entry.file));
  return {
    file: entry.file,
    gzipBytes: gzipSync(contents, { level: 9 }).byteLength,
    manifestKey,
    rawBytes: contents.byteLength,
  };
}

function staticImportClosure(manifest, rootKey) {
  const visited = new Set();
  const pending = [rootKey];

  while (pending.length > 0) {
    const key = pending.pop();
    if (!key || visited.has(key)) continue;
    visited.add(key);

    for (const importedKey of manifest[key]?.imports || []) {
      pending.push(importedKey);
    }
  }

  return visited;
}

const [manifest, policy] = await Promise.all([
  readJson(manifestPath, "Vite build manifest"),
  readJson(budgetPath, "Prompt 09 performance budget"),
]);
const failures = [];
const rows = [];

for (const budget of policy.budgets) {
  const actual = await measureEntry(manifest, budget.selector);
  rows.push({
    budget: budget.label,
    file: actual.file,
    gzip: actual.gzipBytes,
    raw: actual.rawBytes,
  });

  for (const sizeKind of ["rawBytes", "gzipBytes"]) {
    const maximum = budget.maximum[sizeKind];
    if (maximum !== undefined && actual[sizeKind] > maximum) {
      failures.push(
        `${budget.label} ${sizeKind} is ${actual[sizeKind]} bytes; maximum is ${maximum}.`,
      );
    }
  }
}

for (const routeKey of policy.productRouteIsolation.routes) {
  if (!manifest[routeKey]) {
    failures.push(`Product-route manifest entry is missing: ${routeKey}.`);
    continue;
  }

  const closure = staticImportClosure(manifest, routeKey);
  const forbidden = policy.productRouteIsolation.forbiddenManifestKeys.filter((key) =>
    closure.has(key),
  );

  if (forbidden.length > 0) {
    failures.push(`${routeKey} statically imports forbidden home-only code: ${forbidden.join(", ")}.`);
  }
}

console.table(rows);

if (failures.length > 0) {
  console.error("Bundle budget verification failed:\n- " + failures.join("\n- "));
  process.exitCode = 1;
} else {
  console.log(
    `Bundle budgets passed for ${rows.length} emitted assets; ${policy.productRouteIsolation.routes.length} product routes remain isolated from WebGL, GSAP, and Lenis.`,
  );
}
