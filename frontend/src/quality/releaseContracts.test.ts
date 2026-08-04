import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = process.cwd();
const repositoryRoot = path.resolve(frontendRoot, "..");
const packageManifest = JSON.parse(
  readFileSync(path.join(frontendRoot, "package.json"), "utf8"),
) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};
const packageLock = JSON.parse(
  readFileSync(path.join(frontendRoot, "package-lock.json"), "utf8"),
) as { packages: Record<string, { version?: string }> };
const workflow = readFileSync(
  path.join(repositoryRoot, ".github", "workflows", "ci.yml"),
  "utf8",
);
const backendRequirements = readFileSync(
  path.join(repositoryRoot, "backend", "requirements.txt"),
  "utf8",
);
const backendDevRequirements = readFileSync(
  path.join(repositoryRoot, "backend", "requirements-dev.txt"),
  "utf8",
);

describe("Prompt 09A release contracts", () => {
  it("keeps every remediated direct dependency on its reviewed exact version", () => {
    expect(packageManifest.dependencies["@react-three/drei"]).toBe("9.122.0");
    expect(packageManifest.dependencies["react-router-dom"]).toBe("6.30.4");
    expect(packageManifest.devDependencies["@vitejs/plugin-react"]).toBe("4.7.0");
    expect(packageManifest.devDependencies.vite).toBe("6.4.3");

    expect(packageLock.packages["node_modules/@react-three/drei"]?.version).toBe(
      "9.122.0",
    );
    expect(packageLock.packages["node_modules/react-router-dom"]?.version).toBe(
      "6.30.4",
    );
    expect(packageLock.packages["node_modules/vite"]?.version).toBe("6.4.3");
    expect(backendRequirements).toMatch(/^Flask==3\.1\.3$/m);
    expect(backendRequirements).toMatch(/^Flask-Cors==6\.0\.5$/m);
    expect(backendRequirements).toMatch(/^python-dotenv==1\.2\.2$/m);
    expect(backendDevRequirements).toMatch(/^pytest==9\.0\.3$/m);
  });

  it("keeps CI immutable, least-privilege, security-gated, and non-deploying", () => {
    const actionReferences = [...workflow.matchAll(/uses:\s+actions\/[^@\s]+@([^\s#]+)/g)];

    expect(actionReferences.length).toBeGreaterThan(0);
    expect(actionReferences.every(([, reference]) => /^[0-9a-f]{40}$/.test(reference ?? ""))).toBe(
      true,
    );
    expect(workflow).toMatch(/permissions:\s+contents:\s+read/);
    expect(workflow).toMatch(/NODE_VERSION:\s+"20\.19\.6"/);
    expect(workflow).toMatch(/PYTHON_VERSION:\s+"3\.12\.12"/);
    expect(workflow).toMatch(/npm audit --audit-level=high/);
    expect(workflow).toMatch(/python -m pip_audit/);
    expect(workflow).toMatch(
      /python -m bandit[^\n]*--severity-level medium/,
    );
    expect(workflow).not.toMatch(/pull_request_target/);
    expect(workflow).not.toMatch(/\b(?:vercel|deploy(?:ment)?)\b/i);
    expect(workflow).not.toMatch(/\$\{\{\s*secrets\./);
  });
});
