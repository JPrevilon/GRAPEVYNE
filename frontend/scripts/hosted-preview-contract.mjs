const VERCEL_PREVIEW_SUFFIX = ".vercel.app";
const VERCEL_HOST_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+vercel\.app$/;
const GIT_COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const PREVIEW_DATABASE_SENTINEL_PATTERN =
  /^grapevyne-preview-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SAFE_CHILD_ENVIRONMENT_KEYS = [
  "APPDATA",
  "CI",
  "DISPLAY",
  "FORCE_COLOR",
  "HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LOCALAPPDATA",
  "NODE_EXTRA_CA_CERTS",
  "NO_COLOR",
  "PATH",
  "PLAYWRIGHT_BROWSERS_PATH",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "TZ",
  "USERPROFILE",
  "WAYLAND_DISPLAY",
  "XDG_RUNTIME_DIR",
];
const GIT_COMMIT_PATHS = [
  ["meta", "githubCommitSha"],
  ["meta", "gitlabCommitSha"],
  ["meta", "bitbucketCommitSha"],
  ["meta", "gitCommitSha"],
  ["gitSource", "sha"],
  ["source", "sha"],
  ["git", "sha"],
  ["githubCommitSha"],
  ["gitlabCommitSha"],
  ["bitbucketCommitSha"],
  ["gitCommitSha"],
];

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${label} is required.`);
  }

  return value.trim();
}

function optionalStringAtPath(value, path) {
  let current = value;

  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    current = current[key];
  }

  return typeof current === "string" && current.trim()
    ? current.trim()
    : undefined;
}

function deploymentMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Vercel deployment metadata is required.");
  }

  const nested = value.deployment;
  return nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested
    : value;
}

function normalizedDeploymentOrigin(value, label) {
  const deploymentUrl = requiredString(value, label);
  return normalizeHostedPreviewBaseUrl(
    deploymentUrl.startsWith("https://")
      ? deploymentUrl
      : `https://${deploymentUrl}`,
  );
}

function verifyMetadataIdentity(inspectedDeployment, metadata) {
  const metadataId = optionalStringAtPath(metadata, ["id"]);
  const metadataName = optionalStringAtPath(metadata, ["name"]);
  const metadataUrl = optionalStringAtPath(metadata, ["url"]);

  if (metadataId && metadataId !== inspectedDeployment.id) {
    throw new Error(
      "Vercel deployment metadata does not match the inspected deployment ID.",
    );
  }

  if (metadataName && metadataName !== inspectedDeployment.name) {
    throw new Error(
      "Vercel deployment metadata does not match the inspected project.",
    );
  }

  if (
    metadataUrl &&
    normalizedDeploymentOrigin(
      metadataUrl,
      "The deployment metadata URL",
    ) !==
      normalizedDeploymentOrigin(
        inspectedDeployment.url,
        "The inspected deployment URL",
      )
  ) {
    throw new Error(
      "Vercel deployment metadata does not match the inspected deployment URL.",
    );
  }
}

function deploymentCommitSha(metadata) {
  const candidates = GIT_COMMIT_PATHS.map((path) =>
    optionalStringAtPath(metadata, path),
  ).filter(Boolean);

  if (candidates.length === 0) {
    throw new Error("Vercel deployment metadata has no Git commit SHA.");
  }

  const normalizedCandidates = candidates.map((candidate) => {
    if (!GIT_COMMIT_PATTERN.test(candidate)) {
      throw new Error("Vercel deployment metadata has an invalid Git commit SHA.");
    }

    return candidate.toLowerCase();
  });
  const uniqueCandidates = new Set(normalizedCandidates);

  if (uniqueCandidates.size !== 1) {
    throw new Error("Vercel deployment metadata has conflicting Git commit SHAs.");
  }

  return normalizedCandidates[0];
}

export function normalizeHostedPreviewBaseUrl(value) {
  const candidate = requiredString(value, "PLAYWRIGHT_BASE_URL");
  let parsed;

  try {
    parsed = new URL(candidate);
  } catch {
    throw new TypeError("PLAYWRIGHT_BASE_URL must be an absolute URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new TypeError("Hosted Preview E2E requires HTTPS.");
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new TypeError(
      "PLAYWRIGHT_BASE_URL must contain only the HTTPS Preview origin.",
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    !hostname.endsWith(VERCEL_PREVIEW_SUFFIX) ||
    hostname === "vercel.app" ||
    !VERCEL_HOST_PATTERN.test(hostname)
  ) {
    throw new TypeError(
      "Hosted Preview E2E must use a generated Vercel deployment URL.",
    );
  }

  return parsed.origin;
}

export function validatePreviewDatabaseSentinel(value) {
  const sentinel = requiredString(
    value,
    "GRAPEVYNE_PREVIEW_DATABASE_SENTINEL",
  );

  if (!PREVIEW_DATABASE_SENTINEL_PATTERN.test(sentinel)) {
    throw new TypeError(
      "GRAPEVYNE_PREVIEW_DATABASE_SENTINEL must be a valid Preview marker.",
    );
  }

  return sentinel;
}

export function validateHostedPreviewDeployment(
  deployment,
  baseUrl,
  expectedProjectName,
  expectedCommitSha,
  rawMetadata = deployment,
) {
  if (!deployment || typeof deployment !== "object" || Array.isArray(deployment)) {
    throw new TypeError("Vercel inspect did not return a deployment object.");
  }

  const normalizedBaseUrl = normalizeHostedPreviewBaseUrl(baseUrl);
  const inspectedOrigin = normalizedDeploymentOrigin(
    deployment.url,
    "The inspected deployment URL",
  );

  if (deployment.target !== "preview") {
    throw new Error(
      "Hosted Preview E2E refuses every non-Preview Vercel deployment.",
    );
  }

  if (deployment.readyState !== "READY") {
    throw new Error("The inspected Vercel Preview deployment is not READY.");
  }

  if (inspectedOrigin !== normalizedBaseUrl) {
    throw new Error(
      "PLAYWRIGHT_BASE_URL must be the immutable inspected deployment URL, not an alias.",
    );
  }

  const projectName = requiredString(
    deployment.name,
    "The inspected deployment project name",
  );
  const deploymentId = requiredString(
    deployment.id,
    "The inspected deployment ID",
  );

  if (!/^dpl_[a-zA-Z0-9]+$/.test(deploymentId)) {
    throw new Error("Vercel inspect returned an invalid deployment ID.");
  }

  if (
    expectedProjectName &&
    projectName !== requiredString(expectedProjectName, "The linked project name")
  ) {
    throw new Error(
      "The inspected deployment does not belong to the linked Vercel project.",
    );
  }

  const expectedSha = requiredString(expectedCommitSha, "The current Git HEAD");

  if (!GIT_COMMIT_PATTERN.test(expectedSha)) {
    throw new TypeError("The current Git HEAD is not a full Git commit SHA.");
  }

  const metadata = deploymentMetadata(rawMetadata);
  verifyMetadataIdentity(deployment, metadata);
  const deployedCommitSha = deploymentCommitSha(metadata);

  if (deployedCommitSha !== expectedSha.toLowerCase()) {
    throw new Error(
      "The inspected Vercel deployment was not built from the current Git HEAD.",
    );
  }

  return {
    baseUrl: normalizedBaseUrl,
    deploymentId,
    deployedCommitSha,
    projectName,
  };
}

export function validateHostedPreviewHealth(payload, expectedSentinel) {
  const sentinel = validatePreviewDatabaseSentinel(expectedSentinel);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("Preview health did not return an object.");
  }

  const data = payload.data;
  const deployment =
    data && typeof data === "object" && !Array.isArray(data)
      ? data.deployment
      : undefined;

  if (
    !deployment ||
    typeof deployment !== "object" ||
    Array.isArray(deployment)
  ) {
    throw new Error("Preview health has no deployment verification contract.");
  }

  if (deployment.environment !== "preview") {
    throw new Error("Preview health did not report the Preview environment.");
  }

  if (deployment.databaseVerified !== true) {
    throw new Error("Preview health did not verify its database.");
  }

  if (deployment.databaseSentinel !== sentinel) {
    throw new Error("Preview health returned the wrong database sentinel.");
  }

  return true;
}

export function validateHostedPreviewBypassRedirect(status, location, baseUrl) {
  const healthUrl = new URL("/api/health", normalizeHostedPreviewBaseUrl(baseUrl));

  if (status !== 307 || typeof location !== "string" || !location.trim()) {
    throw new Error(
      "The Preview bypass cookie response was not the expected redirect.",
    );
  }

  let redirectUrl;

  try {
    redirectUrl = new URL(location, healthUrl);
  } catch {
    throw new Error("The Preview bypass cookie redirect was not a valid URL.");
  }

  if (redirectUrl.href !== healthUrl.href) {
    throw new Error(
      "The Preview bypass cookie redirect left the exact health URL.",
    );
  }

  return true;
}

export function parseSetCookiesForStorageState(setCookieValues, baseUrl) {
  if (!Array.isArray(setCookieValues)) {
    throw new TypeError("Set-Cookie values must be an array.");
  }

  const origin = new URL(normalizeHostedPreviewBaseUrl(baseUrl));

  return setCookieValues.map((header) => {
    if (typeof header !== "string" || !header || /[\r\n]/.test(header)) {
      throw new Error("The Preview bypass response returned an invalid cookie.");
    }

    const parts = header.split(";");
    const nameValue = parts.shift();
    const separator = nameValue.indexOf("=");

    if (separator <= 0) {
      throw new Error("The Preview bypass response returned an invalid cookie.");
    }

    const name = nameValue.slice(0, separator).trim();
    const value = nameValue.slice(separator + 1).trim();

    if (!name || !value) {
      throw new Error("The Preview bypass response returned an invalid cookie.");
    }

    const attributes = new Map();

    for (const rawAttribute of parts) {
      const trimmed = rawAttribute.trim();
      if (!trimmed) continue;

      const attributeSeparator = trimmed.indexOf("=");
      const attributeName = (
        attributeSeparator === -1
          ? trimmed
          : trimmed.slice(0, attributeSeparator)
      ).toLowerCase();
      const attributeValue =
        attributeSeparator === -1
          ? ""
          : trimmed.slice(attributeSeparator + 1).trim();
      attributes.set(attributeName, attributeValue);
    }

    let expires = -1;
    const maxAge = attributes.get("max-age");

    if (maxAge !== undefined) {
      const seconds = Number(maxAge);

      if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new Error("The Preview bypass response returned an expired cookie.");
      }

      expires = Math.floor(Date.now() / 1000 + seconds);
    } else if (attributes.has("expires")) {
      const milliseconds = Date.parse(attributes.get("expires"));

      if (!Number.isFinite(milliseconds) || milliseconds <= Date.now()) {
        throw new Error("The Preview bypass response returned an expired cookie.");
      }

      expires = Math.floor(milliseconds / 1000);
    }

    const sameSiteValue = attributes.get("samesite")?.toLowerCase();
    const sameSite =
      sameSiteValue === "strict"
        ? "Strict"
        : sameSiteValue === "none"
          ? "None"
          : "Lax";
    const cookiePath = attributes.get("path");

    return {
      domain: origin.hostname,
      expires,
      httpOnly: attributes.has("httponly"),
      name,
      path: cookiePath?.startsWith("/") ? cookiePath : "/",
      sameSite,
      secure: true,
      value,
    };
  });
}

export function createRestrictedChildEnvironment(
  sourceEnvironment,
  explicitEnvironment = {},
) {
  const restricted = {};

  for (const key of SAFE_CHILD_ENVIRONMENT_KEYS) {
    const value = sourceEnvironment?.[key];

    if (typeof value === "string") {
      restricted[key] = value;
    }
  }

  for (const [key, value] of Object.entries(explicitEnvironment)) {
    if (typeof value === "string") {
      restricted[key] = value;
    }
  }

  return restricted;
}
