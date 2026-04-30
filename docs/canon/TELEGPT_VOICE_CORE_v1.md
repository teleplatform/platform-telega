# Tele•GPT Voice-Core v1.0 (CosyVoice3 Engine Integration)
Статус: CANONICAL
Owner: Никита
Дата: 2026-01-29
Scope: Tele•GPT → Voice Lab → Voice-Core (Local Provider)

## 0) Цель
Добавить в Tele•GPT локальный модуль речи, который:
- умеет клонировать голос по короткому референсу (до ~30 сек),
- генерирует озвучку текста выбранным голосом,
- умеет voice-to-voice (перенос голоса на аудио),
- поддерживает диалоги (спикер A/B),
- работает как провайдер (engine), без ComfyUI как UI.

Важно: Voice-Core — это backend-движок. UI — только Tele•GPT.

## 1) Принципы (жёстко)
1) Engine-first: никакого ComfyUI в продукте, только движок в worker.
2) Public/Maker split:
   - Public: только базовые голоса, без клона.
   - Maker: клонирование, voice-to-voice, диалоги.
3) Интонация/“настроение” управляются референсом, а не ручками (в v1).
4) Ударения/произношение правятся на стороне текста (preprocess).
5) Легальность: инструмент разрешён только для своего голоса или с явным согласием владельца.
6) Auditability: каждое создание и использование voice_id логируется.

## 2) Архитектура
Tele•GPT (API)
  └─ Voice Lab (UI)
      └─ Voice-Core Router (provider router)
          └─ Local Worker: cosyvoice.v3
               ├─ clone (audio → voice_id)
               ├─ speak (text + voice_id → audio)
               ├─ convert (audio + voice_id → audio)
               └─ dialogue (script + voices → audio)

## 3) Провайдеры (v1)
- provider: "local.cosyvoice.v3" (главный)
- provider: "local.tts.base" (Public fallback)

Роутинг:
- Public → local.tts.base
- Maker → local.cosyvoice.v3

## 4) Форматы и ограничения (v1)
- Референс для клона: wav/flac/mp3, моно предпочтительно, 16k–48k.
- Длина референса: до 30 сек (лишнее режем).
- Выход аудио: wav (канон). Экспорт mp3/aac — отдельным шагом MediaFactory/Exporter.

## 5) Модель безопасности (Policy)
- Maker-only для /voice/clone и /voice/convert и /voice/dialogue.
- Явная декларация пользователем: "я владелец голоса или имею разрешение".
- Логи:
  - кто создал voice_id, когда, fingerprint исходного файла (хэш),
  - где использовал (speak/convert/dialogue), сколько раз.
- Отказ (blocked): если policy gate не пройден.

## 6) Текстовый препроцесс (v1)
Минимальный набор:
- нормализация пробелов/кавычек
- авто-пунктуация (если пусто — добавлять паузы)
- подсказки ударений: поддержка CAPS-акцента и знака ударения
- lang autodetect (ru/uz/en) + ручной override

## 7) Контракты API (см. docs/contracts/VOICE_CORE_API_v1.json)
Этот документ — единственный источник правды по API v1.

## 8) Maker Policy Gate v1 (Voice-Core)
Статус: CANONICAL
Версия: 1.0.0

### Правило
Операции клона и переноса голоса допускаются только в Maker режиме.

### Требования
1) Пользователь должен подтвердить:
   - "Я владелец голоса или у меня есть разрешение" = true
2) Действия логируются:
   - voice_id creator, timestamp, input sha256
   - speak/convert/dialogue usage events

### Блокировки (blocked)
- consent=false
- пользователь не Maker
- файл аудио пустой/битый/не поддерживается
- превышение лимита (длина/размер)

### Ответ пользователю (UI)
- вежливо и коротко:
  "Функция клона доступна только в Maker и только для вашего голоса/с разрешением владельца."
