# Code organization

The Python package builds and evaluates models; `web/packages` holds the npm packages
(`@nodd/core` shared, `@nodd/browser`, `@nodd/node`); `web/demo` is the React demo site. Keep UI state and browser navigation out of
library code. The CLI coordinates existing pipeline functions.

## Python

- `spec.py`: user task specifications and decisions.
- `artifacts.py`: versioned model configs and model cards, validated on write and
  load. Legacy cards without `artifact_version` are treated as version 1. Browser
  model configs remain format version 2.
- `classifiers.py`: the inference `Classifier` protocol and built-in loaders.
  Both runtime and training use this module; runtime does not import training.
- `encoder.py`: the model (a fine-tuned sentence encoder) and fitting.
- `train.py`: candidate selection, calibration, and saving a run.
- `export.py`: export orchestration and compatibility exports.
  `exporters/encoder.py` owns the artifact writer and ONNX reference inference;
  `exporters/common.py` owns parity metrics and shared helpers.
- `evaluate.py`: measurement and report data; `reporting.py`: Markdown rendering.
- `data.py`, `teachers/`, `synth.py`: collection, labeling, and generation.

The existing `nodd.export` functions, `train.classifier_for`, and
`evaluate.render_markdown` remain importable. Prefer the owning modules in new
internal code. There is one tier (encoder); `tier` stays in the artifacts for format stability.

## Browser library and demo

`model.ts` loads a config, selects an engine, and produces decisions. `index.ts`
provides the public API and chooses main-thread or worker execution. The engine
interface remains in `engines.ts`.

`@nodd/browser/training` is a separate entry point for full encoder fine-tuning. Its worker
owns `training/session.ts`; `bert.ts` implements differentiable BERT and AdamW, `bundle.ts`
handles portable safetensors checkpoints, and `data.ts` owns splits, metrics, and calibration.
The UI calls a full training-step probe before enabling training. `src/nodd/browser_training.py`
prepares base checkpoints and imports trained weights into the native eval/export pipeline.
See [browser training](BROWSER_TRAINING.md) for capabilities and limits.

`rpc.ts` owns request correlation, progress delivery, error handling, and disposal.
`protocol.ts` defines inference messages; its progress payload is download bytes.
Clients infer their return types from the request rather than choosing arbitrary
result types. Worker replies use the same protocol types.

All seven HTML entries (index, models, model, docs, bench, parity, train) contain only
metadata, styles, and a React root; layout and page titles are owned by React
components. The only explicit document lookup in the demo is the root mount. Service workers and ML
utilities remain ordinary JavaScript/TypeScript because they do not render UI.

## Artifact contracts

Python's `artifacts.py` generates `web/packages/core/src/model.schema.json`. Ajv compiles it
at development time into `model-validator.ts`; `artifacts.ts` uses that validator
and checks relationships such as head dimensions and label cardinality. The
browser ships the generated validator, without Ajv or runtime schema compilation.

After changing the contract:

```sh
cd web
npm run schema
npm test
```

Both generated files are committed. The fixture generator checks schema freshness;
`npm test` also checks validator freshness. Cross-language cases cover accepted
configs and rejection of invalid versions, dimensions, labels, and tokenizer IDs.
Incompatible contract changes require a new format version and a migration plan.

## Reproducible checks

From a clean checkout:

```sh
uv sync --locked
uv run pytest
cd web
npm ci
npm test
npm run typecheck
npm run build:lib
npm run build:demo
```

`npm test` first runs `scripts/generate_fixtures.py` through uv. It exports a tiny
seeded BERT classifier through the production Python exporter and writes the config
contract cases. Fixtures go in ignored `web/test/generated/`; no teacher calls, model
downloads, or existing `runs/` folders are needed. `npm run test:browser` checks that
the model page reproduces Python's answers on that fixture.

For production-page acceptance checks, install Chromium once and run:

```sh
npx playwright install chromium
npm run test:browser
```

This uses the generated fixture model to exercise the model page (load, validate,
classify) and renders the docs and models pages. The existing `parity`,
`bench`, and `offline` commands still cover real exported models; the tiny fixtures do not replace quality checks on those models.
