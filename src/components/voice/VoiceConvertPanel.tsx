"use client";

import React, { useEffect, useMemo, useState } from "react";

type VoiceRow = {
  voice_id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
};

function short(id: string) {
  return id ? `${id.slice(0, 8)}…` : "—";
}

async function fileToBase64(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  return buf.toString("base64");
}

export function VoiceConvertPanel() {
  const [voices, setVoices] = useState<VoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [targetVoice, setTargetVoice] = useState<string>("");
  const [srcFile, setSrcFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const targetObj = useMemo(
    () => voices.find((v) => v.voice_id === targetVoice) ?? null,
    [voices, targetVoice]
  );

  async function loadVoices() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/voice/me", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to load voices");
      setVoices(j.voices ?? []);
      if (!targetVoice && j.voices?.[0]?.voice_id) setTargetVoice(j.voices[0].voice_id);
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

  async function onConvert() {
    setErr(null);
    setWarning(null);
    if (!srcFile) return setErr("Загрузи source аудио");
    if (!targetVoice) return setErr("Выбери target голос");

    setBusy(true);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);

    try {
      const b64 = await fileToBase64(srcFile);
      const r = await fetch("/api/voice/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target_voice_id: targetVoice,
          source_audio_base64: b64,
          source_mime: srcFile.type || "audio/wav",
          lang_hint: "ru",
        }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "convert_failed");
      }

      const warn = r.headers.get("x-voice-warnings");
      if (warn) setWarning(warn);

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      await loadVoices();
    } catch (e: any) {
      setErr(e?.message ?? "convert_error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="text-lg font-semibold">Конверт (audio → audio)</div>
      <div className="text-sm text-white/70">
        Maker-only. Если прямой VC недоступен — будет fallback ASR→TTS (это покажем предупреждением).
      </div>

      {err && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm">
          {err}
        </div>
      )}
      {warning && (
        <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-sm">
          {warning}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2">
          <div className="text-sm font-medium">Source audio</div>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setSrcFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-white/80 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
          />
          <div className="text-xs text-white/60">
            {srcFile ? `${srcFile.name} (${Math.round(srcFile.size / 1024)} KB)` : "Выбери файл…"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2">
          <div className="text-sm font-medium">Target voice</div>
          <select
            value={targetVoice}
            onChange={(e) => setTargetVoice(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-sm outline-none focus:border-white/20"
            disabled={loading}
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
              {targetObj ? (targetObj.label || short(targetObj.voice_id)) : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          onClick={onConvert}
          disabled={busy || !srcFile || !targetVoice}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
        >
          {busy ? "Конвертирую…" : "Convert"}
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
