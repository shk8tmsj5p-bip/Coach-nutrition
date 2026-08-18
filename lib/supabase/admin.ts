import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Service role — webhooks iOS / jobs serveur uniquement. Bypass RLS. */
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
