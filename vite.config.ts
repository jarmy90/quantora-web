import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// When building on Vercel (VERCEL=1 is always set by their build system),
// use the vercel preset so Nitro produces a Vercel-compatible serverless output
// and import.meta.env.VITE_* variables are correctly injected at build time.
const nitroPreset = process.env["VERCEL"] === "1" ? "vercel" : "node-server";

export default defineConfig({
  optimizeDeps: {
    // The TanStack Start plugin injects virtual modules (#tanstack-router-entry,
    // #tanstack-start-entry, tanstack-start-manifest:v) that esbuild cannot
    // resolve during dependency pre-bundling – let Vite serve these modules
    // directly instead of optimizing them.
    exclude: ["@tanstack/start-server-core", "@tanstack/react-start-server"],
  },
  server: {
    port: 3000,
    host: true,
    // The site is reverse-proxied behind <label>.<PUBLIC_SITE_DOMAIN>; the proxy
    // masks the Host to localhost:3000, but accept any host so a dev server never
    // rejects a proxied request with "Blocked request".
    allowedHosts: true,
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    nitro({ preset: nitroPreset }),
    viteReact(),
  ],
});