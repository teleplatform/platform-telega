"use client";

import type { StyleId, Format } from "../types";
import { TeleChip } from "@/components/tele/TeleChip";

const PUBLIC: { id: StyleId; label: string }[] = [
  { id: "none", label: "Без стиля" },
  { id: "natural", label: "Сделай естественно" },
  { id: "formal", label: "Официально" },
  { id: "simple", label: "Просто и понятно" },
  { id: "academic", label: "Академично" },
  { id: "marketing", label: "Маркетинг / продающе" },
  { id: "short", label: "Коротко" },
  { id: "uz_colloquial", label: "Узбекский разговорный" },
  { id: "ru_business", label: "Русский деловой" },
  { id: "telegram", label: "Telegram-стиль" },
];

const MAKER: { id: StyleId; label: string; format?: Format }[] = [
  { id: "ui_strings", label: "UI Strings", format: "ui_strings" },
  { id: "json_csv_batch", label: "JSON/CSV batch", format: "json" },
  { id: "tele_ga_voice", label: "Brand voice: Tele•Ga" },
];

export default function StyleChips(props: {
  strings: any;
  mode: "public" | "maker";
  styleId: StyleId;
  onStyle: (s: StyleId) => void;
  onFormat: (f: Format) => void;
  disabled: boolean;
}) {
  const { strings, mode, styleId, onStyle, disabled, onFormat } = props;

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">{strings.style}</div>
      <div className="flex flex-wrap gap-2">
        {PUBLIC.map((c) => (
          <TeleChip
            key={c.id}
            label={c.label}
            active={styleId === c.id}
            disabled={disabled}
            onClick={() => {
              onFormat("plain");
              onStyle(c.id);
            }}
          />
        ))}

        {mode === "maker" && (
          <>
            <div className="w-full h-px tele-glass my-2" />
            {MAKER.map((c) => (
              <TeleChip
                key={c.id}
                label={c.label}
                active={styleId === c.id}
                disabled={disabled}
                onClick={() => {
                  if (c.format) onFormat(c.format);
                  onStyle(c.id);
                }}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
