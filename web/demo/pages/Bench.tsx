import { useEffect, useState } from "react";
import { type BenchResult, runBench } from "../bench";
import { MODEL_URL } from "../common";
import { BenchTable } from "../ui/Bench";
import { Layout } from "../ui/Layout";
import { mount } from "../ui/mount";

/** Runs on load; `npm run bench` reads window.__result and writes it to the export's bench.json. */
function Bench() {
  const [results, setResults] = useState<BenchResult[]>([]);
  const [sub, setSub] = useState("running…");

  useEffect(() => {
    runBench(MODEL_URL, (rs) => setResults([...rs])).then(
      (r) => {
        setResults(r.results);
        setSub(`${MODEL_URL} · ${r.n} test inputs · crossOriginIsolated=${r.crossOriginIsolated} · WebGPU=${r.webgpu} · ${r.userAgent}`);
        (window as unknown as { __result: unknown }).__result = r;
      },
      (err) => setSub(`failed: ${err instanceof Error ? err.message : err}`),
    );
  }, []);

  return (
    <Layout page="bench">
      <h2 className="title">Benchmark</h2>
      <p className="muted small">{sub}</p>
      <BenchTable results={results} />
    </Layout>
  );
}

mount(<Bench />);
