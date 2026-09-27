import { defineConfig } from "vite";
import autoprefixer from "autoprefixer";

// GitHub Pages serves this repository under /wavsorterV2/.
// All runtime public assets use import.meta.env.BASE_URL, so this is the
// only deployment path that needs to be changed if the repo is renamed.
const GITHUB_PAGES_BASE = "/wavsorterV2/";

export default defineConfig({
  base: GITHUB_PAGES_BASE,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    rollupOptions: {
      input: "index.html"
    }
  },
  css: {
    postcss: {
      plugins: [autoprefixer]
    }
  }
});
