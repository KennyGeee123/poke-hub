import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

/** Nitro/srvx writeHead crashes on public/adventure.html in local Node 22. Serve it first. */
function serveAdventureHtml(): Plugin {
  const files: Record<string, { file: string; type: string }> = {
    "/adventure.html": { file: "adventure.html", type: "text/html; charset=utf-8" },
    "/adventure-world.js": { file: "adventure-world.js", type: "text/javascript; charset=utf-8" },
  };
  return {
    name: "serve-adventure-html",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || "").split("?")[0];
        const hit = files[path];
        if (!hit) return next();
        const full = join(process.cwd(), "public", hit.file);
        if (!existsSync(full)) return next();
        const { size } = statSync(full);
        res.statusCode = 200;
        res.setHeader("content-type", hit.type);
        res.setHeader("content-length", String(size));
        res.setHeader("cache-control", "no-cache");
        createReadStream(full).pipe(res);
      });
    },
  };
}

// Stock Vite + TanStack Start + React + Tailwind for Vercel (via Nitro).
// server.entry "server" resolves to src/server.ts (SSR error wrapper).
export default defineConfig({
  plugins: [
    serveAdventureHtml(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    nitro(),
    viteReact(),
  ],
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "@tanstack/react-router",
      "@tanstack/react-query",
      "@tanstack/react-start",
    ],
  },
});
