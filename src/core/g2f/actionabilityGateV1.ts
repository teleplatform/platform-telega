export type ActionabilityGate = {
  ok: boolean;
  score: number;
  reason: string;
  task_kind?: "forge.build";
  task_title?: string;
  task_prompt?: string;
  artifacts_expected?: string[];
};

const HAS = (t: string, arr: string[]) => arr.some((x) => t.includes(x));

export function actionabilityGateV1(input: string, agentOutput?: string): ActionabilityGate {
  const t = `${input}\n${agentOutput ?? ""}`.toLowerCase();

  let score = 0;

  if (
    HAS(t, [
      "file:",
      "создай файл",
      "патч",
      "скрипт",
      "endpoint",
      "route",
      "docs/",
      "readme",
      ".ts",
      ".md",
      ".sh",
    ])
  ) {
    score += 30;
  }
  if (HAS(t, ["сделай", "реализуй", "добавь", "сгенерируй", "почини", "внедри", "собери"])) {
    score += 25;
  }
  if (HAS(t, ["forge", "g2f", "task", "artifact", "api", "sqlite", "supabase", "next.js", "traces"])) {
    score += 20;
  }
  if (HAS(t, ["контракт", "json", "status", "fields", "acceptance", "proof"])) {
    score += 15;
  }

  const ok = score >= 60;
  if (!ok) {
    return { ok: false, score, reason: "not_actionable_enough" };
  }

  return {
    ok: true,
    score,
    reason: "actionable",
    task_kind: "forge.build",
    task_title: "G2F: BuildTask from /v1/ask",
    task_prompt: `Собери Forge BuildTask: создай артефакты (plan + patch draft) по запросу:\n${input}`,
    artifacts_expected: ["plan.md", "patch.diff", "pack.json"],
  };
}
