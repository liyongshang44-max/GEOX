import { defineConfig } from "vite"; // Import Vite config helper.
import react from "@vitejs/plugin-react"; // Import React plugin for Vite.
import path from "node:path"; // Import Node path utilities.

const webRoot = path.resolve(__dirname); // Resolve apps/web as the Vite project root.

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
  proxy: {
    "/api": {
      target: "http://127.0.0.1:3001",
      changeOrigin: true,
    },
  },
},
  build: {
    outDir: path.resolve(__dirname, "dist"), // Output build files into apps/web/dist.
    emptyOutDir: true, // Clean dist before each build.
  },
});