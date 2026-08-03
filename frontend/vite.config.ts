import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const previewApiProxyTarget =
  process.env.GRAPEVYNE_API_PROXY_TARGET || "http://127.0.0.1:5000";
const shareImagePath =
  "/assets/video/posters/desktop/hero-bottle-macro.desktop.jpg";

function vercelDeploymentOrigin() {
  if (process.env.VERCEL !== "1") return null;

  const hostname = process.env.VERCEL_URL?.trim().toLowerCase();

  if (!hostname) return null;

  if (
    !hostname.endsWith(".vercel.app") ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+vercel\.app$/.test(
      hostname,
    )
  ) {
    throw new Error("VERCEL_URL must be an exact vercel.app hostname.");
  }

  return `https://${hostname}`;
}

const deploymentOrigin = vercelDeploymentOrigin();

export default defineConfig({
  build: {
    assetsDir: "build",
    manifest: true,
  },
  plugins: [
    react(),
    {
      name: "grapevyne-preview-share-metadata",
      transformIndexHtml(html) {
        if (!deploymentOrigin) return html;

        return html.replaceAll(
          `content="${shareImagePath}"`,
          `content="${deploymentOrigin}${shareImagePath}"`,
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        changeOrigin: true,
        target: "http://127.0.0.1:5000",
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        changeOrigin: true,
        target: previewApiProxyTarget,
      },
    },
  },
});
