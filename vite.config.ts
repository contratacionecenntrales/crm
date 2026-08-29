// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Lovable Cloud always builds for Cloudflare Workers regardless of this
// setting. Outside Lovable's sandbox:
//   - DEPLOY_TARGET=node   -> plain Node server at .output/server/index.mjs
//                             (VPS or cPanel "Setup Node.js App")
//   - DEPLOY_TARGET=static -> fully static HTML/JS/CSS in .output/public,
//                             no server at all (classic shared hosting,
//                             e.g. Hostalia, that only serves plain files)
// See README.md.
const deployTarget = process.env["DEPLOY_TARGET"];
const deployingToNode = deployTarget === "node";
const deployingStatic = deployTarget === "static";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(deployingStatic
      ? {
          prerender: { enabled: true, crawlLinks: true },
          pages: [{ path: "/" }, { path: "/auth" }],
        }
      : {}),
  },
  ...(deployingToNode ? { nitro: { preset: "node-server" } } : {}),
});
