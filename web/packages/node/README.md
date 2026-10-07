# @nodd/node

Run a [Nodd](https://github.com/quaedra/nodd) model in Node with transformers.js on
onnxruntime-node (native CPU). Same API as [`@nodd/browser`](https://www.npmjs.com/package/@nodd/browser);
the export folder is read from disk.

```sh
npm install @nodd/node
```

```ts
import { nodd } from "@nodd/node";

const m = await nodd.load("./models/comment_moderation/v3"); // a `nodd export` folder
const d = await m.decide("Buy cheap followers at ...");
// { label: "spam", probabilities: {...}, confidence: 0.98, source: "micro", ... }
if (!m.isConfident(d)) { /* below the calibrated threshold: escalate */ }
```

Options: `dtype: "q8" | "fp32"` (fp32 only if the export includes `onnx/model.onnx`).

Why a separate package from the browser one: in Node there is no Web Worker, Cache API or
same-origin rule, and onnxruntime-node runs the model natively (≈1 ms per input for a
MiniLM-L6 q8 on an M2 Pro), so none of the browser plumbing or `.wasm` files are needed.
Requires Node ≥ 20.
