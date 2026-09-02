"use client";

type Status = "pending" | "running" | "completed" | "failed";

export default function StageCard({
  n,
  label,
  status,
  output,
  warningCount,
}: {
  n: string;
  label: string;
  status: Status;
  output?: string;
  warningCount?: number;
}) {
  const ring =
    status === "running"
      ? "border-violet/50 glow-violet"
      : status === "completed"
      ? "border-success/40 glow-success"
      : status === "failed"
      ? "border-red-500/50 shadow-[0_0_0_1px_rgba(239,68,68,0.4),0_0_30px_-8px_rgba(239,68,68,0.6)]"
      : "border-edge";

  const dot =
    status === "running"
      ? "bg-violet animate-pulse"
      : status === "completed"
      ? "bg-success"
      : status === "failed"
      ? "bg-red-500"
      : "bg-ink-dim/30";

  return (
    <div className={`glass rounded-2xl border p-4 transition-all duration-300 ${ring}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-ink-dim/50">{n}</span>
        <div className="flex items-center gap-1.5">
          {!!warningCount && status === "completed" && (
            <span className="font-mono text-[10px] text-amber-400">{warningCount} warn</span>
          )}
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        </div>
      </div>
      <h3 className="mt-2 font-display text-lg text-ink">{label}</h3>
      <p className="mt-3 min-h-[3.2rem] text-xs leading-relaxed text-ink-dim">
        {status === "pending" && "Waiting in queue…"}
        {status === "running" && "Working…"}
        {status === "completed" && (output ? truncate(output, 100) : "Done.")}
        {status === "failed" && "Failed — see wire feed for details."}
      </p>
    </div>
  );
}

function truncate(s: string, n: number) {
  const clean = s.replace(/\n+/g, " ").trim();
  return clean.length > n ? clean.slice(0, n) + "…" : clean;
}
