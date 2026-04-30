-- Voice•LAB Assistant Bindings v1
-- связывает assistant_id -> voice_id (owner scoped)

create table if not exists public.assistant_voice_bindings (
  owner_user_id text not null,
  assistant_id  text not null,
  voice_id      uuid null,
  updated_at    timestamptz not null default now(),
  primary key (owner_user_id, assistant_id)
);

-- (опционально) FK на voice_profiles если у тебя voice_profiles.voice_id uuid
-- alter table public.assistant_voice_bindings
--   add constraint assistant_voice_bindings_voice_fk
--   foreign key (voice_id) references public.voice_profiles(voice_id)
--   on delete set null;

alter table public.assistant_voice_bindings enable row level security;

-- Только владелец видит/меняет свои привязки
create policy "assistant_voice_bindings_select_own"
on public.assistant_voice_bindings
for select
using (owner_user_id = auth.uid()::text);

create policy "assistant_voice_bindings_upsert_own"
on public.assistant_voice_bindings
for insert
with check (owner_user_id = auth.uid()::text);

create policy "assistant_voice_bindings_update_own"
on public.assistant_voice_bindings
for update
using (owner_user_id = auth.uid()::text)
with check (owner_user_id = auth.uid()::text);
