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

export function SpeakButton({ assistantId, text, className }: Props) {
  const { bindings } = useVoiceBindings();

  const agentVoice = useMemo(() => getAgentVoiceConfig(assistantId), [assistantId]);

  const voiceId = useMemo(() => {
    if (!assistantId) return null;
    return bindings[assistantId]?.voice_id ?? null;
  }, [assistantId, bindings]);

  const [loading, setLoading] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    setLoading(true);
    if (audioSrc) URL.revokeObjectURL(audioSrc);
    setAudioSrc(null);

    try {
      const useSay = !!agentVoice;
      const r = await fetch(useSay ? "/api/voice/say" : "/api/voice/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          useSay
            ? { text, assistant_id: assistantId, lang: "ru" }
            : { text, voice_id: voiceId ?? null, lang_hint: "ru" }
        ),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "speak_failed");
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setAudioSrc(url);
    } catch (e: any) {
      setErr(e?.message ?? "speak_failed");
      setAudioSrc(null);
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
          title={
            agentVoice
              ? `Озвучить preset: ${agentVoice.preset}`
              : voiceId
                ? "Озвучить голосом ассистента"
                : "Озвучить (дефолтным голосом)"
          }
        >
          {loading ? "🎙 Озвучиваю…" : "🎙 Озвучить"}
        </button>

        {agentVoice || voiceId ? (
          <VoiceCanonBadge agentVoice={agentVoice} voiceId={voiceId ?? null} />
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
