/**
 * Lightweight evaluation harness.
 *
 * This is RULE-BASED, not LLM-as-a-judge: it runs the real orchestrator
 * against representative topics (using the deterministic mock LLM/search,
 * so results are reproducible without an API key) and checks structural,
 * checkable properties — not "is this article good," which would need a
 * judge model and human spot-checks to trust.
 *
 * Run with: npm run eval
 *
 * To evaluate against the real OpenAI/Tavily backends instead, set
 * OPENAI_API_KEY / TAVILY_API_KEY before running — the same checks apply,
 * but results won't be reproducible run-to-run since the model output
 * varies.
 */
import { runPipeline } from "../lib/orchestrator";
import { getLLMClient } from "../lib/llm";
import { getSearchProvider } from "../lib/search";
import { randomUUID } from "crypto";

const TOPICS = [
  "switching from freelance to a remote job",
  "async rust vs tokio",
  "how to run a blameless postmortem",
  "pricing a SaaS product for the first time",
  "onboarding checklist for remote engineering teams",
];

interface EvalResult {
  topic: string;
  completed: boolean;
  hadCitations: boolean;
  hadValidationIssues: boolean;
  hadValidationWarnings: boolean;
  sectionCount: number;
  totalTokens: number;
  durationMs: number;
  failureReason: string | null;
}

async function evaluateTopic(topic: string): Promise<EvalResult> {
  const start = Date.now();
  const deps = { llm: getLLMClient(), search: getSearchProvider() };
  const dispatchId = randomUUID();

  let hadValidationIssues = false;
  let hadValidationWarnings = false;
  let totalTokens = 0;

  const generator = runPipeline(dispatchId, topic, deps);
  let next = await generator.next();
  while (!next.done) {
    const event = next.value;
    if (event.type === "usage") totalTokens += event.data.totalTokens;
    if (event.type === "validation") {
      if (!event.data.passed) hadValidationIssues = true;
      if (event.data.warnings.length > 0) hadValidationWarnings = true;
    }
    next = await generator.next();
  }

  const finalState = next.value;
  const completed = finalState.status === "waiting_for_approval";

  return {
    topic,
    completed,
    hadCitations: (finalState.research?.sources.length ?? 0) > 0,
    hadValidationIssues,
    hadValidationWarnings,
    sectionCount: finalState.draft?.sections.length ?? 0,
    totalTokens,
    durationMs: Date.now() - start,
    failureReason: finalState.errors[0] ?? null,
  };
}

async function main() {
  console.log(`Running evaluation against ${TOPICS.length} topics (mode: ${getLLMClient().mode})...\n`);

  const results: EvalResult[] = [];
  for (const topic of TOPICS) {
    const result = await evaluateTopic(topic);
    results.push(result);
    const status = result.completed ? "PASS" : "FAIL";
    console.log(`[${status}] "${topic}"`);
    if (!result.completed) console.log(`         reason: ${result.failureReason}`);
    console.log(`         citations: ${result.hadCitations ? "yes" : "no"} · sections: ${result.sectionCount} · tokens: ${result.totalTokens} · ${result.durationMs}ms`);
  }

  const completedCount = results.filter((r) => r.completed).length;
  const citedCount = results.filter((r) => r.hadCitations).length;
  const cleanCount = results.filter((r) => r.completed && !r.hadValidationIssues).length;

  console.log("\n--- Summary ---");
  console.log(`Completion rate:        ${completedCount}/${results.length}`);
  console.log(`Citation presence:      ${citedCount}/${results.length}`);
  console.log(`Clean runs (no issues): ${cleanCount}/${results.length}`);
  console.log(`Total tokens used:      ${results.reduce((s, r) => s + r.totalTokens, 0)}`);

  if (completedCount < results.length) {
    console.log("\nOne or more topics failed to complete. Exiting with non-zero status.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Evaluation script crashed:", err);
  process.exit(1);
});
