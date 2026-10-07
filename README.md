<img src="web/public/logo.svg" alt="Nodd logo" width="96">

# Nodd

Turn one decision ("is this comment ok, spam or toxic?") into a **tiny, calibrated
classifier that runs in the browser** — ~10–35 MB, offline, no per-call cost — and
knows when it is unsure, so the hard cases can go to a bigger model.

**Website and demo:** https://quaedra.com/nodd ·
**Docs:** https://quaedra.com/nodd/docs

**Community models:** [Search the catalog on Hugging Face](https://huggingface.co/spaces/nodd-repo/community).
Share your own model by submitting a listing through the Space's Community tab;
see the [contribution guide](community/README.md).

## How it works

```
task spec (YAML) → collect inputs → teacher labels → train → calibrate → evaluate → export → browser
```

- **Models**: a small sentence encoder (MiniLM-class) fine-tuned with a classification
  head, exported to ONNX q8 and run with transformers.js. Every base model that fits your
  download budget is trained and the best fit is kept (highest validation F1; the smaller
  one on a near-tie).
- Every prediction is a typed `Decision` with a **calibrated** confidence; below the
  threshold (chosen for a target precision) it should be escalated.
- Exports are checked for **parity**: the browser matches Python on the test set.

Example task (`examples/comment_moderation.yaml`, 1,711 synthetic comments):

| model | download | test macro F1 | handled without escalation | browser p95 |
|---|---|---|---|---|
| MiniLM-L3 (v2) | 18.6 MB | 0.943 | 88% | 6.8 ms |
| **MiniLM-L6** (v3, best fit) | **23.7 MB** | **0.948** | **96%** | 12.0 ms |

The test data is synthetic — expect lower numbers on real comments.

## Quickstart

```bash
uv sync
uv run nodd run examples/comment_moderation.yaml   # collect → label → train → eval → export
uv run nodd compare runs/comment_moderation/v2 runs/comment_moderation/v3

cd web && npm install && npm run sync-model && npm run dev # overview and demo, models, docs, train, benchmark, parity
```

```ts
import { nodd } from "@nodd/browser";
const m = await nodd.load("/models/comment_moderation/v2");
const d = await m.decide("Buy cheap followers at …");  // { label: "spam", confidence: 0.99, … }
```

On a server, `@nodd/node` has the same API and runs the same export folder natively:

```ts
import { nodd } from "@nodd/node";
const m = await nodd.load("./runs/comment_moderation/v3/export");
```

Design: [docs/SPEC.md](docs/SPEC.md) · Plan: [docs/ROADMAP.md](docs/ROADMAP.md) ·
npm packages: [web/README.md](web/README.md)

Code layout and reproducible checks: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Full browser training

The **Train** page fine-tunes every layer of a small encoder on local labeled examples.
It tests a real training step on the user's hardware before enabling training, with
WebGPU, WebGL, and CPU backends. Validation, calibration, test metrics, cancellation,
and trained checkpoint downloads are included. This feature is experimental.

```sh
cd web
npm run prepare:training   # install the pretrained MiniLM-L3 starter (~70 MB FP32)
npm run dev               # open /train.html
```

Downloaded checkpoints can be imported with `nodd import-browser-training` and exported
through the existing ONNX pipeline. Setup, dataset format, hardware limits, and checks:
[browser training guide](docs/BROWSER_TRAINING.md).

## Larger offline synthetic training runs

With the baseline runs present locally (`comment_moderation/v3`, `prompt_injection/v2`,
`sentiment/v1`, and `support_triage/v1`):

```bash
uv run python scripts/train_synthetic.py --per-label 1000
cd web && npm run sync-model
```

This adds 13,000 template-labeled examples across the four tasks, trains both MiniLM
candidates within each task's 30 MB budget, and saves the selected model as a new version
with evaluation, ONNX exports, and a baseline comparison. Existing validation and test
rows are preserved; additions with embedding cosine similarity above 0.90 to either
holdout are rejected. Use `--prepare-only` to generate data without training, or
`--tasks sentiment` to run one task.

Each run includes `synthetic_manifest.json` with the baseline fingerprint, seed, counts,
and generation method. Template variants are correlated and labeled by construction,
not by an independent teacher. Metrics use the original synthetic holdouts and do not
establish real-world accuracy. Generated datasets and model weights stay under `runs/`.

Results and validation: [larger synthetic training report](docs/SYNTHETIC_TRAINING.md).

## Contributing

Bug reports, fixes, documentation, and new examples are welcome. [Open an issue](https://github.com/michaljach/nodd/issues)
to report a problem or discuss an idea, or submit a pull request with a description of your changes
and the checks you ran. Run `uv run pytest` for Python changes; see the [web development checks](web/README.md#development-checks)
for browser and Node.js changes.

To share a model, follow the [model contribution guide](community/README.md) and submit a listing
through the [Hugging Face community Space](https://huggingface.co/spaces/nodd-repo/community).

## License

The Nodd source code is licensed under the [MIT License](LICENSE).
Models and datasets have their own licenses; check each model or dataset card before reuse.
