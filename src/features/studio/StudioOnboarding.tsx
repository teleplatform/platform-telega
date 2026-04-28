"use client";

import { useEffect, useMemo, useState } from "react";
import { TeleChip, TeleGlassPanel, TelePrimaryButton, TeleSecondaryButton } from "@/components/tele";
import { toast } from "@/ui/toastStore";

type OnboardGoal = "build" | "translate" | "agents" | "devtools";
type RunMode = "local" | "cloud";
type Step = "welcome" | "mode" | "goal" | "check";
type CheckState = "idle" | "ok" | "fail";

type Props = {
  onDone: (goal: OnboardGoal, runMode: RunMode) => void;
};


async function checkOk(url: string, timeoutMs = 3500): Promise<boolean> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    return !!res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export default function StudioOnboarding({ onDone }: Props) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [runMode, setRunMode] = useState<RunMode>("local");
  const [goal, setGoal] = useState<OnboardGoal>("build");

  const [health, setHealth] = useState<CheckState>("idle");
  const [traces, setTraces] = useState<CheckState>("idle");
  const [models, setModels] = useState<CheckState>("idle");

  useEffect(() => setMounted(true), []);

  const shouldShow = useMemo(() => {
    return mounted;
  }, [mounted]);

  // Mode step: show a lightweight "models" reachability signal (local endpoint proxy)
  useEffect(() => {
    if (!shouldShow) return;
    if (step !== "mode") return;

    let alive = true;
    setModels("idle");

    (async () => {
      const ok = await checkOk("/api/v1/models", 3500);
      if (!alive) return;
      setModels(ok ? "ok" : "fail");
    })();

    return () => {
      alive = false;
    };
  }, [step, shouldShow]);

  // Check step: run all checks
  useEffect(() => {
    if (!shouldShow) return;
    if (step !== "check") return;

    let alive = true;
    setHealth("idle");
    setTraces("idle");
    setModels("idle");

    (async () => {
      const [h, t, m] = await Promise.all([
        checkOk("/api/v1/health", 3500),
        checkOk("/api/v1/traces?limit=1", 3500),
        checkOk("/api/v1/models", 3500),
      ]);

      if (!alive) return;
      setHealth(h ? "ok" : "fail");
      setTraces(t ? "ok" : "fail");
      setModels(m ? "ok" : "fail");
    })();

    return () => {
      alive = false;
    };
  }, [step, shouldShow]);

  if (!shouldShow) return null;

  function finish() {
    toast.show({ kind: "success", message: "Studio ready ✅", durationMs: 1600 });
    onDone(goal, runMode);
  }

  return (
    <div className="telegpt-onboard fixed inset-0 z-[9998] bg-black/95 text-foreground">
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <TeleGlassPanel strong className="w-full max-w-xl space-y-4 p-5">
          {step === "welcome" && (
            <>
              <div className="text-lg font-semibold">Добро пожаловать в Studio</div>
              <div className="text-sm text-muted-foreground">
                Studio — место где Tele•GPT строит задачи, запускает агента и отдаёт артефакты.
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <TelePrimaryButton className="px-5" onClick={() => setStep("check")}>
                  Start in 30s
                </TelePrimaryButton>
                <TeleSecondaryButton className="px-5" onClick={() => setStep("mode")}>
                  I’ll configure
                </TeleSecondaryButton>
              </div>
            </>
          )}

          {step === "mode" && (
            <>
              <div className="text-lg font-semibold">Выбери режим запуска</div>

              <div className="flex flex-wrap gap-2">
                <TeleChip label="Local (recommended)" active={runMode === "local"} onClick={() => setRunMode("local")} />
                <TeleChip label="Cloud" active={runMode === "cloud"} onClick={() => setRunMode("cloud")} />
              </div>

              <div className="text-xs text-muted-foreground">
                {runMode === "local" ? "быстрее, приватнее, без ключей" : "везде работает, нужна конфигурация ключей"}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <StatusLine label="Local endpoint (/models)" state={models} />
                <StatusLine
                  label="Cloud keys"
                  state={runMode === "cloud" ? "fail" : "ok"}
                  note={runMode === "cloud" ? "set in .env" : "not needed"}
                />
              </div>

              <div className="flex items-center gap-2">
                <TeleSecondaryButton className="px-4" onClick={() => setStep("welcome")}>
                  Back
                </TeleSecondaryButton>
                <TelePrimaryButton className="px-4" onClick={() => setStep("goal")}>
                  Continue
                </TelePrimaryButton>
              </div>
            </>
          )}

          {step === "goal" && (
            <>
              <div className="text-lg font-semibold">Что ты хочешь делать в Studio?</div>

              <div className="flex flex-wrap gap-2">
                <TeleChip label="Build (G2F)" active={goal === "build"} onClick={() => setGoal("build")} />
                <TeleChip label="Translate" active={goal === "translate"} onClick={() => setGoal("translate")} />
                <TeleChip label="Agents" active={goal === "agents"} onClick={() => setGoal("agents")} />
                <TeleChip label="DevTools" active={goal === "devtools"} onClick={() => setGoal("devtools")} />
              </div>

              <div className="flex items-center gap-2">
                <TeleSecondaryButton className="px-4" onClick={() => setStep("mode")}>
                  Back
                </TeleSecondaryButton>
                <TelePrimaryButton className="px-4" onClick={() => setStep("check")}>
                  Continue
                </TelePrimaryButton>
              </div>
            </>
          )}

          {step === "check" && (
            <>
              <div className="text-lg font-semibold">Быстрая проверка</div>

              <div className="space-y-1 text-sm text-muted-foreground">
                <StatusLine label="/health" state={health} />
                <StatusLine label="/v1/traces" state={traces} />
                <StatusLine label="providers (/models)" state={models} />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <TelePrimaryButton className="px-5" onClick={finish}>
                  Open Studio
                </TelePrimaryButton>
                <TeleSecondaryButton className="px-5" onClick={finish}>
                  Skip (I know what I’m doing)
                </TeleSecondaryButton>
              </div>
            </>
          )}
        </TeleGlassPanel>
      </div>
    </div>
  );
}

function StatusLine({ label, state, note }: { label: string; state: CheckState; note?: string }) {
  const text = state === "ok" ? "OK" : state === "fail" ? "Not reachable" : "Checking...";
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span>
        {text}
        {note ? ` · ${note}` : ""}
      </span>
    </div>
  );
}
