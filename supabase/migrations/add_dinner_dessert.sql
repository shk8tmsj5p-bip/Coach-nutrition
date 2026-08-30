-- Dessert soir batch (Gem Chef) for the selected week — not a 5th meal slot
alter table public.plans_semaine
  add column if not exists dinner_dessert jsonb;
