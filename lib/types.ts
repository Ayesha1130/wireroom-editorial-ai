/**
 * Core typed state for a pipeline run. Every agent consumes and produces
 * pieces of this — nothing passes between stages as an unstructured blob
 * except the natural-language body text itself.
 */

export type StageId = "research" | "draft" | "edit" | "verify" | "publish";

export type PipelineStatus =
  | "pending"
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type StageStatus = "pending" | "running" | "completed" | "failed";

export interface Source {
  title: string;
  url: string;
  domain: string;
  retrievedAt: string;
  relevance: number; // 0-1, provider-reported or heuristic
  excerpt?: string; // source text used for evidence verification; never presented as a fact by itself
}

export interface Claim {
  text: string;
  sourceIds: number[]; // indexes into Source[]
  confidence: number; // 0-1
}

export interface ResearchAgentResult {
  summary: string;
  keyFacts: string[];
  claims: Claim[];
  sources: Source[];
  uncertainties: string[];
  mode: "live_search" | "demo_mock" | "llm_only";
}

export interface DraftSection {
  heading: string;
  content: string;
}

export interface DraftAgentResult {
  title: string;
  sections: DraftSection[];
  body: string; // rendered markdown, derived from sections
  claimsUsed: number[]; // indexes into ResearchAgentResult.claims
  sourceReferences: number[]; // indexes into ResearchAgentResult.sources
}

export interface EditorAgentResult {
  revisedTitle: string;
  revisedBody: string;
  improvements: string[];
  issuesFound: string[];
}

export interface EvidenceCheck {
  claimIndex: number;
  sourceIds: number[];
  verdict: "supported" | "weak" | "unsupported";
  score: number;
}

export interface QualityReport {
  evidenceCoverage: number;
  citationCoverage: number;
  structureScore: number;
  seoScore: number;
  overallScore: number;
  checks: EvidenceCheck[];
  warnings: string[];
}

export interface SeoAgentResult {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  readabilityScore: number; // 0-100 heuristic
  seoIssues: string[];
}

export interface ValidationResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
}

export interface TokenUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null; // null when pricing is unknown
}

export interface StageTiming {
  stage: StageId;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  retryCount: number;
  status: StageStatus;
  usage: TokenUsage | null;
}

export interface PipelineState {
  dispatchId: string;
  topic: string;
  status: PipelineStatus;
  currentStage: StageId | null;
  research: ResearchAgentResult | null;
  draft: DraftAgentResult | null;
  edited: EditorAgentResult | null;
  seo: SeoAgentResult | null;
  quality: QualityReport | null;
  validation: Record<StageId, ValidationResult | null>;
  timings: StageTiming[];
  errors: string[];
  mode: "live" | "demo";
}

export function initState(dispatchId: string, topic: string, mode: "live" | "demo"): PipelineState {
  return {
    dispatchId,
    topic,
    status: "pending",
    currentStage: null,
    research: null,
    draft: null,
    edited: null,
    seo: null,
    quality: null,
    validation: { research: null, draft: null, edit: null, verify: null, publish: null },
    timings: [],
    errors: [],
    mode,
  };
}

/**
 * The single event shape sent over SSE. Every event carries the dispatchId
 * so a client (or a reconnecting client) can always tell which run an event
 * belongs to.
 */
export type PipelineEvent =
  | { type: "stage_update"; dispatchId: string; stage: StageId; status: StageStatus; timestamp: string; data?: unknown }
  | { type: "validation"; dispatchId: string; stage: StageId; timestamp: string; data: ValidationResult }
  | { type: "usage"; dispatchId: string; stage: StageId; timestamp: string; data: TokenUsage }
  | { type: "waiting_for_approval"; dispatchId: string; timestamp: string; data: { research: ResearchAgentResult; draft: DraftAgentResult; edited: EditorAgentResult; seo: SeoAgentResult; quality: QualityReport } }
  | { type: "pipeline_complete"; dispatchId: string; timestamp: string; data: { state: PipelineState } }
  | { type: "pipeline_failed"; dispatchId: string; timestamp: string; data: { error: string; stage: StageId | null } }
  | { type: "log"; dispatchId: string; timestamp: string; data: { message: string } };
