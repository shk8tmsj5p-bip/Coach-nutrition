-- Recettes favoris foyer (cœur Aujourd’hui → onglet Repas / Favoris)
-- Coller dans : Supabase → SQL Editor → Run

alter table public.parametres
  add column if not exists favorite_recipes jsonb not null default '[]'::jsonb;
