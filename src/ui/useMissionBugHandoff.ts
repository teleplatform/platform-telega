"use client";

import { useEffect } from "react";

export function useMissionBugHandoff(
  setBugDraft: (v: string) => void,
  opts?: { onInserted?: (report: string) => void }
) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("handoff") !== "1") return;

    try {
      const raw = sessionStorage.getItem("telegpt_mission_handoff");
      if (!raw) return;

      const handoff = JSON.parse(raw);
      if (handoff?.kind !== "MISSION_HANDOFF_BUG_REPORT_V1") return;
      if (typeof handoff?.ts === "number" && Date.now() - handoff.ts > 5 * 60_000) {
        sessionStorage.removeItem("telegpt_mission_handoff");
        return;
      }

      const report = typeof handoff.report === "string" ? handoff.report : "";
      if (report) {
        setBugDraft(report);
        opts?.onInserted?.(report);
      }

      sessionStorage.removeItem("telegpt_mission_handoff");

      url.searchParams.delete("handoff");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, [setBugDraft]);
}
