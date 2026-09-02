const DISPATCHES = [
  "RESEARCH — signal picked up on 'remote-first hiring in 2026'",
  "DRAFT — 412 words filed, 3 sections",
  "EDIT — meta description cleared, 5 keywords tagged",
  "PUBLISH — story pushed live to blog.example.com",
  "RESEARCH — cross-checking sources on 'cold outreach that works'",
];

export default function Ticker() {
  const line = DISPATCHES.join("      ·      ");
  return (
    <div className="border-y border-edge bg-surface/60 overflow-hidden">
      <div className="flex whitespace-nowrap py-2.5 text-xs font-mono text-ink-dim animate-[scroll_38s_linear_infinite] motion-reduce:animate-none">
        <span className="px-4">{line}</span>
        <span className="px-4" aria-hidden>
          {line}
        </span>
      </div>
      <style>{`
        @keyframes scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
