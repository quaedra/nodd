import { createReadStream, existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { type Plugin, defaultClientConditions, defineConfig } from "vite";

// COOP/COEP make the page crossOriginIsolated → multi-threaded WASM for onnxruntime-web.
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

// onnxruntime-web dynamically imports its .mjs loader from wasmPaths; the dev server would try to
// transform files under public/ and refuse. Serve /ort/* raw (production builds already do).
const serveOrtRaw: Plugin = {
  name: "serve-ort-raw",
  configureServer(server) {
    server.middlewares.use("/ort", (req, res, next) => {
      const file = resolve(import.meta.dirname, "public/ort", (req.url ?? "").split("?")[0].replace(/^\//, ""));
      if (!file.startsWith(resolve(import.meta.dirname, "public/ort")) || !existsSync(file)) return next();
      const type = extname(file) === ".wasm" ? "application/wasm" : "text/javascript";
      res.writeHead(200, { "Content-Type": type, ...isolation });
      createReadStream(file).pipe(res);
    });
  },
};

export default defineConfig({
  plugins: [react(), serveOrtRaw],
  // @nodd/* resolve to their TypeScript sources (packages/*/src), not dist/
  resolve: { conditions: ["@nodd/source", ...defaultClientConditions] },
  // "/" locally; BASE=/nodd/ for quaedra.com (scripts/deploy.sh)
  base: process.env.BASE ?? "/",
  root: "demo",
  publicDir: resolve(import.meta.dirname, "public"),
  server: { headers: isolation, fs: { allow: [".."] } },
  preview: { headers: isolation },
  optimizeDeps: { exclude: ["onnxruntime-web"] },
  worker: { format: "es" },
  build: {
    outDir: resolve(import.meta.dirname, "dist-demo"),
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "demo/index.html"),
        bench: resolve(import.meta.dirname, "demo/bench.html"),
        parity: resolve(import.meta.dirname, "demo/parity.html"),
        docs: resolve(import.meta.dirname, "demo/docs.html"),
        models: resolve(import.meta.dirname, "demo/models.html"),
        model: resolve(import.meta.dirname, "demo/model.html"),
        train: resolve(import.meta.dirname, "demo/train.html"),
      },
    },
  },
});
