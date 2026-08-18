-- Ajustements coach appliqués (Tab 4 → badges Tab 1, scopés à la semaine)
-- Coller dans : Supabase → SQL Editor → Run

alter table public.profils
  add column if not exists applied_adjustments jsonb;
