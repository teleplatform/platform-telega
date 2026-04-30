alter table public.assistant_voice_bindings
  add column if not exists auto_speak_max_chars int not null default 420;

alter table public.assistant_voice_bindings
  add constraint assistant_voice_bindings_max_chars_range
  check (auto_speak_max_chars >= 60 and auto_speak_max_chars <= 4000);
