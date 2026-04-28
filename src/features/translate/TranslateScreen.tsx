"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TeleGlassPanel,
  TeleHeaderBar,
  TeleChip,
  TelePrimaryButton,
  TeleSecondaryButton,
} from "@/components/tele";
import { useTranslate } from "./state/useTranslate";
import FastTextArea, { type FastTextAreaHandle } from "@/ui/FastTextArea";
import { jumpTopActive } from "@/ui/activeSurface";

const LANGS = [
  { code: "auto", label: "Автоопределение" },
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
  { code: "uz", label: "O‘zbek (Latin)" },
];

const STYLES = [
  { id: "natural", label: "Сделай естественно" },
  { id: "formal", label: "Официально" },
  { id: "simple", label: "Просто и понятно" },
  { id: "academic", label: "Академично" },
  { id: "marketing", label: "Маркетинг / продающе" },
  { id: "short", label: "Коротко" },
  { id: "tg", label: "Telegram-стиль" },
];

export default function TranslateScreen() {
  const t = useTranslate();
  const inputRef = useRef<FastTextAreaHandle | null>(null);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    const onFocus = () => {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener("telegpt:translate:focus" as any, onFocus);
    return () => window.removeEventListener("telegpt:translate:focus" as any, onFocus);
  }, []);

  const sourceLabel = useMemo(
    () => LANGS.find((l) => l.code === t.sourceLang)?.label ?? "Автоопределение",
    [t.sourceLang]
  );
  const targetLabel = useMemo(
    () => LANGS.find((l) => l.code === t.targetLang)?.label ?? "English",
    [t.targetLang]
  );

  return (
    <div className="min-h-screen tele-bg text-foreground">
      <div className="mx-auto w-full max-w-[980px] px-4 py-6 space-y-4">
        <TeleHeaderBar
          title="Tele•GPT Translate"
          right={
            <div className="flex items-center gap-2">
              <TeleChip
                active={t.mode === "public"}
                onClick={() => t.setMode("public")}
                label="Public"
              />
              <TeleChip
                active={t.mode === "maker"}
                onClick={() => t.setMode("maker")}
                label="Maker"
              />
              <TeleSecondaryButton onClick={() => {}} className="px-4">
                Профиль
              </TeleSecondaryButton>
            </div>
          }
        />

        {/* Language row */}
        <TeleGlassPanel className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm text-white/70">Откуда:</div>
            <select
              value={t.sourceLang}
              onChange={(e) => t.setSourceLang(e.target.value)}
              className="tele-glass rounded-full px-4 py-2 text-sm outline-none"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={t.swapLangs}
              className="tele-glass rounded-full px-4 py-2 text-sm hover:bg-white/10"
              title="Поменять местами"
            >
              ↔
            </button>

            <div className="text-sm text-white/70">Куда:</div>
            <select
              value={t.targetLang}
              onChange={(e) => t.setTargetLang(e.target.value)}
              className="tele-glass rounded-full px-4 py-2 text-sm outline-none"
            >
              {LANGS.filter((x) => x.code !== "auto").map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>

            <div className="ml-auto text-xs text-white/50">
              {sourceLabel} → {targetLabel}
            </div>
          </div>
        </TeleGlassPanel>

        {/* Input */}
        <TeleGlassPanel className="p-4 space-y-3">
          <div className="text-sm text-white/70">Текст</div>
          {showJump && (
            <button
              type="button"
              className="text-xs opacity-80 hover:opacity-100"
              onClick={() => jumpTopActive({ preferId: "translate-input", sourceId: "JumpButton:translate" })}
            >
              ↑ к началу
            </button>
          )}
          <FastTextArea
            key={t.inputVersion}
            defaultValue={t.sourceText}
            ref={inputRef}
            onChangeDebounced={t.setSourceText}
            onScrollStateChange={(top) => setShowJump(top > 120)}
            placeholder="Вставь текст для перевода"
            surfaceId="translate-input"
            rememberScroll
            className="telegpt-fasttext tele-glass w-full min-h-[220px] max-h-[220px] rounded-[var(--radius-input)] p-3 text-[15px] leading-6 text-foreground placeholder:text-white/35"
          />
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>{t.sourceText.length} символов</span>
            <div className="flex items-center gap-2">
              <TeleSecondaryButton onClick={t.clear} className="px-4">
                Очистить
              </TeleSecondaryButton>
                <TelePrimaryButton
                  disabled={!t.canTranslate}
                  onClick={() => t.translate(inputRef.current?.getText() ?? t.sourceText)}
                  className="px-5"
                >
                  Перевести
                </TelePrimaryButton>
            </div>
          </div>
        </TeleGlassPanel>

        {/* Style chips */}
        <TeleGlassPanel className="p-4">
          <div className="text-sm text-white/70 mb-3">Стиль</div>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <TeleChip
                key={s.id}
                active={t.styleId === s.id}
                onClick={() => t.setStyleId(s.id)}
                label={s.label}
              />
            ))}
            {t.mode === "maker" && (
              <>
                <TeleChip
                  active={t.format === "ui_strings"}
                  onClick={() => t.setFormat("ui_strings")}
                  label="UI Strings"
                />
                <TeleChip
                  active={t.format === "json"}
                  onClick={() => t.setFormat("json")}
                  label="JSON/CSV batch"
                />
                <TeleChip
                  active={t.styleId === "brand"}
                  onClick={() => t.setStyleId("brand")}
                  label="Brand voice: Tele•Ga"
                />
              </>
            )}
          </div>
        </TeleGlassPanel>

        {/* Result */}
        {(t.state !== "idle" || t.result) && (
          <TeleGlassPanel className="p-4 tele-glow">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="text-xs text-white/60">
                Стиль: <span className="text-white/80">{t.styleId}</span>{" "}
                • Формат: <span className="text-white/80">{t.format}</span>
              </div>
              <div className="flex items-center gap-2">
                <TeleSecondaryButton onClick={t.copyResult} className="px-4">
                  Копировать
                </TeleSecondaryButton>
                <TeleSecondaryButton onClick={t.shareResult} className="px-4">
                  Поделиться
                </TeleSecondaryButton>
                {t.mode === "maker" && (
                  <TeleSecondaryButton onClick={() => {}} className="px-4">
                    В словарь
                  </TeleSecondaryButton>
                )}
              </div>
            </div>

            {t.state === "loading" ? (
              <div className="space-y-2">
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="h-4 w-4/5 rounded bg-white/10" />
                <div className="h-4 w-1/2 rounded bg-white/10" />
              </div>
            ) : t.state === "error" ? (
              <div className="text-sm text-red-300">
                Ошибка перевода. Попробуй ещё раз.
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-[15px] leading-6">
                {t.result}
              </div>
            )}
          </TeleGlassPanel>
        )}

        {/* How it works */}
        <TeleGlassPanel className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="tele-glass rounded-2xl p-4">
              <div className="text-white/80 font-medium">1) Добавь текст</div>
              <div className="text-white/60 mt-1">Вставь или набери — без чата.</div>
            </div>
            <div className="tele-glass rounded-2xl p-4">
              <div className="text-white/80 font-medium">2) Перевод мгновенно</div>
              <div className="text-white/60 mt-1">Стиль задаётся чипами.</div>
            </div>
            <div className="tele-glass rounded-2xl p-4">
              <div className="text-white/80 font-medium">3) Уточняй смысл</div>
              <div className="text-white/60 mt-1">Public/Maker — один дизайн, разные силы.</div>
            </div>
          </div>
        </TeleGlassPanel>
      </div>
    </div>
  );
}
