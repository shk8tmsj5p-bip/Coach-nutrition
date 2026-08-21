-- Accès foyer : plus d’anon. Un compte Auth unique (HOUSEHOLD_EMAIL).
-- Webhook Santé : service_role bypass RLS (inchangé).
-- À lancer dans Supabase → SQL Editor APRÈS un premier « Entrer » réussi
-- (pour créer le user foyer) + clé SERVICE_ROLE dans .env si besoin.

drop policy if exists "dev_profils_all" on public.profils;
drop policy if exists "dev_repas_all" on public.repas;
drop policy if exists "dev_logs_sante_all" on public.logs_sante;
drop policy if exists "dev_parametres_all" on public.parametres;
drop policy if exists "dev_plans_semaine_all" on public.plans_semaine;
drop policy if exists "dev_pesees_all" on public.pesees;

drop policy if exists "auth_profils_all" on public.profils;
drop policy if exists "auth_repas_all" on public.repas;
drop policy if exists "auth_logs_sante_all" on public.logs_sante;
drop policy if exists "auth_parametres_all" on public.parametres;
drop policy if exists "auth_plans_semaine_all" on public.plans_semaine;
drop policy if exists "auth_pesees_all" on public.pesees;

create policy "auth_profils_all"
  on public.profils for all to authenticated
  using (true) with check (true);

create policy "auth_repas_all"
  on public.repas for all to authenticated
  using (true) with check (true);

create policy "auth_logs_sante_all"
  on public.logs_sante for all to authenticated
  using (true) with check (true);

create policy "auth_parametres_all"
  on public.parametres for all to authenticated
  using (true) with check (true);

create policy "auth_plans_semaine_all"
  on public.plans_semaine for all to authenticated
  using (true) with check (true);

create policy "auth_pesees_all"
  on public.pesees for all to authenticated
  using (true) with check (true);
