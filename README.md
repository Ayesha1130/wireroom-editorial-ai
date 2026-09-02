# Wireroom

An editorial pipeline run by agents. Give it a topic, and five stages —
Research, Draft, Edit + SEO, Verify, Review — take it from idea to a
source-cited, SEO-tagged, evidence-scored article. Nothing is marked live
without a human approval gate.

This is a portfolio project, and this README is deliberately specific
about what's real, what's mocked, and why — see [Known limitations](#known-limitations).

## What this project is

Not "a nice UI over three sequential prompts." The pipeline is a pure,
framework-free orchestrator (`lib/orchestrator.ts`) with:

- typed state passed between stages (no giant strings ferrying meaning)
- Zod-validated structured JSON output per stage, checked at runtime
- a real search-tool abstraction with source/citation tracking
- an explicit validation gate after each stage (schema + heuristic checks)
- bounded retries and timeouts on every external call
- a state machine (`pending → running → waiting_for_approval → completed/failed`)
- token/cost tracking from real API usage
- a demo mode that runs the *exact same orchestration code* as live mode

## Architecture

```
User (topic)
     │
     ▼
Next.js dashboard ──POST──▶ /api/pipeline (SSE)
                                  │
                                  ▼
                         lib/orchestrator.ts
                   (pure, no HTTP/Next.js knowledge)
                                  │
        ┌──────────┬─────────────┼─────────────┬──────────┐
        ▼          ▼             ▼              ▼          ▼
   SearchProvider  Research   Draft agent   Editor +    Verify      Review
   (Tavily/Mock)   agent      (LLM call)    SEO agent   (quality)   (package)
        └────sources──▶│          │             │
                        ▼          ▼             ▼
                  Zod validation at every stage boundary
                        │
                        ▼
              waiting_for_approval (SSE event, human sees full
              draft + sources + validation warnings)
                        │
                 human clicks Approve
                        │
                        ▼
              POST /api/dispatches ──▶ Supabase (service-role,
                                        session-scoped, idempotent)
```

`/api/pipeline` is a thin adapter: it builds real or mock dependencies
based on which env vars are set, calls `runPipeline()`, and streams each
yielded event as SSE. All the actual logic is in `lib/`, importable and
testable without spinning up a server — that's how `scripts/evaluate.ts`
and `tests/orchestrator.test.ts` exercise it directly.

## Why these are agents, not just prompts

Each stage has a defined responsibility, structured input, and structured
output — not a string handed to the next prompt:

| Stage | Input | Output (Zod-validated) |
|---|---|---|
| Research | topic + retrieved sources | `summary`, `keyFacts`, `claims[]` (each with `sourceIds`), `uncertainties` |
| Draft | research claims + facts | `title`, `sections[]`, `claimsUsed[]`, `sourceReferences[]` |
| Edit | draft body | `revisedTitle`, `revisedBody`, `improvements[]`, `issuesFound[]` |
| SEO | edited body | `metaTitle`, `metaDescription`, `keywords[]`, `seoIssues[]` |
| Verify | research + draft + final body + SEO | evidence/citation/structure/SEO quality report |

The draft agent must reference claim/source indices that actually exist in
the research output — validation checks this and fails the stage if not.
This is what "structured state" buys you: a downstream stage can't
silently invent a citation, because citations are indices into a list the
upstream stage actually produced.

## Reliability

- **Retries & timeouts**: `lib/retry.ts` races every external call against
  a timeout and retries up to a bounded count with exponential backoff.
  This has a test (`tests/retry.test.ts`) that specifically checks the
  timeout still fires even when the wrapped function ignores the abort
  signal — an earlier version of this code had exactly that bug.
- **Honest failure**: if a stage's LLM call fails after retries, the
  pipeline stops, marks `status: "failed"`, and emits a `pipeline_failed`
  SSE event with the real error message. It does **not** fall back to mock
  content and pretend the run succeeded — that was a bug in the previous
  version of this project and has been removed.
- **Validation gates**: schema validation (Zod) plus heuristic checks
  (missing fields, unsupported claim references, repetition ratio) run
  between every stage. These are consistency checks, not fact-checking —
  the UI and this README both say so explicitly.
- **SSE robustness**: the route listens for client disconnect
  (`req.signal`), stops enqueueing once the client is gone, and always
  closes the stream in a `finally` block.
- **Idempotency**: publish requests are keyed by `dispatchId` (the
  Postgres primary key). A duplicate publish request — double-click,
  retried fetch — checks for an existing row first and returns a no-op
  success rather than erroring or double-inserting.
- **Isolation**: there is no module-level mutable pipeline state. Every
  request builds its own orchestrator run; concurrent dispatches don't
  share memory.

## Security

The previous version of this project had a `public read on dispatches`
RLS policy and did Supabase writes from the client with the anon key.
Both are gone:

- **No anon-key access to dispatch data at all.** `lib/supabase.ts` is
  marked `"server-only"` (the package throws a build error if it's ever
  imported into client code) and holds the **service-role** key, used
  exclusively inside `/api/dispatches` route handlers.
- **RLS is still enabled** on the `dispatches` table (`supabase/schema.sql`)
  with **zero policies** — meaning even if the anon key were wired up
  somewhere by mistake, it could read or write nothing. The service role
  bypasses RLS, which is exactly why ownership is also checked in
  application code, not left to RLS alone.
- **Session scoping, not real auth.** There are no user accounts. Each
  browser gets a random, httpOnly, unguessable session cookie
  (`lib/session.ts`), and every dispatch row is tagged with it. This is
  *not* authentication — it doesn't survive a cleared cookie jar or prove
  identity — but it stops the "everyone's data in one public pile"
  problem and demonstrates the pattern you'd extend with real auth
  (Supabase Auth, Clerk, etc.) in a production version.
- **Secrets stay server-side.** `OPENAI_API_KEY`, `TAVILY_API_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` are read only in server code (API routes,
  `lib/`) and are never prefixed `NEXT_PUBLIC_`.

## Evaluation

`npm run eval` runs the real orchestrator against five representative
topics and checks completion, citation presence, validation state, section
count, token usage, and the final quality gate. The in-app Verify stage also
computes evidence coverage against retrieved source excerpts. These checks
are intentionally transparent heuristics — they are not a claim of factual
truth or an LLM judge grading its own work.

Sample output (demo mode, no API key needed to run this):

```
Running evaluation against 5 topics (mode: demo)...

[PASS] "switching from freelance to a remote job"
         citations: yes · sections: 3 · tokens: 1575 · 6ms
[PASS] "async rust vs tokio"
         citations: yes · sections: 3 · tokens: 1467 · 0ms
...
--- Summary ---
Completion rate:        5/5
Citation presence:      5/5
Clean runs (no issues): 5/5
```

## Testing

`npm test` runs Vitest: 26 tests across retry/timeout logic, Zod schema
parsing, the heuristic validation layer, and orchestrator integration
tests (both a full happy-path run and a genuine failure-path run using an
LLM client that always throws, asserting the pipeline fails honestly
instead of masking the error).

These aren't `expect(true).toBe(true)` tests — one of them (the timeout
test) caught a real bug during development: the original `withRetry`
signaled `AbortController.abort()` on timeout but never actually forced
the wrapped promise to reject, so a call that ignored the abort signal
would just hang past its supposed deadline. The fix races the operation
against a timeout promise directly.

## Observability

Every stage emits `stage_update`, `validation`, and `usage` SSE events
with `dispatchId`, `stage`, `timestamp`, and payload — the dashboard's
wire feed is a live render of this event stream, and `PipelineState.timings`
accumulates start/end/duration/status per stage for the whole run. There
is currently no persisted log store or structured logging sink beyond the
SSE stream itself — see limitations below.

## Demo mode vs live mode

| | Demo mode | Live mode |
|---|---|---|
| Trigger | no `OPENAI_API_KEY` | `OPENAI_API_KEY` set |
| LLM | `MockLLMClient` — deterministic, topic-aware JSON | `OpenAILLMClient` (`gpt-4o-mini`), real usage/cost |
| Search | `MockSearchProvider` — labeled `example.com` placeholder sources | `TavilySearchProvider` if `TAVILY_API_KEY` set, real URLs |
| Persistence | acknowledged, not written | written to Supabase if configured |
| UI label | "DEMO MODE" badge | "LIVE AI MODE" badge |

Both modes run through the identical `runPipeline()` function — the only
difference is which `LLMClient`/`SearchProvider` implementation gets
injected. That's checked directly in `tests/orchestrator.test.ts`.

## Running locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Zero configuration needed — it runs fully
in demo mode.

```bash
npm test        # Vitest unit + integration tests
npm run eval    # rule-based pipeline evaluation
npm run build   # production build + typecheck
npm run lint    # ESLint
```

### Going live

1. Copy `.env.example` to `.env.local`.
2. Add `OPENAI_API_KEY` for real model calls.
3. Add `TAVILY_API_KEY` for real web search with real citations.
4. Create a Supabase project, run `supabase/schema.sql` in the SQL editor,
   and add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service role, not
   anon — see the security section above).

## Environment variables

All optional; see `.env.example` for the full list with explanations.
`OPENAI_API_KEY`, `TAVILY_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are secrets
and must never be exposed to the client or prefixed `NEXT_PUBLIC_`.

## Technical decisions

- **JSON mode over function-calling schemas**: agent prompts ask for JSON
  and responses are parsed with Zod, rather than using OpenAI's stricter
  `json_schema` structured-output mode. Simpler, broadly compatible across
  model versions, and the Zod layer catches malformed output either way.
- **Session cookies over full auth**: building real multi-user auth for a
  portfolio demo would have added a lot of surface area without changing
  the interesting engineering. The session-scoping pattern is real and
  extends cleanly to real auth later; pretending there's a login system
  when there isn't one would not have been honest.
- **Rule-based eval over LLM-as-judge**: cheaper, deterministic, and
  doesn't create the illusion that a model grading its own sibling's
  output is a strong quality signal.

## Known limitations

Being direct about what's not production-grade:

- **No real auth.** Session cookies scope ownership; they don't
  authenticate anyone. A real deployment needs real auth.
- **No persisted structured logs.** Observability is the SSE event stream
  plus `PipelineState.timings`; there's no log aggregation, no dashboard
  beyond the live wire feed, and nothing survives a server restart mid-run.
- **No distributed/queue infrastructure.** Each dispatch runs in-process
  for the lifetime of one HTTP request. That's fine for a demo; a
  production content pipeline handling many concurrent long-running
  dispatches would want a job queue instead of a single long-lived request.
- **Cost estimates are approximate.** `lib/llm.ts` hardcodes a pricing
  table for `gpt-4o-mini` at the time this was written — OpenAI's pricing
  changes, and this is labeled as an estimate, not a billing figure.
- **The SEO "readability score" is a simple sentence-length heuristic**,
  not a real Flesch-Kincaid implementation.
- **Rejection/recovery flow is minimal.** If validation fails, the
  pipeline fails the run; there's no automatic "send back to draft agent
  and retry with feedback" loop yet, only stage-level retries on
  transient errors.

## Interview explanation

*"Wireroom is a four-stage content pipeline — research, draft, edit,
publish — where each stage is a real agent with typed input/output
validated by Zod at runtime, not just a chained prompt. The research stage
uses a pluggable search-provider abstraction with a real Tavily
integration and citation tracking, so downstream stages reference actual
claim/source indices instead of free-floating text. Every external call
goes through a bounded retry-with-timeout wrapper — I actually caught a
real timeout bug with a test during development, where the abort signal
was being set but nothing was forcing the promise to reject. Failures are
surfaced honestly as a `failed` pipeline state with a real error message
instead of silently falling back to placeholder content. On the security
side, the original version had a public-read Supabase policy and
client-side writes with the anon key; I moved all database access
server-side behind the service-role key, scoped to a per-browser session
cookie, with RLS enabled and zero policies as defense in depth. There's a
rule-based eval script and a Vitest suite covering the retry logic, schema
validation, and both the happy path and a genuine failure path through the
orchestrator."*

## Reliability & evaluation

Wireroom treats model output as untrusted data. Every stage is schema-validated, network calls have bounded retries/timeouts, and the pipeline stops honestly on failure. Before approval, a dedicated **Verify** stage computes an auditable quality report covering: **evidence coverage, citation coverage, structure, and SEO**.

The evidence score is deliberately described as a **heuristic consistency check, not a factual truth detector**. Live search results include source excerpts so claims can be checked against retrieved evidence rather than only against titles and URLs.

The publish endpoint does not trust article content sent by the browser. When Supabase is configured, the server stores the approval package under the current session and the publish action only transitions that server-owned record from `waiting_for_approval` to `published`.

### Production roadmap

- background queue for long-running dispatches
- OpenTelemetry/Langfuse tracing
- prompt/version registry and regression datasets
- stronger semantic citation verification
- real CMS adapter(s) and webhook delivery
- authenticated multi-user tenancy
#   w i r e r o o m - e d i t o r i a l - a i  
 