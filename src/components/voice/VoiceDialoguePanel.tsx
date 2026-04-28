"use client";

import React, { useEffect, useMemo, useState } from "react";

type VoiceRow = {
  voice_id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
};

type Line = { speaker: "A" | "B"; text: string };

function short(id: string) {
  return id ? `${id.slice(0, 8)}…` : "—";
}

export function VoiceDialoguePanel() {
  const [voices, setVoices] = useState<VoiceRow[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [voiceA, setVoiceA] = useState<string>("");
  const [voiceB, setVoiceB] = useState<string>("");

  const [lines, setLines] = useState<Line[]>([
    { speaker: "A", text: "Привет. Это спикер А." },
    { speaker: "B", text: "А это спикер Б. Слышу тебя отлично." },
  ]);

  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const voiceAObj = useMemo(
    () => voices.find((v) => v.voice_id === voiceA) ?? null,
    [voices, voiceA]
  );
  const voiceBObj = useMemo(
    () => voices.find((v) => v.voice_id === voiceB) ?? null,
    [voices, voiceB]
  );

  async function loadVoices() {
    setLoadingVoices(true);
    setErr(null);
    try {
      const r = await fetch("/api/voice/me", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to load voices");
      const list: VoiceRow[] = (j.voices ?? []).filter((v: any) => !v.deleted_at);
      setVoices(list);

      if (!voiceA && list[0]?.voice_id) setVoiceA(list[0].voice_id);
      if (!voiceB && list[1]?.voice_id) setVoiceB(list[1].voice_id);
      if (!voiceB && list[0]?.voice_id) setVoiceB(list[0].voice_id);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setLoadingVoices(false);
    }
  }

  useEffect(() => {
    loadVoices();
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  function addLine(speaker: "A" | "B") {
    setLines((prev) => [...prev, { speaker, text: "" }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveLine(idx: number, dir: -1 | 1) {
    setLines((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function generateDialogue() {
    setErr(null);
    if (!voiceA || !voiceB) {
      setErr("Выбери голоса A и B");
      return;
    }
    const script = lines
      .map((l) => ({ speaker: l.speaker, text: l.text.trim() }))
      .filter((l) => l.text.length > 0);

    if (script.length === 0) {
      setErr("Скрипт пустой");
      return;
    }

    setBusy(true);

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);

    try {
      const r = await fetch("/api/voice/dialogue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          script,
          voices: { A: { voice_id: voiceA }, B: { voice_id: voiceB } },
          lang_hint: "ru",
        }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "dialogue_failed");
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      await loadVoices();
    } catch (e: any) {
      setErr(e?.message ?? "dialogue_error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Диалог</div>
          <div className="text-sm text-white/70">
            Скрипт A/B → генерация одной дорожки (WAV). Maker-only.
          </div>
        </div>
        <button
          onClick={loadVoices}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
        >
          Обновить голоса
        </button>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2">
          <div className="text-sm font-medium">Голос A</div>
          <select
            value={voiceA}
            onChange={(e) => setVoiceA(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-sm outline-none focus:border-white/20"
            disabled={loadingVoices}
          >
            <option value="">— выбрать —</option>
            {voices.map((v) => (
              <option key={v.voice_id} value={v.voice_id}>
                {(v.label || "Без названия")} ({short(v.voice_id)})
              </option>
            ))}
          </select>
          <div className="text-xs text-white/60">
            Выбран:{" "}
            <span className="text-white/80">
              {voiceAObj ? voiceAObj.label || short(voiceAObj.voice_id) : "—"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2">
          <div className="text-sm font-medium">Голос B</div>
          <select
            value={voiceB}
            onChange={(e) => setVoiceB(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-sm outline-none focus:border-white/20"
            disabled={loadingVoices}
          >
            <option value="">— выбрать —</option>
            {voices.map((v) => (
              <option key={v.voice_id} value={v.voice_id}>
                {(v.label || "Без названия")} ({short(v.voice_id)})
              </option>
            ))}
          </select>
          <div className="text-xs text-white/60">
            Выбран:{" "}
            <span className="text-white/80">
              {voiceBObj ? voiceBObj.label || short(voiceBObj.voice_id) : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Скрипт</div>
          <div className="flex gap-2">
            <button
              onClick={() => addLine("A")}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
            >
              + A
            </button>
            <button
              onClick={() => addLine("B")}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
            >
              + B
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {lines.map((l, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/10 bg-black/10 p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={l.speaker}
                    onChange={(e) =>
                      updateLine(idx, { speaker: e.target.value as "A" | "B" })
                    }
                    className="rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none focus:border-white/20"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                  <div className="text-xs text-white/60">Строка {idx + 1}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => moveLine(idx, -1)}
                    className="rounded-xl bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
                    title="Вверх"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveLine(idx, 1)}
                    className="rounded-xl bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
                    title="Вниз"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeLine(idx)}
                    className="rounded-xl bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <textarea
                value={l.text}
                onChange={(e) => updateLine(idx, { text: e.target.value })}
                rows={2}
                className="w-full rounded-2xl border border-white/10 bg-black/30 p-2 text-sm outline-none focus:border-white/20"
                placeholder={l.speaker === "A" ? "Текст спикера A…" : "Текст спикера B…"}
              />
            </div>
          ))}
        </div>

        <div className="text-xs text-white/60">
          Если ударения “плывут” — правь текстом (капс/знак ударения) и
          перегенерируй.
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          onClick={generateDialogue}
          disabled={busy || !voiceA || !voiceB}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
        >
          {busy ? "Генерирую…" : "Сгенерировать диалог"}
        </button>

        {audioUrl && (
          <div className="w-full md:w-2/3">
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
