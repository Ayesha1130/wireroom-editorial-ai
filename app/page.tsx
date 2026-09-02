import Link from "next/link";
import Ticker from "@/components/Ticker";
import Hero3D from "@/components/Hero3DWrapper";

const STAGES = [
  [
    "01",
    "Research",
    "Searches relevant sources and turns them into structured claims and evidence.",
  ],
  [
    "02",
    "Draft",
    "Builds a coherent article from the research instead of starting from a blank prompt.",
  ],
  [
    "03",
    "Edit + SEO",
    "Improves clarity, creates metadata and prepares the piece for discovery.",
  ],
  [
    "04",
    "Verify",
    "Checks evidence and citation coverage before the story reaches review.",
  ],
  [
    "05",
    "Human review",
    "You decide what ships. Edit, regenerate, reject or approve the final package.",
  ],
];

const USE_CASES = [
  [
    "Businesses",
    "SaaS teams, startups, agencies and product companies that need consistent research-backed content.",
  ],
  [
    "Content creators",
    "Bloggers, newsletter writers, technical writers and independent publishers who want a faster editorial workflow.",
  ],
  [
    "Students",
    "Research projects, technical reports and study writing — with source visibility and a reminder to verify work yourself.",
  ],
  [
    "Marketing teams",
    "SEO articles, thought leadership, product education and repeatable content campaigns.",
  ],
  [
    "Editorial teams",
    "A research, writing, editing and evidence layer that can sit alongside human writers and editors.",
  ],
  [
    "AI teams",
    "A practical reference architecture for typed agent orchestration, streaming, validation and human-in-the-loop workflows.",
  ],
];

export default function Home() {
  return (
    <main className="flex-1 overflow-hidden">
      <header className="relative z-20 flex items-center justify-between border-b border-edge/60 px-6 py-5 md:px-10">
        <Link
          href="/"
          className="font-display text-lg tracking-tight text-ink"
        >
          wireroom
          <span className="text-cyan">.</span>
        </Link>

        <nav className="hidden items-center gap-7 text-xs text-ink-dim md:flex">
          <a
            href="#how-it-works"
            className="hover:text-ink"
          >
            How it works
          </a>

          <a
            href="#use-cases"
            className="hover:text-ink"
          >
            Who it&apos;s for
          </a>

          <a
            href="#technology"
            className="hover:text-ink"
          >
            Technology
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="hidden rounded-full px-4 py-2 text-xs text-ink-dim hover:text-ink sm:block"
          >
            Log in
          </Link>

          <Link
            href="/auth/signup"
            className="rounded-full border border-edge-bright bg-surface-2 px-4 py-2 text-xs text-ink hover:border-violet/60"
          >
            Get started →
          </Link>
        </div>
      </header>

      <section className="relative min-h-[720px] overflow-hidden border-b border-edge/60">
        <div className="absolute inset-0 grid-fade" />
        <div className="orb orb-violet absolute -left-24 top-20" />
        <div className="orb orb-cyan absolute -right-24 top-48" />
        <div className="scanline" />

        <Hero3D />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-24 md:pt-32">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] tracking-[.3em] text-cyan">
              AI EDITORIAL INTELLIGENCE / 05 STAGES
            </p>

            <h1 className="mt-6 text-balance font-display text-5xl leading-[.98] text-ink md:text-8xl">
              One idea.
              <br />
              <span className="text-gradient">
                An entire newsroom.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-ink-dim md:text-lg">
              Wireroom takes a topic through research,
              drafting, editing, SEO, evidence
              verification and human review — so AI does
              the heavy lifting without becoming the final
              authority.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/auth/signup"
                className="glow-violet rounded-full bg-gradient-to-r from-violet to-cyan px-6 py-3.5 text-sm font-medium text-void"
              >
                Start creating →
              </Link>

              <a
                href="#how-it-works"
                className="rounded-full border border-edge-bright bg-surface/60 px-6 py-3.5 text-sm text-ink hover:bg-surface-2"
              >
                Explore the system
              </a>
            </div>
          </div>

          <div className="mt-20 grid max-w-3xl grid-cols-3 gap-4 text-xs text-ink-dim">
            <div>
              <strong className="font-display text-2xl text-ink">
                5
              </strong>
              <br />
              specialized stages
            </div>

            <div>
              <strong className="font-display text-2xl text-ink">
                1
              </strong>
              <br />
              human approval gate
            </div>

            <div>
              <strong className="font-display text-2xl text-ink">
                ∞
              </strong>
              <br />
              ideas to explore
            </div>
          </div>
        </div>
      </section>

      <Ticker />

      <section
        id="how-it-works"
        className="px-6 py-24 md:px-10 md:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] tracking-[.25em] text-violet">
              THE WORKFLOW
            </p>

            <h2 className="mt-4 font-display text-4xl leading-tight text-ink md:text-6xl">
              Built like a system,
              <br />
              not a prompt.
            </h2>

            <p className="mt-5 text-sm leading-6 text-ink-dim">
              Each stage has a job, a typed contract and
              validation. Outputs become structured inputs
              for the next stage.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-5">
            {STAGES.map(([number, name, copy]) => (
              <article
                key={number}
                className="glass group rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:border-violet/40"
              >
                <span className="font-mono text-[10px] text-cyan">
                  {number}
                </span>

                <h3 className="mt-10 font-display text-xl text-ink">
                  {name}
                </h3>

                <p className="mt-3 text-sm leading-6 text-ink-dim">
                  {copy}
                </p>

                <div className="mt-8 h-px bg-gradient-to-r from-violet/60 to-transparent opacity-0 transition group-hover:opacity-100" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="use-cases"
        className="border-y border-edge bg-surface/30 px-6 py-24 md:px-10 md:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] tracking-[.25em] text-cyan">
            WHO IT&apos;S FOR
          </p>

          <h2 className="mt-4 max-w-3xl font-display text-4xl text-ink md:text-6xl">
            Useful anywhere ideas need to become
            trustworthy content.
          </h2>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {USE_CASES.map(([title, copy], index) => (
              <article
                key={title}
                className="rounded-2xl border border-edge bg-void/40 p-6 hover:border-edge-bright"
              >
                <div className="font-mono text-[10px] text-ink-dim/50">
                  0{index + 1}
                </div>

                <h3 className="mt-10 font-display text-2xl text-ink">
                  {title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-ink-dim">
                  {copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-2 md:items-center">
          <div>
            <p className="font-mono text-[10px] tracking-[.25em] text-violet">
              THE DIFFERENCE
            </p>

            <h2 className="mt-4 font-display text-4xl text-ink md:text-6xl">
              Don&apos;t just generate.
              <br />
              <span className="text-gradient">
                Verify.
              </span>
            </h2>

            <p className="mt-5 text-sm leading-6 text-ink-dim">
              Every run exposes evidence coverage,
              citation coverage, structure and SEO signals
              before the human review gate.
            </p>

            <Link
              href="/auth/signup"
              className="mt-8 inline-flex rounded-full border border-edge-bright px-5 py-3 text-sm text-ink hover:border-cyan/50"
            >
              See it in action →
            </Link>
          </div>

          <div className="glass rounded-3xl p-6 shadow-2xl shadow-cyan/5">
            <div className="flex items-end justify-between border-b border-edge pb-5">
              <div>
                <p className="font-mono text-[10px] text-ink-dim">
                  ARTICLE QUALITY
                </p>

                <p className="mt-2 font-display text-6xl text-ink">
                  93
                  <span className="text-xl text-ink-dim">
                    /100
                  </span>
                </p>
              </div>

              <span className="rounded-full border border-success/30 px-3 py-1 font-mono text-[10px] text-success">
                READY FOR REVIEW
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {[
                ["Evidence", 95],
                ["Citations", 92],
                ["Structure", 94],
                ["SEO", 91],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-ink-dim">
                      {label}
                    </span>

                    <span className="font-mono text-ink">
                      {value}%
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet to-cyan"
                      style={{
                        width: `${value}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="technology"
        className="border-t border-edge px-6 py-20 md:px-10 md:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-8 md:flex-row">
            <div>
              <p className="font-mono text-[10px] tracking-[.25em] text-cyan">
                UNDER THE HOOD
              </p>

              <h2 className="mt-4 font-display text-3xl text-ink md:text-5xl">
                Production-minded AI engineering.
              </h2>
            </div>

            <div className="max-w-xl text-sm leading-6 text-ink-dim">
              Typed agent contracts, Zod validation,
              retries and timeouts, SSE streaming, evidence
              checks, persistence and a human approval
              boundary. The demo can run without paid API
              credentials.
            </div>
          </div>

          <div className="mt-12 flex flex-wrap gap-2">
            {[
              "Next.js",
              "TypeScript",
              "OpenAI",
              "Tavily",
              "Supabase",
              "Zod",
              "SSE",
              "Three.js",
              "Vitest",
            ].map((technology) => (
              <span
                key={technology}
                className="rounded-full border border-edge bg-surface px-4 py-2 font-mono text-[11px] text-ink-dim"
              >
                {technology}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 pt-8 md:px-10 md:pb-32">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-edge-bright bg-surface p-8 text-center md:p-16">
          <div className="absolute inset-0 grid-fade" />

          <div className="relative">
            <p className="font-mono text-[10px] tracking-[.3em] text-cyan">
              YOUR NEXT IDEA IS ALREADY WAITING
            </p>

            <h2 className="mx-auto mt-5 max-w-3xl font-display text-4xl text-ink md:text-6xl">
              Turn it into something publishable.
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-ink-dim">
              Create an account, send the desk a topic,
              and watch the pipeline work in real time.
            </p>

            <Link
              href="/auth/signup"
              className="glow-violet mt-8 inline-flex rounded-full bg-gradient-to-r from-violet to-cyan px-7 py-3.5 text-sm font-medium text-void"
            >
              Create your workspace →
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-edge px-6 py-8 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 text-xs text-ink-dim/60 md:flex-row">
          <span>
            Wireroom — evidence-aware AI editorial
            infrastructure.
          </span>

          <span className="font-mono">
            Next.js · OpenAI · Supabase · Three.js
          </span>
        </div>
      </footer>
    </main>
  );
}