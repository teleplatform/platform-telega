"use client";

import { TeleGlassPanel } from "@/components/tele/TeleGlassPanel";
import { TelePrimaryButton } from "@/components/tele/TelePrimaryButton";

export default function SourceInput(props: {
  strings: any;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  canTranslate: boolean;
  onTranslate: () => void;
  mode: "public" | "maker";
}) {
  const { strings, value, onChange, disabled, canTranslate, onTranslate } = props;

  const chars = value.length;

  return (
    <div className="space-y-2">
      <TeleGlassPanel className="p-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={strings.placeholder}
          disabled={disabled}
          className="w-full min-h-[180px] tele-input outline-none"
        />
      </TeleGlassPanel>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button className="text-sm text-muted-foreground hover:text-foreground" type="button">
            📋 Вставить
          </button>
          <button className="text-sm text-muted-foreground" type="button" disabled title={strings.comingSoon}>
            🎙️ {strings.comingSoon}
          </button>
          <button className="text-sm text-muted-foreground" type="button" disabled title={strings.comingSoon}>
            🖼️ {strings.comingSoon}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">{strings.chars(chars)}</div>
          <TelePrimaryButton
            onClick={onTranslate}
            disabled={!canTranslate || disabled}
          >
            {strings.translate}
          </TelePrimaryButton>
        </div>
      </div>
    </div>
  );
}
