import { describe, it, expect } from "vitest";
import { validateResearch, validateDraft, validateFinal, verifyEvidence } from "@/lib/validation";
import { ResearchAgentResult, DraftAgentResult } from "@/lib/types";

function baseResearch(overrides: Partial<ResearchAgentResult> = {}): ResearchAgentResult {
  return {
    summary: "A reasonably detailed summary of the research findings for this topic.",
    keyFacts: ["fact one", "fact two"],
    claims: [{ text: "a claim", sourceIds: [0], confidence: 0.6 }],
    sources: [{ title: "Source", url: "https://example.com", domain: "example.com", retrievedAt: "now", relevance: 0.5 }],
    uncertainties: [],
    mode: "live_search",
    ...overrides,
  };
}

describe("validateResearch", () => {
  it("passes a well-formed research result with no warnings", () => {
    const result = validateResearch(baseResearch());
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("flags a missing summary as an issue, not just a warning", () => {
    const result = validateResearch(baseResearch({ summary: "" }));
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.toLowerCase().includes("summary"))).toBe(true);
  });

  it("warns (but does not fail) when claims have no linked sources", () => {
    const result = validateResearch(baseResearch({ claims: [{ text: "x", sourceIds: [], confidence: 0.5 }] }));
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.includes("linked source"))).toBe(true);
  });

  it("warns when running in demo mode so the UI can label it honestly", () => {
    const result = validateResearch(baseResearch({ mode: "demo_mock" }));
    expect(result.warnings.some((w) => w.toLowerCase().includes("demo"))).toBe(true);
  });
});

describe("validateDraft", () => {
  const draft: DraftAgentResult = {
    title: "A Real Title",
    sections: [{ heading: "Intro", content: "Enough content to pass the minimum length check here." }],
    body: "# A Real Title\n\n## Intro\n\nEnough content to pass the minimum length check here.",
    claimsUsed: [0],
    sourceReferences: [0],
  };

  it("passes a draft that references claims within range", () => {
    const result = validateDraft(draft, 2, 2);
    expect(result.passed).toBe(true);
  });

  it("fails when the draft references a claim index that doesn't exist", () => {
    const result = validateDraft({ ...draft, claimsUsed: [5] }, 2, 2);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes("claims"))).toBe(true);
  });

  it("fails when a section is too short to be useful", () => {
    const result = validateDraft({ ...draft, sections: [{ heading: "Empty", content: "short" }] }, 2, 2);
    expect(result.passed).toBe(false);
  });

  it("warns (does not fail) when no claims are cited at all", () => {
    const result = validateDraft({ ...draft, claimsUsed: [] }, 2, 2);
    expect(result.passed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("validateFinal", () => {
  it("fails on a body that's too short to publish", () => {
    const result = validateFinal("short", "a description");
    expect(result.passed).toBe(false);
  });

  it("passes a reasonably sized body with a meta description", () => {
    const body = "A".repeat(150);
    const result = validateFinal(body, "A meaningful meta description.");
    expect(result.passed).toBe(true);
  });
});


describe("evidence verification", () => {
  it("scores claim/source overlap without pretending to fact-check the web", () => {
    const research = {
      summary: "A sufficiently long research summary for this test case.",
      keyFacts: ["fact"],
      claims: [{ text: "remote teams use asynchronous workflows", sourceIds: [0], confidence: 0.9 }],
      sources: [{ title: "Remote teams", url: "https://example.com/source", domain: "example.com", retrievedAt: new Date().toISOString(), relevance: 0.9, excerpt: "Remote teams use asynchronous workflows to coordinate across time zones." }],
      uncertainties: [], mode: "live_search" as const,
    };
    const draft = { title: "Remote teams", sections: [{ heading: "One", content: "A useful section with enough words to pass." }], body: "# Remote teams\n\n## One\n\nA useful section with enough words to pass.", claimsUsed: [0], sourceReferences: [0] };
    const seo = { metaTitle: "Remote teams", metaDescription: "A practical guide to remote teams and async work.", keywords: ["remote", "teams", "async"], readabilityScore: 80, seoIssues: [] };
    const report = verifyEvidence(research, draft, draft.body, seo);
    expect(report.evidenceCoverage).toBe(100);
    expect(report.checks[0].verdict).toBe("supported");
  });
});
