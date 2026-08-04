import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

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
const viteCli = path.join(frontendRoot, "node_modules", "vite", "bin", "vite.js");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "grapevyne-e2e-"));
const databasePath = path.join(temporaryRoot, "grapevyne-e2e.sqlite3");
const children = new Set();
let cleaningUp = false;

function listenForFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) {
          reject(error);
        } else if (port === null) {
          reject(new Error("Could not allocate an E2E server port."));
        } else {
          resolve(port);
        }
      });
    });
  });
}

async function firstAccessible(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported Python location.
    }
  }

  return process.platform === "win32" ? "python" : "python3";
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...options.env },
      stdio: options.stdio || "inherit",
      cwd: options.cwd,
    });
    children.add(child);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      children.delete(child);
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${path.basename(command)} ${args.join(" ")} exited ${code ?? signal}`,
          ),
        );
      }
    });
  });
}

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    env: { ...process.env, ...options.env },
    stdio: "inherit",
    cwd: options.cwd,
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

async function waitForUrl(url, child, label) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${label} exited before becoming ready.`);
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`${label} did not become ready at ${url}.`);
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 4_000)),
  ]);

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
}

async function cleanup() {
  if (cleaningUp) return;
  cleaningUp = true;
  await Promise.all([...children].map(stopChild));

  if (path.basename(temporaryRoot).startsWith("grapevyne-e2e-")) {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

for (const [signal, exitCode] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(exitCode));
  });
}

let exitCode = 0;

try {
  const [apiPort, previewPort] = await Promise.all([
    listenForFreePort(),
    listenForFreePort(),
  ]);
  const python =
    process.env.E2E_PYTHON ||
    (await firstAccessible([
      path.join(backendRoot, ".venv", "bin", "python"),
      path.join(backendRoot, ".venv", "Scripts", "python.exe"),
    ]));
  const apiTarget = `http://127.0.0.1:${apiPort}`;
  const previewUrl = `http://127.0.0.1:${previewPort}`;
  const backendEnvironment = {
    FLASK_ENV: "testing",
    FRONTEND_ORIGINS: previewUrl,
    SECRET_KEY: "prompt-09-disposable-e2e-secret",
    TEST_DATABASE_URL: `sqlite:///${databasePath}`,
  };

  await run(python, ["-m", "flask", "--app", "app", "db", "upgrade"], {
    cwd: backendRoot,
    env: backendEnvironment,
  });

  if (!process.argv.includes("--skip-build")) {
    await run("npm", ["run", "build"], {
      cwd: frontendRoot,
      env: { GRAPEVYNE_API_PROXY_TARGET: apiTarget },
    });
  }

  const playwrightArguments = process.argv.slice(2).filter(
    (argument) => argument !== "--skip-build",
  );
  const backend = start(
    python,
    [
      "-m",
      "flask",
      "--app",
      "app",
      "run",
      "--host",
      "127.0.0.1",
      "--port",
      String(apiPort),
      "--no-reload",
    ],
    { cwd: backendRoot, env: backendEnvironment },
  );
  await waitForUrl(`${apiTarget}/api/health`, backend, "Flask E2E server");

  const preview = start(
    process.execPath,
    [viteCli, "preview", "--host", "127.0.0.1", "--port", String(previewPort), "--strictPort"],
    {
      cwd: frontendRoot,
      env: { GRAPEVYNE_API_PROXY_TARGET: apiTarget },
    },
  );
  await waitForUrl(`${previewUrl}/api/health`, preview, "Vite production preview");

  await run(process.execPath, [playwrightCli, "test", ...playwrightArguments], {
    cwd: frontendRoot,
    env: {
      PLAYWRIGHT_BASE_URL: previewUrl,
      PLAYWRIGHT_HTML_OPEN: "never",
    },
  });
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.message : error);
} finally {
  await cleanup();
}

process.exitCode = exitCode;
