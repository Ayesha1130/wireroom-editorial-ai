"use client";

import { useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";

let supabaseClient: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  supabaseClient = createClient(url, key);

  return supabaseClient;
}

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = getClient();

    if (!client) return;

    let mounted = true;

    client.auth.getSession().then(({ data }) => {
      if (mounted && data.session) {
        client.auth.signOut();
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const submit = async () => {
    if (busy) return;

    setBusy(true);
    setError(null);

    const client = getClient();

    if (!client) {
      setError(
        "Authentication is not configured. Add the Supabase public environment variables first."
      );
      setBusy(false);
      return;
    }

    try {
      const { data, error: signupError } = await client.auth.signUp({
        email,
        password,
      });

      if (signupError) {
        setError(signupError.message);
        return;
      }

      // If Supabase creates a session immediately,
      // sign out so the user must login manually.
      if (data.session) {
        await client.auth.signOut();
      }

      router.replace("/auth/login");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="absolute inset-0 grid-fade" />

      <div className="orb orb-violet absolute left-[12%] top-[15%]" />
      <div className="orb orb-cyan absolute bottom-[10%] right-[12%]" />

      <div className="relative z-10 w-full max-w-md">
        <Link
          href="/"
          className="mb-8 block text-center font-display text-xl tracking-tight text-ink"
        >
          wireroom<span className="text-cyan">.</span>
        </Link>

        <div className="glass rounded-3xl p-7 shadow-2xl shadow-violet/10 md:p-9">
          <div className="mb-7 text-center">
            <p className="font-mono text-[10px] tracking-[.24em] text-cyan">
              EDITORIAL INTELLIGENCE
            </p>

            <h1 className="mt-3 font-display text-3xl text-ink">
              Create your workspace.
            </h1>

            <p className="mt-2 text-sm text-ink-dim">
              Start building your AI-powered newsroom.
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-full border border-edge p-1">
            <Link
              href="/auth/login"
              className="rounded-full px-4 py-2 text-center text-xs font-medium text-ink-dim transition hover:text-ink"
            >
              Log in
            </Link>

            <div className="rounded-full bg-surface-2 px-4 py-2 text-center text-xs font-medium text-ink">
              Sign up
            </div>
          </div>

          <label htmlFor="email" className="block text-xs text-ink-dim">
            Email
          </label>

          <input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            className="glass mt-2 w-full rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-violet/60"
            placeholder="you@company.com"
          />

          <label
            htmlFor="password"
            className="mt-4 block text-xs text-ink-dim"
          >
            Password
          </label>

          <input
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void submit();
              }
            }}
            type="password"
            autoComplete="new-password"
            className="glass mt-2 w-full rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-violet/60"
            placeholder="At least 6 characters"
          />

          {error && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !email || !password}
            className="glow-violet mt-5 w-full rounded-xl bg-gradient-to-r from-violet to-cyan px-5 py-3 text-sm font-medium text-void transition hover:scale-[1.01] disabled:opacity-40"
          >
            {busy ? "Creating workspace…" : "Create account →"}
          </button>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-dim/60">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-cyan transition hover:text-ink"
            >
              Log in
            </Link>
          </p>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-dim/60">
            Secure authentication for your AI newsroom.
          </p>
        </div>
      </div>
    </main>
  );
}