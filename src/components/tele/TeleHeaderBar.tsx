"use client";

import Image from "next/image";
import { TeleGlassPanel } from "./TeleGlassPanel";

let lastTap = 0;
function onHeaderTap() {
  const now = Date.now();
  if (now - lastTap < 280) {
    window.dispatchEvent(new CustomEvent("telegpt:textarea:jumpTop" as any, { detail: { sourceId: "TeleHeaderBar:doubleTap" } }));
    lastTap = 0;
    return;
  }
  lastTap = now;
}

export function TeleHeaderBar(props: { title: string; right?: React.ReactNode }) {
  return (
    <TeleGlassPanel
      strong
      className="px-4 py-4 flex items-center justify-between"
      onPointerUp={onHeaderTap}
    >
      <div className="flex items-center gap-3">
        <Image
          src="/brand/telegpt-logo.png"
          alt="Tele•GPT"
          width={26}
          height={26}
          priority
          style={{ borderRadius: 8 }}
        />
        <div className="text-base font-semibold">{props.title}</div>
      </div>
      <div className="flex items-center gap-2">{props.right}</div>
    </TeleGlassPanel>
  );
}
