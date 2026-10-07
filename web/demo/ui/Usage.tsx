import { useState } from "react";

export interface Usage {
  label: string;
  install: string;
  code: string;
}

/** Browser, Node.js and Python snippets for one model. `url` is where the site serves its export folder. */
export function usagesFor(m: { url: string; task: string; version: string; example: string; labels: string[] }): Usage[] {
  const text = JSON.stringify(m.example);
  const labels = m.labels.map((l) => JSON.stringify(l));
  const which = labels.length === 3 ? `${labels[0]}, ${labels[1]} or ${labels[2]}` : `one of ${labels.join(", ")}`;
  return [
    {
      label: "Browser",
      install: "npm install @nodd/browser",
      code: `import { nodd } from "@nodd/browser";

// the export folder, served from your site (runs in a Web Worker, cached offline)
const m = await nodd.load("${m.url}");
const d = await m.decide(${text});
// d.label is ${which}
if (!m.isConfident(d)) { /* escalate to a bigger model */ }`,
    },
    {
      label: "Node.js",
      install: "npm install @nodd/node",
      code: `import { nodd } from "@nodd/node";

// the export folder on disk (onnxruntime-node, native CPU)
const m = await nodd.load("./models/${m.task}/${m.version}");
const d = await m.decide(${text});
// d.label is ${which}
if (!m.isConfident(d)) { /* escalate to a bigger model */ }`,
    },
    {
      label: "Python",
      install: "uv add git+https://github.com/quaedra/nodd",
      code: `from nodd.runtime import Runtime

# the trained run folder (PyTorch)
rt = Runtime.load("runs/${m.task}/${m.version}")
d = rt.decide(${text})
# d.label is ${which}
if not rt.is_confident(d):
    ...  # escalate to a bigger model`,
    },
  ];
}

/** The same model from each runtime: one tab per language, install line above the code. */
export function UsageTabs({ usages }: { usages: Usage[] }) {
  const [active, setActive] = useState(0);
  const u = usages[active];
  return (
    <div className="usage">
      <div role="tablist" aria-label="Language" className="tabs">
        {usages.map((x, i) => (
          <button
            key={x.label}
            role="tab"
            id={`usage-tab-${i}`}
            aria-selected={i === active}
            aria-controls="usage-panel"
            onClick={() => setActive(i)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="usage-panel" aria-labelledby={`usage-tab-${active}`}>
        <pre><code>{u.install}</code></pre>
        <pre><code>{u.code}</code></pre>
      </div>
    </div>
  );
}
