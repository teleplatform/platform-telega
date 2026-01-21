"use client";

import { TeleGlassPanel } from "@/components/tele/TeleGlassPanel";
import { TeleHeaderBar } from "@/components/tele/TeleHeaderBar";
import { TeleSecondaryButton } from "@/components/tele/TeleSecondaryButton";
import { TeleToggle } from "@/components/tele/TeleToggle";

export default function HeroBar(props: {
  title: string;
  mode: "public" | "maker";
  onModeChange: (m: "public" | "maker") => void;
  uiLang: "ru" | "uz" | "en";
  onUiLangChange: (l: "ru" | "uz" | "en") => void;
}) {
  const { title, mode, onModeChange, uiLang, onUiLangChange } = props;

  return (
    <TeleHeaderBar
      title={title}
      subtitle="Public / Maker split • non-chat screen"
      rightSlot={(
        <>
          <TeleGlassPanel className="p-0 px-3 h-10 flex items-center">
            <select
              value={uiLang}
              onChange={(e) => onUiLangChange(e.target.value as any)}
              className="h-10 tele-input text-sm outline-none"
            >
              <option value="ru">RU</option>
              <option value="uz">UZ</option>
              <option value="en">EN</option>
            </select>
          </TeleGlassPanel>

          <TeleToggle
            leftLabel="Public"
            rightLabel="Maker"
            checked={mode === "maker"}
            onCheckedChange={(v) => onModeChange(v ? "maker" : "public")}
          />

          <TeleSecondaryButton>
            Профиль / Войти
          </TeleSecondaryButton>
        </>
      )}
    />
  );
}
