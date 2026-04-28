"use client";

import React, { useEffect, useMemo, useState } from "react";
import { VoiceDialoguePanel } from "@/components/voice/VoiceDialoguePanel";
import { VoiceConvertPanel } from "@/components/voice/VoiceConvertPanel";
import { VoiceRenameInline } from "@/components/voice/VoiceRenameInline";

type VoiceRow = {
  voice_id: string;
  label: string | null;
  provider: string | null;
  created_at: string;
  last_used_at: string | null;
  input_mime: string | null;
  input_seconds: number | null;
  input_sha256: string;
};

function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleString();
}

export default function VoiceLabPage() {
  const [voices, setVoices] = useState<VoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [refFile, setRefFile] = useState<File | null>(null);
  const [registerBusy, setRegisterBusy] = useState(false);

  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [testText, setTestText] = useState("Привет! Это тест Tele•GPT Voice Lab.");
  const [speakBusy, setSpeakBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const selected = useMemo(
    () => voices.find((v) => v.voice_id === selectedVoiceId) ?? null,
    [voices, selectedVoiceId]
  );

  async function loadVoices() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/voice/me", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to load");
      setVoices(j.voices ?? []);
      if (!selectedVoiceId && j.voices?.[0]?.voice_id) {
        setSelectedVoiceId(j.voices[0].voice_id);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVoices();
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  async function onRegister() {
    if (!refFile) return;
    setRegisterBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("ref", refFile, refFile.name || "ref.wav");
      const r = await fetch("/api/voice/register", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "register_failed");
      await loadVoices();
      setRefFile(null);
    } catch (e: any) {
      setErr(e?.message ?? "register_error");
    } finally {
      setRegisterBusy(false);
    }
  }

  async function onSpeak() {
    if (!selectedVoiceId || !testText.trim()) return;
    setSpeakBusy(true);
    setErr(null);

    if (audioUrl) URL.revokeObjectURL(audioUrl);

    try {
      const r = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          voice_id: selectedVoiceId,
          text: testText,
          lang_hint: "ru",
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "speak_failed");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      await loadVoices();
    } catch (e: any) {
      setErr(e?.message ?? "speak_error");
    } finally {
      setSpeakBusy(false);
    }
  }

  async function onDelete(voice_id: string) {
    if (!voice_id) return;
    setErr(null);
    try {
      const r = await fetch("/api/voice/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voice_id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "delete_failed");
      if (selectedVoiceId === voice_id) setSelectedVoiceId("");
      await loadVoices();
    } catch (e: any) {
      setErr(e?.message ?? "delete_error");
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 bg-black text-white">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xl font-semibold">Voice Lab</div>
          <div className="text-sm text-white/70">
            Maker-only: регистрация, диалоги и конвертация. Public: безопасная озвучка.
          </div>
        </header>

        {err && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm">
            {err}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="font-medium">Добавить голос (референс до ~30 сек)</div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setRefFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-white/80 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
            />
            <button
              onClick={onRegister}
              disabled={!refFile || registerBusy}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
            >
              {registerBusy ? "Загружаю…" : "Зарегистрировать"}
            </button>
          </div>
          <div className="text-xs text-white/60">
            Важно: загружай только свой голос или с разрешением владельца.
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="font-medium">Мои голоса</div>
            <button
              onClick={loadVoices}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
            >
              Обновить
            </button>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-white/70">Загрузка…</div>
          ) : voices.length == 0 ? (
            <div className="mt-3 text-sm text-white/70">
              Пока пусто. Добавь референс выше.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {voices.map((v) => (
                <div
                  key={v.voice_id}
                  className={`rounded-2xl border p-3 ${
                    v.voice_id === selectedVoiceId
                      ? "border-white/20 bg-white/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {v.label || "Без названия"}{" "}
                        <span className="text-xs text-white/50">
                          ({v.voice_id.slice(0, 8)}…)
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-white/60 space-y-0.5">
                        <div>Создан: {fmt(v.created_at)}</div>
                        <div>Последнее использование: {fmt(v.last_used_at)}</div>
                        <div>
                          SHA256:{" "}
                          <span className="text-white/45">
                            {v.input_sha256.slice(0, 12)}…
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => setSelectedVoiceId(v.voice_id)}
                        className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                      >
                        Выбрать
                      </button>
                      <VoiceRenameInline
                        voice_id={v.voice_id}
                        current={v.label || "Без названия"}
                        onDone={loadVoices}
                      />
                      <button
                        onClick={() => onDelete(v.voice_id)}
                        className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="font-medium">Тест-озвучка</div>

          <div className="text-sm text-white/70">
            Выбранный голос:{" "}
            <span className="text-white">
              {selected ? selected.label || selected.voice_id : "—"}
            </span>
          </div>

          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-white/20"
            placeholder="Текст для озвучки…"
          />

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <button
              onClick={onSpeak}
              disabled={!selectedVoiceId || speakBusy || !testText.trim()}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
            >
              {speakBusy ? "Генерирую…" : "Озвучить"}
            </button>

            {audioUrl && <audio controls src={audioUrl} className="w-full" />}
          </div>

          <div className="text-xs text-white/60">
            Если ударения “плывут” — правим текстом (капсом/знаком ударения) и
            перегенерируем.
          </div>
        </section>

        <VoiceDialoguePanel />
        <VoiceConvertPanel />
      </div>
    </div>
  );
}
