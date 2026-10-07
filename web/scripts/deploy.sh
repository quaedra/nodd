#!/usr/bin/env bash
# Build the site and deploy it to https://quaedra.com/nodd/ (Cloudflare Worker, see wrangler.jsonc).
#   scripts/deploy.sh                 (from web/; needs exported models, see CLAUDE.md)
#   scripts/deploy.sh --reuse-models  (use existing public/ artifacts without runs/)
set -euo pipefail
cd "$(dirname "$0")/.."

export BASE="/nodd/"
case "${1:-}" in
  "") node scripts/sync-model.mjs ;;
  --reuse-models)
    [ -f public/models/index.json ] && [ -d public/ort ] || {
      echo "missing public/models/index.json or public/ort; restore the deployed artifacts first"
      exit 1
    }
    ;;
  *) echo "usage: $0 [--reuse-models]"; exit 1 ;;
esac
npx vite build
node scripts/check-social-preview.mjs

# lean site: the fp32 encoder (70 MB) is only an optional WebGPU variant
find dist-demo/models -path '*/onnx/model.onnx' -delete
for cfg in dist-demo/models/*/*/nodd.json; do
  node -e 'const f=process.argv[1],fs=require("fs"),c=JSON.parse(fs.readFileSync(f));if(c.onnx)delete c.onnx.fp32_file;fs.writeFileSync(f,JSON.stringify(c))' "$cfg"
done

# The asset directory mirrors the URL path.
rm -rf dist-site
mkdir -p dist-site
cp -R dist-demo dist-site/nodd
cat > dist-site/_headers <<'HEADERS'
/nodd/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: same-origin
HEADERS

# Workers assets cap files at 25 MiB: split larger ones; worker/index.js reassembles them.
node -e '
const fs = require("fs"), path = require("path");
const LIMIT = 24 * 1024 * 1024;
const types = { ".wasm": "application/wasm", ".zip": "application/zip", ".onnx": "application/octet-stream" };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk("dist-site")) {
  const size = fs.statSync(f).size;
  if (size <= LIMIT) continue;
  const buf = fs.readFileSync(f);
  const parts = Math.ceil(size / LIMIT);
  for (let i = 0; i < parts; i++) fs.writeFileSync(`${f}.part${i}`, buf.subarray(i * LIMIT, (i + 1) * LIMIT));
  fs.writeFileSync(`${f}.parts.json`, JSON.stringify({ parts, size, type: types[path.extname(f)] ?? "application/octet-stream" }));
  fs.unlinkSync(f);
  console.log(`split ${f} (${(size / 1048576).toFixed(1)} MiB) into ${parts} parts`);
}'
echo "site: $(du -sh dist-site | cut -f1)"

npx wrangler deploy
echo "deployed → https://quaedra.com/nodd/"
