import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient<Database> | null = null;

/** Client foyer : session cookie (RLS authenticated) + anon key. */
export function createBrowserSupabaseClient() {
  const env = getSupabaseBrowserEnv();
  if (!env) return null;
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(env.url, env.anonKey);
  }
  return browserClient;
}
