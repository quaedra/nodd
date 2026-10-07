import { useEffect, useRef, useState } from "react";
import { TrainingClient, defaults, validateDataset, validateOptions, type Options, type Hardware, type Progress, type Result } from "@nodd/browser/training";
import { Layout } from "../ui/Layout";
import { mount } from "../ui/mount";

function Train() {
  const client = useRef<TrainingClient | null>(null);
  const generation = useRef(0);
  const downloadAbort = useRef<AbortController | null>(null);
  const [bundle, setBundle] = useState<File | null>(null);
  const [data, setData] = useState("");
  const [options, setOptions] = useState<Options>(defaults);
  const [backend, setBackend] = useState<"auto" | "cpu" | "webgpu" | "webgl">("auto");
  const [hardware, setHardware] = useState<Hardware | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [prediction, setPrediction] = useState("");
  const [history, setHistory] = useState<Progress[]>([]);
  useEffect(() => () => { generation.current++; downloadAbort.current?.abort(); client.current?.dispose(); }, []);
  function invalidate() {
    generation.current++; downloadAbort.current?.abort(); client.current?.dispose(); client.current = null;
    setHardware(null); setResult(null); setProgress(null); setError(""); setPrediction(""); setHistory([]);
  }
  function update<K extends keyof Options>(key: K, value: Options[K]) { invalidate(); setOptions(o => ({ ...o, [key]: value })); }
  function stop() { invalidate(); setBusy(false); setProgress({ phase: "Stopped. Check your browser again to start a fresh run." }); }
  async function run(action: () => Promise<void>) {
    const id = generation.current;
    setBusy(true); setError("");
    try { await action(); }
    catch (e) {
      if (id === generation.current) {
        setError(e instanceof Error ? e.message : String(e)); setHardware(null); setResult(null);
        client.current?.dispose(); client.current = null;
      }
    } finally { if (id === generation.current) setBusy(false); }
  }
  function onProgress(p: Progress) {
    setProgress(p);
    if (p.validationF1 !== undefined) setHistory(h => [...h, p]);
  }
  async function check() {
    invalidate();
    const id = generation.current;
    await run(async () => {
      if (!globalThis.isSecureContext || typeof Worker === "undefined") throw new Error("Training requires HTTPS (or localhost) and Web Workers.");
      validateOptions(options); validateDataset(data, options.seed);
      setProgress({ phase: bundle ? "Opening checkpoint" : "Downloading starter encoder (about 70 MB)" });
      let buffer: ArrayBuffer;
      if (bundle) {
        if (bundle.size > 250_000_000) throw new Error("Checkpoint must be smaller than 250 MB.");
        buffer = await bundle.arrayBuffer();
      } else {
        downloadAbort.current = new AbortController();
        const response = await fetch(`${import.meta.env.BASE_URL}training/minilm-l3.zip`, { signal: downloadAbort.current.signal });
        if (!response.ok || response.headers.get("content-type")?.includes("text/html")) throw new Error("Starter encoder is not installed on this site. Upload a training checkpoint, or follow the setup instructions below.");
        buffer = await response.arrayBuffer();
      }
      if (id !== generation.current) return;
      const worker = new TrainingClient(); client.current = worker;
      const checked = await worker.check({ bundle: buffer, data, options, backend }, onProgress);
      if (id !== generation.current) return;
      setHardware(checked); setProgress({ phase: "Training step passed. Ready to train." });
    });
  }
  async function train() {
    const id = generation.current;
    await run(async () => {
      const trained = await client.current!.train(onProgress);
      if (id !== generation.current) return;
      setResult(trained); setProgress({ phase: "Training complete. Best validation checkpoint restored." });
    });
  }
  async function download() {
    await run(async () => {
      const bytes = await client.current!.download();
      const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/zip" }));
      const a = document.createElement("a"); a.href = url; a.download = `${options.task}.nodd.zip`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  return <Layout page="train">
    <p>Teach a small encoder your decision using labeled examples. Every encoder layer is fine-tuned on your device; your examples stay in this browser.</p>
    <p className="muted small">Experimental. Start with a small dataset and keep this tab open. Download your completed checkpoint before closing it.</p>
    <fieldset disabled={busy} className="training-fields">
      <legend>Model and examples</legend>
      <label htmlFor="checkpoint">Starting checkpoint <span className="muted">(optional; defaults to MiniLM-L3)</span></label>
      <input id="checkpoint" type="file" accept=".zip" onChange={e => { invalidate(); setBundle(e.target.files?.[0] ?? null); }} />
      <p className="muted small">Upload a prepared Nodd encoder or a previously downloaded training checkpoint. Continuing a checkpoint starts a new optimizer.</p>
      <label htmlFor="dataset-file">Labeled examples (JSON or JSONL)</label>
      <input id="dataset-file" type="file" accept=".json,.jsonl" onChange={async e => {
        invalidate(); setData(""); const id = generation.current, file = e.target.files?.[0]; if (!file) return;
        if (file.size > 20_000_000) { setError("Dataset must be smaller than 20 MB."); return; }
        try { const contents = await file.text(); if (generation.current === id) setData(contents); }
        catch { if (generation.current === id) setError("Could not read the dataset file."); }
      }} />
      <label htmlFor="training-data">Or paste examples</label>
      <textarea id="training-data" value={data} onChange={e => { invalidate(); setData(e.target.value); }} placeholder={'{"text":"I love this product","label":"positive"}\n{"text":"This is disappointing","label":"negative"}'} />
      <p className="muted small">At least 5 distinct examples per label and 2 labels. Automatic split: 60% training, 20% validation, 20% test. To preserve existing holdouts, supply a <code>split</code> field on every row: <code>train</code>, <code>val</code>, or <code>test</code>. Optional <code>confidence</code>: greater than 0, up to 1.</p>
      <div className="controls"><label>Task name <input aria-label="Task name" value={options.task} onChange={e => update("task", e.target.value)} /></label></div>
      <details><summary>Training settings</summary>
        <div className="training-grid">
          {([['epochs', 'Epochs', 1, 30, 1], ['batchSize', 'Batch size', 1, 8, 1], ['maxTokens', 'Maximum tokens', 8, 256, 1], ['learningRate', 'Learning rate', 0.000001, 0.01, 0.000001], ['seed', 'Seed', 0, 2147483647, 1], ['targetPrecision', 'Target precision', 0.01, 1, 0.01]] as const).map(([key, label, min, max, step]) =>
            <label key={key}>{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={options[key]} onChange={e => update(key, Number(e.target.value))} /></label>)}
          <label>Compute backend<select aria-label="Compute backend" value={backend} onChange={e => { invalidate(); setBackend(e.target.value as typeof backend); }}><option value="auto">Automatic</option><option value="webgpu">WebGPU</option><option value="webgl">WebGL</option><option value="cpu">CPU</option></select></label>
        </div>
      </details>
    </fieldset>
    <div className="controls">
      <button disabled={busy || !data.trim()} onClick={() => void check()}>Check browser &amp; model</button>
      <button disabled={busy || !hardware || !!result} onClick={() => void train()}>Start full training</button>
      {busy && <button onClick={stop}>Stop</button>}
    </div>
    {error && <p role="alert" className="fail">{error}</p>}
    <div role="status" aria-live="polite">{progress?.phase}{progress?.step !== undefined && ` · ${progress.step}/${progress.total} steps`}{progress?.loss !== undefined && ` · loss ${progress.loss.toFixed(4)}`}</div>
    {busy && progress?.total && <progress aria-label="Training progress" value={progress.step ?? 0} max={progress.total} />}
    {hardware && <section><h2>Browser check passed</h2>
      <p className="muted small">GPU: {hardware.gpu ?? (hardware.webgpu ? "WebGPU available; device name not reported" : "WebGPU unavailable")}</p>
      <table><tbody><tr><th>Tested backend</th><td>{hardware.backend}</td></tr><tr><th>Trainable parameters</th><td>{hardware.parameters.toLocaleString()}</td></tr><tr><th>Reported memory / CPU threads</th><td>{hardware.memoryGB ? `${hardware.memoryGB} GB (approximate)` : "Memory not reported"} / {hardware.cores ?? "unknown"}</td></tr><tr><th>Estimated working memory</th><td>{hardware.estimatedMB} MB</td></tr><tr><th>First training step</th><td>{(hardware.stepMs / 1000).toFixed(2)} seconds (includes warmup)</td></tr></tbody></table>
      {hardware.notes.map(n => <p className="muted small" key={n}>{n}</p>)}
    </section>}
    {history.length > 0 && <section><h2>Validation progress</h2><table><thead><tr><th>Epoch</th><th>Macro F1</th></tr></thead><tbody>{history.map(p => <tr key={p.epoch}><td>{p.epoch}</td><td>{p.validationF1!.toFixed(4)}</td></tr>)}</tbody></table></section>}
    {result && <section><h2>Trained model</h2>
      <p>Best epoch: {result.bestEpoch}. Untouched test set: {result.test.count} examples, macro F1 {result.test.macroF1.toFixed(4)}, accuracy {(result.test.accuracy * 100).toFixed(1)}%.</p>
      <p>Test coverage: {(result.test.coverage * 100).toFixed(1)}%. Precision on covered examples: {result.test.precision === null ? "none covered" : `${(result.test.precision * 100).toFixed(1)}%`}. {result.targetReached ? "The target precision was reached on validation; test performance may differ." : "The target precision was not reached on validation. All predictions escalate."}</p>
      <button disabled={busy} onClick={() => void download()}>Download trained checkpoint</button>
      <p className="muted small">Includes trained weights, settings, metrics, and your labeled examples. Keep this file private if your examples are private.</p>
      <label htmlFor="try-trained">Try your trained model</label><textarea id="try-trained" value={text} onChange={e => setText(e.target.value)} />
      <button disabled={busy || !text.trim()} onClick={() => void run(async () => {
        const decision = await client.current!.predict(text);
        setPrediction(JSON.stringify({ decision, confident: decision.confidence >= result.threshold }, null, 2));
      })}>Classify</button>
      {prediction && <pre>{prediction}</pre>}
    </section>}
    <details className="training-help"><summary>Prepare a checkpoint and export to ONNX</summary>
      <p>A site owner can install the default starter, or you can prepare a ZIP from any supported Nodd run:</p>
      <pre>{'uv run nodd prepare-browser-training --base sentence-transformers/paraphrase-MiniLM-L3-v2 \\\n  --out web/public/training/minilm-l3.zip'}</pre>
      <p>After training, import your downloaded checkpoint and use Nodd’s normal evaluation and browser export:</p>
      <pre>{`uv run nodd import-browser-training ${options.task}.nodd.zip\nuv run nodd eval runs/${options.task}/v1\nuv run nodd export runs/${options.task}/v1`}</pre>
      <p>Use the version path printed by import. Import recalibrates confidence using the saved validation split. ONNX export runs locally in Python; full fine-tuning happens in your browser.</p>
    </details>
  </Layout>;
}
mount(<Train />);
