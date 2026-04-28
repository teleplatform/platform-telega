"use client";

import React, { useEffect, useMemo, useState } from "react";
import { VoiceConvertPanel } from "@/components/voice/VoiceConvertPanel";
import { VoiceDialoguePanel } from "@/components/voice/VoiceDialoguePanel";
import { VoiceRenameInline } from "@/components/voice/VoiceRenameInline";
import { VoiceCanonBadge } from "@/components/voice/VoiceCanonBadge";
import { getAgentVoiceConfig } from "@/config/voiceAgents";
import { VoiceTracePanel } from "@/components/voice/VoiceTracePanel";

type VoiceRow = {
  voice_id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
};

type AssistantRow = {
  id: string;
  name: string;
  description?: string | null;
};

function short(id: string) {
  return id ? `${id.slice(0, 8)}…` : "—";
}

async function fetchJson(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `request_failed:${url}`);
  return j;
}

export default function VoiceLabPage() {
  const [tab, setTab] = useState<"voices" | "assistants">("voices");

  const [voices, setVoices] = useState<VoiceRow[]>([]);
  const [voicesErr, setVoicesErr] = useState<string | null>(null);
  const [voicesLoading, setVoicesLoading] = useState(true);

  const [assistants, setAssistants] = useState<AssistantRow[]>([]);
  const [assistantsErr, setAssistantsErr] = useState<string | null>(null);
  const [assistantsLoading, setAssistantsLoading] = useState(true);

  const [bindings, setBindings] = useState<
    Record<string, { voice_id: string | null; auto_speak: boolean; cooldown_ms: number; max_chars: number }>
  >({});
  const [bindingsErr, setBindingsErr] = useState<string | null>(null);

  async function loadVoices() {
    setVoicesLoading(true);
    setVoicesErr(null);
    try {
      const j = await fetchJson("/api/voice/me");
      setVoices(j.voices ?? []);
    } catch (e: any) {
      setVoicesErr(e?.message ?? "voices_failed");
    } finally {
      setVoicesLoading(false);
    }
  }

  async function loadAssistants() {
    setAssistantsLoading(true);
    setAssistantsErr(null);
    try {
      const j = await fetchJson("/api/assistants/me");
      setAssistants(j.assistants ?? []);
    } catch (e: any) {
      setAssistantsErr(e?.message ?? "assistants_failed");
      setAssistants([]);
    } finally {
      setAssistantsLoading(false);
    }
  }

  async function loadBindings() {
    setBindingsErr(null);
    try {
      const j = await fetchJson("/api/voice/bindings");
      setBindings(j.bindings ?? {});
    } catch (e: any) {
      setBindingsErr(e?.message ?? "bindings_failed");
      setBindings({});
    }
  }

  useEffect(() => {
    loadVoices();
  }, []);

  useEffect(() => {
    if (tab === "assistants") {
      loadAssistants();
      loadBindings();
    }
  }, [tab]);

  const voiceOptions = useMemo(() => {
    return [{ value: "", label: "— нет голоса —" }].concat(
      voices.map((v) => ({
        value: v.voice_id,
        label: `${v.label || "Без названия"} (${short(v.voice_id)})`,
      }))
    );
  }, [voices]);

  async function setBinding(assistantId: string, voiceId: string | null) {
    setBindingsErr(null);
    setBindings((prev) => ({
      ...prev,
      [assistantId]: {
        voice_id: voiceId,
        auto_speak: prev[assistantId]?.auto_speak ?? false,
        cooldown_ms: prev[assistantId]?.cooldown_ms ?? 45000,
      },
    }));

    try {
      const r = await fetch("/api/voice/bind", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assistant_id: assistantId, voice_id: voiceId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "bind_failed");
    } catch (e: any) {
      setBindingsErr(e?.message ?? "bind_failed");
      await loadBindings();
    }
  }

  async function toggleAutoSpeak(assistantId: string, current: boolean) {
    try {
      await fetch("/api/voice/auto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assistant_id: assistantId,
          auto_speak: !current,
          cooldown_ms: bindings[assistantId]?.cooldown_ms ?? 45000,
          max_chars: bindings[assistantId]?.max_chars ?? 420,
        }),
      });
      await loadBindings();
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Voice•LAB</div>
            <div className="text-sm text-white/70">
              Голоса • Конверт • Диалоги • Привязка к ассистентам
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className={`rounded-xl px-3 py-2 text-sm border ${
                tab === "voices"
                  ? "border-white/20 bg-white/10"
                  : "border-white/10 bg-black/20 hover:bg-white/5"
              }`}
              onClick={() => setTab("voices")}
            >
              Голоса
            </button>
            <button
              className={`rounded-xl px-3 py-2 text-sm border ${
                tab === "assistants"
                  ? "border-white/20 bg-white/10"
                  : "border-white/10 bg-black/20 hover:bg-white/5"
              }`}
              onClick={() => setTab("assistants")}
            >
              Ассистенты
            </button>
          </div>
        </div>
      </div>

      {tab === "voices" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Мои голоса</div>
              <button
                className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                onClick={() => (window.location.href = "/voice")}
              >
                Открыть “Create / Speak”
              </button>
            </div>
            <div className="mt-2 text-sm text-white/70">
              “Create / Speak” живёт на /voice. Voice•LAB — хаб управления и
              расширенные панели.
            </div>

            {voicesErr && (
              <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm">
                {voicesErr}
              </div>
            )}

            <div className="mt-3 space-y-2">
              {voicesLoading ? (
                <div className="text-sm text-white/70">Загрузка…</div>
              ) : (
                voices.map((v) => (
                  <div
                    key={v.voice_id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-medium">
                          {v.label || "Без названия"}
                        </div>
                        <div className="text-xs text-white/60">
                          {short(v.voice_id)} • created{" "}
                          {new Date(v.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <VoiceRenameInline
                          voice_id={v.voice_id}
                          current={v.label || "Без названия"}
                          onDone={loadVoices}
                        />
                        <button
                          className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                          onClick={async () => {
                            await fetch("/api/voice/delete", {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ voice_id: v.voice_id }),
                            });
                            await loadVoices();
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {!voicesLoading && voices.length === 0 && (
                <div className="text-sm text-white/70">
                  Пока нет голосов. Создай первый на /voice → Register.
                </div>
              )}
            </div>
          </div>

          <VoiceConvertPanel />
          <VoiceDialoguePanel />
        </div>
      )}

      {tab === "assistants" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-lg font-semibold">Ассистенты → Голос</div>
            <div className="text-sm text-white/70">
              Здесь ты выбираешь голос для каждого ассистента. В чате потом
              появится “🎙 озвучить” и он возьмёт голос ассистента.
            </div>

            {bindingsErr && (
              <div className="mt-3 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-sm">
                {bindingsErr}
              </div>
            )}
            {assistantsErr && (
              <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm">
                Не найден список ассистентов (ожидался /api/assistants/me).
                Подключи этот эндпоинт — и вкладка оживёт.
              </div>
            )}

            <div className="mt-3 space-y-2">
              {assistantsLoading ? (
                <div className="text-sm text-white/70">Загрузка…</div>
              ) : (
                assistants.map((a) => {
                  const selected = bindings[a.id]?.voice_id ?? "";
                  const autoSpeak = !!bindings[a.id]?.auto_speak;
                  const maxChars = bindings[a.id]?.max_chars ?? 420;
                  const agentVoice = getAgentVoiceConfig(a.id);
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-medium">{a.name}</div>
                          <div className="text-xs text-white/60">
                            {a.description || a.id}
                          </div>
                          {agentVoice || selected ? (
                            <div className="mt-2">
                              <VoiceCanonBadge
                                agentVoice={agentVoice}
                                voiceId={selected || null}
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                          <select
                            className="rounded-xl border border-white/10 bg-black/30 p-2 text-sm outline-none focus:border-white/20"
                            value={selected || ""}
                            onChange={(e) =>
                              setBinding(
                                a.id,
                                e.target.value ? e.target.value : null
                              )
                            }
                          >
                            {voiceOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <button
                            className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                            onClick={() =>
                              (window.location.href = `/voice?assistant=${encodeURIComponent(
                                a.id
                              )}`)
                            }
                          >
                            Тест
                          </button>

                          <button
                            className={`rounded-xl px-3 py-2 text-xs border ${
                              autoSpeak
                                ? "border-white/20 bg-white/10"
                                : "border-white/10 bg-black/20 hover:bg-white/5"
                            }`}
                            onClick={() => toggleAutoSpeak(a.id, autoSpeak)}
                          >
                            {autoSpeak ? "🔊 Авто: ON" : "🔇 Авто: OFF"}
                          </button>

                          <select
                            className="rounded-xl border border-white/10 bg-black/30 p-2 text-xs outline-none focus:border-white/20"
                            value={maxChars}
                            onChange={async (e) => {
                              const next = Number(e.target.value);
                              await fetch("/api/voice/auto", {
                                method: "POST",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  assistant_id: a.id,
                                  auto_speak: autoSpeak,
                                  cooldown_ms: bindings[a.id]?.cooldown_ms ?? 45000,
                                  max_chars: next,
                                }),
                              });
                              await loadBindings();
                            }}
                          >
                            {[200, 300, 420, 600, 900].map((n) => (
                              <option key={n} value={n}>
                                ≤ {n} chars
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {!assistantsLoading &&
                assistants.length === 0 &&
                !assistantsErr && (
                  <div className="text-sm text-white/70">
                    Ассистентов пока нет.
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      <VoiceTracePanel />
    </div>
  );
}
