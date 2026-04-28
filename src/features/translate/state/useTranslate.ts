"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { copyWithToast } from "@/ui/copy";

type Mode = "public" | "maker";
type Format = "plain" | "ui_strings" | "json";

export function useTranslate() {
  const [mode, setMode] = useState<Mode>("public");
  const [format, setFormat] = useState<Format>("plain");

  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");

  const [styleId, setStyleId] = useState("natural");

  const [sourceText, setSourceTextState] = useState("");
  const [inputVersion, setInputVersion] = useState(0);
  const sourceTextRef = useRef("");
  const [result, setResult] = useState<string>("");

  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const canTranslate = useMemo(() => sourceText.trim().length > 0 && state !== "loading", [sourceText, state]);

  const clear = useCallback(() => {
    setSourceTextState("");
    setResult("");
    setState("idle");
    sourceTextRef.current = "";
    setInputVersion((v) => v + 1);
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

  const translate = useCallback(async (overrideText?: string) => {
    setState("loading");
    try {
      const input = (overrideText ?? sourceText).trim();
      if (!input) {
        setState("idle");
        return;
      }
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
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

  const setSourceText = useCallback((v: string) => {
    sourceTextRef.current = v;
    setSourceTextState(v);
  }, []);

  const copyResult = useCallback(async () => {
    if (!result) return;
    await copyWithToast(result);
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
    sourceTextRef,
    inputVersion,
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
