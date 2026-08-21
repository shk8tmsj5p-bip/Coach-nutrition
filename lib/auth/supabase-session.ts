import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { householdEmail, householdPassword } from "@/lib/auth/household";

/** Session Supabase foyer (RLS). Silencieux si le compte n’existe pas encore. */
export async function establishHouseholdSupabaseSession() {
  const email = householdEmail();
  const password = householdPassword();
  if (!email || !password) return;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return;

  const first = await supabase.auth.signInWithPassword({ email, password });
  if (!first.error) return;

  const admin = createAdminSupabaseClient();
  if (!admin) return;

  const existing = await admin.auth.admin.listUsers({ perPage: 200 });
  const user = existing.data.users.find((row) => row.email === email);
  if (user) {
    await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  } else {
    await admin.auth.admin.createUser({ email, password, email_confirm: true });
  }
  await supabase.auth.signInWithPassword({ email, password });
}

export async function clearHouseholdSupabaseSession() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}
