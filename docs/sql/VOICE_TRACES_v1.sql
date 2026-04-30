create table if not exists public.voice_traces (
  id text primary key,
  created_at timestamptz not null default now(),
  route text not null check (route in ('say','speak')),
  preset text null,
  speaker text null,
  tts_ms double precision null,
  dsp_ms double precision null,
  rtf double precision null,
  chunks int null,
  failover_used boolean not null default false,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists voice_traces_created_at_idx
  on public.voice_traces (created_at desc);
