import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const previewApiProxyTarget =
  process.env.GRAPEVYNE_API_PROXY_TARGET || "http://127.0.0.1:5000";

export default defineConfig({
  build: {
    manifest: true,
  },
  plugins: [react()],
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
