import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateSessionId } from "@/lib/session";
import { getUserFromRequest, authConfigured } from "@/lib/auth";

async function owner(request: Request) {
  const user = await getUserFromRequest(request);
  if (authConfigured) return { userId: user?.id ?? null, sessionId: null };
  return { userId: null, sessionId: await getOrCreateSessionId() };
}

export async function GET(req: NextRequest) {
  const { userId, sessionId } = await owner(req);
  if (authConfigured && !userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ configured: false, dispatches: [] });

  let query = supabaseAdmin.from("dispatches").select("id, topic, status, created_at, published_at").order("created_at", { ascending: false }).limit(50);
  query = userId ? query.eq("user_id", userId) : query.eq("session_id", sessionId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ configured: true, dispatches: [], error: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, dispatches: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId, sessionId } = await owner(req);
  if (authConfigured && !userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await req.json(); const dispatchId = body?.dispatchId;
  if (!dispatchId || typeof dispatchId !== "string") return NextResponse.json({ error: "dispatchId is required." }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ persisted: false, mode: "demo" });

  let lookup = supabaseAdmin.from("dispatches").select("id, status").eq("id", dispatchId);
  lookup = userId ? lookup.eq("user_id", userId) : lookup.eq("session_id", sessionId);
  const { data: existing, error: lookupError } = await lookup.maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Dispatch not found for this account." }, { status: 404 });
  if (existing.status === "published") return NextResponse.json({ persisted: true, mode: "live", alreadyPublished: true });
  if (existing.status !== "waiting_for_approval") return NextResponse.json({ error: "Dispatch is not awaiting approval." }, { status: 409 });

  let update = supabaseAdmin.from("dispatches").update({ status: "published", published_at: new Date().toISOString() }).eq("id", dispatchId).eq("status", "waiting_for_approval");
  update = userId ? update.eq("user_id", userId) : update.eq("session_id", sessionId);
  const { error } = await update;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true, mode: "live", alreadyPublished: false });
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
