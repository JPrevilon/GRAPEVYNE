import { describe, expect, it } from "vitest";

import {
  createRestrictedChildEnvironment,
  normalizeHostedPreviewBaseUrl,
  parseSetCookiesForStorageState,
  validateHostedPreviewDeployment,
  validateHostedPreviewHealth,
  validatePreviewDatabaseSentinel,
} from "./hosted-preview-contract.mjs";

const currentCommit = "0123456789abcdef0123456789abcdef01234567";
const otherCommit = "fedcba9876543210fedcba9876543210fedcba98";
const baseUrl = "https://grapevyne-git-feature-example.vercel.app";
const readyPreview = {
  id: "dpl_prompt10a",
  name: "grapevyne",
  readyState: "READY",
  target: "preview",
  url: "grapevyne-git-feature-example.vercel.app",
};
const readyMetadata = {
  id: readyPreview.id,
  meta: { githubCommitSha: currentCommit },
  name: readyPreview.name,
  url: readyPreview.url,
};
const previewSentinel = "grapevyne-preview-prompt10a";

function validate(deployment = readyPreview, metadata = readyMetadata) {
  return validateHostedPreviewDeployment(
    deployment,
    baseUrl,
    "grapevyne",
    currentCommit,
    metadata,
  );
}

describe("hosted Preview URL guard", () => {
  it("normalizes one immutable HTTPS Vercel deployment origin", () => {
    expect(normalizeHostedPreviewBaseUrl(`${baseUrl}/`)).toBe(baseUrl);
  });

  it.each([
    "",
    "http://grapevyne-git-feature-example.vercel.app",
    "https://127.0.0.1:4173",
    "https://*.vercel.app",
    "https://-invalid.vercel.app",
    "https://grapevyne.example.com",
    `${baseUrl}/discover`,
    `${baseUrl}?token=secret`,
    "https://user:password@grapevyne-git-feature-example.vercel.app",
  ])("rejects an unsafe hosted target: %s", (candidate) => {
    expect(() => normalizeHostedPreviewBaseUrl(candidate)).toThrow();
  });

  it("accepts a READY Preview from the linked project and current Git HEAD", () => {
    expect(validate()).toEqual({
      baseUrl,
      deployedCommitSha: currentCommit,
      deploymentId: "dpl_prompt10a",
      projectName: "grapevyne",
    });
  });

  it.each([
    ["production target", { ...readyPreview, target: "production" }],
    ["non-ready deployment", { ...readyPreview, readyState: "ERROR" }],
    ["unrelated project", { ...readyPreview, name: "unrelated-app" }],
    [
      "branch or production alias",
      { ...readyPreview, url: "another-deployment.vercel.app" },
    ],
    ["malformed deployment ID", { ...readyPreview, id: "production" }],
  ])("rejects a %s", (_label, deployment) => {
    expect(() => validate(deployment)).toThrow();
  });
});

describe("hosted Preview Git binding", () => {
  it.each([
    ["GitHub metadata", { meta: { githubCommitSha: currentCommit } }],
    ["GitLab metadata", { meta: { gitlabCommitSha: currentCommit } }],
    ["Bitbucket metadata", { meta: { bitbucketCommitSha: currentCommit } }],
    ["gitSource metadata", { gitSource: { sha: currentCommit } }],
    [
      "nested REST metadata",
      { deployment: { meta: { githubCommitSha: currentCommit } } },
    ],
  ])("accepts %s", (_label, metadata) => {
    expect(validate(readyPreview, metadata).deployedCommitSha).toBe(currentCommit);
  });

  it.each([
    ["missing SHA", { ...readyMetadata, meta: {} }],
    [
      "wrong SHA",
      { ...readyMetadata, meta: { githubCommitSha: otherCommit } },
    ],
    [
      "abbreviated SHA",
      { ...readyMetadata, meta: { githubCommitSha: currentCommit.slice(0, 12) } },
    ],
    [
      "conflicting SHA",
      {
        ...readyMetadata,
        gitSource: { sha: otherCommit },
        meta: { githubCommitSha: currentCommit },
      },
    ],
    ["mismatched deployment ID", { ...readyMetadata, id: "dpl_unrelated" }],
    [
      "mismatched deployment URL",
      { ...readyMetadata, url: "unrelated-deployment.vercel.app" },
    ],
  ])("rejects %s", (_label, metadata) => {
    expect(() => validate(readyPreview, metadata)).toThrow();
  });
});

describe("hosted Preview health contract", () => {
  const healthyPayload = {
    data: {
      deployment: {
        databaseSentinel: previewSentinel,
        databaseVerified: true,
        environment: "preview",
      },
      phase: "foundation",
      service: "grapevyne-api",
      status: "ok",
    },
  };

  it("accepts an exact Preview database attestation", () => {
    expect(validateHostedPreviewHealth(healthyPayload, previewSentinel)).toBe(
      true,
    );
  });

  it.each([
    [
      "production environment",
      {
        ...healthyPayload,
        data: {
          ...healthyPayload.data,
          deployment: {
            ...healthyPayload.data.deployment,
            environment: "production",
          },
        },
      },
    ],
    [
      "unverified database",
      {
        ...healthyPayload,
        data: {
          ...healthyPayload.data,
          deployment: {
            ...healthyPayload.data.deployment,
            databaseVerified: false,
          },
        },
      },
    ],
    [
      "wrong sentinel",
      {
        ...healthyPayload,
        data: {
          ...healthyPayload.data,
          deployment: {
            ...healthyPayload.data.deployment,
            databaseSentinel: "grapevyne-preview-wrong",
          },
        },
      },
    ],
    ["missing deployment contract", { data: { status: "ok" } }],
  ])("rejects a %s", (_label, payload) => {
    expect(() =>
      validateHostedPreviewHealth(payload, previewSentinel),
    ).toThrow();
  });

  it.each([
    "",
    "preview",
    "grapevyne-production-prompt10a",
    "grapevyne-preview-invalid_underscore",
  ])("rejects invalid Preview sentinel %s", (sentinel) => {
    expect(() => validatePreviewDatabaseSentinel(sentinel)).toThrow();
  });
});

describe("hosted Preview bypass state", () => {
  it("scopes a bypass cookie to the exact generated deployment hostname", () => {
    const [cookie] = parseSetCookiesForStorageState(
      [
        "_vercel_jwt=opaque-value==; Path=/; Max-Age=3600; Domain=.vercel.app; HttpOnly; Secure; SameSite=None",
      ],
      baseUrl,
    );

    expect(cookie).toMatchObject({
      domain: "grapevyne-git-feature-example.vercel.app",
      httpOnly: true,
      name: "_vercel_jwt",
      path: "/",
      sameSite: "None",
      secure: true,
      value: "opaque-value==",
    });
    expect(cookie.expires).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it.each([
    ["non-array input", "_vercel_jwt=value"],
    ["header injection", ["_vercel_jwt=value\r\nX-Test: bad"]],
    ["empty value", ["_vercel_jwt=; Path=/"]],
    ["expired value", ["_vercel_jwt=value; Max-Age=0"]],
  ])("rejects %s", (_label, values) => {
    expect(() => parseSetCookiesForStorageState(values, baseUrl)).toThrow();
  });
});

describe("hosted Preview child environment", () => {
  it("keeps only runtime allowlist keys plus explicit non-secret runner state", () => {
    const environment = createRestrictedChildEnvironment(
      {
        DATABASE_URL: "postgresql://secret",
        GITHUB_TOKEN: "github-secret",
        HOME: "/safe-home",
        OPENAI_API_KEY: "provider-secret",
        PATH: "/safe-bin",
        SECRET_KEY: "session-secret",
        VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-secret",
        VERCEL_TOKEN: "vercel-secret",
      },
      {
        GRAPEVYNE_E2E_MODE: "hosted-preview",
        PLAYWRIGHT_BASE_URL: baseUrl,
      },
    );

    expect(environment).toEqual({
      GRAPEVYNE_E2E_MODE: "hosted-preview",
      HOME: "/safe-home",
      PATH: "/safe-bin",
      PLAYWRIGHT_BASE_URL: baseUrl,
    });
    expect(Object.values(environment)).not.toContain("bypass-secret");
  });
});
