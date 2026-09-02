"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import StageCard from "@/components/StageCard";
import WireFeed from "@/components/WireFeed";
import ArticlePreview from "@/components/ArticlePreview";
import HistoryList, {
  HistoryItem,
} from "@/components/HistoryList";
import { STAGES } from "@/lib/pipeline";
import {
  StageId,
  StageStatus,
  PipelineEvent,
  ResearchAgentResult,
  EditorAgentResult,
  SeoAgentResult,
  ValidationResult,
  TokenUsage,
} from "@/lib/types";

const Pipeline3D = dynamic(
  () => import("@/components/Pipeline3D"),
  { ssr: false }
);

type StageState = Record<
  StageId,
  {
    status: StageStatus;
    output?: string;
    warnings?: number;
  }
>;

const initialStages = (): StageState => ({
  research: { status: "pending" },
  draft: { status: "pending" },
  edit: { status: "pending" },
  verify: { status: "pending" },
  publish: { status: "pending" },
});

function timestamp() {
  return new Date().toLocaleTimeString([], {
    hour12: false,
  });
}

export default function Dashboard() {
  const router = useRouter();

  const authClient = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    return url && key
      ? createClient(url, key)
      : null;
  }, []);

  const [userEmail, setUserEmail] =
    useState<string | null>(null);

  const [topic, setTopic] = useState("");

  const [running, setRunning] = useState(false);

  const [stages, setStages] =
    useState<StageState>(initialStages());

  const [log, setLog] = useState<string[]>([]);

  const [validations, setValidations] =
    useState<
      Partial<
        Record<StageId, ValidationResult | null>
      >
    >({});

  const [usage, setUsage] =
    useState<TokenUsage[]>([]);

  const [approvalData, setApprovalData] =
    useState<{
      research: ResearchAgentResult;
      edited: EditorAgentResult;
      seo: SeoAgentResult;
      quality: import("@/lib/types").QualityReport;
    } | null>(null);

  const [published, setPublished] =
    useState(false);

  const [publishing, setPublishing] =
    useState(false);

  const [pipelineError, setPipelineError] =
    useState<string | null>(null);

  const [history, setHistory] =
    useState<HistoryItem[]>([]);

  const [historyConfigured, setHistoryConfigured] =
    useState(true);

  const [mode, setMode] =
    useState<{
      llm: string;
      search: string;
    } | null>(null);

  const [dispatchId, setDispatchId] =
    useState<string | null>(null);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [
      ...prev,
      `[${timestamp()}] ${line}`,
    ]);
  }, []);

  const authHeaders = useCallback(
    async (): Promise<Record<string, string>> => {
      if (!authClient) {
        return {};
      }

      const { data } =
        await authClient.auth.getSession();

      if (!data.session) {
        return {};
      }

      return {
        Authorization: `Bearer ${data.session.access_token}`,
      };
    },
    [authClient]
  );

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/dispatches", {
        headers: await authHeaders(),
      });

      if (!res.ok) {
        throw new Error("Failed to load history");
      }

      const data = await res.json();

      setHistoryConfigured(
        Boolean(data.configured)
      );

      setHistory(data.dispatches ?? []);
    } catch {
      // History is a nice-to-have; a failed fetch
      // shouldn't disrupt the dashboard.
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!authClient) {
      return;
    }

    let mounted = true;

    const checkSession = async () => {
      const { data } =
        await authClient.auth.getSession();

      if (!mounted) return;

      if (!data.session) {
        router.replace("/auth/login");
        return;
      }

      setUserEmail(
        data.session.user.email ?? null
      );

      await loadHistory();
    };

    void checkSession();

    const {
      data: listener,
    } = authClient.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        setUserEmail(
          session?.user.email ?? null
        );

        if (!session) {
          router.replace("/auth/login");
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [
    authClient,
    loadHistory,
    router,
  ]);

  useEffect(() => {
    let mounted = true;

    fetch("/api/status")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Status request failed");
        }

        return res.json();
      })
      .then((data) => {
        if (!mounted) return;

        setMode({
          llm: data.llm,
          search: data.search,
        });
      })
      .catch(() => {
        if (!mounted) return;
        setMode(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleEvent = useCallback(
    (event: PipelineEvent) => {
      const deskLabel = (stage: StageId) =>
        STAGES.find(
          (s) => s.id === stage
        )?.desk ?? stage;

      switch (event.type) {
        case "stage_update": {
          const desk = deskLabel(event.stage);

          if (event.status === "running") {
            pushLog(
              `${desk} picked up the dispatch…`
            );
          }

          if (event.status === "completed") {
            pushLog(
              `${desk} filed its output.`
            );
          }

          if (event.status === "failed") {
            pushLog(`${desk} failed.`);
          }

          setStages((prev) => ({
            ...prev,
            [event.stage]: {
              status: event.status,
              output:
                typeof event.data === "object" &&
                event.data &&
                "summary" in
                  (event.data as object)
                  ? (
                      event.data as ResearchAgentResult
                    ).summary
                  : prev[event.stage].output,
            },
          }));

          break;
        }

        case "validation": {
          setValidations((prev) => ({
            ...prev,
            [event.stage]: event.data,
          }));

          if (event.data.warnings.length > 0) {
            setStages((prev) => ({
              ...prev,
              [event.stage]: {
                ...prev[event.stage],
                warnings:
                  event.data.warnings.length,
              },
            }));
          }

          if (!event.data.passed) {
            pushLog(
              `Validation failed at ${event.stage}: ${event.data.issues.join(
                "; "
              )}`
            );
          }

          break;
        }

        case "usage": {
          setUsage((prev) => [
            ...prev,
            event.data,
          ]);

          break;
        }

        case "waiting_for_approval": {
          setApprovalData({
            research: event.data.research,
            edited: event.data.edited,
            seo: event.data.seo,
            quality: event.data.quality,
          });

          pushLog(
            `Story ready for review: "${event.data.edited.revisedTitle}"`
          );

          break;
        }

        case "pipeline_failed": {
          setPipelineError(
            event.data.error
          );

          pushLog(
            `Pipeline failed${
              event.data.stage
                ? ` at ${event.data.stage}`
                : ""
            }: ${event.data.error}`
          );

          break;
        }

        default:
          break;
      }
    },
    [pushLog]
  );

  const runDispatch = async () => {
    const clean = topic.trim();

    if (!clean || running) {
      return;
    }

    setRunning(true);
    setStages(initialStages());
    setLog([]);
    setValidations({});
    setUsage([]);
    setApprovalData(null);
    setPublished(false);
    setPipelineError(null);
    setDispatchId(null);

    pushLog(
      `Dispatch opened for "${clean}"`
    );

    try {
      const res = await fetch(
        "/api/pipeline",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            topic: clean,
          }),
        }
      );

      if (!res.ok) {
        let message =
          "Pipeline request failed.";

        try {
          const data = await res.json();

          if (
            typeof data?.error === "string"
          ) {
            message = data.error;
          }
        } catch {
          // Ignore JSON parsing errors.
        }

        throw new Error(message);
      }

      const headerDispatchId =
        res.headers.get("X-Dispatch-Id");

      if (headerDispatchId) {
        setDispatchId(
          headerDispatchId
        );
      }

      const reader =
        res.body?.getReader();

      if (!reader) {
        throw new Error(
          "Stream unavailable."
        );
      }

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(
          value,
          { stream: true }
        );

        const parts =
          buffer.split("\n\n");

        buffer =
          parts.pop() || "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) {
            continue;
          }

          try {
            const event =
              JSON.parse(
                part.slice(6)
              ) as PipelineEvent;

            handleEvent(event);
          } catch {
            pushLog(
              "Received an invalid pipeline event."
            );
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Connection lost before the pipeline finished.";

      pushLog(
        "Connection to the desk dropped. Try again."
      );

      setPipelineError(message);
    } finally {
      setRunning(false);
    }
  };

  const handlePublish = async () => {
    if (!approvalData || !dispatchId) {
      return;
    }

    setPublishing(true);

    pushLog(
      "Approved. Pushing to the wire…"
    );

    try {
      const res = await fetch(
        "/api/dispatches",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            dispatchId,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          "Publish request failed."
        );
      }

      const data = await res.json();

      if (data.mode === "demo") {
        pushLog(
          "Demo mode: publish acknowledged, nothing persisted."
        );
      } else if (data.alreadyPublished) {
        pushLog(
          "Already published (idempotent no-op)."
        );
      } else {
        pushLog("Live.");
      }

      setPublished(true);

      await loadHistory();
    } catch {
      pushLog(
        "Publish request failed. Nothing was marked live."
      );
    } finally {
      setPublishing(false);
    }
  };

  const statuses = STAGES.map(
    (stage) =>
      stages[stage.id].status
  );

  const labels = STAGES.map(
    (stage) => stage.label
  );

  const totalTokens = usage.reduce(
    (sum, item) =>
      sum + item.totalTokens,
    0
  );

  const totalCost = usage.reduce(
    (sum, item) =>
      item.estimatedCostUsd != null
        ? sum + item.estimatedCostUsd
        : sum,
    0
  );

  const hasCost = usage.some(
    (item) =>
      item.estimatedCostUsd != null
  );

  return (
    <div className="flex-1">
      <header className="flex items-center justify-between border-b border-edge px-6 py-4 md:px-10">
        <Link
          href="/"
          className="font-display text-lg tracking-tight text-ink"
        >
          wireroom
        </Link>

        <div className="flex items-center gap-3">
          {mode && (
            <span
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] ${
                mode.llm === "live"
                  ? "border-success/40 text-success"
                  : "border-amber-500/40 text-amber-400"
              }`}
            >
              {mode.llm === "live"
                ? "LIVE AI MODE"
                : "DEMO MODE"}
            </span>
          )}

          <span className="font-mono text-[10px] text-ink-dim/50">
            {historyConfigured
              ? "SUPABASE CONNECTED"
              : "IN-MEMORY ONLY"}
          </span>

          {userEmail && (
            <>
              <span className="hidden max-w-[180px] truncate text-xs text-ink-dim sm:block">
                {userEmail}
              </span>

              <button
                type="button"
                onClick={() => {
                  void authClient?.auth.signOut();
                }}
                className="rounded-full border border-edge px-3 py-1.5 text-[10px] text-ink-dim hover:border-edge-bright hover:text-ink"
              >
                Log out
              </button>
            </>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={topic}
            onChange={(e) =>
              setTopic(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void runDispatch();
              }
            }}
            placeholder="Give the desk a topic — e.g. “switching from freelance to a remote job”"
            className="glass flex-1 rounded-full px-5 py-3 text-sm text-ink placeholder:text-ink-dim/40 focus:border-violet/60 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => {
              void runDispatch();
            }}
            disabled={
              running || !topic.trim()
            }
            className="glow-violet rounded-full bg-gradient-to-r from-violet to-cyan px-6 py-3 text-sm font-medium text-void transition-transform hover:scale-[1.03] disabled:opacity-40 disabled:hover:scale-100"
          >
            {running
              ? "Running…"
              : "Run dispatch"}
          </button>
        </div>

        {pipelineError && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            Pipeline failed:{" "}
            {pipelineError}
          </div>
        )}

        <div className="glass mt-6 h-[280px] overflow-hidden rounded-2xl md:h-[320px]">
          <Pipeline3D
            statuses={statuses}
            labels={labels}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {STAGES.map((stage, index) => (
            <StageCard
              key={stage.id}
              n={String(index + 1).padStart(
                2,
                "0"
              )}
              label={stage.label}
              status={
                stages[stage.id].status
              }
              output={
                stages[stage.id].output
              }
              warningCount={
                stages[stage.id].warnings
              }
            />
          ))}
        </div>

        {usage.length > 0 && (
          <div className="glass mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl px-4 py-2.5 font-mono text-[11px] text-ink-dim">
            <span>
              tokens:{" "}
              {totalTokens.toLocaleString()}
            </span>

            <span>
              cost:{" "}
              {hasCost
                ? `~$${totalCost.toFixed(
                    4
                  )}`
                : "n/a (demo mode)"}
            </span>

            <span>
              calls: {usage.length}
            </span>
          </div>
        )}

        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            {approvalData ? (
              <ArticlePreview
                research={
                  approvalData.research
                }
                edited={
                  approvalData.edited
                }
                seo={approvalData.seo}
                validations={validations}
                quality={
                  approvalData.quality
                }
                published={published}
                publishing={publishing}
                onPublish={
                  handlePublish
                }
              />
            ) : (
              <div className="glass flex h-64 items-center justify-center rounded-2xl border-dashed text-sm text-ink-dim/40">
                The finished piece will
                show up here once the
                desk files it.
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="h-64">
              <WireFeed
                lines={log}
                live={running}
              />
            </div>

            <HistoryList
              items={history}
              configured={
                historyConfigured
              }
              activeId={
                dispatchId ?? undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}