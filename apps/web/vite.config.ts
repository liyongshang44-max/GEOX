// GEOX/apps/web/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const apiTarget = process.env.GEOX_WEB_API_TARGET ?? "http://127.0.0.1:3001"; // Match docker-compose server default port used in acceptance.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve contracts from monorepo source (no build step).
      "@geox/contracts": path.resolve(__dirname, "../../packages/contracts/src/index.ts"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/media": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
