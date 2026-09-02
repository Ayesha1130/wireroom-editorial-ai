import {
  PipelineState,
  PipelineEvent,
  StageId,
  ResearchAgentResult,
  DraftAgentResult,
  EditorAgentResult,
  SeoAgentResult,
  Claim,
  initState,
} from "./types";
import { LLMClient } from "./llm";
import { SearchProvider } from "./search";
import { parseStructured, ResearchResultSchema, DraftResultSchema, EditorResultSchema, SeoResultSchema } from "./schemas";
import { validateResearch, validateDraft, validateFinal, verifyEvidence } from "./validation";

export interface OrchestratorDeps {
  llm: LLMClient;
  search: SearchProvider;
}

function now() {
  return new Date().toISOString();
}

/**
 * Runs the full pipeline as an async generator: every meaningful state
 * transition is a yielded, typed event. The caller (an SSE route, a test,
 * or the eval script) decides what to do with each event — stream it,
 * assert on it, log it. The orchestrator itself has no knowledge of HTTP,
 * SSE, or Next.js.
 */
export async function* runPipeline(
  dispatchId: string,
  topic: string,
  deps: OrchestratorDeps
): AsyncGenerator<PipelineEvent, PipelineState> {
  const state = initState(dispatchId, topic, deps.llm.mode);
  state.status = "running";

  // ---- Research ---------------------------------------------------------
  const researchStart = now();
  state.currentStage = "research";
  yield { type: "stage_update", dispatchId, stage: "research", status: "running", timestamp: now() };

  let research: ResearchAgentResult;
  try {
    const { sources, mode: searchMode } = await deps.search.search(topic);

    const sourceList = sources.map((s, i) => `[${i}] ${s.title} (${s.url})\nEvidence excerpt: ${s.excerpt ?? "(no excerpt returned)"}`).join("\n\n") || "(no sources retrieved)";
    const prompt = `You are a research agent. Topic: "${topic}"\n\nAvailable sources:\n${sourceList}\n\nReturn ONLY a JSON object with this exact shape:\n{"summary": string, "keyFacts": string[], "claims": [{"text": string, "sourceIds": number[] (indexes into the source list above, empty array if none apply), "confidence": number 0-1}], "uncertainties": string[]}\n\nOnly reference sourceIds that exist in the list above. If you are not confident in a claim, lower its confidence and note it in uncertainties.`;

    const { text, usage } = await deps.llm.complete(prompt, { maxTokens: 500 });
    yield { type: "usage", dispatchId, stage: "research", timestamp: now(), data: usage };

    const parsed = parseStructured(ResearchResultSchema, text);
    if (!parsed.ok) throw new Error(`Research agent returned invalid output: ${parsed.error}`);

    research = { ...parsed.data, sources, mode: searchMode === "live_search" ? "live_search" : "demo_mock" };
    state.research = research;

    const validation = validateResearch(research);
    state.validation.research = validation;
    yield { type: "validation", dispatchId, stage: "research", timestamp: now(), data: validation };
    if (!validation.passed) throw new Error(`Research failed validation: ${validation.issues.join("; ")}`);

    recordTiming(state, "research", researchStart, "completed", 0, usage);
    yield { type: "stage_update", dispatchId, stage: "research", status: "completed", timestamp: now(), data: research };
  } catch (err) {
    const message = markFailed(state, "research", err);
    yield { type: "stage_update", dispatchId, stage: "research", status: "failed", timestamp: now() };
    yield { type: "pipeline_failed", dispatchId, timestamp: now(), data: { error: message, stage: "research" } };
    return state;
  }

  // ---- Draft --------------------------------------------------------------
  const draftStart = now();
  state.currentStage = "draft";
  yield { type: "stage_update", dispatchId, stage: "draft", status: "running", timestamp: now() };

  let draft: DraftAgentResult;
  try {
    const claimList = research.claims.map((c, i) => `[${i}] ${c.text} (sources: ${c.sourceIds.join(",") || "none"})`).join("\n") || "(no claims)";
    const prompt = `You are a writing agent. Topic: "${topic}"\n\nResearch summary: ${research.summary}\nKey facts: ${research.keyFacts.join("; ")}\nClaims available to cite:\n${claimList}\n\nWrite an article using this research. Return ONLY a JSON object with this exact shape:\n{"title": string, "sections": [{"heading": string, "content": string}] (3-4 sections, each 2-4 sentences), "claimsUsed": number[] (indexes of claims above that you actually used), "sourceReferences": number[] (indexes into the original source list, 0-based, matching sources behind the claims you used)}`;

    const { text, usage } = await deps.llm.complete(prompt, { maxTokens: 900 });
    yield { type: "usage", dispatchId, stage: "draft", timestamp: now(), data: usage };

    const parsed = parseStructured(DraftResultSchema, text);
    if (!parsed.ok) throw new Error(`Draft agent returned invalid output: ${parsed.error}`);

    const body = renderBody(parsed.data.title, parsed.data.sections);
    draft = { ...parsed.data, body };
    state.draft = draft;

    const validation = validateDraft(draft, research.claims.length, research.sources.length);
    state.validation.draft = validation;
    yield { type: "validation", dispatchId, stage: "draft", timestamp: now(), data: validation };
    if (!validation.passed) throw new Error(`Draft failed validation: ${validation.issues.join("; ")}`);

    recordTiming(state, "draft", draftStart, "completed", 0, usage);
    yield { type: "stage_update", dispatchId, stage: "draft", status: "completed", timestamp: now(), data: draft };
  } catch (err) {
    const message = markFailed(state, "draft", err);
    yield { type: "stage_update", dispatchId, stage: "draft", status: "failed", timestamp: now() };
    yield { type: "pipeline_failed", dispatchId, timestamp: now(), data: { error: message, stage: "draft" } };
    return state;
  }

  // ---- Edit (editor pass + SEO pass) --------------------------------------
  const editStart = now();
  state.currentStage = "edit";
  yield { type: "stage_update", dispatchId, stage: "edit", status: "running", timestamp: now() };

  let edited: EditorAgentResult;
  let seo: SeoAgentResult;
  try {
    const editorPrompt = `You are an editor agent. Improve this draft for clarity and flow without changing its meaning.\n\nTitle: ${draft.title}\nDraft:\n${draft.body}\n\nReturn ONLY a JSON object: {"revisedTitle": string, "revisedBody": string (markdown, keep section headings as ## lines), "improvements": string[], "issuesFound": string[]}`;
    const editorRes = await deps.llm.complete(editorPrompt, { maxTokens: 900 });
    yield { type: "usage", dispatchId, stage: "edit", timestamp: now(), data: editorRes.usage };

    const editorParsed = parseStructured(EditorResultSchema, editorRes.text);
    if (!editorParsed.ok) throw new Error(`Editor agent returned invalid output: ${editorParsed.error}`);
    edited = editorParsed.data;
    state.edited = edited;

    const seoPrompt = `You are an SEO agent. Given this article, return ONLY a JSON object: {"metaTitle": string (<=60 chars), "metaDescription": string (<=155 chars), "keywords": string[] (3-6 items), "seoIssues": string[]}\n\nArticle:\n${edited.revisedBody}`;
    const seoRes = await deps.llm.complete(seoPrompt, { maxTokens: 300 });
    yield { type: "usage", dispatchId, stage: "edit", timestamp: now(), data: seoRes.usage };

    const seoParsed = parseStructured(SeoResultSchema, seoRes.text);
    if (!seoParsed.ok) throw new Error(`SEO agent returned invalid output: ${seoParsed.error}`);
    seo = { ...seoParsed.data, readabilityScore: estimateReadability(edited.revisedBody) };
    state.seo = seo;

    const validation = validateFinal(edited.revisedBody, seo.metaDescription);
    state.validation.edit = validation;
    yield { type: "validation", dispatchId, stage: "edit", timestamp: now(), data: validation };
    if (!validation.passed) throw new Error(`Final validation failed: ${validation.issues.join("; ")}`);

    const combinedUsage = {
      model: editorRes.usage.model,
      promptTokens: editorRes.usage.promptTokens + seoRes.usage.promptTokens,
      completionTokens: editorRes.usage.completionTokens + seoRes.usage.completionTokens,
      totalTokens: editorRes.usage.totalTokens + seoRes.usage.totalTokens,
      estimatedCostUsd:
        editorRes.usage.estimatedCostUsd != null && seoRes.usage.estimatedCostUsd != null
          ? editorRes.usage.estimatedCostUsd + seoRes.usage.estimatedCostUsd
          : null,
    };
    recordTiming(state, "edit", editStart, "completed", 0, combinedUsage);
    yield { type: "stage_update", dispatchId, stage: "edit", status: "completed", timestamp: now(), data: { edited, seo } };
  } catch (err) {
    const message = markFailed(state, "edit", err);
    yield { type: "stage_update", dispatchId, stage: "edit", status: "failed", timestamp: now() };
    yield { type: "pipeline_failed", dispatchId, timestamp: now(), data: { error: message, stage: "edit" } };
    return state;
  }

  // ---- Verify -----------------------------------------------------------
  const verifyStart = now();
  state.currentStage = "verify";
  yield { type: "stage_update", dispatchId, stage: "verify", status: "running", timestamp: now() };
  try {
    const quality = verifyEvidence(research, draft, edited.revisedBody, seo);
    state.quality = quality;
    const validation = {
      passed: quality.overallScore >= 60 && quality.evidenceCoverage >= 50,
      issues: quality.overallScore < 60 ? ["Quality score is below the publication threshold."] : [],
      warnings: quality.warnings,
    };
    state.validation.verify = validation;
    yield { type: "validation", dispatchId, stage: "verify", timestamp: now(), data: validation };
    if (!validation.passed) throw new Error(`Evidence verification failed: ${validation.issues.join("; ")}`);
    recordTiming(state, "verify", verifyStart, "completed", 0, null);
    yield { type: "stage_update", dispatchId, stage: "verify", status: "completed", timestamp: now(), data: quality };
  } catch (err) {
    const message = markFailed(state, "verify", err);
    yield { type: "stage_update", dispatchId, stage: "verify", status: "failed", timestamp: now() };
    yield { type: "pipeline_failed", dispatchId, timestamp: now(), data: { error: message, stage: "verify" } };
    return state;
  }

  // ---- Publish (package for human review — does not go live on its own) --
  const publishStart = now();
  state.currentStage = "publish";
  yield { type: "stage_update", dispatchId, stage: "publish", status: "running", timestamp: now() };
  recordTiming(state, "publish", publishStart, "completed", 0, null);
  yield { type: "stage_update", dispatchId, stage: "publish", status: "completed", timestamp: now() };

  state.status = "waiting_for_approval";
  state.currentStage = null;
  yield {
    type: "waiting_for_approval",
    dispatchId,
    timestamp: now(),
    data: { research, draft, edited, seo, quality: state.quality! },
  };

  return state;
}

function renderBody(title: string, sections: { heading: string; content: string }[]): string {
  const body = sections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");
  return `# ${title}\n\n${body}`;
}

function estimateReadability(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (words.length === 0 || sentences.length === 0) return 0;
  const avgWordsPerSentence = words.length / sentences.length;
  // Simple heuristic, not a real Flesch score: shorter sentences score higher.
  const score = Math.max(0, Math.min(100, 100 - (avgWordsPerSentence - 12) * 4));
  return Math.round(score);
}

function recordTiming(
  state: PipelineState,
  stage: StageId,
  startedAt: string,
  status: "completed" | "failed",
  retryCount: number,
  usage: PipelineState["timings"][number]["usage"]
) {
  const endedAt = now();
  state.timings.push({
    stage,
    startedAt,
    endedAt,
    durationMs: new Date(endedAt).getTime() - new Date(startedAt).getTime(),
    retryCount,
    status,
    usage,
  });
}

function markFailed(state: PipelineState, stage: StageId, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  state.status = "failed";
  state.currentStage = null;
  state.errors.push(`[${stage}] ${message}`);
  state.timings.push({
    stage,
    startedAt: now(),
    endedAt: now(),
    durationMs: 0,
    retryCount: 0,
    status: "failed",
    usage: null,
  });
  return message;
}

/** Unused claim type import kept for downstream consumers that inspect claims directly. */
export type { Claim };
