import OpenAI from "openai";
import { TokenUsage } from "./types";
import { withRetry } from "./retry";

export interface LLMResult {
  text: string;
  usage: TokenUsage;
}

export interface LLMClient {
  readonly mode: "live" | "demo";
  complete(prompt: string, opts?: { maxTokens?: number }): Promise<LLMResult>;
}

// Pricing per 1M tokens, gpt-4o-mini, as published at the time this was
// written. OpenAI's pricing changes — treat this as an estimate, not a
// billing-accurate figure, and it's labeled as such everywhere it's shown.
const PRICE_PER_M = { input: 0.15, output: 0.6 };

function estimateCost(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1_000_000) * PRICE_PER_M.input + (completionTokens / 1_000_000) * PRICE_PER_M.output;
}

export class OpenAILLMClient implements LLMClient {
  readonly mode = "live" as const;
  private client: OpenAI;
  private model = "gpt-4o-mini";

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async complete(prompt: string, opts: { maxTokens?: number } = {}): Promise<LLMResult> {
    return withRetry(
      async (signal) => {
        const completion = await this.client.chat.completions.create(
          {
            model: this.model,
            max_tokens: opts.maxTokens ?? 800,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }],
          },
          { signal }
        );
        const text = completion.choices[0]?.message?.content ?? "";
        if (!text.trim()) throw new Error("Model returned an empty response.");
        const usage = completion.usage;
        const promptTokens = usage?.prompt_tokens ?? 0;
        const completionTokens = usage?.completion_tokens ?? 0;
        return {
          text,
          usage: {
            model: this.model,
            promptTokens,
            completionTokens,
            totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
            estimatedCostUsd: estimateCost(promptTokens, completionTokens),
          },
        };
      },
      { retries: 2, timeoutMs: 25_000 }
    );
  }
}

/**
 * Deterministic, topic-aware mock used when no OPENAI_API_KEY is
 * configured. It returns *the same JSON shape the real client's prompts
 * ask for*, run through the same schema validation downstream — demo mode
 * and live mode share every line of orchestration code.
 */
export class MockLLMClient implements LLMClient {
  readonly mode = "demo" as const;

  async complete(prompt: string): Promise<LLMResult> {
    const text = mockResponseFor(prompt);
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(text.length / 4);
    return {
      text,
      usage: {
        model: "mock",
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCostUsd: null,
      },
    };
  }
}

function extractTopic(prompt: string): string {
  const match = prompt.match(/topic:\s*"([^"]+)"/i) ?? prompt.match(/about:\s*"([^"]+)"/i);
  return match ? match[1] : "this topic";
}

function extractDraftBody(prompt: string): string {
  const start = prompt.indexOf("Draft:\n") + "Draft:\n".length;
  const end = prompt.indexOf("\n\nReturn ONLY", start);
  if (start < 0 || end < 0) return "";
  return prompt.slice(start, end).trim();
}

/**
 * Stage detection keys off each prompt's opening role line ("You are a
 * research agent.", etc.) rather than JSON field names. Field-name
 * matching is fragile: this mock echoes fragments of upstream prompts
 * back into its own output (e.g. the editor's mock revisedBody), and a
 * later stage's prompt can end up containing an earlier stage's field
 * names as a result. Anchoring on the fixed opening line avoids that
 * entirely.
 */
function mockResponseFor(prompt: string): string {
  const topic = extractTopic(prompt);
  const title = topic.charAt(0).toUpperCase() + topic.slice(1);

  if (prompt.startsWith("You are a research agent")) {
    return JSON.stringify({
      summary: `Coverage of "${topic}" converges on a few practical points rather than one big headline: adoption is real but uneven, and teams that succeed tend to start narrow.`,
      keyFacts: [
        `Interest in "${topic}" has shifted from experimental to budgeted.`,
        "Early wins come from narrow, well-scoped use cases, not broad rollouts.",
        "Teams underestimate the ongoing operational cost of maintaining the system.",
      ],
      claims: [
        { text: `Teams that scope "${topic}" narrowly see results faster than teams that generalize early.`, sourceIds: [0], confidence: 0.6 },
        { text: "Automation exposes a messy underlying process rather than fixing it.", sourceIds: [1], confidence: 0.55 },
      ],
      uncertainties: ["Demo mode: these are illustrative claims, not verified findings."],
    });
  }

  if (prompt.startsWith("You are a writing agent")) {
    return JSON.stringify({
      title,
      sections: [
        { heading: "Why it matters now", content: `Interest in ${topic.toLowerCase()} has moved from "worth watching" to "worth budgeting for." That shift raises the bar for what counts as a working version.` },
        { heading: "What actually works", content: "Teams that get traction start narrow, define what \"done\" looks like in concrete terms, and resist generalizing before the first version has run for a few weeks." },
        { heading: "What to watch for", content: "The main risk isn't the technology. It's treating it as a one-time project instead of an ongoing process that needs monitoring and the occasional correction." },
      ],
      claimsUsed: [0, 1],
      sourceReferences: [0, 1],
    });
  }

  if (prompt.startsWith("You are an editor agent")) {
    const draftBody = extractDraftBody(prompt) || title;
    return JSON.stringify({
      revisedTitle: title,
      revisedBody: draftBody,
      improvements: ["Tightened section transitions.", "Removed a redundant sentence in the intro."],
      issuesFound: [],
    });
  }

  if (prompt.startsWith("You are an SEO agent")) {
    return JSON.stringify({
      metaTitle: title.slice(0, 60),
      metaDescription: `A practical look at ${topic.toLowerCase()}: what's driving interest and where to start.`,
      keywords: topic.toLowerCase().split(" ").filter((w) => w.length > 3).slice(0, 5).concat(["guide"]),
      seoIssues: [],
    });
  }

  return JSON.stringify({});
}

export function getLLMClient(): LLMClient {
  const key = process.env.OPENAI_API_KEY;
  return key ? new OpenAILLMClient(key) : new MockLLMClient();
}
