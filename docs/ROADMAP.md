# Nodd — Roadmap

Build in order. Each milestone ends with passing tests and a short summary.
End goal: a task-specific model that runs in the browser (WASM/WebGPU).

## [x] M0 — Skeleton
- `uv` project, `src/nodd`, typer CLI entry point, pytest set up
- `spec.py`: `TaskSpec` and `Decision` pydantic models; load/validate YAML
- `nodd init <task>` writes a template spec

**Done when:** example spec loads; invalid specs (no labels, duplicate
labels, unknown output type/tier) fail with clear errors; tests pass.

## [x] M1 — Data + teacher labeling
- `data.py`: load CSV/JSONL, normalize, exact + near-dup dedup, stratified split
- `synth.py`: LLM-based synthetic inputs per label incl. borderline cases
- `teachers/`: base protocol, disk cache, `FakeTeacher`, `LLMTeacher`, `CSVTeacher`
- CLI: `collect`, `label`

**Done when:** collect+label produces a labeled dataset; second run makes
zero teacher calls (cache); labels always within the label set.

## [x] M2 — Static tier end to end (first PoC, Python)
- static embeddings + logistic regression; calibration; threshold; report
- `runtime.py`: `Runtime.load(...).decide(text) -> Decision`
- CLI: `train`, `eval`, `run`

**Done when:** `nodd run examples/comment_moderation.yaml` finishes
on a laptop CPU in < 10 min with a readable report.

## [x] M3 — Browser runtime + export (first PoC in the browser)
- export static tier (JSON/binary) and ONNX in transformers.js layout
- `web/`: TS package, Web Worker, `nodd.load/decide`, demo page,
  benchmark page (load time, p50/p95, WASM vs WebGPU)
- parity check Python vs browser

**Done when:** the demo page classifies comments fully offline in the
browser, and browser labels match Python on ≥ 99.5% of the test set.

## [x] M4 — Encoder tier
- MiniLM-class encoder, SetFit/fine-tune, ONNX q8 export, runs in `web/`

**Done when:** report compares static vs encoder; encoder runs in the demo.

## [–] M4.5 — Web training playground — removed
Built (train a static-tier head in the browser, save or download it), then
removed on request: browser training only covered the static tier, and a frozen
encoder + trained head measured below it (comment moderation test F1 0.864–0.869
vs 0.897 static, 0.948 fine-tuned MiniLM-L6). Training now happens in Python;
the browser runs the exported models. Superseded by the full encoder training feature below.

## [x] M4.6 — Full browser encoder training
- Full BERT/MiniLM forward/backward training with AdamW in a dedicated worker; WebGPU,
  WebGL, and CPU backends. No frozen-head replacement for encoder fine-tuning.
- Actual-model hardware probe at the selected batch/sequence size; approximate memory,
  CPU/GPU reporting, backend fallback, invalidation on settings changes, and cancellation.
- Local labeled data, preserved or stratified splits, validation checkpoint selection,
  temperature calibration, untouched test metrics, and standard Decision outputs.
- Portable FP32 checkpoints; native import checks prediction parity and supports eval/ONNX export.
- Python forward/update parity tests, browser worker/UI acceptance, native round trip, and
  actual 17M-parameter MiniLM-L3 WebGPU training checked at batch 2 / 64 tokens.

**Done when:** those checks pass and users can train/download through `/train.html`.
The runtime remains experimental; memory estimates and one passing step cannot guarantee
all hardware or a long run. Setup and limits: [BROWSER_TRAINING.md](BROWSER_TRAINING.md).

## [–] M5 — Decoder tier (Qwen-class) — dropped
Built and measured, then removed: the project targets tiny models (~30 MB).
Qwen3-0.6B: test F1 0.974 at 501 MB (q4), p95 ~237 ms; SmolLM2-135M: 0.932 at
115 MB — both lose to the MiniLM-L3 encoder on size, and SmolLM2 also on F1
(encoder: 0.943 at 18.6 MB). The code was never committed; lessons, if it is
ever revisited: decoder q4 must be weight-only (HQQ, block 32 — plain RTN lost
3 F1 points); dynamic int8 activation quantization lost ~5; export the pooled
last-token logits (one forward pass, no KV cache); fp32 export needs external data.


## [–] Static tier — removed
Built in M2 (model2vec embeddings + logistic regression, plain-JS runtime), then
removed on request: at similar size it lost to the encoder (comment moderation
test F1 0.897 at 33 MB vs 0.943 at 18.6 MB; prompt injection 0.873 vs 0.942),
best fit never picked it, and it doubled the export path, browser runtime and
parity checks. model2vec is still used for near-duplicate detection.
## [ ] M6 — Escalate, feedback, retrain
- FastAPI `POST /decide` (teacher proxy); browser `escalateUrl`
- `feedback.jsonl`; `nodd retrain` with version comparison

**Done when:** low-confidence inputs in the browser get the teacher's answer
via the server and are logged; retrain refuses to promote a worse model.

## [ ] M7 — Jev teacher
- `JevTeacher` against TypeSafe's official API (check current docs first)
- Jev's calibrated probabilities used as soft labels in training

**Done when:** the example pipeline runs with `teacher.kind: jev`.
