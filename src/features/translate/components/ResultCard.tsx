"use client";

import { TeleGlassPanel } from "@/components/tele/TeleGlassPanel";
import { TelePrimaryButton } from "@/components/tele/TelePrimaryButton";
import { TeleSecondaryButton } from "@/components/tele/TeleSecondaryButton";
import type { Lang, StyleId } from "../types";
import { useMemo } from "react";
import { copyWithToast } from "@/ui/copy";

export default function ResultCard(props: {
  strings: any;
  status: "idle" | "typing" | "loading" | "success" | "error" | "empty";
  error: string | null;
  result: { translatedText: string; detectedLang?: Exclude<Lang, "auto"> } | null;
  sourceLang: Lang;
  targetLang: Exclude<Lang, "auto">;
  styleId: StyleId;
  mode: "public" | "maker";
}) {
  const { strings, status, error, result, sourceLang, targetLang, styleId, mode } = props;

  const header = useMemo(() => {
    const src = sourceLang === "auto" ? (result?.detectedLang ?? "auto") : sourceLang;
    return { style: styleId, langs: `${String(src).toUpperCase()} → ${String(targetLang).toUpperCase()}` };
  }, [sourceLang, targetLang, styleId, result]);

  async function copy() {
    const text = result?.translatedText ?? "";
    if (!text) return;
    await copyWithToast(text);
  }

  if (status === "idle" || status === "typing") {
    return null;
  }

  return (
    <TeleGlassPanel>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs text-muted-foreground">
          Стиль: <span className="text-foreground">{header.style}</span> • Языки:{" "}
          <span className="text-foreground">{header.langs}</span>
        </div>
      </div>

      {status === "loading" && (
        <div className="space-y-2">
          <div className="h-4 tele-glass" />
          <div className="h-4 tele-glass w-5/6" />
          <div className="h-4 tele-glass w-2/3" />
        </div>
      )}

      {status === "error" && (
        <div className="text-sm text-red-200">
          {mode === "public" ? "Ошибка перевода. Попробуй ещё раз." : (error ?? "Translate error")}
        </div>
      )}

      {status === "empty" && <div className="text-sm text-white/70">Ничего не переведено.</div>}

      {status === "success" && (
        <>
          <div className="whitespace-pre-wrap text-base leading-relaxed">
            {result?.translatedText}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <TeleSecondaryButton
              onClick={copy}
            >
              {strings.copy}
            </TeleSecondaryButton>

            <div className="flex gap-2">
              {mode === "maker" && (
                <TeleSecondaryButton>
                  В словарь
                </TeleSecondaryButton>
              )}
              <TelePrimaryButton>{strings.share}</TelePrimaryButton>
            </div>
          </div>
        </>
      )}
    </TeleGlassPanel>
  );
}
