# CLAUDE.md — nodd

**nodd** (formerly microdecide): a framework that turns a Jev-style task spec
(input + fixed set of typed outputs) into a tiny, fast, calibrated model
trained for that one use case, that **runs in the browser** (WASM/WebGPU),
with automatic escalation to a bigger "teacher" model when it is unsure.

Full design: `docs/SPEC.md`. Build plan: `docs/ROADMAP.md`.
Example spec: `examples/comment_moderation.yaml`.

## How to work in this repo

- Build **one milestone at a time** from `docs/ROADMAP.md`. Do not start the
  next milestone until the current one's acceptance criteria pass.
- After each milestone: run `uv run pytest`, then summarize what was built
  and what's next. Update the checkbox in `docs/ROADMAP.md`.
- Keep it minimal. Prefer a few clear modules over abstractions. No plugin
  systems until a second implementation actually exists.
- **Tiny models only**: target ~30 MB downloads. Every model is a fine-tuned small encoder.
  The decoder tier (SmolLM2/Qwen, 115–500 MB) was built, measured and dropped
  on purpose — don't reintroduce large models (see ROADMAP M5). The static
  tier (model2vec + logistic regression) was removed too: it lost to the
  encoder at similar size.
- Models must **run in the browser** (transformers.js / onnxruntime-web, WASM by
  default) and must **train on CPU**.
- Classification is **one forward pass, no text generation**.

## Stack

- Python 3.11+, managed with `uv`
- `pydantic` v2 for the spec and all typed outputs
- `typer` for the CLI
- `scikit-learn` for metrics
- `model2vec` (static embeddings) for near-duplicate detection when collecting data
- `setfit` / `sentence-transformers` for the encoder tier
- `transformers` + `torch` for the encoder tier (fine-tuned classification head)
- `torch.onnx.export` (dynamo, needs `onnxscript`) + `onnxruntime.quantization` for ONNX
  export + int8 quantization (`optimum-onnx` pins transformers < 4.58, incompatible with v5)
- **JS runtime** in `web/` (npm workspaces, published under the `@nodd` org):
  `@nodd/core` (model format, `Decision`, decision logic), `@nodd/browser`
  (transformers.js on onnxruntime-web, Web Worker, Cache API), `@nodd/node`
  (transformers.js on onnxruntime-node, loads the export folder from disk).
  TypeScript, built with `tsc`; the demo + benchmark site is built with `vite`
- `fastapi` + `uvicorn` for the escalation/feedback server
- `pytest` for tests

Add dependencies only when the milestone needs them.

## Commands

```bash
uv sync                          # install
uv run pytest                    # tests
uv run nodd run examples/comment_moderation.yaml   # full pipeline (→ export)
uv run nodd train examples/comment_moderation.yaml --tier encoder
uv run nodd compare runs/comment_moderation/v2 runs/comment_moderation/v3

cd web && npm install
npm run sync-model               # copy every runs/*/v*/export + ORT wasm into public/, write models/index.json
npm run dev                      # demo at /, /repository.html, /model.html?model=…, /docs.html, /bench.html, /parity.html
npm test && npm run typecheck    # vitest (incl. @nodd/node parity vs Python) + tsc
npm run build                    # tsc → packages/*/dist; publish: npm publish --workspaces (2FA: run in your own terminal)
MODEL=/models/<task>/<version> npm run parity   # headless Chromium: labels vs Python ≥ 99.5%
npm run bench                    # → export/bench.json; `nodd eval` adds it to report.md
npm run offline                  # network cut: page + model reload from caches, still classifies
npm run deploy                   # build for /nodd/app/, deploy to Cloudflare → quaedra.com/nodd/app/
SITE=https://quaedra.com/nodd/app/ npm run parity   # run the browser checks against the live site
```

## Rules

- **Never put teacher API keys in browser code.** Browser escalation calls
  the user's own server endpoint, which calls the teacher.
- **Never** hardcode or commit API keys. Read from env:
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `TYPESAFE_API_KEY`.
- **Cache every teacher call** on disk (keyed by hash of teacher + prompt +
  input). Teacher calls cost money; re-running the pipeline must be free.
- Tests must not hit real APIs. Use a `FakeTeacher` that labels with simple
  keyword rules.
- Every model output follows the `Decision` schema in `docs/SPEC.md`.
  Never return a label outside the spec's label set.
- Determinism: fix random seeds; record them in the run metadata.
- Artifacts go under `runs/<task>/<version>/`, never into `src/`.
- The Jev teacher adapter (M7) must be written against TypeSafe's current
  official API docs — check them first; don't guess endpoints or fields.
