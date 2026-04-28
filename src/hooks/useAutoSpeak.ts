"use client";

import { useEffect, useRef } from "react";
import { useVoiceBindings } from "@/hooks/useVoiceBindings";

export function useAutoSpeak(opts: {
  messageId: string;
  assistantId?: string | null;
  text: string;
  onAudio: (src: string) => void;
  onError?: (err: string) => void;
}) {
  const { bindings, loading } = useVoiceBindings();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (loading) return;

    const assistantId = opts.assistantId || "";
    if (!assistantId) return;

    const cfg = bindings[assistantId];
    if (!cfg?.auto_speak) return;

    const text = (opts.text || "").trim();
    if (!text) return;

    const maxChars = Number(cfg.max_chars ?? 420);
    if (text.length > maxChars) return;

    fired.current = true;

    (async () => {
      try {
        const r = await fetch("/api/voice/speak-bulk", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text,
            voice_id: cfg.voice_id ?? null,
            auto: true,
            assistant_id: assistantId,
            max_chars: 900,
          }),
        });

        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok) {
          if (j?.error === "auto_speak_cooldown") return;
          throw new Error(j?.error || "auto_speak_failed");
        }

        const src = j.audio_base64
          ? `data:${j.mime || "audio/mpeg"};base64,${j.audio_base64}`
          : null;
        if (src) opts.onAudio(src);
      } catch (e: any) {
        opts.onError?.(e?.message ?? "auto_speak_failed");
      }
    })();
  }, [bindings, loading, opts]);
}
