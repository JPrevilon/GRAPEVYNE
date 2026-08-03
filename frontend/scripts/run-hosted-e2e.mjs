import { execFile, spawn } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  chmod,
  mkdtemp,
  readFile,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  createRestrictedChildEnvironment,
  normalizeHostedPreviewBaseUrl,
  parseSetCookiesForStorageState,
  validateHostedPreviewDeployment,
  validateHostedPreviewHealth,
  validatePreviewDatabaseSentinel,
} from "./hosted-preview-contract.mjs";

const executeFile = promisify(execFile);
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const backendRoot = path.join(repositoryRoot, "backend");
const playwrightCli = path.join(
  frontendRoot,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);
const linkedProjectPath = path.join(repositoryRoot, ".vercel", "project.json");
const defaultArguments = [
  "e2e/hosted-preview.spec.ts",
  "e2e/public-journeys.spec.ts",
  "e2e/demo-mobile.spec.ts",
  "e2e/discovery-reliability.spec.ts",
  "e2e/modes-and-failures.spec.ts",
  "--project=desktop-chromium",
  "--project=mobile-chromium",
  "--project=reduced-motion-chromium",
];
const GIT_COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_HEALTH_BYTES = 64 * 1024;
const VERCEL_COMMAND_TIMEOUT = 30_000;
const CLEANUP_TIMEOUT = 60_000;

function requiredEnvironmentValue(name) {
  const value = process.env[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required for hosted Preview E2E.`);
  }

  return value.trim();
}

function optionalEnvironmentValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function vercelEnvironment() {
  const environment = createRestrictedChildEnvironment(process.env);

  for (const name of [
    "VERCEL_ORG_ID",
    "VERCEL_PROJECT_ID",
    "VERCEL_SCOPE",
    "VERCEL_TEAM_ID",
    "VERCEL_TOKEN",
  ]) {
    const value = process.env[name];

    if (typeof value === "string") {
      environment[name] = value;
    }
  }

  return environment;
}

async function linkedProjectName() {
  let contents;

  try {
    contents = await readFile(linkedProjectPath, "utf8");
  } catch {
    throw new Error(
      "Hosted Preview E2E requires the repository root to be linked to Vercel.",
    );
  }

  let project;

  try {
    project = JSON.parse(contents);
  } catch {
    throw new Error("The local Vercel project link is not valid JSON.");
  }

  if (typeof project.projectName !== "string" || !project.projectName.trim()) {
    throw new Error("The local Vercel project link has no project name.");
  }

  return project.projectName.trim();
}

async function executeJson(command, arguments_, options, failureMessage) {
  let stdout;

  try {
    ({ stdout } = await executeFile(command, arguments_, {
      ...options,
      encoding: "utf8",
      maxBuffer: MAX_JSON_BYTES,
    }));
  } catch {
    throw new Error(failureMessage);
  }

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`${failureMessage} The command did not return valid JSON.`);
  }
}

async function currentGitHead() {
  let stdout;

  try {
    ({ stdout } = await executeFile(
      "git",
      ["rev-parse", "--verify", "HEAD"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: createRestrictedChildEnvironment(process.env),
        maxBuffer: 4 * 1024,
        timeout: 10_000,
      },
    ));
  } catch {
    throw new Error("Hosted Preview E2E could not resolve the current Git HEAD.");
  }

  const commitSha = stdout.trim();

  if (!GIT_COMMIT_PATTERN.test(commitSha)) {
    throw new Error("Hosted Preview E2E requires a full current Git commit SHA.");
  }

  return commitSha.toLowerCase();
}

async function inspectPreview(baseUrl, environment) {
  return executeJson(
    "vercel",
    [
      "inspect",
      baseUrl,
      "--format=json",
      "--no-color",
      "--cwd",
      repositoryRoot,
    ],
    {
      cwd: repositoryRoot,
      env: environment,
      timeout: VERCEL_COMMAND_TIMEOUT,
    },
    "Vercel Preview inspection failed. Confirm the CLI identity, link, URL, and deployment access.",
  );
}

async function inspectPreviewMetadata(deploymentId, environment) {
  if (!/^dpl_[a-zA-Z0-9]+$/.test(deploymentId)) {
    throw new Error("Vercel inspect returned an invalid deployment ID.");
  }

  return executeJson(
    "vercel",
    [
      "api",
      `/v13/deployments/${deploymentId}`,
      "--raw",
      "--no-color",
      "--cwd",
      repositoryRoot,
    ],
    {
      cwd: repositoryRoot,
      env: environment,
      timeout: VERCEL_COMMAND_TIMEOUT,
    },
    "Vercel deployment metadata inspection failed.",
  );
}

async function verifyPreviewHealth(baseUrl, expectedSentinel, bypassSecret) {
  const healthUrl = new URL("/api/health", baseUrl);
  const headers = bypassSecret
    ? {
        "x-vercel-protection-bypass": bypassSecret,
        "x-vercel-set-bypass-cookie": "true",
      }
    : undefined;
  let response;

  try {
    response = await fetch(healthUrl, {
      cache: "no-store",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("The exact-origin Preview health preflight failed.");
  }

  if (
    response.status !== 200 ||
    response.redirected ||
    response.url !== healthUrl.href
  ) {
    throw new Error(
      "The exact-origin Preview health preflight did not return HTTP 200 without a redirect.",
    );
  }

  let responseBody;

  try {
    responseBody = await response.text();
  } catch {
    throw new Error("The Preview health response could not be read.");
  }

  if (Buffer.byteLength(responseBody, "utf8") > MAX_HEALTH_BYTES) {
    throw new Error("The Preview health response exceeded the safety limit.");
  }

  let payload;

  try {
    payload = JSON.parse(responseBody);
  } catch {
    throw new Error("The Preview health response was not valid JSON.");
  }

  validateHostedPreviewHealth(payload, expectedSentinel);

  const setCookieValues =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie")]
        : [];

  if (bypassSecret && setCookieValues.length === 0) {
    throw new Error(
      "The protected Preview preflight did not return a browser bypass cookie.",
    );
  }

  return {
    cookies: bypassSecret
      ? parseSetCookiesForStorageState(setCookieValues, baseUrl)
      : [],
    origins: [],
  };
}

async function createTemporaryStorageState(storageState) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "grapevyne-hosted-preview-"),
  );
  const file = path.join(directory, "storage-state.json");

  try {
    await writeFile(file, JSON.stringify(storageState), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await chmod(file, 0o600);
  } catch {
    try {
      await unlink(file);
    } catch {
      // The file might not have been created.
    }

    try {
      await rmdir(directory);
    } catch {
      // Preserve the original storage-state creation failure.
    }

    throw new Error("Could not create the ephemeral Playwright storage state.");
  }

  return { directory, file };
}

async function removeTemporaryStorageState(temporaryState) {
  if (!temporaryState) return;

  let removalFailed = false;

  try {
    await unlink(temporaryState.file);
  } catch (error) {
    if (error?.code !== "ENOENT") removalFailed = true;
  }

  try {
    await rmdir(temporaryState.directory);
  } catch (error) {
    if (error?.code !== "ENOENT") removalFailed = true;
  }

  if (removalFailed) {
    throw new Error("Could not remove the ephemeral Playwright storage state.");
  }
}

async function firstAccessible(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next supported Python location.
    }
  }

  return process.platform === "win32" ? "python" : "python3";
}

async function resolvePython() {
  const configured = optionalEnvironmentValue("E2E_PYTHON");

  if (configured) {
    if (/[\0\r\n]/.test(configured)) {
      throw new Error("E2E_PYTHON must identify one executable.");
    }

    if (path.isAbsolute(configured)) {
      try {
        await access(configured, constants.X_OK);
      } catch {
        throw new Error("E2E_PYTHON is not an executable file.");
      }

      return configured;
    }

    if (configured.includes("/") || configured.includes("\\")) {
      const candidate = path.resolve(repositoryRoot, configured);

      try {
        await access(candidate, constants.X_OK);
      } catch {
        throw new Error("E2E_PYTHON is not an executable file.");
      }

      return candidate;
    }

    if (!/^[a-zA-Z0-9._+-]+$/.test(configured)) {
      throw new Error("E2E_PYTHON must identify one executable.");
    }

    return configured;
  }

  return firstAccessible([
    path.join(backendRoot, ".venv", "bin", "python"),
    path.join(backendRoot, ".venv", "Scripts", "python.exe"),
    path.join(repositoryRoot, ".venv", "bin", "python"),
    path.join(repositoryRoot, ".venv", "Scripts", "python.exe"),
  ]);
}

async function cleanupPreviewDatabase(python, databaseUrl, sentinel) {
  const environment = createRestrictedChildEnvironment(process.env, {
    DATABASE_URL: databaseUrl,
    FLASK_ENV: "development",
    PYTHONDONTWRITEBYTECODE: "1",
  });

  try {
    await executeFile(
      python,
      [
        "-m",
        "flask",
        "--app",
        "app",
        "cleanup-preview-e2e",
        "--sentinel",
        sentinel,
      ],
      {
        cwd: backendRoot,
        encoding: "utf8",
        env: environment,
        maxBuffer: 1024 * 1024,
        timeout: CLEANUP_TIMEOUT,
      },
    );
  } catch {
    throw new Error("The verified Preview database cleanup failed.");
  }
}

function validatePlaywrightArguments(arguments_) {
  for (const argument of arguments_) {
    if (
      argument.startsWith("-c") ||
      argument === "--config" ||
      argument.startsWith("--config=") ||
      argument === "--debug" ||
      argument === "--trace" ||
      argument.startsWith("--trace=") ||
      argument === "--fully-parallel" ||
      argument === "--ui" ||
      argument.startsWith("--ui=") ||
      argument === "--ui-host" ||
      argument.startsWith("--ui-host=") ||
      argument === "--ui-port" ||
      argument.startsWith("--ui-port=") ||
      argument === "--workers" ||
      (argument.startsWith("--workers=") && argument !== "--workers=1")
    ) {
      throw new Error(
        "Hosted Preview E2E does not allow config, debug, UI, trace, or unsafe worker overrides.",
      );
    }
  }

  return arguments_;
}

let activePlaywrightChild;
let interruptedExitCode;

function throwIfInterrupted() {
  if (interruptedExitCode) {
    throw new Error("Hosted Preview E2E was interrupted.");
  }
}

for (const [signal, exitCode] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  process.once(signal, () => {
    interruptedExitCode = exitCode;

    if (
      activePlaywrightChild &&
      activePlaywrightChild.exitCode === null &&
      activePlaywrightChild.signalCode === null
    ) {
      activePlaywrightChild.kill("SIGTERM");
    }
  });
}

function runPlaywright(arguments_, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [playwrightCli, "test", ...arguments_],
      {
        cwd: frontendRoot,
        env: environment,
        stdio: "inherit",
      },
    );
    activePlaywrightChild = child;

    child.once("error", () => {
      if (activePlaywrightChild === child) activePlaywrightChild = undefined;
      reject(new Error("Hosted Preview Playwright could not start."));
    });
    child.once("exit", (code, signal) => {
      if (activePlaywrightChild === child) activePlaywrightChild = undefined;

      if (code !== 0) {
        reject(
          new Error(
            `Hosted Preview Playwright exited with ${code ?? signal ?? "an unknown status"}.`,
          ),
        );
      } else {
        resolve();
      }
    });
  });
}

function asError(error, fallbackMessage) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

function failureMessage(errors) {
  const messages = [...new Set(errors.map((error) => error.message))];
  return messages.join("\n");
}

const failures = [];
let cleanupContext;
let temporaryState;

try {
  const rawDatabaseUrl = requiredEnvironmentValue(
    "GRAPEVYNE_PREVIEW_DATABASE_URL",
  );
  const sentinel = validatePreviewDatabaseSentinel(
    requiredEnvironmentValue("GRAPEVYNE_PREVIEW_DATABASE_SENTINEL"),
  );
  const bypassSecret = optionalEnvironmentValue(
    "VERCEL_AUTOMATION_BYPASS_SECRET",
  );

  Reflect.deleteProperty(process.env, "GRAPEVYNE_PREVIEW_DATABASE_URL");
  Reflect.deleteProperty(process.env, "VERCEL_AUTOMATION_BYPASS_SECRET");

  const baseUrl = normalizeHostedPreviewBaseUrl(
    requiredEnvironmentValue("PLAYWRIGHT_BASE_URL"),
  );
  const projectName = await linkedProjectName();
  throwIfInterrupted();
  const gitHead = await currentGitHead();
  throwIfInterrupted();
  const inspectEnvironment = vercelEnvironment();
  const deployment = await inspectPreview(baseUrl, inspectEnvironment);
  throwIfInterrupted();
  const deploymentMetadata = await inspectPreviewMetadata(
    deployment?.id,
    inspectEnvironment,
  );
  throwIfInterrupted();
  const verified = validateHostedPreviewDeployment(
    deployment,
    baseUrl,
    projectName,
    gitHead,
    deploymentMetadata,
  );
  const storageState = await verifyPreviewHealth(
    verified.baseUrl,
    sentinel,
    bypassSecret,
  );
  throwIfInterrupted();
  const python = await resolvePython();
  throwIfInterrupted();

  cleanupContext = { databaseUrl: rawDatabaseUrl, python, sentinel };
  temporaryState = await createTemporaryStorageState(storageState);
  throwIfInterrupted();

  await cleanupPreviewDatabase(python, rawDatabaseUrl, sentinel);
  throwIfInterrupted();

  const playwrightArguments = validatePlaywrightArguments(
    process.argv.length > 2 ? process.argv.slice(2) : defaultArguments,
  );
  const playwrightEnvironment = createRestrictedChildEnvironment(process.env, {
    GRAPEVYNE_E2E_MODE: "hosted-preview",
    GRAPEVYNE_HOSTED_PREVIEW_DEPLOYMENT_ID: verified.deploymentId,
    GRAPEVYNE_HOSTED_PREVIEW_STORAGE_STATE: temporaryState.file,
    PLAYWRIGHT_BASE_URL: verified.baseUrl,
    PLAYWRIGHT_HTML_OPEN: "never",
  });

  await runPlaywright(playwrightArguments, playwrightEnvironment);
  throwIfInterrupted();
} catch (error) {
  failures.push(asError(error, "Hosted Preview E2E failed."));
} finally {
  if (cleanupContext) {
    try {
      await cleanupPreviewDatabase(
        cleanupContext.python,
        cleanupContext.databaseUrl,
        cleanupContext.sentinel,
      );
    } catch (error) {
      failures.push(
        asError(error, "The final verified Preview database cleanup failed."),
      );
    }
  }

  try {
    await removeTemporaryStorageState(temporaryState);
  } catch (error) {
    failures.push(
      asError(error, "The ephemeral Playwright storage state cleanup failed."),
    );
  }
}

if (failures.length > 0) {
  console.error(failureMessage(failures));
  process.exitCode = interruptedExitCode ?? 1;
} else if (interruptedExitCode) {
  console.error("Hosted Preview E2E was interrupted.");
  process.exitCode = interruptedExitCode;
}
