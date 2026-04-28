"use client";

import { useEffect } from "react";

export function useForgeBuildTaskHandoff(setDraftTask: (v: any) => void) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("handoff") !== "1") return;

    try {
      const raw = sessionStorage.getItem("telegpt_forge_handoff");
      if (!raw) return;

      const handoff = JSON.parse(raw);
      if (handoff?.kind !== "FORGE_HANDOFF_BUILD_TASK_V1") return;

      setDraftTask(handoff.task);

      sessionStorage.removeItem("telegpt_forge_handoff");
      url.searchParams.delete("handoff");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, [setDraftTask]);
}
