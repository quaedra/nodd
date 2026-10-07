# nodd web

npm workspaces with the [nodd](../docs/SPEC.md) JavaScript packages and the demo site.

| package | runs on | what it adds |
|---|---|---|
| [`@nodd/browser`](packages/browser) | browser: onnxruntime-web, WASM (WebGPU opt-in) | Web Worker, Cache API (offline), download progress |
| [`@nodd/node`](packages/node) | Node ≥ 20: onnxruntime-node, native CPU | loads the export folder from disk |
| [`@nodd/core`](packages/core) | both | `nodd.json` validator, `Decision`, logits → decision |

`@nodd/browser` and `@nodd/node` have the same API (`nodd.load`, `decide`, `decideBatch`,
`isConfident`), so the same export folder answers the same way on either side.

```sh
npm run build          # tsc → packages/*/dist (core first)
npm publish --workspaces  # publish all three to the @nodd org (after npm test, npm run build)
```

In development, Vite, Vitest and `tsc` resolve `@nodd/*` to `packages/*/src` through the
`@nodd/source` export condition, so nothing needs building first.

## Demo site

`demo/` is a static React site (Vite, one HTML entry per page, so deep links work on GitHub Pages
without a router): `index.html` (demo, benchmark, parity), `repository.html` (Community page linking
to the community's Hugging Face models), `model.html?model=…`, `docs.html`, `bench.html`,
`parity.html`. Pages live in `demo/pages/`, shared components in `demo/ui/`. React is a dev
dependency only; the library in `src/` doesn't use it.

Development: see the Commands section in [CLAUDE.md](../CLAUDE.md).

## Development checks

`npm test` generates deterministic Python model-export fixtures with
uv, then runs all Node tests including parity. Run `uv sync --locked` at the repo
root first. No pretrained downloads or existing run artifacts are required.
`npm run test:browser` checks the built pages with those fixtures (requires
`npx playwright install chromium`).

Artifact schemas are owned by Python and compiled for browser validation with
`npm run schema`. See [the architecture notes](../docs/ARCHITECTURE.md) for module
ownership, compatibility entry points, and regeneration commands.

The site is served from https://quaedra.com/nodd/app/ by a Cloudflare Worker
(`wrangler.jsonc`, `worker/index.js`). To deploy UI changes from a checkout without trained
`runs/`, reuse the archived model assets:

```sh
git fetch origin gh-pages
git archive origin/gh-pages models ort training | tar -x -C public
npm run deploy -- --reuse-models
```

The default deployment command still syncs artifacts from local training runs.
