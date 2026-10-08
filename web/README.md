# Nodd web

npm workspaces with the [Nodd](../docs/SPEC.md) JavaScript packages and the demo site.

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

The public site at https://quaedra.com/nodd is built and deployed from the
[quaedra/www](https://github.com/quaedra/www) repository, which carries its own copy of these
pages (`src/nodd/`) and builds `@nodd/browser` and `@nodd/core` from this checkout. The demo here
is the development and test harness: `npm run dev`, `parity`, `bench` and `offline` drive it.
To publish new models, run `npm run sync-model` here, then `npm run sync-nodd` and
`npm run deploy` in www.
