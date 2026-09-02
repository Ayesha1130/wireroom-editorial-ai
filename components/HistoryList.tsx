"use client";

export type HistoryItem = {
  id: string;
  topic: string;
  status: string;
  created_at: string;
};

export default function HistoryList({
  items,
  activeId,
  configured,
}: {
  items: HistoryItem[];
  activeId?: string;
  configured: boolean;
}) {
  return (
    <div className="glass rounded-2xl">
      <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-wide text-ink-dim/60">DISPATCH LOG</span>
        {!configured && (
          <span className="font-mono text-[9px] text-ink-dim/40">no db configured</span>
        )}
      </div>
      <div className="max-h-[380px] overflow-y-auto">
        {items.length === 0 && (
          <p className="px-4 py-4 text-xs text-ink-dim/40">
            {configured ? "No published dispatches yet." : "Add Supabase credentials to persist history."}
          </p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className={`block w-full border-b border-edge/60 px-4 py-3 text-left ${
              activeId === item.id ? "bg-white/[0.03]" : ""
            }`}
          >
            <p className="truncate text-sm text-ink">{item.topic}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className={`font-mono text-[10px] ${item.status === "published" ? "text-success" : "text-violet"}`}>
                {item.status}
              </span>
              <span className="font-mono text-[10px] text-ink-dim/40">
                {new Date(item.created_at).toLocaleTimeString([], { hour12: false })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
