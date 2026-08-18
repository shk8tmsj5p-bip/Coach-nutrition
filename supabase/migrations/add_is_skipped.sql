-- À coller dans Supabase → SQL Editor → Run
-- Ajoute le saut de repas individuel (remplace le jeûne global)

alter table public.repas
  add column if not exists is_skipped boolean not null default false;
