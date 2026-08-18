-- IMC Apple Santé (webhook) — 1 colonne sur pesees
-- Coller dans : Supabase → SQL Editor → Run

alter table public.pesees
  add column if not exists bmi numeric(4, 1);
