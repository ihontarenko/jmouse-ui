import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { appearanceBootScript } from "../../packages/ui-kit/src/appearance/appearance";
import { showcaseStoragePrefix, showcaseThemes } from "./src/catalogue";

const source = (path: string) => fileURLToPath(new URL(`../../packages/ui-kit/src/${path}`, import.meta.url));

/*
 * The UI-kit's reference host. It reads the package's SOURCE through the aliases below, so editing a component or a
 * stylesheet shows at once; a product reads the built `dist` through the package's exports instead. The boot script is
 * written into the page's head, as a product's index.html carries it, so the stored theme is on <html> before the
 * first paint.
 */
export default defineConfig({
  plugins: [
    react(),
    {
      name: "ui-kit-appearance-boot",
      transformIndexHtml(html) {
        return html.replace("<!-- appearance-boot -->", `<script>${appearanceBootScript(showcaseStoragePrefix, showcaseThemes)}</script>`);
      },
    },
  ],
  resolve: {
    alias: [
      { find: "@jmouse/ui-kit/styles.css", replacement: source("styles/index.css") },
      { find: "@jmouse/ui-kit/code.css", replacement: source("styles/code.css") },
      { find: /^@jmouse\/ui-kit\/code$/, replacement: source("code/index.ts") },
      { find: /^@jmouse\/ui-kit$/, replacement: source("index.ts") },
      { find: /^@jmouse\/file-handling$/, replacement: fileURLToPath(new URL("../../packages/file-handling/src/index.ts", import.meta.url)) },
      { find: /^@jmouse\/explorer$/, replacement: fileURLToPath(new URL("../../packages/explorer/src/index.ts", import.meta.url)) },
    ],
    dedupe: ["react", "react-dom", "@codemirror/state", "@codemirror/view", "@codemirror/language", "@lezer/common", "@lezer/highlight"],
  },
  server: { port: 5121, strictPort: true },
});
