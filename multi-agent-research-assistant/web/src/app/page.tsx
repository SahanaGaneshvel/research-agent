"use client";

import {
  ArrowRight, Calculator, CircleAlert, Cpu, Info, Link2, Pause, Play, RotateCcw, ShieldCheck, SkipForward,
} from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useMemo, useState } from "react";

import { FlowDiagram } from "@/components/flow/flow-diagram";
import { DetailsCard, NowPanel } from "@/components/flow/panels";
import { ReportView } from "@/components/flow/report-view";
import { buildStages, duration } from "@/lib/flow";
import { buildLayers, NODE_IDS, type NodeId } from "@/lib/layers";
import { SPEEDS, useFlowRun, type Depth } from "@/lib/use-flow-run";

const REPO_URL = "https://github.com/SahanaGaneshvel/research-agent";

const FEATURES = [
  { icon: Link2, title: "Cites by ID only", text: "The model writes [S3]. Code owns every URL and removes any ID that does not exist." },
  { icon: ShieldCheck, title: "Verified benchmarks", text: "A score is kept only if that number and benchmark name appear in the source it cites." },
  { icon: Calculator, title: "Code does exact work", text: "Licences, parameter counts and memory estimates come from APIs and arithmetic, not the model." },
  { icon: CircleAlert, title: "Fails honestly", text: "No sources means no claims. Every fallback and removed sentence is labelled in the report." },
];

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs font-semibold uppercase tracking-[0.14em] text-primary ${className}`}>{children}</p>;
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, children, ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={`group inline-flex items-center justify-center gap-2 rounded-xs bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

function OutlineButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, children, ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xs border border-line bg-card px-6 py-3 text-base font-semibold text-ink transition hover:border-primary/40 hover:bg-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export default function Page() {
  const run = useFlowRun();
  const [edited, setEdited] = useState<string | null>(null);
  const [depth, setDepth] = useState<Depth>("basic");
  const [picked, setSelected] = useState<NodeId | null | undefined>(undefined); // undefined = not touched yet
  const selected = picked === undefined ? (NODE_IDS.includes(run.openOnLoad as NodeId) ? (run.openOnLoad as NodeId) : null) : picked;
  const topic = edited ?? run.recorded?.topic ?? ""; // defaults to the recorded run's question

  const started = run.mode !== "idle";
  const liveRunning = run.mode === "live" && !run.finished;
  const model = run.mode === "live" ? run.health?.model ?? "local model" : run.recorded?.model_name ?? "qwen3.5";
  const stages = useMemo(() => buildStages(run.events), [run.events]);
  const layers = useMemo(
    () => buildLayers(stages, {
      started,
      finished: run.finished,
      failed: run.error,
      totalSeconds: run.result?.timings?.total ?? run.now,
    }),
    [stages, started, run.finished, run.error, run.result, run.now],
  );
  const result = run.mode === "live" ? run.result : run.recorded;
  const recordedOn = run.recorded?.recorded_at
    ? new Date(run.recorded.recorded_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* ------------------------------------------------------------ navbar */}
      <header className="sticky top-0 z-30 border-b border-line bg-card/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Image src="/brand/genai-protos-logo.png" alt="GenAI Protos" width={1280} height={232} loading="eager" className="h-6 w-auto sm:h-7 lg:h-8" />
            <span className="hidden h-6 w-px bg-line sm:block" />
            <span className="hidden truncate text-sm font-semibold text-ink sm:block">Research Agents</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-2 rounded-full border border-border-blue bg-field px-3 py-1 text-muted md:inline-flex">
              <span className={`h-2 w-2 rounded-full ${run.liveAvailable ? "bg-primary" : "bg-slate-400"}`} />
              {run.mode === "live" ? `Live · ${model}` : run.liveAvailable ? `${run.health?.model} ready` : "Recorded run"}
            </span>
            <a href={REPO_URL} target="_blank" rel="noreferrer"
              className="rounded-xs border border-line px-3 py-1.5 font-semibold text-ink transition hover:border-primary/40 hover:bg-soft">
              Source code
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ------------------------------------------------------------ hero + question */}
        <section className="hero-backdrop">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-16 lg:pb-20">
            <div className="max-w-xl">
              <Eyebrow>GenAI Protos · Proof of concept</Eyebrow>
              <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-ink lg:text-5xl">
                Multi-Agent AI Research Assistant
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-muted">
                Four AI agents research a technical question and write a cited report. Every model call runs on a
                small local model, and plain code checks every fact before it reaches the report.
              </p>
              <dl className="mt-8 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-6">
                {[["4", "agents"], ["0", "paid APIs"], ["139", "tests passing"]].map(([n, label]) => (
                  <div key={label}>
                    <dt className="sr-only">{label}</dt>
                    <dd className="text-3xl font-bold text-ink">{n}</dd>
                    <dd className="mt-1 text-sm text-muted">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="self-start rounded-xs border border-line bg-card p-6 sm:p-8">
              <label htmlFor="q" className="text-sm font-semibold text-ink">Research question</label>
              <textarea
                id="q"
                rows={5}
                value={topic}
                readOnly={!run.liveAvailable}
                onChange={(e) => setEdited(e.target.value)}
                className="mt-2 w-full resize-none rounded-xs border border-line bg-field px-4 py-3 text-base leading-relaxed text-ink outline-none transition focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 read-only:text-muted"
              />

              {run.liveAvailable ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div role="radiogroup" aria-label="Research depth" className="inline-flex rounded-xs border border-line bg-field p-1 text-sm">
                    {(["basic", "detailed"] as Depth[]).map((d) => (
                      <button key={d} type="button" role="radio" aria-checked={depth === d} onClick={() => setDepth(d)}
                        className={`rounded-xs px-3 py-1.5 font-semibold capitalize transition ${depth === d ? "bg-card text-primary shadow-sm" : "text-muted hover:text-ink"}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-muted">{depth === "basic" ? "~2 sources per tool, faster" : "~4 sources per tool, slower"}</span>
                </div>
              ) : (
                <p className="mt-3 flex gap-2 text-sm leading-relaxed text-muted">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
                  <span>
                    New research runs on a local machine with Ollama. Here you can watch a real run
                    {recordedOn ? ` from ${recordedOn}` : ""}, answered by a small model on a laptop, played back faster.
                  </span>
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                {run.liveAvailable && (
                  <PrimaryButton onClick={() => { setSelected(null); run.runLive(topic, depth); }}
                    disabled={topic.trim().length < 10 || liveRunning}>
                    {liveRunning ? "Researching…" : "Start research"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                  </PrimaryButton>
                )}
                {run.liveAvailable ? (
                  <OutlineButton onClick={() => { setSelected(null); run.replay(); }} disabled={!run.recorded}>
                    <Play className="h-4 w-4" strokeWidth={2} /> Watch the recorded run
                  </OutlineButton>
                ) : (
                  <PrimaryButton onClick={() => { setSelected(null); run.replay(); }} disabled={!run.recorded}>
                    <Play className="h-4 w-4" strokeWidth={2} /> {run.mode === "replay" ? "Watch again" : "Watch the recorded run"}
                  </PrimaryButton>
                )}
              </div>
              {run.error && run.mode === "live" && (
                <p role="alert" className="mt-4 rounded-xs border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{run.error}</p>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ replay controls */}
        {run.mode === "replay" && (
          <div className="sticky top-[49px] z-20 border-y border-line bg-card/95 backdrop-blur sm:top-[53px] lg:top-[57px]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm sm:px-8">
              <button type="button" onClick={run.finished ? run.replay : run.togglePlay}
                aria-label={run.finished ? "Play again" : run.playing ? "Pause" : "Play"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xs bg-primary text-white transition hover:bg-primary/90">
                {run.finished ? <RotateCcw className="h-4 w-4" /> : run.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <span className="tabular-nums font-medium text-ink">
                {duration(run.now)} <span className="font-normal text-muted">of {duration(run.end)}</span>
              </span>
              <span className="inline-flex rounded-xs border border-line bg-field p-0.5">
                {SPEEDS.map((s) => (
                  <button key={s} type="button" onClick={() => run.setSpeed(s)} aria-label={`Play at ${s} times speed`}
                    className={`rounded-xs px-2.5 py-1 font-semibold ${run.speed === s ? "bg-card text-primary shadow-sm" : "text-muted hover:text-ink"}`}>
                    {s}×
                  </button>
                ))}
              </span>
              <span className="hidden text-muted md:inline">Replaying a real run, sped up</span>
              {!run.finished && (
                <button type="button" onClick={run.skipToEnd} className="ml-auto inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
                  Skip to the end <SkipForward className="h-4 w-4" />
                </button>
              )}
              <span className="h-1 w-full bg-line-soft">
                <span className="block h-1 bg-primary transition-[width] duration-200" style={{ width: `${run.end ? (run.now / run.end) * 100 : 0}%` }} />
              </span>
            </motion.div>
          </div>
        )}

        {/* ------------------------------------------------------------ the flow */}
        <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Behind the scenes</Eyebrow>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink lg:text-4xl">How the run flows</h2>
            </div>
            <p className="max-w-md text-base text-muted">Click any step to see what it does and what it found.</p>
          </div>
          <div className={`mt-6 rounded-xs border border-line bg-card p-4 transition-opacity duration-500 sm:p-6 ${started ? "" : "opacity-80"}`}>
            <FlowDiagram layers={layers} selected={selected} onSelect={(id) => setSelected(selected === id ? null : id)} />
          </div>

          <div className="mt-6 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <NowPanel layers={layers} />
            {selected ? (
              <DetailsCard key={selected} id={selected} layers={layers} result={result} model={model} onClose={() => setSelected(null)} />
            ) : (
              <div className="fade-in flex items-center rounded-xs border border-dashed border-border-blue bg-card/60 p-6 text-base text-muted">
                Select a step in the diagram to see what it does and what it produced.
              </div>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------------ the result */}
        {run.finished && result?.report && (
          <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-8">
            <ReportView result={result} />
          </section>
        )}

        {/* ------------------------------------------------------------ how it stays honest */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:py-20">
          <Eyebrow>The main idea</Eyebrow>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-ink lg:text-4xl">
            The model reads and writes. Code checks every fact.
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="group rounded-xs border border-line bg-card p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white">
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h3 className="mt-5 text-lg font-bold text-ink transition-colors group-hover:text-primary">{title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="bg-navy text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Image src="/brand/genai-protos-logo-white.png" alt="GenAI Protos" width={1280} height={228} className="h-auto w-36 lg:w-40" />
            <p className="mt-4 text-sm leading-relaxed">Get started with AI. Experiment fast. Invest with clarity.</p>
          </div>
          <div className="grid gap-2 text-sm">
            <p className="font-semibold text-white">Research Agents</p>
            <p className="flex items-center gap-2"><Cpu className="h-4 w-4 text-slate-400" /> Runs on {model} through Ollama, never online</p>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-slate-400 transition hover:text-white">Source code on GitHub</a>
            <a href={`${REPO_URL}/blob/main/multi-agent-research-assistant/outputs/example_report.md`} target="_blank" rel="noreferrer"
              className="text-slate-400 transition hover:text-white">Example report</a>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-slate-400 sm:px-8">
            A GenAI Protos proof of concept. One small local model does the language work; plain code checks it. No paid services.
          </p>
        </div>
      </footer>
    </div>
  );
}
