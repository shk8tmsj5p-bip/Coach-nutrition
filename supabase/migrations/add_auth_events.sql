-- Journal d’accès foyer (alertes mail). Service role only — pas de policy client.
-- Coller dans : Supabase → SQL Editor → Run
-- Sans cette table, les mails partent quand même (Gmail SMTP).

create table if not exists public.auth_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  ip_hash text,
  user_agent text,
  emailed boolean not null default false
);

create index if not exists auth_events_kind_created_idx
  on public.auth_events (kind, created_at desc);

create index if not exists auth_events_ip_created_idx
  on public.auth_events (ip_hash, created_at desc);

alter table public.auth_events enable row level security;
