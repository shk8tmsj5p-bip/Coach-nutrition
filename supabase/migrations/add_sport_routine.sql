-- Routine sport de référence (Tab 2 / coach / Strava)
-- Coller dans : Supabase → SQL Editor → Run

alter table public.profils
  add column if not exists sport_routine jsonb not null default jsonb_build_object(
    'runsPerWeek', 0,
    'ridesPerWeek', 0,
    'strengthDays', 0,
    'targetMinutesPerWeek', 0
  );

update public.profils
set sport_routine = jsonb_build_object(
  'runsPerWeek', 0,
  'ridesPerWeek', 3,
  'strengthDays', 1,
  'targetMinutesPerWeek', 240
)
where id = 'alexis'
  and (sport_routine->>'ridesPerWeek') is not distinct from '0'
  and (sport_routine->>'runsPerWeek') is not distinct from '0';

update public.profils
set sport_routine = jsonb_build_object(
  'runsPerWeek', 3,
  'ridesPerWeek', 0,
  'strengthDays', 1,
  'targetMinutesPerWeek', 150
)
where id = 'elodie'
  and (sport_routine->>'ridesPerWeek') is not distinct from '0'
  and (sport_routine->>'runsPerWeek') is not distinct from '0';
