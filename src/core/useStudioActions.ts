"use client";

import { useCallback } from "react";
import { toast } from "@/ui/toastStore";

type StudioIntent = "forge" | "translate" | "agents" | "devtools";

type Actions = {
  openIntent(intent: StudioIntent): void;
  primary(intent: StudioIntent): Promise<void>;
  secondary(intent: StudioIntent): Promise<void>;
};

async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs = 8000
): Promise<{ ok: boolean; status: number; json?: T; text?: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const json = (await res.json()) as T;
      return { ok: res.ok, status: res.status, json };
    }
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(t);
  }
}

function fire(name: string, detail?: any) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function useStudioActions(setTab: (tab: string) => void): Actions {
  const openIntent = useCallback(
    (intent: StudioIntent) => {
      if (intent === "forge") setTab("forge");
      else if (intent === "translate") setTab("skills");
      else if (intent === "agents") setTab("skills");
      else setTab("skills");
    },
    [setTab]
  );

  const primary = useCallback(
    async (intent: StudioIntent) => {
      if (intent === "forge") {
        setTab("forge");

        const r = await postJson<{ task_id?: string; id?: string }>(
          "/api/v1/forge/tasks/create",
          {
            title: "First BuildTask",
            spec: "Create a minimal verified artifact (hello.txt) to prove G2F lifecycle.",
            source: "studio-empty-state",
          },
          9000
        );

        if (r.ok) {
          const taskId = r.json?.task_id || r.json?.id;
          toast.show({
            kind: "success",
            message: taskId ? `BuildTask created ✅ ${taskId}` : "BuildTask created ✅",
            durationMs: 1800,
          });
          fire("telegpt:forge:focusTask", { taskId });
          return;
        }

        toast.show({
          kind: "info",
          message:
            r.status === 404 || r.status === 0
              ? "Forge открыт ✅ (endpoint create-task пока недоступен)"
              : `Forge открыт ✅ (create-task вернул ${r.status})`,
          durationMs: 2200,
        });
        return;
      }

      if (intent === "translate") {
        setTab("skills");
        fire("telegpt:translate:focus");
        toast.show({ kind: "success", message: "Translate открыт ✅", durationMs: 1400 });
        return;
      }

      if (intent === "agents") {
        setTab("skills");
        fire("telegpt:agents:newTemplate");
        toast.show({ kind: "success", message: "Agents: template draft ✅", durationMs: 1600 });
        return;
      }

      setTab("skills");
      fire("telegpt:skills:open");
      toast.show({ kind: "success", message: "Skills открыт ✅", durationMs: 1400 });
    },
    [setTab]
  );

  const secondary = useCallback(
    async (intent: StudioIntent) => {
      if (intent === "forge") {
        setTab("forge");
        fire("telegpt:forge:openTasks");
        toast.show({ kind: "info", message: "Открываю последние таски…", durationMs: 1600 });
        return;
      }

      if (intent === "translate") {
        const ok = await fetch("/api/v1/models", { cache: "no-store" })
          .then((r) => r.ok)
          .catch(() => false);

        toast.show({
          kind: ok ? "success" : "error",
          message: ok ? "Models OK ✅" : "Models недоступны ❌",
          durationMs: 1700,
        });
        return;
      }

      if (intent === "agents") {
        setTab("skills");
        fire("telegpt:kb:open");
        toast.show({ kind: "info", message: "Открываю Knowledge Packs…", durationMs: 1700 });
        return;
      }

      setTab("skills");
      fire("telegpt:skills:import", { skill: "react-next-best-practices" });
      toast.show({ kind: "info", message: "Импорт skill: подготовлено ✅", durationMs: 1800 });
    },
    [setTab]
  );

  return { openIntent, primary, secondary };
}
