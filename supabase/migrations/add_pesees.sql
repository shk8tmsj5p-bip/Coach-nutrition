-- Pesées & composition (Tab 2 Suivi) — 1 ligne = 1 profil × 1 jour
-- Coller dans : Supabase → SQL Editor → Run

create table if not exists public.pesees (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profils (id) on delete cascade,
  date date not null default current_date,
  poids numeric(5, 2),
  masse_grasse numeric(4, 1),
  masse_musculaire numeric(5, 2),
  tour_taille numeric(5, 1),
  bmi numeric(4, 1),
  journal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, date)
);

create index if not exists pesees_profile_date_idx
  on public.pesees (profile_id, date desc);

drop trigger if exists pesees_set_updated_at on public.pesees;
create trigger pesees_set_updated_at
  before update on public.pesees
  for each row execute function public.set_updated_at();

alter table public.pesees enable row level security;

drop policy if exists "dev_pesees_all" on public.pesees;
create policy "dev_pesees_all"
  on public.pesees for all
  to anon, authenticated
  using (true) with check (true);
