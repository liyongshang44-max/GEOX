import { defineConfig } from "vite"; // Import Vite config helper.
import react from "@vitejs/plugin-react"; // Import React plugin for Vite.
import path from "node:path"; // Import Node path utilities.

const webRoot = path.resolve(__dirname); // Resolve apps/web as the Vite project root.
const apiProxyTarget = process.env.GEOX_WEB_PROXY_TARGET || "http://127.0.0.1:3001"; // Host default; container can override to http://server:3000.
const hmrHost = process.env.GEOX_WEB_HMR_HOST;
const parsedHmrPort = process.env.GEOX_WEB_HMR_PORT ? Number(process.env.GEOX_WEB_HMR_PORT) : undefined;
const hmrPort = Number.isFinite(parsedHmrPort) ? parsedHmrPort : undefined;

export default defineConfig({
  root: webRoot, // Force Vite root to apps/web so index.html is found correctly.
  plugins: [react({ include: /\.[jt]sx?$/ })], // Enable React transform for JS/TS JSX files.
  resolve: {
    alias: {
      "@geox/contracts": path.resolve(__dirname, "../../packages/contracts/src/index.ts"), // Map contracts alias to workspace source file.
    },
  },
  esbuild: {
    loader: "tsx", // Parse matching source files with TSX loader.
    include: /src\/.*\.[jt]sx?$/, // Apply loader to web src JS/TS/JSX/TSX files.
    exclude: [], // Do not exclude additional files from the loader rule.
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx", // Treat dependency JS files as JSX when needed.
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: hmrHost || hmrPort
      ? {
          host: hmrHost,
          port: hmrPort,
        }
      : undefined,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"), // Output build files into apps/web/dist.
    emptyOutDir: true, // Clean dist before each build.
  },
});
