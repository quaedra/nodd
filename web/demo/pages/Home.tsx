import { useEffect, useState } from "react";
import { catalogOf, useModels } from "../catalog";
import { MODEL_URL, type ModelEntry, fmt } from "../common";
import { BenchPanel } from "../ui/Bench";
import { Classifier } from "../ui/Classifier";
import { Layout } from "../ui/Layout";
import { mount } from "../ui/mount";
import { UsageTabs, usagesFor } from "../ui/Usage";

// hand-picked inputs for the comment moderation demo; other models use their catalog examples
const EXAMPLES = [
  "Thanks for sharing! Do you have any tips for beginners?",
  "Buy 10,000 real followers for $9.99 at fastfollowz dot example",
  "The devs who shipped this are brain-dead clowns.",
  "This update is terrible, sync is broken again.",
  "Great post! Check my profile for more tips 😉",
  "hi",
];

const SPEC = `task: comment_moderation
input:  {type: text, max_chars: 2000}
output:
  type: choice
  labels:
    ok:    Normal comment. Can be positive, negative or off topic, but harmless.
    spam:  Ads, links to unrelated products or services, SEO junk, scams.
    toxic: Insults, harassment, threats or hate toward people or groups.
targets:    {min_macro_f1: 0.90, deploy: browser, max_download_mb: 30}`;

const PIPELINE = `task spec (YAML) → collect inputs → teacher labels
  → train → calibrate → evaluate → export → browser`;

// docs/SYNTHETIC_TRAINING.md: released versions, q8 test macro-F1 and download
const RELEASED: [string, string, number, number][] = [
  ["Comment moderation v4", "MiniLM-L6", 0.934, 24.32],
  ["Prompt injection v3", "MiniLM-L3", 0.942, 18.58],
  ["Sentiment v2", "MiniLM-L6", 0.88, 24.32],
  ["Support triage v2", "MiniLM-L6", 0.939, 24.32],
];

const USAGES = usagesFor({
  url: "/models/comment_moderation/v4",
  task: "comment_moderation",
  version: "v4",
  example: "Buy cheap followers at ...",
  labels: ["ok", "spam", "toxic"],
});

const DECISION = `{
  "label": "spam",
  "probabilities": {"ok": 0.04, "spam": 0.93, "toxic": 0.03},
  "confidence": 0.93,
  "escalated": false,
  "source": "micro",
  "model": "comment_moderation@v4",
  "latency_ms": 0.4
}`;

function Home() {
  const index = useModels();
  const catalog = catalogOf(index);
  const [model, setModel] = useState(MODEL_URL);
  const [extra, setExtra] = useState<ModelEntry | null>(null);

  // a model that isn't in the index (opened with ?model=…) still gets an option
  useEffect(() => {
    if (!index || index.some((m) => m.path === MODEL_URL)) return;
    setExtra({ id: MODEL_URL.split("/").pop()!, path: MODEL_URL, base: "", downloadMB: NaN });
  }, [index]);

  const options = [...(extra ? [extra] : []), ...(index ?? [])];
  const entry = catalog.find((m) => m.path === model);
  const examples = entry?.task === "comment_moderation" ? EXAMPLES : (entry?.examples ?? []);

  const picker = (
    <>
      <label htmlFor="model">Model</label>
      <select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
        {options.map((m) => (
          <option key={m.path} value={m.path}>
            {m.id}{Number.isFinite(m.downloadMB) ? ` · ${fmt(m.downloadMB, 1)} MB` : ""}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <Layout
      page="home"
      lede="Tiny, calibrated text classifiers that run in the browser. One decision, about 20 MB, offline, no per-call cost, and each model knows when it is unsure."
      intro={
        <div className="kv">
          <div><b>18–24 MB</b><span>q8 model download</span></div>
          <div><b>12 ms</b><span>Browser p95, MiniLM-L6</span></div>
          <div><b>MIT</b><span>Source license</span></div>
        </div>
      }
    >
      <section id="try" aria-labelledby="try-heading">
        <h2 id="try-heading">Try it</h2>
        <p>
          The model downloads once and runs entirely in this tab, so nothing you type leaves your browser.{" "}
          {entry && (
            <>
              {entry.description} Labels:{" "}
              {Object.keys(entry.labels).map((l, i) => (
                <span key={l}>{i > 0 && ", "}<code>{l}</code></span>
              ))}
              .
            </>
          )}
        </p>
        {index && <Classifier key={model} model={model} examples={examples} heading="h3" picker={picker} />}
        <p className="note">
          Below the calibrated threshold a decision should be escalated to a larger model. Models are trained on synthetic
          data; expect lower accuracy on real text.
        </p>
      </section>

      <section id="how" aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>
        <pre><code>{PIPELINE}</code></pre>
        <p>
          You write a task spec. Label descriptions matter: the labeling model reads them.
        </p>
        <pre><code>{SPEC}</code></pre>
        <p>
          One command collects inputs, has a larger model label them (every call is cached on disk), trains every base
          model that fits the download budget, keeps the best one, calibrates it and exports it for the browser.
          Calibration uses temperature scaling on a held-out split, so the confidence a model reports matches how often
          it is right. Exports are checked for parity: the browser must match Python on the test set.
        </p>
        <pre><code>uv run nodd run examples/comment_moderation.yaml</code></pre>
      </section>

      <section id="released" aria-labelledby="released-heading">
        <h2 id="released-heading">Released models</h2>
        <table>
          <thead>
            <tr><th>Task</th><th>Base</th><th className="num">Test F1</th><th className="num">MB</th></tr>
          </thead>
          <tbody>
            {RELEASED.map(([task, base, f1, mb]) => (
              <tr key={task}>
                <td>{task}</td><td>{base}</td>
                <td className="num"><span className="bar" style={{ width: `${f1 * 48}px` }} /> {f1.toFixed(3)}</td>
                <td className="num">{mb.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">
          q8 test macro-F1 on small synthetic holdouts (50–257 cases); real-world accuracy is unmeasured. Chromium WASM and
          WebGPU predictions agree with Python ONNX on 99.6–100% of test cases.{" "}
          <a href="https://github.com/quaedra/nodd/blob/main/docs/SYNTHETIC_TRAINING.md">Training report</a>
        </p>

        <h3>Picking a base: comment moderation</h3>
        <p>
          Every candidate that fits the download budget is trained, and the best fit is kept: the highest validation F1,
          or the smaller model when two are practically tied. They train on a CPU; no GPU needed.
        </p>
        <table>
          <thead>
            <tr><th>Base</th><th className="num">Download</th><th className="num">F1</th><th className="num">Handled</th><th className="num">p95</th></tr>
          </thead>
          <tbody>
            <tr><td>MiniLM-L3</td><td className="num">18.6 MB</td><td className="num">0.943</td><td className="num">88%</td><td className="num">6.8 ms</td></tr>
            <tr><td>MiniLM-L6 (kept)</td><td className="num">23.7 MB</td><td className="num">0.948</td><td className="num">96%</td><td className="num">12.0 ms</td></tr>
          </tbody>
        </table>
        <p className="note">“Handled” is the share of test cases answered without escalation; p95 is browser latency.</p>
      </section>

      <section id="use" aria-labelledby="use-heading">
        <h2 id="use-heading">Use it</h2>
        <p>The same model answers the same way in the browser, in Node.js and in Python.</p>
        <UsageTabs usages={USAGES} />
        <p>Every answer has the same shape:</p>
        <pre><code>{DECISION}</code></pre>
      </section>

      <section id="bench" aria-labelledby="bench-heading">
        <h2 id="bench-heading">Benchmark</h2>
        <p>
          Load time, per-input latency and batch throughput for each browser backend, on the selected model's test inputs.
          Cold load includes the download; warm load reads the model back from the browser cache. The demo runs on WASM:
          at this size WebGPU is slower per input, so it's only an opt-in for large batches.
        </p>
        <BenchPanel key={model} model={model} />
      </section>
    </Layout>
  );
}

mount(<Home />);
