"use client";

import React, { useMemo, useState } from "react";
import { useVoiceBindings } from "@/hooks/useVoiceBindings";
import { getAgentVoiceConfig } from "@/config/voiceAgents";
import { VoiceCanonBadge } from "@/components/voice/VoiceCanonBadge";

type Props = {
  assistantId?: string | null;
  text: string;
  className?: string;
};

function toDataUrl(b64: string, mime?: string) {
  const m = mime || "audio/mpeg";
  return `data:${m};base64,${b64}`;
}

export function BulkSpeakButton({ assistantId, text, className }: Props) {
  const { bindings } = useVoiceBindings();
  const agentVoice = useMemo(() => getAgentVoiceConfig(assistantId), [assistantId]);
  const voiceId = useMemo(
    () => (assistantId ? bindings[assistantId]?.voice_id ?? null : null),
    [assistantId, bindings]
  );

  const [loading, setLoading] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ chunks?: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    setLoading(true);
    setAudioSrc(null);
    setMeta(null);

    try {
      const useSay = !!agentVoice;
      const r = await fetch(useSay ? "/api/voice/say-bulk" : "/api/voice/speak-bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          useSay
            ? { text, assistant_id: assistantId, max_chars: 900, lang: "ru" }
            : { text, voice_id: voiceId, max_chars: 900 }
        ),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "bulk_speak_failed");

      const url = j.audio_base64 ? toDataUrl(j.audio_base64, j.mime) : null;
      if (!url) throw new Error("no_audio_in_response");

      setAudioSrc(url);
      setMeta({ chunks: j.chunks });
    } catch (e: any) {
      setErr(e?.message ?? "bulk_speak_failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <button
          onClick={run}
          disabled={loading || !text?.trim()}
          className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15 disabled:opacity-50"
          title="Озвучить весь ответ (авто-склейка по абзацам)"
        >
          {loading ? "🎙 Озвучиваю всё…" : "🎙 Озвучить всё"}
        </button>

        {agentVoice || voiceId ? (
          <VoiceCanonBadge agentVoice={agentVoice} voiceId={voiceId ?? null} />
        ) : meta?.chunks ? (
          <div className="text-[11px] text-white/60">chunks: {meta.chunks}</div>
        ) : null}
      </div>

      {err && (
        <div className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 p-2 text-xs">
          {err}
        </div>
      )}

      {audioSrc && (
        <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-2">
          <audio controls src={audioSrc} className="w-full" />
        </div>
      )}
    </div>
  );
}
