# @nodd/browser

Run a [Nodd](https://github.com/quaedra/nodd) model in the browser with transformers.js
(onnxruntime-web: WASM by default, WebGPU opt-in). Inference runs in a Web Worker; model files
are cached with the Cache API, so a model loads offline after the first visit.

```sh
npm install @nodd/browser
```

```ts
import { nodd } from "@nodd/browser";

const m = await nodd.load("/models/comment_moderation/v3"); // a `nodd export` folder
const d = await m.decide("Buy cheap followers at ...");
// { label: "spam", probabilities: {...}, confidence: 0.99, source: "micro", ... }
if (!m.isConfident(d)) { /* below the calibrated threshold: escalate */ }
m.dispose(); // stops the worker
```

Options: `device: "auto" | "webgpu" | "wasm"` (auto = wasm, measured faster than WebGPU at this
size), `dtype: "q8" | "fp32"`, `onProgress({ loaded, total })`, `worker`, `cache`,
`ortWasmPaths` (default `/ort/`).

Serving:

- The export folder must be served from the page's own origin (never the Hub or a CDN).
- Serve `onnxruntime-web/dist/ort-wasm*` at `ortWasmPaths`.
- Optional: `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` enable multi-threaded WASM.

The package ships as plain ESM that uses `new Worker(new URL("./worker.js", import.meta.url))`,
so your bundler (Vite, webpack 5, …) compiles the worker and its dependencies.

On a server, use [`@nodd/node`](https://www.npmjs.com/package/@nodd/node): same API, native CPU.

## Full encoder training (experimental)

Training is isolated behind `@nodd/browser/training`, so inference does not import the training runtime.

```ts
import { TrainingClient, defaults } from "@nodd/browser/training";

const trainer = new TrainingClient();
const hardware = await trainer.check({
  bundle: await checkpointFile.arrayBuffer(), // prepared FP32 encoder ZIP; transferred to worker
  data: await datasetFile.text(),              // JSON array or JSONL: text, label, optional split/confidence
  options: { ...defaults, task: "my_classifier" },
  backend: "auto",                             // WebGPU → WebGL → CPU, tested by a full training step
}, console.log);
const result = await trainer.train(console.log);
const decision = await trainer.predict("An example input");
const checkpoint = await trainer.download(); // Uint8Array ZIP, includes your labeled data
trainer.dispose();                           // also cancels an active run
```

Only BERT/MiniLM-style GELU encoders are supported. All encoder parameters are trained.
Check success measures compatibility at the requested batch/sequence size, not guaranteed
free memory. Keep the worker alive until you have saved its checkpoint. A continued
checkpoint starts a new optimizer. Import downloaded weights with `nodd import-browser-training`
before using the normal native evaluation and ONNX export commands.

See [the training guide](../../../docs/BROWSER_TRAINING.md) for setup and limitations.
