"use client";

import { ChevronDown, Download, FileCheck2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import type { RunState } from "@/lib/types";
import { Markdown } from "../markdown";

/** The finished report: read inline or download. `compact` drops the heading (used inside a details card). */
export function ReportView({ result, compact = false }: { result: RunState; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const report = result.report;
  if (!report) return null;

  const download = () => {
    const url = URL.createObjectURL(new Blob([report.markdown], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "research-report.md" });
    a.click();
    URL.revokeObjectURL(url);
  };

  const cited = report.citation_check.cited?.length ?? 0;
  const unknown = report.citation_check.unknown?.length ?? 0;
  const summary = report.insufficient_evidence
    ? "No useful sources were found, so the report says so instead of guessing."
    : `Ten sections, ${cited} sources cited, and every link in it was actually opened.`;

  const buttons = (
    <div className={`flex flex-wrap gap-3 ${compact ? "mt-3" : "mt-6"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xs bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 active:translate-y-px">
        {open ? "Hide the report" : "Read the report"}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <button type="button" onClick={download}
        className="inline-flex items-center gap-2 rounded-xs border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-primary/40 hover:bg-soft active:translate-y-px">
        <Download className="h-4 w-4" /> Download (.md)
      </button>
    </div>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={compact ? "" : "rounded-xs border border-line bg-card p-6 sm:p-8"}
    >
      {compact ? (
        <p className="text-[0.92rem] text-muted">{summary}</p>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
              <FileCheck2 className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Result</p>
              <h2 className="mt-1 text-2xl font-bold text-ink">The report is ready</h2>
              <p className="mt-1 max-w-xl text-base text-muted">{summary}</p>
            </div>
          </div>
          {!report.insufficient_evidence && (
            <dl className="grid grid-cols-3 gap-6 text-center">
              {[[String(cited), "sources cited"], [String(unknown), "unknown citations"], [String(report.removed_claims?.length ?? 0), "sentences removed"]].map(([n, l]) => (
                <div key={l}>
                  <dd className="text-2xl font-bold text-ink">{n}</dd>
                  <dt className="mt-0.5 text-xs text-muted">{l}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
      {buttons}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`mt-6 rounded-xs border border-line bg-card ${compact ? "px-4 py-5" : "px-6 py-8 sm:px-10"}`}>
              <Markdown text={report.markdown} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
