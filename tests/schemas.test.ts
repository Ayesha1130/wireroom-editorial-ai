import { describe, it, expect } from "vitest";
import { parseStructured, ResearchResultSchema, SeoResultSchema } from "@/lib/schemas";

describe("parseStructured", () => {
  it("parses valid JSON matching the schema", () => {
    const raw = JSON.stringify({
      summary: "A summary long enough to pass validation.",
      keyFacts: ["fact one"],
      claims: [{ text: "claim", sourceIds: [0], confidence: 0.5 }],
      uncertainties: [],
    });
    const result = parseStructured(ResearchResultSchema, raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.keyFacts).toEqual(["fact one"]);
  });

  it("strips a markdown code fence before parsing", () => {
    const raw = "```json\n" + JSON.stringify({
      summary: "A summary long enough to pass validation.",
      keyFacts: ["fact"],
      claims: [],
      uncertainties: [],
    }) + "\n```";
    const result = parseStructured(ResearchResultSchema, raw);
    expect(result.ok).toBe(true);
  });

  it("fails cleanly on malformed JSON instead of throwing", () => {
    const result = parseStructured(ResearchResultSchema, "{not valid json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not valid JSON");
  });

  it("fails on valid JSON that doesn't match the schema shape", () => {
    const result = parseStructured(ResearchResultSchema, JSON.stringify({ wrong: "shape" }));
    expect(result.ok).toBe(false);
  });

  it("rejects a meta description over the length limit", () => {
    const raw = JSON.stringify({
      metaTitle: "Title",
      metaDescription: "x".repeat(200),
      keywords: ["a"],
      seoIssues: [],
    });
    const result = parseStructured(SeoResultSchema, raw);
    expect(result.ok).toBe(false);
  });

  it("rejects an empty keywords array", () => {
    const raw = JSON.stringify({
      metaTitle: "Title",
      metaDescription: "A short description.",
      keywords: [],
      seoIssues: [],
    });
    const result = parseStructured(SeoResultSchema, raw);
    expect(result.ok).toBe(false);
  });
});
