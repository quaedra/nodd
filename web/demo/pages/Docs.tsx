import { Layout } from "../ui/Layout";
import { page } from "../common";
import { mount } from "../ui/mount";

const QUICKSTART = `uv sync                                   # Python 3.11+, managed with uv
uv run nodd init my_task           # writes my_task.yaml
# edit the labels and descriptions, then:
uv run nodd run my_task.yaml       # collect → label → train → eval → export

cd web && npm install
npm run sync-model                        # copy every export into public/models
npm run dev                               # open /model.html?model=/models/my_task/v1`;

const SPEC = `task: comment_moderation            # slug: lowercase letters, digits, _ or -
description: >
  Decide whether a user comment on a product blog is acceptable to publish.
input:
  type: text
  max_chars: 2000                   # longer inputs are cut
output:
  type: choice                      # choice (≥ 2 labels) | boolean (true / false)
  labels:
    ok: Normal comment. Can be positive, negative or off topic, but harmless.
    spam: Ads, links to unrelated products or services, SEO junk, scams.
    toxic: Insults, harassment, threats or hate toward people or groups.
model:
  tier: auto                        # auto | encoder (both: best fit among the encoder bases)
  base: null                        # force one base model (with tier: encoder)
  quantization: q8
teacher:                            # the model that labels the training data
  kind: llm                         # llm | csv
  model: claude-haiku-4-5-20251001
data:
  seed_examples: null               # CSV/JSONL: text[,label]
  unlabeled: null                   # CSV/JSONL of real inputs: text[,source]
  gold: null                        # human-labeled CSV/JSONL: always the test set
  synthetic: 2000                   # generated inputs
targets:
  min_macro_f1: 0.90
  max_download_mb: 30
escalation:
  target_precision: 0.97            # the confidence threshold is picked for this precision
seed: 42`;

const LOAD = `import { nodd } from "@nodd/browser";

const m = await nodd.load("/models/comment_moderation/v3", {
  onProgress: ({ loaded, total }) => console.log(\`\${loaded} / \${total} bytes\`),
});
const d = await m.decide("Buy cheap followers at ...");
d.label;          // "spam": always one of the model's labels
d.confidence;     // calibrated probability of that label
m.isConfident(d); // confidence ≥ the model's calibrated threshold
m.dispose();      // stops the worker`;

const NODE = `import { nodd } from "@nodd/node";

const m = await nodd.load("./models/comment_moderation/v3"); // the export folder
const d = await m.decide("Buy cheap followers at ...");`;

const DECISION = `{
  "label": "spam",
  "probabilities": {"ok": 0.04, "spam": 0.93, "toxic": 0.03},
  "confidence": 0.93,
  "escalated": false,
  "source": "micro",
  "model": "comment_moderation@v3",
  "latency_ms": 2.4
}`;

const TOC: [string, string][] = [
  ["quickstart", "Quick start"],
  ["spec", "Task spec"],
  ["cli", "Command line"],
  ["training", "Training and model selection"],
  ["browser-training", "Browser training"],
  ["export", "Exported model folder"],
  ["library", "JavaScript packages"],
  ["serving", "Serving models"],
  ["checks", "Checks"],
];

function Docs() {
  return (
    <Layout page="docs">
      <p>
        Nodd turns a task spec (an input and a fixed set of labels) into a small classifier for exactly that task.
        A larger model labels examples, Nodd trains and calibrates the smallest model that does the job well, and
        exports it as a folder the browser library loads. Every answer is one forward pass and always one of your labels.
      </p>
      <ul>
        {TOC.map(([id, title]) => (
          <li key={id}><a href={`#${id}`}>{title}</a></li>
        ))}
      </ul>

      <h2 id="quickstart">Quick start</h2>
      <pre><code>{QUICKSTART}</code></pre>
      <p>
        The example specs in <code>examples/</code> (comment moderation, sentiment, support triage, prompt injection)
        are available through the <a href={page("models")}>Models page</a>. Run artifacts go to{" "}
        <code>runs/&lt;task&gt;/&lt;version&gt;/</code>; the browser folder is <code>…/export</code>.
      </p>

      <h2 id="spec">Task spec</h2>
      <p>A YAML file, validated before anything runs. Label descriptions matter: the labeling model reads them.</p>
      <pre><code>{SPEC}</code></pre>
      <table>
        <thead>
          <tr><th>field</th><th>default</th><th>meaning</th></tr>
        </thead>
        <tbody>
          <tr><td><code>output.labels</code></td><td>required</td><td>label → description; names use letters, digits, <code>_</code> or <code>-</code></td></tr>
          <tr><td><code>model.base</code></td><td>none</td><td>train one base model instead of choosing (needs <code>tier: encoder</code>)</td></tr>
          <tr><td><code>teacher.kind</code></td><td>required</td><td><code>llm</code> (needs <code>model</code>) or <code>csv</code> (needs <code>path</code>, a labeled CSV)</td></tr>
          <tr><td><code>teacher.min_confidence</code></td><td>0</td><td>drop labels the labeling model is less sure about</td></tr>
          <tr><td><code>data.synthetic</code></td><td>0</td><td>how many inputs to generate; <code>synth_model</code> defaults to the teacher's</td></tr>
          <tr><td><code>targets.min_macro_f1</code></td><td>0.90</td><td>reported as met or missed</td></tr>
          <tr><td><code>targets.max_download_mb</code></td><td>150 (the <code>init</code> template writes 30)</td><td>candidates over it aren't trained</td></tr>
          <tr><td><code>escalation.target_precision</code></td><td>0.97</td><td>precision the confidence threshold is calibrated for</td></tr>
          <tr><td><code>seed</code></td><td>42</td><td>splits and training; recorded in the model card</td></tr>
        </tbody>
      </table>

      <h2 id="cli">Command line</h2>
      <p>Every command is <code>uv run nodd &lt;command&gt;</code>.</p>
      <table>
        <thead>
          <tr><th>command</th><th>does</th></tr>
        </thead>
        <tbody>
          <tr><td><code>init &lt;task&gt;</code></td><td>writes a spec template</td></tr>
          <tr><td><code>check &lt;spec&gt;</code></td><td>validates a spec</td></tr>
          <tr><td><code>collect &lt;spec&gt;</code></td><td>gathers gold, seed, unlabeled and synthetic inputs, removes duplicates</td></tr>
          <tr><td><code>label &lt;spec&gt;</code></td><td>labels the inputs (every call cached on disk) and splits train / val / test</td></tr>
          <tr><td><code>train &lt;spec&gt;</code></td><td>trains the next version; <code>--tier</code>, <code>--base</code>, <code>--max-download-mb</code> override the spec</td></tr>
          <tr><td><code>eval &lt;run&gt;</code></td><td>test-split report: <code>report.md</code> + <code>report.json</code></td></tr>
          <tr><td><code>export &lt;run&gt;</code></td><td>writes the browser folder and checks it against the trained model</td></tr>
          <tr><td><code>compare &lt;run&gt; &lt;run&gt;…</code></td><td>versions side by side on the same test split</td></tr>
          <tr><td><code>run &lt;spec&gt;</code></td><td>all of the above, collect → export</td></tr>
        </tbody>
      </table>
      <p className="small">
        Labeling with <code>kind: llm</code> reads <code>ANTHROPIC_API_KEY</code> from the environment. Cached labels live
        in <code>.cache/nodd</code> (<code>NODD_CACHE_DIR</code>), so re-running is free.
      </p>

      <h2 id="training">Training and model selection</h2>
      <p>
        Every model is a small sentence encoder fine-tuned with a classification head. These base models are the
        candidates:
      </p>
      <table>
        <thead>
          <tr><th>base</th><th>download (int8)</th></tr>
        </thead>
        <tbody>
          <tr><td>sentence-transformers/paraphrase-MiniLM-L3-v2</td><td>18 MB</td></tr>
          <tr><td>sentence-transformers/all-MiniLM-L6-v2</td><td>24 MB</td></tr>
          <tr><td>BAAI/bge-small-en-v1.5</td><td>34 MB</td></tr>
        </tbody>
      </table>
      <p>
        Every candidate that fits <code>max_download_mb</code> is trained and the best fit wins: the highest validation
        macro F1, or the smaller model when two are within 0.01. Each trains in tens of seconds on CPU
        (<code>NODD_DEVICE=mps</code> or <code>cuda</code> to speed up).
      </p>
      <p>
        Calibration fits a temperature on the validation split, so the reported confidence matches how often the model is
        right, then picks the lowest threshold that reaches <code>escalation.target_precision</code>. Label confidence is
        the sample weight throughout.
      </p>

      <h2 id="browser-training">Browser training</h2>
      <p>The <a href={page("train")}>Train page</a> fine-tunes every layer of a BERT/MiniLM encoder on your local
        examples. A real forward/backward training step checks the selected model and settings before training
        is enabled. Automatic mode tries WebGPU, WebGL, then CPU. Reported memory is approximate; a successful
        check cannot guarantee that a long run will fit.</p>
      <p>Upload JSON or JSONL examples with <code>text</code> and <code>label</code>, with at least five examples per
        label. Validation chooses the best epoch and calibrates confidence; the untouched test split measures
        quality. Download the trained checkpoint before closing the page. Your examples stay on your device.</p>
      <pre>{`# Site setup: install the default pretrained encoder\ncd web && npm run prepare:training\n\n# After downloading a finished checkpoint (from the repository root):\nuv run nodd import-browser-training browser_model.nodd.zip\n# Use the version path printed by import:\nuv run nodd eval runs/browser_model/v1\nuv run nodd export runs/browser_model/v1`}</pre>
      <p>This experimental feature trains in the browser; ONNX conversion and quantization use the existing Python
        exporter. A downloaded checkpoint can also start another browser training run, with a fresh optimizer.</p>

      <h2 id="export">Exported model folder</h2>
      <table>
        <thead>
          <tr><th>file</th><th>contents</th></tr>
        </thead>
        <tbody>
          <tr><td><code>nodd.json</code></td><td>labels, temperature, threshold, tokenizer rules, file sizes; validated on load</td></tr>
          <tr><td><code>tokenizer.json</code>, <code>tokenizer_config.json</code>, <code>config.json</code></td><td>Hugging Face tokenizer and model config</td></tr>
          <tr><td><code>onnx/model_quantized.onnx</code></td><td>the model, int8 (what the browser loads)</td></tr>
          <tr><td><code>onnx/model.onnx</code></td><td>full precision, optional</td></tr>
          <tr><td><code>parity.jsonl</code>, <code>model_card.json</code></td><td>expected answers on the test split; training metadata</td></tr>
        </tbody>
      </table>

      <h2 id="library">JavaScript packages</h2>
      <p>
        <code>@nodd/browser</code> runs an exported folder in the browser with transformers.js on WASM.
        Inference happens in a Web Worker, and model files are cached, so a
        model loads offline after the first visit.
      </p>
      <pre><code>{LOAD}</code></pre>
      <table>
        <thead>
          <tr><th>option</th><th>default</th><th>meaning</th></tr>
        </thead>
        <tbody>
          <tr><td><code>onProgress</code></td><td>none</td><td><code>{"{ loaded, total }"}</code> bytes while the files download</td></tr>
          <tr><td><code>device</code></td><td><code>auto</code> = WASM</td><td><code>webgpu</code> is opt-in: slower per input at this model size, faster only for large full-precision batches</td></tr>
          <tr><td><code>dtype</code></td><td><code>q8</code></td><td><code>fp32</code> uses the full-precision file</td></tr>
          <tr><td><code>worker</code>, <code>cache</code></td><td>true</td><td>run in a Web Worker; keep files in the Cache API</td></tr>
          <tr><td><code>ortWasmPaths</code></td><td><code>/ort/</code></td><td>where onnxruntime-web's <code>.wasm</code> files are served</td></tr>
        </tbody>
      </table>
      <p>Every answer has the same shape; <code>decideBatch(texts)</code> returns one per input:</p>
      <pre><code>{DECISION}</code></pre>
      <p>
        On a server, <code>@nodd/node</code> has the same API and loads the folder from disk. It runs on
        onnxruntime-node (native CPU), so it needs no worker, cache or <code>.wasm</code> files:
      </p>
      <pre><code>{NODE}</code></pre>

      <h2 id="serving">Serving models</h2>
      <ul>
        <li>Serve the export folder as static files. Encoder models must come from the page's own origin.</li>
        <li>
          Serve onnxruntime-web's <code>ort-wasm*</code> files at <code>ortWasmPaths</code>;{" "}
          <code>npm run sync-model</code> copies them into <code>public/ort</code> along with the models.
        </li>
        <li>
          Optional: the <code>Cross-Origin-Opener-Policy: same-origin</code> and{" "}
          <code>Cross-Origin-Embedder-Policy: require-corp</code> headers enable multi-threaded WASM.
        </li>
        <li>
          This site is built from the <a href="https://github.com/quaedra/www">quaedra/www</a> repository.
        </li>
      </ul>

      <h2 id="checks">Checks</h2>
      <table>
        <tbody>
          <tr><td><code>uv run pytest</code></td><td>Python tests (no API calls)</td></tr>
          <tr><td><code>npm test</code></td><td>library tests: the config contract (Python schema → browser validator), download progress, worker transport</td></tr>
          <tr><td><code>npm run parity</code></td><td>headless Chromium: browser answers vs Python (≥ 99.5% of labels)</td></tr>
          <tr><td><code>npm run bench</code></td><td>load time and latency per backend; the result shows on the home page</td></tr>
          <tr><td><code>npm run offline</code></td><td>network cut: the page and the model reload from caches</td></tr>
          <tr><td><code>npm run test:browser</code></td><td>the built pages against the generated fixture model</td></tr>
        </tbody>
      </table>
    </Layout>
  );
}

mount(<Docs />);
