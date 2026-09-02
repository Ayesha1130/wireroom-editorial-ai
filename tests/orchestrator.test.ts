import { describe, it, expect } from "vitest";
import { runPipeline } from "@/lib/orchestrator";
import { MockLLMClient } from "@/lib/llm";
import { MockSearchProvider } from "@/lib/search";
import { PipelineEvent } from "@/lib/types";
import { LLMClient, LLMResult } from "@/lib/llm";

async function collect(dispatchId: string, topic: string, deps: Parameters<typeof runPipeline>[2]) {
  const events: PipelineEvent[] = [];
  const gen = runPipeline(dispatchId, topic, deps);
  let next = await gen.next();
  while (!next.done) {
    events.push(next.value);
    next = await gen.next();
  }
  return { events, state: next.value };
}

describe("runPipeline (mock deps, deterministic)", () => {
  it("runs all four stages to completion and reaches waiting_for_approval", async () => {
    const { events, state } = await collect("test-1", "remote work productivity", {
      llm: new MockLLMClient(),
      search: new MockSearchProvider(),
    });

    expect(state.status).toBe("waiting_for_approval");
    expect(state.research).not.toBeNull();
    expect(state.draft).not.toBeNull();
    expect(state.edited).not.toBeNull();
    expect(state.seo).not.toBeNull();
    expect(state.quality).not.toBeNull();
    expect(state.quality!.overallScore).toBeGreaterThanOrEqual(60);

    const stageOrder = events
      .filter((e): e is Extract<PipelineEvent, { type: "stage_update" }> => e.type === "stage_update" && e.status === "running")
      .map((e) => e.stage);
    expect(stageOrder).toEqual(["research", "draft", "edit", "verify", "publish"]);

    const approvalEvent = events.find((e) => e.type === "waiting_for_approval");
    expect(approvalEvent).toBeDefined();
  });

  it("produces citations from the search provider — research is grounded, not free-floating text", async () => {
    const { state } = await collect("test-2", "topic with sources", {
      llm: new MockLLMClient(),
      search: new MockSearchProvider(),
    });
    expect(state.research!.sources.length).toBeGreaterThan(0);
    expect(state.research!.mode).toBe("demo_mock");
  });

  it("every timing entry has a duration and a terminal status", async () => {
    const { state } = await collect("test-3", "timing check", {
      llm: new MockLLMClient(),
      search: new MockSearchProvider(),
    });
    for (const timing of state.timings) {
      expect(timing.durationMs).not.toBeNull();
      expect(["completed", "failed"]).toContain(timing.status);
    }
  });
});

/** An LLM client that always fails, to exercise the honest-failure path. */
class AlwaysFailingLLMClient implements LLMClient {
  readonly mode = "live" as const;
  async complete(): Promise<LLMResult> {
    throw new Error("simulated model outage");
  }
}

describe("runPipeline (failure handling)", () => {
  it("fails the pipeline honestly instead of silently falling back to mock content", async () => {
    const { events, state } = await collect("test-fail", "anything", {
      llm: new AlwaysFailingLLMClient(),
      search: new MockSearchProvider(),
    });

    expect(state.status).toBe("failed");
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.errors[0]).toContain("simulated model outage");

    const failedEvent = events.find((e) => e.type === "pipeline_failed");
    expect(failedEvent).toBeDefined();
    if (failedEvent?.type === "pipeline_failed") {
      expect(failedEvent.data.stage).toBe("research");
    }

    // Draft/edit/publish must never have run after research failed.
    expect(state.draft).toBeNull();
    expect(state.edited).toBeNull();
  });

  it("never reaches waiting_for_approval on failure", async () => {
    const { state } = await collect("test-fail-2", "anything", {
      llm: new AlwaysFailingLLMClient(),
      search: new MockSearchProvider(),
    });
    expect(state.status).not.toBe("waiting_for_approval");
  });
});
