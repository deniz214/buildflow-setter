-- Savant setter desk: B2C clients and their leads.
-- Run once in the Supabase SQL editor. Creates two NEW tables; touches nothing existing.
--
-- Access matches the rest of the dashboard today (open to the public key the
-- app ships with). Tighten it together with everything else when the login /
-- lockdown work happens.

create extension if not exists pgcrypto;

create table if not exists desk_clients (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  timezone        text not null default 'ET',            -- ET / CT / MT / PT
  webhook_key     text not null unique default encode(gen_random_bytes(12), 'hex'),
  ghl_location_id text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists desk_leads (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references desk_clients(id),
  ghl_contact_id   text,
  full_name        text,
  phone            text,
  email            text,
  postal_code      text,
  project          text,
  timezone         text,                                  -- ET / CT / MT / PT
  stage            text not null default 'Opt-In',        -- same stage names as b2b_leads
  opt_in_at        timestamptz not null default now(),
  booked_at        timestamptz,
  appt_at          timestamptz,                           -- wall-clock digits in the lead's own time (b2b_leads convention)
  stage_changed_at timestamptz not null default now(),
  setter_calls     jsonb not null default '{}'::jsonb,
  notes            text,
  created_at       timestamptz not null default now()
);

create unique index if not exists desk_leads_client_contact on desk_leads (client_id, ghl_contact_id) where ghl_contact_id is not null;
create index if not exists desk_leads_client_stage on desk_leads (client_id, stage);

alter table desk_clients enable row level security;
alter table desk_leads   enable row level security;
create policy desk_clients_open on desk_clients for all using (true) with check (true);
create policy desk_leads_open   on desk_leads   for all using (true) with check (true);
