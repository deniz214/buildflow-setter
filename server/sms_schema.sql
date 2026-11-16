-- Savant setter desk: SMS outreach desk.
-- Run once in the Supabase SQL editor. Creates NEW tables only.
--
-- sms_accounts holds each GoHighLevel sub-account that sends texts, INCLUDING its
-- API token. It has no public policy on purpose: only the server functions (service
-- key) can read it, so tokens never reach the browser and no Netlify env var is needed
-- per account (the agency-ops site is at its env-var limit).

create extension if not exists pgcrypto;

create table if not exists sms_accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                           -- e.g. "East Coast (704)"
  ghl_location_id text not null unique,
  ghl_token       text,                                    -- private-integration token for that sub-account
  webhook_key     text not null unique default encode(gen_random_bytes(12), 'hex'),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
alter table sms_accounts enable row level security;        -- no policy = service key only

-- What the desk is allowed to see about an account (no token).
create or replace view sms_accounts_public as
  select id, name, ghl_location_id, active, created_at from sms_accounts;
grant select on sms_accounts_public to anon, authenticated;

create table if not exists sms_leads (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references sms_accounts(id),
  ghl_contact_id   text not null,
  business_name    text,
  full_name        text,
  phone            text,
  timezone         text,                                   -- ET / CT / MT / PT
  tags             text[] not null default '{}',
  sentiment        text,                                   -- positive / negative / neutral (first reply)
  no_call          boolean not null default false,         -- a "no": stays in the inbox, kept out of the call pot
  touched          boolean not null default false,         -- a person has called or texted since the reply
  stage            text not null default 'Opt-In',         -- same stage names as b2b_leads ("Opt-In" = replied)
  first_reply_at   timestamptz,
  last_message_at  timestamptz,
  booked_at        timestamptz,
  appt_at          timestamptz,                            -- wall-clock digits in the lead's own time
  stage_changed_at timestamptz not null default now(),
  setter_calls     jsonb not null default '{}'::jsonb,
  bot_state        text,                                   -- needs_you / booked / talking / took_over / silent
  bot_why          text,
  notes            text,
  created_at       timestamptz not null default now(),
  unique (account_id, ghl_contact_id)
);

create table if not exists sms_messages (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references sms_leads(id) on delete cascade,
  dir            text not null check (dir in ('out', 'in', 'note', 'call')),
  body           text not null,
  sent_at        timestamptz not null default now(),
  is_auto        boolean not null default false,           -- part of the outreach blast
  is_bot         boolean not null default false,           -- written by the booking bot
  why            text,                                     -- the bot's reason
  author         text,                                     -- who wrote a note / made a call
  ghl_message_id text unique                               -- stops GHL retries creating duplicates
);
create index if not exists sms_messages_lead on sms_messages (lead_id, sent_at);
create index if not exists sms_leads_stage on sms_leads (stage, last_message_at desc);

alter table sms_leads    enable row level security;
alter table sms_messages enable row level security;
create policy sms_leads_open    on sms_leads    for all using (true) with check (true);
create policy sms_messages_open on sms_messages for all using (true) with check (true);
