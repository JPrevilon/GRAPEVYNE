import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const viteConfigSource = readFileSync(
  path.resolve(process.cwd(), "vite.config.ts"),
  "utf8",
);

describe("local API topology", () => {
  it("proxies same-origin /api requests to the explicit local Flask target", () => {
    expect(viteConfigSource).toMatch(
      /["']\/api["']\s*:\s*{[\s\S]*?changeOrigin:\s*true,[\s\S]*?target:\s*["']http:\/\/127\.0\.0\.1:5000["']/,
    );
    expect(viteConfigSource).not.toMatch(/localhost:5000/);
  });
});
