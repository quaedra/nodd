import { type CatalogEntry, catalogOf, pct, title, useModels } from "../catalog";
import { MODEL_URL, page } from "../common";
import { Classifier } from "../ui/Classifier";
import { Layout } from "../ui/Layout";
import { mount } from "../ui/mount";
import { UsageTabs, usagesFor } from "../ui/Usage";

function Card({ m }: { m: CatalogEntry }) {
  const q = m.metrics;
  const per = q?.perLabel ?? {};
  const usages = usagesFor({
    url: m.path,
    task: m.task,
    version: m.version,
    example: m.examples[0] ?? "…",
    labels: Object.keys(m.labels),
  });
  const quality: [string, string][] = q
    ? [
        ["macro F1", q.macroF1.toFixed(3)],
        ["accuracy", pct(q.accuracy)],
        ["calibration error (ECE)", `${q.eceBefore.toFixed(3)} → ${q.eceAfter.toFixed(3)}`],
        ["train / val / test", `${m.data.train} / ${m.data.val} / ${m.data.test}`],
      ]
    : [];

  return (
    <>
      <div className="cols">
        <section>
          <h2>Labels</h2>
          <div className="scroll">
            <table>
              <thead>
                <tr><th>label</th><th>meaning</th><th>F1</th><th>test n</th></tr>
              </thead>
              <tbody>
                {Object.entries(m.labels).map(([k, d]) => (
                  <tr key={k}>
                    <td><code>{k}</code></td>
                    <td style={{ whiteSpace: "normal" }}>{d}</td>
                    <td className="num">{per[k] ? per[k].f1.toFixed(2) : "—"}</td>
                    <td className="num">{per[k]?.support ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2>Quality</h2>
          {q ? (
            <>
              <p className="small">
                On {q.testN} held-out test inputs.
              </p>
              <table className="kv">
                <tbody>
                  {quality.map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="small">No evaluation report was synced for this model.</p>
          )}
        </section>
      </div>

      <h2>Use it</h2>
      <UsageTabs usages={usages} />
      <p className="small">
        <a href={`${m.path}/report.md`}>Full evaluation report</a> ·{" "}
        <a href={page("bench", `?model=${encodeURIComponent(m.path)}`)}>Benchmark this model</a> ·{" "}
        <a href={page("parity", `?model=${encodeURIComponent(m.path)}`)}>Check parity</a>
      </p>
    </>
  );
}

function Model() {
  const index = useModels();
  const m = catalogOf(index).find((e) => e.path === MODEL_URL);

  return (
    <Layout page="model">
      <title>{m ? `${title(m.task)} · Nodd · Quaedra Research` : "Model · Nodd · Quaedra Research"}</title>
      <p><a href={page("models")}>← Models</a></p>
      {m ? (
        <>
          <h2 className="title">{title(m.task)} <span className="muted">{m.version}</span></h2>
          <p>{m.description}</p>
          <p className="muted small">
            {[m.id, m.base, Number.isFinite(m.downloadMB) ? `${m.downloadMB.toFixed(1)} MB` : null, `trained ${m.created.slice(0, 10)}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </>
      ) : (
        <>
          <h2 className="title">Model</h2>
          {index && <p>{MODEL_URL} isn't in the model repository.</p>}
        </>
      )}
      {index && <Classifier model={MODEL_URL} examples={m?.examples ?? []} />}
      {m && <Card m={m} />}
    </Layout>
  );
}

mount(<Model />);
