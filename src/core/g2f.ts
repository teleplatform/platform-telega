import type { BuildTask } from "../types/telecore.js";

export type ForgeSpec = {
  skill_kind: "sales_followup" | "support_ticket" | "kb_update" | "code_change";
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
};

export function buildForgeSpecFromMessage(message: string): ForgeSpec | null {
  const m = message.toLowerCase();

  if (m.includes("follow up") || m.includes("email the customer")) {
    return {
      skill_kind: "sales_followup",
      title: "Prepare sales follow-up",
      description: "Draft a concise follow-up message for the customer",
    };
  }

  if (m.includes("open a ticket") || m.includes("support ticket")) {
    return {
      skill_kind: "support_ticket",
      title: "Open support ticket",
      description: "Create a support ticket with the user's issue summary",
    };
  }

  if (m.includes("update faq") || m.includes("update knowledge") || m.includes("kb")) {
    return {
      skill_kind: "kb_update",
      title: "Update knowledge base",
      description: "Propose a KB entry update based on recent Q&A",
    };
  }

  if (m.includes("fix this code") || m.includes("typescript error") || m.includes("patch")) {
    return {
      skill_kind: "code_change",
      title: "Code patch request",
      description: "Create a patch plan for the reported error",
    };
  }

  return null;
}

export function toBuildTask(spec: ForgeSpec, visibility: "public" | "creator" | "core" = "creator"): BuildTask {
  const now = Date.now();
  return {
    type: "build_task",
    version: "1.0",
    meta: {
      task_id: "auto",
      created_at: now,
      priority: "normal",
      mode: "smart",
      persona: "tele-gpt",
      ecosystem: "telega",
      visibility,
    },
    goal: {
      title: spec.title,
      description: spec.description,
    },
    spec,
  } as BuildTask;
}
