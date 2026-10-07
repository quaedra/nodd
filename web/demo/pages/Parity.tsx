import { useEffect, useState } from "react";
import { MODEL_URL } from "../common";
import { type ParityRun, runParity } from "../parity";
import { ParitySummary, ParityTable } from "../ui/Bench";
import { Layout } from "../ui/Layout";
import { mount } from "../ui/mount";

/** Runs on load; `npm run parity` reads window.__result and fails below 99.5% agreement. */
function Parity() {
  const [run, setRun] = useState<ParityRun | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    runParity(MODEL_URL).then(
      (r) => {
        setRun(r);
        (window as unknown as { __result: unknown }).__result = r;
      },
      (err) => setError(`failed: ${err instanceof Error ? err.message : err}`),
    );
  }, []);

  return (
    <Layout page="parity">
      <h2 className="title">Parity</h2>
      <p className="muted small">{run ? <>{MODEL_URL} · <ParitySummary run={run} /></> : error || "running…"}</p>
      {run && <ParityTable run={run} />}
    </Layout>
  );
}

mount(<Parity />);
