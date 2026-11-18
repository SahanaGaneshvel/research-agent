"use client";

import { X } from "lucide-react";
import { motion } from "motion/react";

import { domain } from "@/lib/flow";
import { SOURCE_PLAIN, type Layers, type NodeId, type SourceNode } from "@/lib/layers";
import type { RunState } from "@/lib/types";
import { ReportView } from "./report-view";

// ------------------------------------------------------------------ what's happening now
export function NowPanel({ layers }: { layers: Layers }) {
  const { title, lines } = layers.now;
  return (
    <section aria-live="polite" className="rounded-xs border border-line border-l-4 border-l-primary bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">What&apos;s happening now</p>
      {/* keyed CSS fade: text is always visible even if an animation frame is skipped */}
      <div key={title} className="fade-in">
        <h3 className="mt-2 text-2xl font-bold text-ink">{title}</h3>
        {lines.map((l) => (
          <p key={l} className="fade-in mt-1.5 text-base leading-relaxed text-muted">{l}</p>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ details for a clicked box
const ABOUT: Record<NodeId, { title: string; text: string }> = {
  question: { title: "The question", text: "What you asked. Everything else is built to answer it." },
  check: { title: "Check", text: "Before anything runs, the question is checked and the local AI model is confirmed to be ready." },
  web: { title: "Web", text: "Free search engines, tried one after another until one answers." },
  cards: { title: "Model cards", text: "Official pages for each model on Hugging Face. Sizes and licences come straight from here." },
  papers: { title: "Papers", text: "Research papers from arXiv." },
  code: { title: "Code", text: "Open-source projects on GitHub." },
  research: { title: "Research", text: "Searches four kinds of sources, opens the pages, and has the AI model read each one, keeping only facts that are actually in the text." },
  compare: { title: "Compare", text: "Picks the models worth comparing and fills in one row per model, using only what the sources say about that model." },
  evaluate: { title: "Evaluate", text: "Checks every benchmark number against the source it came from, and estimates how much memory each model needs." },
  write: { title: "Write", text: "Writes the report, then removes any sentence that credits a source that never said it." },
  report: { title: "Report", text: "The finished report, with a link to every source used." },
  model: { title: "Local AI model", text: "One small AI model running on the laptop, never online. It plans the searches, reads the sources, fills in the table and writes the text. Plain code checks its work at every step." },
};

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[0.9rem] text-muted">{children}</p>;
}

function Links({ items }: { items: { title: string; url: string }[] }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((it) => (
        <li key={it.url} className="text-[0.92rem]">
          <a href={it.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{it.title}</a>
          <span className="text-muted"> · {domain(it.url)}</span>
        </li>
      ))}
    </ul>
  );
}

function Produced({ id, layers, result, model }: { id: NodeId; layers: Layers; result: RunState | null; model: string }) {
  switch (id) {
    case "question":
      return <p className="mt-3 text-lg font-medium text-ink">{result?.topic}</p>;
    case "web": case "cards": case "papers": case "code": {
      const found = layers.results[id as SourceNode].flatMap((r) => r.items);
      return found.length ? <Links items={found} /> : <Empty>Nothing from {SOURCE_PLAIN[id as SourceNode]} yet.</Empty>;
    }
    case "research":
      if (!layers.reads.length) return <Empty>No sources read yet.</Empty>;
      return (
        <ul className="mt-3 space-y-3">
          {layers.reads.map((r) => {
            const src = layers.sources.find((s) => s.id === r.id);
            return (
              <li key={r.id} className="text-[0.92rem]">
                <a href={src?.url} target="_blank" rel="noreferrer"
                  className={r.kept ? "font-medium text-primary hover:underline" : "text-muted line-through"}>
                  {r.title}
                </a>
                {!r.kept && <span className="text-muted"> (set aside, nothing useful)</span>}
                {r.kept && r.facts.slice(0, 2).map((f) => (
                  <p key={f} className="mt-0.5 text-[0.88rem] leading-relaxed text-muted">{f}</p>
                ))}
              </li>
            );
          })}
        </ul>
      );
    case "compare":
      if (!layers.rows.length) return <Empty>No models compared yet.</Empty>;
      return (
        <>
          <table className="mt-3 w-full text-left text-[0.9rem]">
            <thead>
              <tr className="border-b border-line bg-field text-[0.82rem] text-ink">
                <th className="px-2 py-2 font-semibold">Model</th>
                <th className="px-2 py-2 font-semibold">Size</th>
                <th className="px-2 py-2 font-semibold">Licence</th>
              </tr>
            </thead>
            <tbody>
              {layers.rows.map((r) => (
                <tr key={r.model} className="border-b border-line align-top">
                  <td className="px-2 py-2 font-medium text-ink">{r.model.split("/").at(-1)}</td>
                  <td className="px-2 py-2 text-muted">{r.open ? "…" : r.size}</td>
                  <td className="px-2 py-2 text-muted">{r.open ? "…" : r.licence}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {layers.differences.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-[0.9rem] text-muted">
              {layers.differences.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </>
      );
    case "evaluate":
      if (layers.nodes.evaluate.status !== "done") return <Empty>Not finished yet.</Empty>;
      return (
        <>
          <p className="mt-3 text-[0.92rem] text-muted">
            {layers.checks.proposed
              ? `${layers.checks.confirmed} of ${layers.checks.proposed} benchmark scores were found in their sources.`
              : "None of the sources gave benchmark scores that could be checked, so none are reported."}
          </p>
          {layers.memory.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[0.85rem] text-muted">Memory needed just for the model at 4-bit (an estimate)</p>
              {layers.memory.map((m, i) => {
                const max = Math.log10(Math.max(...layers.memory.map((x) => x.gb)) + 1);
                return (
                  <div key={m.model} className="grid grid-cols-[minmax(0,9rem)_1fr_5.5rem] items-center gap-3 text-[0.85rem]">
                    <span className="truncate text-muted">{m.model}</span>
                    <span className="h-1.5 bg-line-soft">
                      <motion.span className="block h-full bg-primary" initial={{ width: 0 }}
                        animate={{ width: `${Math.max(2, (Math.log10(m.gb + 1) / max) * 100)}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }} />
                    </span>
                    <span className="text-right font-mono text-ink">{m.gb.toLocaleString()} GB</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      );
    case "write":
      if (layers.nodes.write.status !== "done") return <Empty>Not finished yet.</Empty>;
      return (
        <>
          <p className="mt-3 text-[0.92rem] text-muted">
            {layers.removed.length
              ? `${layers.removed.length} sentences were removed because the source they named never said it:`
              : "Every sentence was checked against its sources. Nothing had to be removed."}
          </p>
          {layers.removed.length > 0 && (
            <ul className="mt-2 space-y-1 text-[0.85rem] text-muted line-through">
              {layers.removed.map((r) => <li key={r}>{r}</li>)}
            </ul>
          )}
        </>
      );
    case "report":
      return result?.report && layers.nodes.report.status === "done"
        ? <div className="mt-2"><ReportView result={result} compact /></div>
        : <Empty>The report appears here when the run finishes.</Empty>;
    case "model":
      return <p className="mt-3 text-[0.92rem] text-muted">This run used <span className="font-mono">{model}</span> through Ollama.</p>;
    default:
      return null;
  }
}

export function DetailsCard({ id, layers, result, model, onClose }: {
  id: NodeId; layers: Layers; result: RunState | null; model: string; onClose: () => void;
}) {
  const about = ABOUT[id];
  return (
    <section key={id} className="fade-in rounded-xs border border-line bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Step details</p>
          <h3 className="mt-2 text-2xl font-bold text-ink">{about.title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xs border border-line text-muted transition hover:border-primary/40 hover:bg-soft hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{about.text}</p>
      <Produced id={id} layers={layers} result={result} model={model} />
    </section>
  );
}
