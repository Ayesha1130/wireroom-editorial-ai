import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "wireroom_session";

/**
 * Wireroom has no user accounts — it's a portfolio demo. But "no accounts"
 * should not mean "everyone's dispatches are in one public pile." This
 * gives each browser a random, unguessable session id in an httpOnly
 * cookie, and every dispatch is scoped to it server-side. It is NOT
 * authentication — it doesn't survive clearing cookies or prove identity —
 * but it's enough to stop the previous "public read on all dispatches"
 * problem and to demonstrate the ownership pattern you'd extend with real
 * auth (Supabase Auth, Clerk, etc.) in production.
 */
export async function getOrCreateSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return id;
}
