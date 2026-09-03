import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our
      // SSR security-headers wrapper).
      server: { entry: "server" },
    }),
    viteReact(),
    // Nitro only matters for `vite build`; the dev server doesn't need it.
    // node-server always: for a fully static export (DEPLOY_TARGET=static,
    // see package.json's build:static / scripts/export-static.mjs) we still
    // build a real Node server first and scrape its rendered HTML, rather
    // than relying on TanStack Start's built-in prerenderer.
    ...(command === "build" ? [nitro({ preset: "node-server" })] : []),
  ],
}));
