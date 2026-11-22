import { defineConfig } from "vite"; // GitHub Pages build only.
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname),
  base: "/Dashboard-Usage/",
  publicDir: path.resolve(__dirname, "public"),
  build: {
    outDir: path.resolve(__dirname, "../dist-pages"),
    emptyOutDir: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "../src") },
  },
});
