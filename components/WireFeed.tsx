"use client";

import { useEffect, useRef } from "react";

export default function WireFeed({ lines, live }: { lines: string[]; live: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  return (
    <div className="glass flex h-full flex-col rounded-2xl">
      <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-wide text-ink-dim/60">WIRE FEED</span>
        <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-cyan animate-pulse" : "bg-ink-dim/30"}`} />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-dim/80">
        {lines.length === 0 && (
          <p className="text-ink-dim/40">Feed is quiet. Run a dispatch to see it tick.</p>
        )}
        {lines.map((line, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {line}
          </p>
        ))}
        <div ref={endRef} className={live ? "caret inline-block" : ""} />
      </div>
    </div>
  );
}
