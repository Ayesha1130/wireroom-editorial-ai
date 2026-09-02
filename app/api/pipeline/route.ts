import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { runPipeline } from "@/lib/orchestrator";
import { getLLMClient } from "@/lib/llm";
import { getSearchProvider } from "@/lib/search";
import { PipelineEvent } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateSessionId } from "@/lib/session";
import { getUserFromRequest, authConfigured } from "@/lib/auth";

export const runtime = "nodejs";

function sse(event: PipelineEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (authConfigured && !user) return new Response(JSON.stringify({ error: "Authentication required." }), { status: 401 });
  const { topic } = await req.json();

  if (typeof topic !== "string" || topic.trim().length === 0) {
    return new Response(JSON.stringify({ error: "topic is required" }), { status: 400 });
  }

  const dispatchId = randomUUID();
  const llm = getLLMClient();
  const search = getSearchProvider();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const enqueue = (event: PipelineEvent) => {
        if (closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(sse(event)));
        } catch {
          // Client disconnected mid-write; stop trying to enqueue further
          // events instead of throwing from inside the generator loop.
          closed = true;
        }
      };

      // If the client disconnects, stop pulling from the generator. We
      // can't cancel an in-flight LLM call, but we do stop doing wasted
      // work (further stages, further enqueues) as soon as we notice.
      req.signal.addEventListener("abort", () => {
        closed = true;
      });

      try {
        const generator = runPipeline(dispatchId, topic.trim(), { llm, search });
        let approvalPackage: Extract<PipelineEvent, { type: "waiting_for_approval" }> | null = null;
        for await (const event of generator) {
          if (closed) break;
          if (event.type === "waiting_for_approval") approvalPackage = event;
          enqueue(event);
        }
        if (!closed && supabaseAdmin && approvalPackage) {
          const sessionId = await getOrCreateSessionId();
          await supabaseAdmin.from("dispatches").upsert({
            id: dispatchId,
            session_id: sessionId,
            user_id: user?.id ?? null,
            topic: topic.trim(),
            status: "waiting_for_approval",
            final_title: approvalPackage.data.edited.revisedTitle,
            final_body: approvalPackage.data.edited.revisedBody,
            seo_description: approvalPackage.data.seo.metaDescription,
            seo_keywords: approvalPackage.data.seo.keywords,
            sources: approvalPackage.data.research.sources,
          }, { onConflict: "id" });
        }
      } catch (err) {
        // Orchestrator failures are handled internally and surfaced as
        // pipeline_failed events; this catch is only for truly unexpected
        // errors (a bug), which we still report honestly rather than
        // hanging the client.
        const message = err instanceof Error ? err.message : "Unknown server error.";
        enqueue({
          type: "pipeline_failed",
          dispatchId,
          timestamp: new Date().toISOString(),
          data: { error: message, stage: null },
        });
      } finally {
        if (!closed) controller.close();
      }
    },
    cancel() {
      // Client aborted the fetch/reader. Nothing further to clean up here
      // since we don't hold open external resources beyond the fetch
      // calls already in flight inside the orchestrator.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Dispatch-Id": dispatchId,
    },
  });
}
