-- Préférences cuisine foyer (Tab 5) — JSON lu/écrit par lib/kitchen-prefs.ts
-- Coller dans : Supabase → SQL Editor → Run

alter table public.parametres
  add column if not exists kitchen_prefs jsonb not null default '{}'::jsonb;
