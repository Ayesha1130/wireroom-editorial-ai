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

export default function LoginPage() {
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
        router.replace("/dashboard");
      }
    });

    return () => {
      mounted = false;
    };
  }, [router]);

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
      const { error: loginError } =
        await client.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      router.replace("/dashboard");
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
              Welcome back.
            </h1>

            <p className="mt-2 text-sm text-ink-dim">
              Sign in to continue to your newsroom.
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-full border border-edge p-1">
            <div className="rounded-full bg-surface-2 px-4 py-2 text-center text-xs font-medium text-ink">
              Log in
            </div>

            <Link
              href="/auth/signup"
              className="rounded-full px-4 py-2 text-center text-xs font-medium text-ink-dim transition hover:text-ink"
            >
              Sign up
            </Link>
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
            autoComplete="current-password"
            className="glass mt-2 w-full rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-violet/60"
            placeholder="Your password"
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
            {busy ? "Opening workspace…" : "Enter dashboard →"}
          </button>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-dim/60">
            Don't have an account?{" "}
            <Link
              href="/auth/signup"
              className="text-cyan transition hover:text-ink"
            >
              Create one
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