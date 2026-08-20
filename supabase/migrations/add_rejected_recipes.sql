-- Plats « Plus jamais » (Ban Aujourd’hui / fiche recette → liste Repas)
-- Coller dans : Supabase → SQL Editor → Run

alter table public.parametres
  add column if not exists rejected_recipes jsonb not null default '[]'::jsonb;
