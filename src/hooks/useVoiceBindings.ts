"use client";

import { useEffect, useState } from "react";

type Bindings = Record<
  string,
  {
    voice_id: string | null;
    auto_speak: boolean;
    cooldown_ms: number;
    max_chars: number;
  }
>;

const KEY = "telegpt_voice_bindings_v1";

async function fetchBindings(): Promise<Bindings> {
  const r = await fetch("/api/voice/bindings", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.error || "bindings_failed");
  return j.bindings || {};
}

function normalizeBindings(value: unknown): Bindings {
  if (!value || typeof value !== "object") return {};
  const out: Bindings = {};
  for (const [k, v] of Object.entries(value as Record<string, any>)) {
    if (v && typeof v === "object") {
      out[k] = {
        voice_id: v.voice_id ?? null,
        auto_speak: !!v.auto_speak,
        cooldown_ms: Number(v.cooldown_ms ?? v.auto_speak_cooldown_ms ?? 45000),
        max_chars: Number(v.max_chars ?? v.auto_speak_max_chars ?? 420),
      };
      continue;
    }
    if (typeof v === "string" || v === null) {
      out[k] = { voice_id: v ?? null, auto_speak: false, cooldown_ms: 45000, max_chars: 420 };
    }
  }
  return out;
}

export function useVoiceBindings() {
  const [bindings, setBindings] = useState<Bindings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setBindings(normalizeBindings(JSON.parse(raw)));
    } catch {
      // ignore cache read
    }

    (async () => {
      try {
        const b = await fetchBindings();
        if (!alive) return;
        setBindings(normalizeBindings(b));
        try {
          sessionStorage.setItem(KEY, JSON.stringify(b));
        } catch {
          // ignore cache write
        }
      } catch {
        // ignore fetch error
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return { bindings, loading };
}
