-- =============================================================================
-- Coach Nutrition — schéma Supabase (Phase 2)
-- Coller tout ce fichier dans : Supabase → SQL Editor → Run
-- =============================================================================
-- Auth : UN seul compte foyer (email/mot de passe). Le sélecteur
-- [Alexis | Élodie | Couple] filtre côté app via profile_id.
-- Les tables ne sont PAS cloisonnées par utilisateur : le compte unique
-- lit/écrit les deux profils.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. PROFILS — Alexis & Élodie (pas des comptes Auth)
-- -----------------------------------------------------------------------------
create table if not exists public.profils (
  id text primary key check (id in ('alexis', 'elodie')),
  display_name text not null,
  height_cm integer not null,
  age integer not null,
  sex text not null check (sex in ('male', 'female')),
  diet text not null check (diet in ('vegan', 'omnivore')),
  aversions text[] not null default '{}',
  preferences text[] not null default '{}',
  start_weight_kg numeric(5, 2) not null,
  current_weight_kg numeric(5, 2) not null,
  target_weight_kg numeric(5, 2) not null,
  primary_goal text not null default 'perte' check (primary_goal in ('perte', 'maintien', 'prise')),
  weekly_rate_kg numeric(4, 2) not null default -0.50,
  sport_routine jsonb not null default '{"runsPerWeek":0,"ridesPerWeek":0,"strengthDays":0,"targetMinutesPerWeek":0}'::jsonb,
  applied_adjustments jsonb,
  target_calories integer not null,
  target_protein_g integer not null,
  target_carbs_g integer not null,
  target_fat_g integer not null,
  bmr integer not null,
  tdee integer not null,
  accent text not null check (accent in ('coral', 'violet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. REPAS — logs du jour + plats planifiés (1 ligne = 1 profil)
--    Double déclinaison : 2 lignes (alexis / elodie) partagent le même group_id
-- -----------------------------------------------------------------------------
create table if not exists public.repas (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profils (id) on delete cascade,
  group_id uuid,
  date date not null default current_date,
  heure time,
  type text not null check (type in ('petit-dejeuner', 'dejeuner', 'diner', 'collation')),
  nom text not null,
  base_partagee text,
  proteine text,
  items jsonb not null default '[]'::jsonb,
  calories integer not null default 0,
  proteines_g numeric(6, 1) not null default 0,
  glucides_g numeric(6, 1) not null default 0,
  lipides_g numeric(6, 1) not null default 0,
  source text not null default 'log'
    check (source in ('plan', 'log', 'photo', 'barcode', 'text')),
  is_planned boolean not null default false,
  is_skipped boolean not null default false,
  low_calorie boolean not null default false,
  appliances text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists repas_profile_date_idx
  on public.repas (profile_id, date desc);

create index if not exists repas_group_idx
  on public.repas (group_id)
  where group_id is not null;

-- -----------------------------------------------------------------------------
-- 3. LOGS_SANTE — poids, composition, check-in, Strava, Renpho OCR, webhook
-- -----------------------------------------------------------------------------
create table if not exists public.logs_sante (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.profils (id) on delete cascade,
  logged_at timestamptz not null default now(),
  date date not null default current_date,
  kind text not null check (kind in ('poids', 'composition', 'checkin', 'activite', 'journal')),
  source text not null default 'manual'
    check (source in ('manual', 'renpho_ocr', 'webhook', 'strava', 'apple_health')),

  weight_kg numeric(5, 2),
  fat_pct numeric(4, 1),
  muscle_kg numeric(5, 2),
  water_pct numeric(4, 1),

  hunger integer check (hunger between 1 and 5),
  energy integer check (energy between 1 and 5),
  fasting boolean,
  notes text,

  activity_name text,
  activity_type text,
  duration_min integer,
  calories_burned integer,
  intensity text check (intensity in ('low', 'moderate', 'high')),
  external_id text,

  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists logs_sante_profile_date_idx
  on public.logs_sante (profile_id, date desc, kind);

create unique index if not exists logs_sante_external_id_uidx
  on public.logs_sante (profile_id, source, external_id)
  where external_id is not null;

-- -----------------------------------------------------------------------------
-- 4. PARAMETRES — 1 seule ligne foyer (pas de clés API ici → .env.local)
-- -----------------------------------------------------------------------------
create table if not exists public.parametres (
  id text primary key default 'foyer' check (id = 'foyer'),
  batch_weekday text not null default 'dimanche',
  batch_time text not null default '16:00',
  dinners_low_calorie boolean not null default true,
  tofu_never_cooked_in_batch boolean not null default true,
  rule_80_20 boolean not null default true,
  snacks_no_cook boolean not null default true,
  weather_note text,
  gemini_model_pro text not null default 'gemini-3.1-pro-preview',
  gemini_model_flash text not null default 'gemini-3.5-flash',
  strava_athlete_id text,
  health_webhook_enabled boolean not null default true,
  kitchen_prefs jsonb not null default '{}'::jsonb,
  favorite_recipes jsonb not null default '[]'::jsonb,
  rejected_recipes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 5. PLANS_SEMAINE — historique Gem Chef (Lun–Dim), 1 ligne par semaine foyer
-- -----------------------------------------------------------------------------
create table if not exists public.plans_semaine (
  week_start date primary key,
  theme text,
  meals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- updated_at auto
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profils_set_updated_at on public.profils;
create trigger profils_set_updated_at
  before update on public.profils
  for each row execute function public.set_updated_at();

drop trigger if exists repas_set_updated_at on public.repas;
create trigger repas_set_updated_at
  before update on public.repas
  for each row execute function public.set_updated_at();

drop trigger if exists parametres_set_updated_at on public.parametres;
create trigger parametres_set_updated_at
  before update on public.parametres
  for each row execute function public.set_updated_at();

drop trigger if exists plans_semaine_set_updated_at on public.plans_semaine;
create trigger plans_semaine_set_updated_at
  before update on public.plans_semaine
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. PESEES — Tab 2 Suivi (1 ligne = 1 profil × 1 jour)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Seed — les deux profils + préférences foyer
-- -----------------------------------------------------------------------------
insert into public.profils (
  id, display_name, height_cm, age, sex, diet, aversions, preferences,
  start_weight_kg, current_weight_kg, target_weight_kg,
  target_calories, target_protein_g, target_carbs_g, target_fat_g,
  bmr, tdee, accent
) values
  (
    'alexis', 'Alexis', 185, 34, 'male', 'vegan',
    array['coriandre', 'chou-fleur', 'piment fort', 'pastèque', 'fenouil', 'seitan', 'tempeh'],
    array['épicé', 'saveurs complexes', 'umami'],
    92.4, 82.1, 78.0, 2300, 160, 240, 70, 1824, 2827, 'coral'
  ),
  (
    'elodie', 'Élodie', 170, 32, 'female', 'omnivore',
    array['beurre de cacahuète', 'chou-fleur', 'piment fort', 'mangue', 'pastèque', 'fenouil'],
    array['frais', 'herbes', 'textures croquantes'],
    74.8, 67.6, 62.0, 1750, 120, 170, 55, 1432, 2219, 'violet'
  )
on conflict (id) do nothing;

update public.profils
set sport_routine = jsonb_build_object(
  'runsPerWeek', 0,
  'ridesPerWeek', 3,
  'strengthDays', 1,
  'targetMinutesPerWeek', 240
)
where id = 'alexis';

update public.profils
set sport_routine = jsonb_build_object(
  'runsPerWeek', 3,
  'ridesPerWeek', 0,
  'strengthDays', 1,
  'targetMinutesPerWeek', 150
)
where id = 'elodie';

insert into public.parametres (id, weather_note)
values ('foyer', 'Canicule → bowls / bo bun / salades')
on conflict (id) do nothing;

-- =============================================================================
-- RLS — MODE DÉVELOPPEMENT (copier tel quel)
-- RLS est ACTIVÉ (Supabase l'exige) mais les policies sont ouvertes :
-- anon + authenticated peuvent tout lire/écrire.
-- Le filtrage Alexis / Élodie / Couple se fait dans l'UI via profile_id,
-- PAS dans Postgres (un seul compte foyer).
-- =============================================================================

alter table public.profils enable row level security;
alter table public.repas enable row level security;
alter table public.logs_sante enable row level security;
alter table public.parametres enable row level security;
alter table public.plans_semaine enable row level security;
alter table public.pesees enable row level security;

drop policy if exists "dev_profils_all" on public.profils;
drop policy if exists "dev_repas_all" on public.repas;
drop policy if exists "dev_logs_sante_all" on public.logs_sante;
drop policy if exists "dev_parametres_all" on public.parametres;
drop policy if exists "dev_plans_semaine_all" on public.plans_semaine;
drop policy if exists "dev_pesees_all" on public.pesees;

create policy "dev_profils_all"
  on public.profils for all
  to anon, authenticated
  using (true) with check (true);

create policy "dev_repas_all"
  on public.repas for all
  to anon, authenticated
  using (true) with check (true);

create policy "dev_logs_sante_all"
  on public.logs_sante for all
  to anon, authenticated
  using (true) with check (true);

create policy "dev_parametres_all"
  on public.parametres for all
  to anon, authenticated
  using (true) with check (true);

create policy "dev_plans_semaine_all"
  on public.plans_semaine for all
  to anon, authenticated
  using (true) with check (true);

create policy "dev_pesees_all"
  on public.pesees for all
  to anon, authenticated
  using (true) with check (true);

-- =============================================================================
-- RLS — MODE PRODUCTION (à coller PLUS TARD, quand le login foyer existe)
-- 1. Exécuter le bloc DROP des policies dev_* ci-dessous
-- 2. Créer les policies auth_* (authenticated uniquement)
-- Le webhook iOS / service_role BYPASSE le RLS : rien à changer pour lui.
-- =============================================================================
--
-- drop policy if exists "dev_profils_all" on public.profils;
-- drop policy if exists "dev_repas_all" on public.repas;
-- drop policy if exists "dev_logs_sante_all" on public.logs_sante;
-- drop policy if exists "dev_parametres_all" on public.parametres;
--
-- create policy "auth_profils_all"
--   on public.profils for all to authenticated
--   using (true) with check (true);
--
-- create policy "auth_repas_all"
--   on public.repas for all to authenticated
--   using (true) with check (true);
--
-- create policy "auth_logs_sante_all"
--   on public.logs_sante for all to authenticated
--   using (true) with check (true);
--
-- create policy "auth_parametres_all"
--   on public.parametres for all to authenticated
--   using (true) with check (true);
-- =============================================================================
