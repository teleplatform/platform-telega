"use client";

import { useEffect } from "react";
import { jumpTopActive } from "./activeSurface";

export default function ActiveSurfaceHost() {
  useEffect(() => {
    const onJumpTop = (e: any) => {
      const sourceId = e?.detail?.sourceId;
      jumpTopActive({ sourceId });
    };
    window.addEventListener("telegpt:textarea:jumpTop" as any, onJumpTop);
    return () => window.removeEventListener("telegpt:textarea:jumpTop" as any, onJumpTop);
  }, []);

  return null;
}
