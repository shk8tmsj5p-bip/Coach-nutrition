-- Verrou foyer depuis l’iPhone / un lien mail (changer le code, éjecter les sessions).
-- Coller dans : Supabase → SQL Editor → Run
-- Nécessite SUPABASE_SERVICE_ROLE_KEY dans Vercel (déjà utile au webhook Santé).

alter table public.parametres
  add column if not exists foyer_lock jsonb not null default '{"epoch":0,"password_hash":null,"urgence_used":null}'::jsonb;
