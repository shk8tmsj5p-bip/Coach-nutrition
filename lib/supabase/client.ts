import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient<Database> | null = null;

/** Client anon, sans cookies ni session persistée. */
export function createBrowserSupabaseClient() {
  const env = getSupabaseBrowserEnv();
  if (!env) return null;
  if (!browserClient) {
    browserClient = createClient<Database>(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return browserClient;
}
