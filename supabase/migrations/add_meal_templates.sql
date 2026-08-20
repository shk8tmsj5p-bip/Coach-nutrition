-- Modèles petit-déj / collation par profil (Paramètres → Aujourd’hui)
-- Coller dans : Supabase → SQL Editor → Run

alter table public.profils
  add column if not exists meal_templates jsonb not null default '[]'::jsonb;
