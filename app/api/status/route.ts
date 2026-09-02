import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";

export async function GET() {
  return NextResponse.json({
    llm: process.env.OPENAI_API_KEY ? "live" : "demo",
    search: process.env.TAVILY_API_KEY ? "live_search" : "demo_mock",
    persistence: supabaseConfigured,
  });
}
