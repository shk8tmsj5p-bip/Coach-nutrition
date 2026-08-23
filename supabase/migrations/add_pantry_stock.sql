-- Stock foyer (frigo / placard / restes) pour Gem Chef
-- Coller dans : Supabase → SQL Editor → Run

alter table public.parametres
  add column if not exists pantry_stock jsonb not null default '{"items":[],"useStock":true,"intensity":"use"}'::jsonb;
