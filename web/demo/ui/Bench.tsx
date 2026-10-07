import { useEffect, useState } from "react";
import { type BenchResult, type BenchRun, runBench } from "../bench";
import { fmt, page } from "../common";
import { type ParityRun, MIN_AGREEMENT } from "../parity";

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function BenchTable({ results }: { results: BenchResult[] }) {
  if (!results.length) return null;
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr><th>backend</th><th>cold load</th><th>warm load</th><th>model</th><th>p50</th><th>p95</th><th>engine p50</th><th>batch/input</th><th>memory</th></tr>
        </thead>
        <tbody>
          {results.map((r) =>
            r.error ? (
              <tr key={r.name}><td>{r.name}</td><td colSpan={8} className="muted">{r.error}</td></tr>
            ) : (
              <tr key={r.name} className="num">
                <td>{r.name}</td>
                <td>{fmt(r.coldLoadMs!, 0)} ms</td>
                <td>{fmt(r.warmLoadMs!, 0)} ms</td>
                <td>{fmt(r.modelMB!, 1)} MB</td>
                <td>{fmt(r.p50Ms!)} ms</td>
                <td>{fmt(r.p95Ms!)} ms</td>
                <td>{fmt(r.engineP50Ms!, 3)} ms</td>
                <td>{fmt(r.batchMsPerInput!, 3)} ms</td>
                <td>{r.memoryMB == null ? "—" : `${fmt(r.memoryMB, 0)} MB`}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ParityTable({ run }: { run: ParityRun }) {
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr><th>backend</th><th>device</th><th>label agreement</th><th>max |Δp|</th><th></th></tr>
        </thead>
        <tbody>
          {run.results.map((r) =>
            r.skipped ? (
              <tr key={r.name}><td>{r.name}</td><td colSpan={4} className="muted">{r.skipped}</td></tr>
            ) : (
              <tr key={r.name} className="num">
                <td>{r.name}</td>
                <td>{r.device}</td>
                <td>{fmt(r.agreement! * 100, 2)}%</td>
                <td>{r.maxProbDiff!.toExponential(2)}</td>
                <td className={r.pass ? "pass" : "fail"}>{r.pass ? "✓" : "✗"}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

export const ParitySummary = ({ run }: { run: ParityRun }) => (
  <>
    {run.n} test inputs vs Python · target ≥ {MIN_AGREEMENT * 100}% · <b className={run.pass ? "pass" : "fail"}>{run.pass ? "PASS" : "FAIL"}</b>
  </>
);

/** Recorded headless-Chromium numbers for a model (bench.json), with a button to measure this browser. */
export function BenchPanel({ model }: { model: string }) {
  const [results, setResults] = useState<BenchResult[]>([]);
  const [sub, setSub] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`${model}/bench.json`)
      .then((res) => (res.ok ? (res.json() as Promise<{ results: BenchResult[]; date?: string }>) : Promise.reject()))
      .then(
        (r) => {
          if (!live) return;
          setResults(r.results);
          setSub(`Recorded in headless Chromium${r.date ? ` on ${r.date.slice(0, 10)}` : ""}. Run it to measure your own browser.`);
        },
        () => live && setSub("No recorded run for this model yet."),
      );
    return () => void (live = false);
  }, [model]);

  async function run() {
    setRunning(true);
    setResults([]);
    setSub("Running in this browser. The model is re-downloaded for each cold load.");
    try {
      const r: BenchRun = await runBench(model, (rs) => setResults([...rs]));
      setSub(`This browser · ${r.n} test inputs · crossOriginIsolated=${r.crossOriginIsolated} · WebGPU=${r.webgpu}`);
    } catch (err) {
      setSub(`failed: ${message(err)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <p className="muted small">{sub}</p>
      <BenchTable results={results} />
      <div className="controls">
        <button onClick={run} disabled={running}>{running ? "Running…" : "Run in this browser"}</button>
        <a href={page("bench", `?model=${encodeURIComponent(model)}`)}>Open on its own page</a>
      </div>
    </>
  );
}
