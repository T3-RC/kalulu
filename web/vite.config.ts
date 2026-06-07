import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// The web app imports the shared client from ../spacetimedb/client. Allow Vite's
// dev server to read files from the repo root (one level up from /web).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@client": resolve(__dirname, "../spacetimedb/client/src"),
    },
    // Force a single copy of these even though the client lives in a sibling
    // folder with its own node_modules — prevents mixed SpacetimeDB versions.
    dedupe: ["spacetimedb", "react", "react-dom"],
  },
  server: {
    fs: { allow: [resolve(__dirname, ".."), __dirname] },
  },
});
