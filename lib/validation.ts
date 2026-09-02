import { ResearchAgentResult, DraftAgentResult, ValidationResult, QualityReport, EvidenceCheck, SeoAgentResult } from "./types";

/**
 * These are consistency/quality checks, not fact-checking. An LLM saying
 * "this looks well-sourced" does not mean it is true — that distinction
 * matters and is called out explicitly wherever validation results are
 * shown in the UI.
 */

function repetitionRatio(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 20) return 0;
  const unique = new Set(words);
  return 1 - unique.size / words.length;
}

export function validateResearch(result: ResearchAgentResult): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!result.summary || result.summary.trim().length < 20) {
    issues.push("Research summary is missing or too short.");
  }
  if (result.keyFacts.length === 0) {
    issues.push("No key facts were produced.");
  }
  if (result.claims.length === 0) {
    warnings.push("No claims were extracted from research.");
  }
  const unsupportedClaims = result.claims.filter((c) => c.sourceIds.length === 0);
  if (unsupportedClaims.length > 0) {
    warnings.push(`${unsupportedClaims.length} claim(s) have no linked source.`);
  }
  if (result.sources.length === 0) {
    warnings.push("No sources were retrieved — research is running without citations.");
  }
  if (result.mode === "demo_mock") {
    warnings.push("Demo mode: sources are placeholders, not real search results.");
  }
  if (repetitionRatio(result.summary) > 0.5) {
    warnings.push("Summary shows unusually high word repetition.");
  }

  return { passed: issues.length === 0, issues, warnings };
}

export function validateDraft(result: DraftAgentResult, availableClaims: number, availableSources: number): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!result.title || result.title.trim().length < 3) {
    issues.push("Draft is missing a usable title.");
  }
  if (result.sections.length === 0) {
    issues.push("Draft has no sections.");
  }
  const emptySection = result.sections.find((s) => s.content.trim().length < 20);
  if (emptySection) {
    issues.push(`Section "${emptySection.heading}" is too short to be useful.`);
  }
  const invalidClaimRefs = result.claimsUsed.filter((i) => i < 0 || i >= availableClaims);
  if (invalidClaimRefs.length > 0) {
    issues.push("Draft references claims that don't exist in the research output.");
  }
  const invalidSourceRefs = result.sourceReferences.filter((i) => i < 0 || i >= availableSources);
  if (invalidSourceRefs.length > 0) {
    issues.push("Draft references sources that don't exist in the research output.");
  }
  if (result.claimsUsed.length === 0) {
    warnings.push("Draft doesn't cite any research claims — it may be under-grounded.");
  }
  const fullText = result.sections.map((s) => s.content).join(" ");
  if (repetitionRatio(fullText) > 0.55) {
    warnings.push("Draft shows unusually high word repetition.");
  }

  return { passed: issues.length === 0, issues, warnings };
}

export function validateFinal(body: string, metaDescription: string): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (body.trim().length < 100) {
    issues.push("Final article body is too short to publish.");
  }
  if (!metaDescription || metaDescription.trim().length < 10) {
    warnings.push("Meta description is missing or very short.");
  }
  if (repetitionRatio(body) > 0.55) {
    warnings.push("Final body shows unusually high word repetition — possible generation issue.");
  }

  return { passed: issues.length === 0, issues, warnings };
}


function normalizeWords(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
}

/** Evidence coverage is a heuristic consistency check, not a factual truth detector. */
export function verifyEvidence(research: ResearchAgentResult, draft: DraftAgentResult, finalBody: string, seo: SeoAgentResult): QualityReport {
  const checks: EvidenceCheck[] = research.claims.map((claim, claimIndex) => {
    const claimWords = new Set(normalizeWords(claim.text));
    const sourceScores = claim.sourceIds.map((sourceId) => {
      const source = research.sources[sourceId];
      if (!source?.excerpt) return 0;
      const sourceWords = new Set(normalizeWords(source.excerpt));
      let overlap = 0;
      for (const word of claimWords) if (sourceWords.has(word)) overlap++;
      return claimWords.size ? overlap / claimWords.size : 0;
    });
    const score = sourceScores.length ? Math.max(...sourceScores) : 0;
    return { claimIndex, sourceIds: claim.sourceIds, score, verdict: score >= 0.35 ? "supported" : score >= 0.15 ? "weak" : "unsupported" };
  });

  const citedClaims = draft.claimsUsed.length;
  const citationCoverage = research.claims.length ? Math.min(100, (citedClaims / research.claims.length) * 100) : 0;
  const evidenceCoverage = checks.length ? (checks.filter((c) => c.verdict === "supported").length / checks.length) * 100 : 0;
  const headings = (finalBody.match(/^## /gm) ?? []).length;
  const structureScore = Math.min(100, headings >= 3 ? 100 : headings * 33);
  const seoScore = Math.round((
    (seo.metaTitle.length <= 60 ? 100 : 60) +
    (seo.metaDescription.length <= 155 ? 100 : 60) +
    (seo.keywords.length >= 3 && seo.keywords.length <= 6 ? 100 : 70)
  ) / 3);
  const overallScore = Math.round(evidenceCoverage * 0.4 + citationCoverage * 0.2 + structureScore * 0.2 + seoScore * 0.2);
  const warnings: string[] = [];
  const weak = checks.filter((c) => c.verdict !== "supported").length;
  if (weak) warnings.push(`${weak} research claim(s) need stronger source evidence.`);
  if (citationCoverage < 70) warnings.push("Citation coverage is below the 70% review threshold.");
  if (research.mode === "demo_mock") warnings.push("Evidence checks in demo mode use placeholders and are not real fact verification.");

  return { evidenceCoverage: Math.round(evidenceCoverage), citationCoverage: Math.round(citationCoverage), structureScore, seoScore, overallScore, checks, warnings };
}
