"use client";

import { useState } from "react";
import { ResearchAgentResult, EditorAgentResult, SeoAgentResult, ValidationResult, QualityReport } from "@/lib/types";

export default function ArticlePreview({
  research,
  edited,
  seo,
  validations,
  quality,
  published,
  publishing,
  onPublish,
}: {
  research: ResearchAgentResult;
  edited: EditorAgentResult;
  seo: SeoAgentResult;
  validations: Partial<Record<string, ValidationResult | null>>;
  quality: QualityReport;
  published: boolean;
  publishing: boolean;
  onPublish: () => void;
}) {
  const [justStamped, setJustStamped] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const handlePublish = () => {
    onPublish();
    setJustStamped(true);
  };

  const bodyLines = edited.revisedBody.split("\n").filter((l) => l.trim().length > 0);
  const allWarnings = Object.values(validations).flatMap((v) => v?.warnings ?? []);
  const allIssues = Object.values(validations).flatMap((v) => v?.issues ?? []);

  return (
    <div className="glass relative rounded-2xl">
      {(published || justStamped) && (
        <div
          className={`glow-success pointer-events-none absolute right-6 top-6 rounded-full border border-success/50 bg-success/10 px-3 py-1 font-mono text-xs font-medium tracking-wide text-success ${
            justStamped ? "stamp-in" : ""
          }`}
        >
          ● PUBLISHED
        </div>
      )}

      <div className="max-h-[460px] overflow-y-auto p-6 md:p-8">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-dim/40">
            Ready for review
          </p>
          {research.mode === "demo_mock" && (
            <span className="rounded-full border border-amber-500/40 px-2 py-0.5 font-mono text-[9px] text-amber-400">
              DEMO SOURCES
            </span>
          )}
        </div>

        <div className="mt-3 space-y-3">
          {bodyLines.map((line, i) => {
            if (line.startsWith("## ")) {
              return (
                <h3 key={i} className="pt-2 font-display text-lg text-ink">
                  {line.replace("## ", "")}
                </h3>
              );
            }
            if (line.startsWith("# ")) {
              return (
                <h1 key={i} className="font-display text-2xl text-ink md:text-3xl">
                  {line.replace("# ", "")}
                </h1>
              );
            }
            return (
              <p key={i} className="text-sm leading-relaxed text-ink-dim">
                {line}
              </p>
            );
          })}
        </div>

        {allIssues.length > 0 && (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-red-400">Validation issues</p>
            <ul className="mt-1.5 space-y-1 text-xs text-red-300/90">
              {allIssues.map((issue, i) => (
                <li key={i}>• {issue}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 rounded-xl border border-cyan/20 bg-cyan/5 p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wide text-cyan">Evidence & quality gate</p>
            <span className="font-display text-lg text-ink">{quality.overallScore}/100</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono text-ink-dim md:grid-cols-4">
            <span>evidence {quality.evidenceCoverage}%</span>
            <span>citations {quality.citationCoverage}%</span>
            <span>structure {quality.structureScore}%</span>
            <span>SEO {quality.seoScore}%</span>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-ink-dim/60">Heuristic evidence coverage checks whether cited source excerpts share meaningful vocabulary with extracted claims; it is not a factual truth detector.</p>
        </div>

        {allWarnings.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-amber-400">Warnings</p>
            <ul className="mt-1.5 space-y-1 text-xs text-amber-300/80">
              {allWarnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 border-t border-edge pt-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-dim/40">
            Meta description · readability {seo.readabilityScore}/100
          </p>
          <p className="mt-1 text-xs text-ink-dim/80">{seo.metaDescription}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {seo.keywords.map((k) => (
              <span key={k} className="rounded-full border border-edge px-2.5 py-0.5 font-mono text-[10px] text-ink-dim">
                {k}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-edge pt-4">
          <button
            onClick={() => setShowSources((s) => !s)}
            className="font-mono text-[10px] uppercase tracking-wide text-cyan hover:text-ink"
          >
            {showSources ? "Hide" : "Show"} sources ({research.sources.length})
          </button>
          {showSources && (
            <ul className="mt-2 space-y-1.5">
              {research.sources.length === 0 && (
                <li className="text-xs text-ink-dim/50">No sources were retrieved for this dispatch.</li>
              )}
              {research.sources.map((s, i) => (
                <li key={i} className="text-xs text-ink-dim/70">
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-cyan hover:underline">
                    {s.title}
                  </a>{" "}
                  <span className="text-ink-dim/40">· {s.domain}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-edge px-6 py-3 md:px-8">
        <span className="text-xs text-ink-dim/60">
          {published ? "Live on the wire." : "Approve to push this live."}
        </span>
        <button
          onClick={handlePublish}
          disabled={published || publishing}
          className="glow-violet rounded-full bg-gradient-to-r from-violet to-cyan px-4 py-2 text-xs font-medium text-void transition-transform hover:scale-[1.03] disabled:cursor-default disabled:opacity-60 disabled:hover:scale-100"
        >
          {published ? "Published" : publishing ? "Publishing…" : "Approve & publish"}
        </button>
      </div>
    </div>
  );
}
