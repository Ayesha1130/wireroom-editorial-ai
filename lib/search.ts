import { Source } from "./types";
import { withRetry } from "./retry";

export interface SearchResult {
  sources: Source[];
  mode: "live_search" | "demo_mock";
}

export interface SearchProvider {
  search(query: string): Promise<SearchResult>;
}

/**
 * Real web search via Tavily (https://tavily.com), an API built for feeding
 * LLM agents. Only used when TAVILY_API_KEY is set — otherwise the
 * orchestrator falls back to MockSearchProvider and the UI labels the run
 * as demo mode. No source is ever invented: if the provider returns
 * nothing, `sources` is an empty array, not fabricated data.
 */
export class TavilySearchProvider implements SearchProvider {
  constructor(private apiKey: string) {}

  async search(query: string): Promise<SearchResult> {
    const data = await withRetry(
      async (signal) => {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: this.apiKey,
            query,
            max_results: 5,
            include_answer: false,
          }),
          signal,
        });
        if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
        return res.json();
      },
      { retries: 1, timeoutMs: 10_000 }
    );

    const results = Array.isArray(data?.results) ? data.results : [];
    const sources: Source[] = results.map((r: { title?: string; url: string; score?: number; content?: string }) => ({
      title: r.title || r.url,
      url: r.url,
      domain: safeDomain(r.url),
      retrievedAt: new Date().toISOString(),
      relevance: typeof r.score === "number" ? r.score : 0.5,
      excerpt: typeof r.content === "string" ? r.content.slice(0, 6000) : undefined,
    }));

    return { sources, mode: "live_search" };
  }
}

/**
 * Mock provider used in demo mode. It returns clearly fake, clearly
 * labeled placeholder sources — it never claims to be real data. This is
 * the difference between "faking a feature" (not allowed) and "an honest
 * stand-in with a documented interface" (fine, and expected when no API
 * key is configured).
 */
export class MockSearchProvider implements SearchProvider {
  async search(query: string): Promise<SearchResult> {
    const slug = query.toLowerCase().replace(/\s+/g, "-").slice(0, 40);
    const sources: Source[] = [
      {
        title: `Demo source: overview of "${query}"`,
        url: `https://example.com/demo/${slug}-1`,
        domain: "example.com",
        retrievedAt: new Date().toISOString(),
        relevance: 0.5,
        excerpt: `Illustrative demo evidence: teams that scope ${query} narrowly see results faster than teams that generalize early. This placeholder is intentionally not real-world evidence.`,
      },
      {
        title: `Demo source: practitioner notes on "${query}"`,
        url: `https://example.com/demo/${slug}-2`,
        domain: "example.com",
        retrievedAt: new Date().toISOString(),
        relevance: 0.4,
        excerpt: `Illustrative practitioner notes: automation exposes a messy underlying process rather than fixing it. This placeholder is intentionally not real-world evidence.`,
      },
    ];
    return { sources, mode: "demo_mock" };
  }
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function getSearchProvider(): SearchProvider {
  const key = process.env.TAVILY_API_KEY;
  return key ? new TavilySearchProvider(key) : new MockSearchProvider();
}
