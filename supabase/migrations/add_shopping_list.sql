-- Cases cochées + lignes ajoutées à la main : partagées sur tous les iPhone du foyer.
-- Coller dans : Supabase → SQL Editor → Run

alter table public.plans_semaine
  add column if not exists shopping_checked jsonb not null default '[]'::jsonb,
  add column if not exists shopping_custom jsonb not null default '[]'::jsonb;

alter table public.plans_semaine replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.plans_semaine;
exception
  when duplicate_object then null;
end $$;
