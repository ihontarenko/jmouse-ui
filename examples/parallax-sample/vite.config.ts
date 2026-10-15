import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
 * A second host for the Parallax packages. It is outside the root's `workspaces` (`packages/*`) on purpose: nothing
 * builds or publishes it, and it resolves react, three and the packages through the monorepo root's node_modules —
 * the same single copies the packages are built against.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // One copy of each: two of three are two WebGL worlds, two of @codemirror/state refuse to share an editor.
    dedupe: ["react", "react-dom", "three", "katex", "@jmouse/parallax", "@jmouse/codemirror", "@codemirror/state", "@codemirror/view",
      "@codemirror/language", "@codemirror/autocomplete", "@lezer/common", "@lezer/highlight"],
  },
  server: {
    port: 5120,
    strictPort: true,
    proxy: {
      // The host's own routes (sign-in) and the library's routes and live socket, all served by Parallax's backend.
      "/api": { target: "http://localhost:8160", changeOrigin: true },
      "/jmouse": { target: "http://localhost:8160", changeOrigin: true, ws: true },
    },
  },
});
