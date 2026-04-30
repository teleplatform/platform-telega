# TRACE_LAYER (Voice) v1.0 — Explainable Tele•GPT Voice Runtime
Статус: CANONICAL
Scope: /api/voice/say*, /api/voice/speak*, Voice Lab Trace Viewer
Цель: по trace_id объяснить “почему звучит иначе” и зафиксировать причину.

## 1) Источник истины
trace_id — единый ключ корреляции на весь пайп:
- request header: x-telegpt-trace-id (вход, если пришёл)
- response header: x-telegpt-trace-id (всегда)
- storage: public.voice_traces.id (опционально)

## 2) Что должно быть объяснимо
Каждый trace обязан отвечать:
- ROUTE: say или speak (fallback)
- PRESET: t800|mila|kozy|none (если say)
- SPEAKER: speaker_id (если есть)
- METRICS: tts_ms, dsp_ms, rtf, chunks (bulk)
- FAILOVER: было ли переключение (failover_used)
- WHY: причина (disabled / missing_bin / runtime_error / policy / unknown)

## 3) Правила формирования WHY
WHY вычисляется детерминированно:
- if failover_used=true:
  - reason = meta.failover_reason || "unknown"
- else if route="say":
  - reason = "ok"
- else if route="speak":
  - reason = "default_or_binding"

## 4) Снимок окружения (безопасный)
В meta разрешено сохранять только безопасные поля:
- node_env, platform, telegpt_say_enabled (bool), tg_say_path_present (bool)
- model/provider для speak (если есть)
Запрещено: ключи, токены, пути к секретам, сырой текст пользователя.

## 5) UI-экран
Экран “Trace Explain” должен показывать:
- карточка Summary (route/preset/speaker/failover/why)
- карточка Metrics (tts/dsp/rtf/chunks)
- карточка Environment (безопасный snapshot)
- кнопка Copy trace-id
