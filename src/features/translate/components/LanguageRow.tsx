"use client";

import type { Lang } from "../types";
import { TeleGlassPanel } from "@/components/tele/TeleGlassPanel";
import { TeleSecondaryButton } from "@/components/tele/TeleSecondaryButton";

const LANGS: { id: Lang; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "ru", label: "RU" },
  { id: "uz", label: "UZ" },
  { id: "en", label: "EN" },
];

export default function LanguageRow(props: {
  strings: any;
  sourceLang: Lang;
  targetLang: Exclude<Lang, "auto">;
  onSourceLang: (l: Lang) => void;
  onTargetLang: (l: Exclude<Lang, "auto">) => void;
  onSwap: () => void;
}) {
  const { strings, sourceLang, targetLang, onSourceLang, onTargetLang, onSwap } = props;

  return (
    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
      <div className="flex-1">
        <div className="text-xs text-muted-foreground mb-1">{strings.source}</div>
        <TeleGlassPanel className="p-0 px-3 h-11 flex items-center">
          <select
            value={sourceLang}
            onChange={(e) => onSourceLang(e.target.value as Lang)}
            className="w-full h-11 tele-input outline-none"
          >
            <option value="auto">{strings.detect}</option>
            {LANGS.filter(x => x.id !== "auto").map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </TeleGlassPanel>
      </div>

      <TeleSecondaryButton
        onClick={onSwap}
        type="button"
        className="h-11 px-4 md:mt-6"
        title="Swap"
      >
        ↔
      </TeleSecondaryButton>

      <div className="flex-1">
        <div className="text-xs text-muted-foreground mb-1">{strings.target}</div>
        <TeleGlassPanel className="p-0 px-3 h-11 flex items-center">
          <select
            value={targetLang}
            onChange={(e) => onTargetLang(e.target.value as any)}
            className="w-full h-11 tele-input outline-none"
          >
            {LANGS.filter(x => x.id !== "auto").map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </TeleGlassPanel>
      </div>
    </div>
  );
}
