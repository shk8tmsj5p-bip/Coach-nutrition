-- Objectifs dynamiques par profil (Tab 2 Suivi)
-- Coller dans : Supabase → SQL Editor → Run

alter table public.profils
  add column if not exists primary_goal text not null default 'perte'
    check (primary_goal in ('perte', 'maintien', 'prise'));

alter table public.profils
  add column if not exists weekly_rate_kg numeric(4, 2) not null default -0.50;

update public.profils set primary_goal = 'perte', weekly_rate_kg = -0.50
where id in ('alexis', 'elodie') and primary_goal is null;
