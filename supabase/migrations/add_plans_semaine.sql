-- Historique des plans Gem Chef (1 ligne = 1 semaine foyer, week_start = lundi)
create table if not exists public.plans_semaine (
  week_start date primary key,
  theme text,
  meals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.plans_semaine enable row level security;

drop policy if exists "dev_plans_semaine_all" on public.plans_semaine;
create policy "dev_plans_semaine_all"
  on public.plans_semaine for all
  to anon, authenticated
  using (true) with check (true);

drop trigger if exists plans_semaine_set_updated_at on public.plans_semaine;
create trigger plans_semaine_set_updated_at
  before update on public.plans_semaine
  for each row execute function public.set_updated_at();
