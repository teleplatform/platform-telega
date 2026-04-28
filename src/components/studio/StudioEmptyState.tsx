"use client";

import React from "react";
import { TeleGlassPanel, TelePrimaryButton, TeleSecondaryButton, TeleChip } from "@/components/tele";
import { toast } from "@/ui/toastStore";

export type StudioIntent = "forge" | "translate" | "agents" | "devtools";

type Props = {
  intent: StudioIntent;
  onPrimary?: () => void;
  onSecondary?: () => void;
};

export default function StudioEmptyState({ intent, onPrimary, onSecondary }: Props) {
  const cfg = getIntentConfig(intent);

  return (
    <TeleGlassPanel strong className="telegpt-home w-full p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-lg font-semibold">{cfg.title}</div>
          <div className="text-sm text-muted-foreground">{cfg.subtitle}</div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <TeleChip label={`Mode: ${cfg.modeHint}`} active />
          <TeleChip label={`Intent: ${intent}`} active />
        </div>
      </div>

      <div className="grid gap-2">
        {cfg.bullets.map((b) => (
          <div key={b} className="text-sm text-muted-foreground">
            • {b}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <TelePrimaryButton
          className="px-5"
          onClick={() => {
            if (onPrimary) return onPrimary();
            toast.show({ kind: "success", message: cfg.primaryToast, durationMs: 1400 });
          }}
        >
          {cfg.primaryCta}
        </TelePrimaryButton>

        <TeleSecondaryButton
          className="px-5"
          onClick={() => {
            if (onSecondary) return onSecondary();
            toast.show({ kind: "info", message: cfg.secondaryToast, durationMs: 1600 });
          }}
        >
          {cfg.secondaryCta}
        </TeleSecondaryButton>
      </div>
    </TeleGlassPanel>
  );
}

function getIntentConfig(intent: StudioIntent) {
  switch (intent) {
    case "forge":
      return {
        title: "Forge • Первый запуск",
        subtitle: "Соберём задачу → запустим → получим артефакты (G2F lifecycle).",
        modeHint: "local",
        bullets: [
          "Создай первую BuildTask (коротко: что собрать и какой результат нужен).",
          "Проверь, что /v1/traces пишет provider=local и lane в meta.",
          "После done открой артефакты и лог — это твой “proof”.",
        ],
        primaryCta: "Создать BuildTask",
        secondaryCta: "Открыть последние таски",
        primaryToast: "BuildTask: draft created ✅ (дальше — wiring в ForgePanel)",
        secondaryToast: "Открою список задач (дальше — wiring в drawer/таб)",
      };

    case "translate":
      return {
        title: "Translate • Быстрый перевод",
        subtitle: "Вставь текст → выбери языки → получи результат + Copy toast.",
        modeHint: "cheap",
        bullets: [
          "Поддержка RU/UZ/EN уже есть, UI токены Tele•DNA подключены.",
          "Copy показывает toast — видно, что реально скопировал.",
          "Большие тексты редактируются плавно (FastTextArea).",
        ],
        primaryCta: "Открыть Translate",
        secondaryCta: "Показать модели",
        primaryToast: "Перехожу в Translate ✅ (дальше — переключение таба/роут)",
        secondaryToast: "Запрошу /v1/models ✅",
      };

    case "agents":
      return {
        title: "Agents • Шаблоны + Knowledge Pack",
        subtitle: "Intent → Lane → Provider chain → Fallback → Truth в traces.",
        modeHint: "smart",
        bullets: [
          "Есть Sales/Support templates + KB injection.",
          "Intent-2: keyword → LLM (при низкой уверенности).",
          "Policy Router v1 логирует lane/intent/fallback/circuit.",
        ],
        primaryCta: "Создать агент-шаблон",
        secondaryCta: "Открыть Knowledge Packs",
        primaryToast: "Agent template: draft created ✅",
        secondaryToast: "Открою KB screen ✅",
      };

    case "devtools":
    default:
      return {
        title: "DevTools • Skill Packs",
        subtitle: "Skills как “lint мозга”: React/Next best practices и канон-валидации.",
        modeHint: "coding",
        bullets: [
          "Skills должны быть воспроизводимыми (SKILL.md + scripts + validators).",
          "Maker/Public правила — через policy, не через “прошу модель”.",
          "Логи и статус — через Tele•Core Contract.",
        ],
        primaryCta: "Открыть Skills",
        secondaryCta: "Импортировать react-best-practices",
        primaryToast: "Открою Skills ✅",
        secondaryToast: "Запущу add-skill (дальше — wiring в UI/CLI) ✅",
      };
  }
}
