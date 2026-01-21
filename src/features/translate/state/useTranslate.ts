"use client";

import { useCallback, useMemo, useState } from "react";

type Mode = "public" | "maker";
type Format = "plain" | "ui_strings" | "json";

export function useTranslate() {
  const [mode, setMode] = useState<Mode>("public");
  const [format, setFormat] = useState<Format>("plain");

  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");

  const [styleId, setStyleId] = useState("natural");

  const [sourceText, setSourceText] = useState("");
  const [result, setResult] = useState<string>("");

  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const canTranslate = useMemo(() => sourceText.trim().length > 0 && state !== "loading", [sourceText, state]);

  const clear = useCallback(() => {
    setSourceText("");
    setResult("");
    setState("idle");
  }, []);

  const swapLangs = useCallback(() => {
    // Канон: если source = auto, то swap делает source=target, target остаётся (не уходим в auto)
    if (sourceLang === "auto") {
      setSourceLang(targetLang);
      setTargetLang("en");
      return;
    }
    const a = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(a);
  }, [sourceLang, targetLang]);

  const translate = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText }),
      });

      if (!res.ok) {
        setState("error");
        return;
      }

      const data = await res.json();

      setResult(data.translatedText || "");
      setState("success");
    } catch {
      setState("error");
    }
  }, [sourceText]);

  const copyResult = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
    } catch {
      // игнор
    }
  }, [result]);

  const shareResult = useCallback(async () => {
    if (!result) return;
    // мягкий share: если есть Web Share API — используем
    // иначе просто копируем
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav: any = navigator;
    if (nav?.share) {
      try {
        await nav.share({ text: result });
        return;
      } catch {}
    }
    await copyResult();
  }, [result, copyResult]);

  return {
    mode,
    setMode,
    format,
    setFormat,

    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,

    styleId,
    setStyleId,

    sourceText,
    setSourceText,
    result,

    state,
    canTranslate,

    clear,
    swapLangs,
    translate,
    copyResult,
    shareResult,
  };
}
