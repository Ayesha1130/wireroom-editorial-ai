import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(url && serviceKey);

/**
 * Service-role client. This bypasses Row Level Security, which is exactly
 * why it must never be imported into a client component or route that
 * doesn't itself enforce ownership — every query using this client filters
 * by session_id explicitly (see app/api/dispatches/route.ts). RLS is still
 * defined in supabase/schema.sql as defense in depth for any future
 * anon-key access path, but this app doesn't currently use the anon key
 * for dispatch data at all.
 */
export const supabaseAdmin: SupabaseClient | null = supabaseConfigured
  ? createClient(url as string, serviceKey as string, {
      auth: { persistSession: false },
    })
  : null;

export type DispatchRow = {
  id: string;
  session_id: string;
  topic: string;
  status: "waiting_for_approval" | "published" | "failed";
  final_title: string | null;
  final_body: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  sources: unknown;
  created_at: string;
  published_at: string | null;
};
