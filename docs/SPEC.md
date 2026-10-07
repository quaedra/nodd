# Nodd — Design Spec

## 1. Goal

A user describes **one decision** (input, allowed outputs, quality/latency
target). Nodd produces a **specialized micro model** for exactly that
decision:

- **tiny**: ~10–35 MB to download (target ~30 MB), runs in a browser (WASM,
  WebGPU optional)
- returns a **typed decision + calibrated confidence**
- runs client-side: offline, private, no per-call cost
- **escalates** to a teacher model (Jev, an LLM, or a human) when unsure,
  and learns from those escalations

Positioning: a "System Zero" layer in front of System One (Jev) and
System Two (frontier LLMs). It handles the easy, high-volume majority of cases
cheaply; the hard cases go up the stack.

Non-goals (v1): text generation, multi-step reasoning, image/audio input,
distributed training.

## 2. Task spec (user input)

YAML, validated by a pydantic `TaskSpec` model.

```yaml
task: comment_moderation            # slug, used for paths
description: >
  Decide whether a user comment on a product blog is acceptable.
input:
  type: text
  max_chars: 2000
output:
  type: choice                      # v1: choice | boolean ; v2: score, multi_label
  labels:
    ok: Normal comment, on or off topic but harmless.
    spam: Ads, links to unrelated products, SEO junk.
    toxic: Insults, harassment, hate.
model:
  tier: auto                        # auto | encoder (both: best fit among encoder bases)
  base: null                        # override base model id (with tier: encoder)
  quantization: q8
teacher:
  kind: llm                         # llm | jev | csv
  model: claude-haiku-4-5-20251001  # configurable (llm, jev)
  path: null                        # labeled CSV (csv)
  min_confidence: 0.0               # drop teacher labels below this
data:
  seed_examples: examples/comment_moderation_seed.csv   # optional
  unlabeled: null                   # optional CSV/JSONL of real inputs
  gold: null                        # optional human-labeled CSV/JSONL, always the test set
  synthetic: 2000                   # number of generated inputs
  synth_model: null                 # generator model, defaults to teacher.model
targets:
  min_macro_f1: 0.90
  deploy: browser                   # browser | node | python
  max_download_mb: 30               # hard budget for the model files
  max_latency_ms: 100               # p95 in browser, WASM backend, short input
escalation:
  target_precision: 0.97            # auto-pick threshold to hit this
seed: 42                            # all randomness (split, synth plan, training)
```

Label descriptions matter: they are used in teacher prompts and synthetic
data generation.

## 3. Output schema (every prediction)

```json
{
  "label": "spam",
  "probabilities": {"ok": 0.04, "spam": 0.93, "toxic": 0.03},
  "confidence": 0.93,
  "escalated": false,
  "source": "micro",              // micro | teacher
  "model": "comment_moderation@v3",
  "latency_ms": 0.4
}
```

`label` is always one of the spec's labels. Boolean tasks use labels
`true`/`false`.

## 4. Pipeline

```
spec ─▶ collect inputs ─▶ teacher labels ─▶ split ─▶ train ─▶ calibrate
                                                                   │
        feedback ◀── escalations ◀── serve (micro + fallback) ◀── export ◀── eval
```

### 4.1 Collect inputs
Sources, merged and deduplicated (normalized-text hash, then near-dup via
embedding cosine > 0.95):
1. user seed examples (may already have labels)
2. user unlabeled real data (best source)
3. synthetic generation by an LLM: prompted per label, with explicit
   diversity axes (length, tone, language, obfuscation, borderline cases).
   Generate ~30% "hard/borderline" examples on purpose.

### 4.2 Teacher labeling
`Teacher` interface:
```python
class Teacher(Protocol):
    name: str
    def fingerprint(self, spec: TaskSpec) -> str: ...   # prompt/model/file hash; part of the cache key
    def label(self, spec: TaskSpec, inputs: list[str]) -> list[Decision | None]: ...  # None = no answer
```
Implementations: `LLMTeacher` (Anthropic, schema-constrained JSON with label +
probability per label; OpenAI-compatible not yet), `JevTeacher` (M7),
`CSVTeacher` (human or offline labels, looked up by normalized text),
`FakeTeacher` (tests). All calls go through `CachedTeacher` (disk cache keyed
by teacher + fingerprint + input, `.cache/nodd/` or `$NODD_CACHE_DIR`).
Rows that already carry a label (gold, labeled seed) skip the teacher.
Store teacher confidence; low-confidence teacher labels are down-weighted
or dropped (configurable).

### 4.3 Split
Stratified train / val / test = 70 / 15 / 15. If a human-labeled gold set
exists, it is always used as the test set.

### 4.4 Train — the model (browser-runnable)
The model outputs logits over the label set in **one forward pass**.
Sizes/latencies are rough targets; measure with the benchmark page (M3).

| Base (default, configurable) | Method | Download | Train on |
|---|---|---|---|
| MiniLM-L3 → MiniLM-L6 → bge-small (17–33M params) | full fine-tune, `*ForSequenceClassification` | ~18–35 MB (q8) | CPU, < 1 min |

Decoder tier (SmolLM2/Qwen3 + LoRA): **dropped.** Built and measured in M5 — Qwen3-0.6B
reached test F1 0.974 vs 0.943 for the encoder, but at 501 MB (q4) vs 18.6 MB and
p95 237 ms (Python, MPS) vs 3 ms (CPU); SmolLM2-135M (115 MB) was *worse* than the encoder. The project
targets tiny models (~30 MB), so the tier was removed.

Static tier (model2vec embeddings + logistic regression, plain-JS runtime): **removed.**
It lost to the encoder at similar size (comment moderation: potion-32M, 33 MB, test F1
0.897 vs MiniLM-L3, 18.6 MB, 0.943) and best fit never picked it on the example tasks.

Encoder details: standard `AutoModelForSequenceClassification` (so the
export runs in transformers.js unchanged), AdamW 1e-4, 6 epochs, warmup 10%,
max 256 tokens, teacher confidence as sample weight, best epoch by val macro F1.
Trains on CPU by default (reproducible); `NODD_DEVICE=mps|cuda` to speed up.

**Auto mode** (best fit): train every base candidate whose estimated
download fits `max_download_mb` (smallest first; over-budget candidates are
skipped), then keep the highest val macro F1. A smaller
candidate wins a near-tie (within 0.01 val macro F1, `train.F1_TIE`), since
val splits are small. `min_macro_f1` doesn't stop the search; it's reported
as met or missed. On the example task it keeps MiniLM-L6 (23.7 MB, test F1
0.948) over MiniLM-L3 (18.6 MB, 0.943). If nothing reaches `min_macro_f1`, the report recommends
more/better data, a larger budget, or escalation-heavy mode.


### 4.5 Calibrate
Temperature scaling (or isotonic if val set is large) fit on val.
Report ECE before/after. Pick the escalation threshold on val as the lowest
confidence at which precision ≥ `target_precision`.

### 4.6 Evaluate (report.md + report.json per run)
- accuracy, macro F1, per-label precision/recall, confusion matrix
- agreement with teacher
- ECE (calibration error)
- **coverage** at chosen threshold: % of inputs the micro model handles
  alone, and accuracy on that covered set
- latency p50/p95, model size on disk
- 20 worst errors listed for inspection

### 4.7 Export (browser-first)
`nodd export <run_dir>` → `<run_dir>/export/`, transformers.js folder layout:
```
nodd.json          runtime config: labels, temperature, threshold, tokenizer rules
                          (max_chars, max_tokens), file sizes (download progress)
tokenizer.json            HF tokenizer (+ tokenizer_config.json, config.json)
onnx/model_quantized.onnx input_ids + attention_mask → logits, dynamic int8 (transformers.js "q8")
onnx/model.onnx           full precision (optional in the browser)
parity.jsonl              test-split predictions from Python (browser parity input)
model_card.json           card + export parity + download sizes (+ bench.json from web/)
```
- `torch.onnx.export` (dynamo) → `onnx/model.onnx` (fp32) + dynamic int8
  `onnx/model_quantized.onnx` (transformers.js "q8"), plus the HF tokenizer/config files. A failed export (parity) is marked in its model
  card and not published by `web/scripts/sync-model.mjs`.
- `parity.jsonl` holds the predictions of the artifact the browser runs (the q8
  ONNX), so browser parity isolates runtime differences from
  quantization loss (which the export parity check measures).
- **Parity check** at export: training-time model vs the exported fp32 and q8
  ONNX on the test split — label agreement, max |Δp|, F1 delta; export fails if
  F1 drops > 2 pts.

### 4.8 JS runtime (`web/packages`: `@nodd/browser`, `@nodd/node`)
```ts
const m = await nodd.load("/models/comment_moderation/v3", {
  device: "auto",                // wasm (measured faster than webgpu at this size)
  dtype: "q8",                   // q8 (default) | fp32
  onProgress: ({ loaded, total }) => {},   // download bytes
});
const d = await m.decide("Buy cheap followers at ...");   // Decision
m.isConfident(d);                // false → escalate (escalateUrl lands in M6)
```
- transformers.js `AutoTokenizer` + `AutoModelForSequenceClassification`, files
  served from the page's origin only (never the Hub or a CDN, so it works offline);
  loaded lazily.
- Device default is measured, not assumed (M2 Pro, Metal): q8 WASM p50 2.5 ms vs
  WebGPU 9.8 ms fp32 / 14.6 ms q8 single-input.
  WebGPU wins only on large batches at this size.
- Model files cached in the browser (Cache API) after first load; the demo adds
  an app-shell service worker so it reloads and classifies with the network off
- Runs in a Web Worker so the UI never blocks; batching supported
- `web/demo`: paste text → decision + probabilities; **benchmark page** (load
  time, p50/p95, WASM vs WebGPU); **parity page** (browser vs Python labels).
  `npm run parity|bench|offline` drive them in headless Chromium.
- `@nodd/node` has the same API (`nodd.load(dir)` loads the export folder from disk)
  on onnxruntime-node, native CPU: no worker, Cache API or `.wasm` files.
  `@nodd/core` holds what both share: the `nodd.json` validator, `Decision`, softmax.

### 4.9 Server: escalate + feedback
`Runtime` wraps model + optional teacher:
```python
rt = Runtime.load("runs/comment_moderation/v3")
d = rt.decide("Buy cheap followers at ...")
```
If `confidence < threshold` and a teacher is configured → ask teacher,
return teacher's decision with `source="teacher"`, and append the input +
teacher label to `feedback.jsonl`.
FastAPI server exposes `POST /decide` with the same schema.

### 4.10 Improve
`nodd retrain` merges `feedback.jsonl` into training data and
produces the next version. Report compares new vs previous version on the
same test set; don't promote if worse.

## 5. CLI

```
nodd init <task>            # scaffold spec yaml
nodd check <spec>           # validate a spec
nodd collect <spec>         # 4.1
nodd label <spec>           # 4.2
nodd train <spec> [--tier encoder|auto] [--base ID] [--max-download-mb N]
nodd eval <run_dir>
nodd compare <run_dir> <run_dir>...   # same test split, side by side → runs/<task>/compare.md
nodd export <run_dir>
nodd serve <run_dir> [--teacher]
nodd retrain <spec>
nodd run <spec>             # collect → label → train → eval → export
```

## 6. Repo layout

```
nodd/
  CLAUDE.md
  pyproject.toml
  docs/SPEC.md  docs/ROADMAP.md
  examples/comment_moderation.yaml
  src/nodd/
    spec.py        # TaskSpec, Decision (pydantic)
    data.py        # collect, dedup, split
    synth.py       # synthetic input generation
    teachers/      # base.py, llm.py, jev.py, csv.py, fake.py, cache.py
    train.py       # candidates, best fit, calibration
    calibrate.py
    evaluate.py
    export.py
    runtime.py     # Runtime + escalation
    server.py
    cli.py
  web/             # TypeScript runtime package + demo/benchmark (vite)
  tests/
  runs/            # gitignored artifacts
```

## 7. Risks & mitigations

- **Teacher errors baked in** → keep optional human gold set; show worst
  errors; teacher-confidence filtering.
- **Synthetic data ≠ real data** → prefer real unlabeled data; report
  metrics separately for synthetic vs real test examples.
- **Drift in production** → escalation rate is logged; rising rate is the
  signal to retrain.
- **Overconfidence** → calibration is mandatory, never optional.

## 8. Later (v2+)

`score` (ordinal) and `multi_label` output types; multiple questions per
input sharing one backbone (one download, many decisions); non-text inputs (tabular, time series); web UI for reviewing
escalations.
