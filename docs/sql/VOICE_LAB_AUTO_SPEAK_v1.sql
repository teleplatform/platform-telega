-- Add auto-speak settings to existing bindings table
alter table public.assistant_voice_bindings
  add column if not exists auto_speak boolean not null default false,
  add column if not exists auto_speak_cooldown_ms int not null default 45000,
  add column if not exists last_auto_spoken_at timestamptz null;

-- sanity
alter table public.assistant_voice_bindings
  add constraint assistant_voice_bindings_cooldown_range
  check (auto_speak_cooldown_ms >= 10000 and auto_speak_cooldown_ms <= 300000);
