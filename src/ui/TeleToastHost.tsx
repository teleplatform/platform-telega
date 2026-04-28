"use client";

import React from "react";
import Image from "next/image";
import { toast, type ToastPayload } from "./toastStore";
import { teleToastClassName } from "@/components/tele/TeleToast";

export function TeleToastHost() {
  const [t, setT] = React.useState<ToastPayload | null>(null);

  React.useEffect(() => toast.subscribe(setT), []);

  if (!t) return null;

  const isSuccess = t.kind === "success";

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        right: 12,
        zIndex: 9999,
        pointerEvents: "none",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`${teleToastClassName} flex items-center gap-3 p-3`}
        style={{
          pointerEvents: "auto",
          background: "rgba(16, 185, 129, 0.14)",
          border: "1px solid rgba(16, 185, 129, 0.28)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        {t.iconSrc ? (
          <Image src={t.iconSrc} alt="" width={28} height={28} style={{ borderRadius: 8 }} />
        ) : (
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: isSuccess ? "rgba(16,185,129,0.9)" : "rgba(59,130,246,0.9)",
            }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {t.title ? (
            <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 2 }}>{t.title}</div>
          ) : null}
          <div style={{ fontSize: 16, fontWeight: 700 }}>{t.message}</div>
        </div>

        <button
          type="button"
          onClick={() => toast.clear()}
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.20)",
            color: "rgba(255,255,255,0.9)",
          }}
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
