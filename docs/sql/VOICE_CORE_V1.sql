-- =========================
-- Tele•GPT Voice-Core v1: Voices + Audit + RateLimit
-- =========================

-- 1) Voices registry
create table if not exists public.voice_profiles (
  voice_id text primary key,
  owner_user_id text not null,
  label text,
  input_sha256 text not null,
  input_mime text,
  input_seconds numeric,
  provider text not null default 'local.cosyvoice.v3',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  deleted_at timestamptz
);

create index if not exists idx_voice_profiles_owner on public.voice_profiles(owner_user_id);
create index if not exists idx_voice_profiles_sha on public.voice_profiles(input_sha256);
create index if not exists idx_voice_profiles_deleted on public.voice_profiles(deleted_at);

-- 2) Audit log (append-only)
create table if not exists public.voice_audit_log (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  actor_user_id text not null,
  action text not null,
  voice_id text,
  provider text,
  status text not null default 'done',
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_voice_audit_owner on public.voice_audit_log(owner_user_id, created_at desc);
create index if not exists idx_voice_audit_action on public.voice_audit_log(action, created_at desc);
create index if not exists idx_voice_audit_voice on public.voice_audit_log(voice_id);

-- 3) Rate limit bucket (simple, atomic via RPC below)
create table if not exists public.voice_rate_buckets (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null,
  window_seconds int not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_voice_rate_updated on public.voice_rate_buckets(updated_at desc);

-- 4) RLS
alter table public.voice_profiles enable row level security;
alter table public.voice_audit_log enable row level security;
alter table public.voice_rate_buckets enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='voice_profiles' and policyname='deny_all_voice_profiles') then
    create policy deny_all_voice_profiles on public.voice_profiles for all
      using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='voice_audit_log' and policyname='deny_all_voice_audit') then
    create policy deny_all_voice_audit on public.voice_audit_log for all
      using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='voice_rate_buckets' and policyname='deny_all_voice_rate') then
    create policy deny_all_voice_rate on public.voice_rate_buckets for all
      using (false) with check (false);
  end if;
end $$;

-- 5) RPC: atomic rate-limit increment
create or replace function public.voice_rate_hit(
  p_key text,
  p_window_seconds int,
  p_limit int
) returns table(allowed boolean, new_count int) as $$
declare
  v_now timestamptz := now();
  v_bucket public.voice_rate_buckets%rowtype;
begin
  insert into public.voice_rate_buckets(key, count, window_start, window_seconds)
  values (p_key, 0, v_now, p_window_seconds)
  on conflict (key) do nothing;

  select * into v_bucket from public.voice_rate_buckets where key = p_key for update;

  if extract(epoch from (v_now - v_bucket.window_start)) >= v_bucket.window_seconds then
    update public.voice_rate_buckets
      set count = 0,
          window_start = v_now,
          window_seconds = p_window_seconds,
          updated_at = v_now
      where key = p_key;
    select * into v_bucket from public.voice_rate_buckets where key = p_key for update;
  end if;

  if v_bucket.count + 1 > p_limit then
    allowed := false;
    new_count := v_bucket.count;
    return next;
    return;
  end if;

  update public.voice_rate_buckets
    set count = count + 1,
        updated_at = v_now
    where key = p_key
    returning count into new_count;

  allowed := true;
  return next;
end;
$$ language plpgsql security definer;

revoke all on function public.voice_rate_hit(text,int,int) from public, anon, authenticated;
