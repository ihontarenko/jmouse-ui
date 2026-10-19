import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { appearanceBootScript, defaultAppearance, standardThemes } from "../../packages/ui-kit/src/appearance/appearance";
import { burinDefaults, burinStoragePrefix } from "./src/appearance";

const source = (path: string) => fileURLToPath(new URL(`../../packages/ui-kit/src/${path}`, import.meta.url));

/*
 * Burin's editor on the kit. It reads the kit's SOURCE through the aliases below, as the showcase does; the boot script
 * puts the stored appearance on <html> before the first paint.
 */
export default defineConfig({
  plugins: [
    react(),
    {
      name: "burin-appearance-boot",
      transformIndexHtml(html) {
        return html.replace("<!-- appearance-boot -->", `<script>${appearanceBootScript(burinStoragePrefix, standardThemes, { ...defaultAppearance, ...burinDefaults })}</script>`);
      },
    },
  ],
  resolve: {
    alias: [
      { find: "@jmouse/ui-kit/styles.css", replacement: source("styles/index.css") },
      { find: /^@jmouse\/ui-kit$/, replacement: source("index.ts") },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: { port: 5122, strictPort: true },
});
