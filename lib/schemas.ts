import { z } from "zod";

/**
 * These mirror the TypeScript interfaces in lib/types.ts. They exist so
 * model output — which is fundamentally untrusted text that merely looks
 * like JSON — is parsed and checked before anything downstream touches it.
 */

export const SourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  domain: z.string().min(1),
  retrievedAt: z.string(),
  relevance: z.number().min(0).max(1),
  excerpt: z.string().optional(),
});

export const ClaimSchema = z.object({
  text: z.string().min(1),
  sourceIds: z.array(z.number().int().nonnegative()),
  confidence: z.number().min(0).max(1),
});

export const ResearchResultSchema = z.object({
  summary: z.string().min(1),
  keyFacts: z.array(z.string()).min(1),
  claims: z.array(ClaimSchema),
  uncertainties: z.array(z.string()),
});

export const DraftResultSchema = z.object({
  title: z.string().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        content: z.string().min(1),
      })
    )
    .min(1),
  claimsUsed: z.array(z.number().int().nonnegative()),
  sourceReferences: z.array(z.number().int().nonnegative()),
});

export const EditorResultSchema = z.object({
  revisedTitle: z.string().min(1),
  revisedBody: z.string().min(1),
  improvements: z.array(z.string()),
  issuesFound: z.array(z.string()),
});

export const SeoResultSchema = z.object({
  metaTitle: z.string().min(1).max(70),
  metaDescription: z.string().min(1).max(160),
  keywords: z.array(z.string()).min(1).max(10),
  seoIssues: z.array(z.string()),
});

export type ResearchResultParsed = z.infer<typeof ResearchResultSchema>;
export type DraftResultParsed = z.infer<typeof DraftResultSchema>;
export type EditorResultParsed = z.infer<typeof EditorResultSchema>;
export type SeoResultParsed = z.infer<typeof SeoResultSchema>;

/**
 * Parses a model's raw text as JSON and validates it against a schema.
 * Never throws — returns a discriminated result so callers can decide how
 * to react (retry, fail the stage, fall back) instead of catching
 * exceptions from three different failure modes.
 */
export function parseStructured<T>(
  schema: z.ZodType<T>,
  raw: string
): { ok: true; data: T } | { ok: false; error: string } {
  let json: unknown;
  try {
    // Models sometimes wrap JSON in code fences despite instructions not to.
    const cleaned = raw.trim().replace(/^```json\s*|^```\s*|```$/g, "");
    json = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "Model output was not valid JSON." };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, data: result.data };
}
