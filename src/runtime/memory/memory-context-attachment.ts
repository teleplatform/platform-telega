/**
 * TGR-6.94 — Memory Context Attachment Core
 *
 * Message In → Identity + Surface + Project + Task + Memory → LLM
 */

import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getRecentTurns, getSessionSummary } from "./session-memory.js";
import { getOperationalSummary, getSessionSummary as getOpsSessionSummary } from "./operational-memory.js";
import { getMemory } from "./runtime-memory-store.js";

export type UserRole = "creator" | "user" | "system";
export type SurfaceType = "telegram" | "web" | "voice" | "kilocode" | "api";
export type ProjectId =
  | "telegpt"
  | "sigma_forge"
  | "telega"
  | "tattoo_cyborg"
  | "yt_forge"
  | "mission_control"
  | "unknown";

export type TaskStatus = "open" | "done" | "blocked";

export interface UserIdentity {
  user_id: string;
  telegram_id?: string;
  web_session_id?: string;
  display_name?: string;
  role: UserRole;
}

export interface SurfaceContext {
  surface: SurfaceType;
  chat_id?: string;
  message_id?: string;
  thread_id?: string;
}

export interface ProjectContext {
  project: ProjectId;
  confidence: number;
  reason: string;
}

export interface TaskContext {
  task_id: string;
  intent: string;
  active_pack?: string;
  related_files?: string[];
  status: TaskStatus;
}

export interface MemoryAttachment {
  user: UserIdentity;
  surface: SurfaceContext;
  project: ProjectContext;
  task: TaskContext;
  canonical_keys: string[];
  evidence_refs: string[];
  short_context: string[];
  working_context: string[];
}

export interface AttachMemoryContextInput {
  message: string;
  surface: SurfaceType;
  user_id?: string;
  telegram_id?: string;
  web_session_id?: string;
  display_name?: string;
  role?: UserRole;
  chat_id?: string;
  message_id?: string;
  thread_id?: string;
  trace_id?: string;
}

interface ProjectRule {
  project: ProjectId;
  patterns: RegExp[];
  weight: number;
  reason: string;
}

const PROJECT_RULES: ProjectRule[] = [
  {
    project: "telegpt",
    patterns: [/kilo\s*code|kilocode|telegpt_execute|telegpt_patch|mcp\s+gateway/i, /tele[•·.]?gpt/i],
    weight: 0.9,
    reason: "KiloCode / Tele•GPT execution keywords",
  },
  {
    project: "sigma_forge",
    patterns: [/sigma[\s_-]?forge|forge[\s_-]?bridge|build[\s_-]?task|dag[\s_-]?wave/i],
    weight: 0.85,
    reason: "Sigma Forge / build pipeline keywords",
  },
  {
    project: "telega",
    patterns: [/telega|tele[•·.]?ga\s+module/i],
    weight: 0.8,
    reason: "Tele•Ga module keywords",
  },
  {
    project: "tattoo_cyborg",
    patterns: [/tattoo|cyborg/i],
    weight: 0.75,
    reason: "Tattoo Cyborg keywords",
  },
  {
    project: "yt_forge",
    patterns: [/yt[\s_-]?forge|youtube\s+forge/i],
    weight: 0.75,
    reason: "YT Forge keywords",
  },
  {
    project: "mission_control",
    patterns: [/mission[\s_-]?control|buildtask|kca[\s_-]?\d/i],
    weight: 0.7,
    reason: "Mission Control keywords",
  },
];

const CANONICAL_KEYS: Record<ProjectId, string[]> = {
  telegpt: ["canon.telegpt.core", "canon.kilocode.mcp", "canon.telegram.delivery"],
  sigma_forge: ["canon.sigma_forge.build", "canon.forge_bridge.executor"],
  telega: ["canon.telega.module"],
  tattoo_cyborg: ["canon.tattoo.cyborg"],
  yt_forge: ["canon.yt_forge"],
  mission_control: ["canon.mission_control.ops"],
  unknown: ["canon.telegpt.core"],
};

const activeTasks = new Map<string, TaskContext>();

function taskKey(userId: string, chatId?: string): string {
  return `${userId}:${chatId ?? "default"}`;
}

function resolveUser(input: AttachMemoryContextInput): UserIdentity {
  const user_id = String(input.user_id ?? input.telegram_id ?? input.web_session_id ?? "anonymous");
  return {
    user_id,
    telegram_id: input.telegram_id,
    web_session_id: input.web_session_id,
    display_name: input.display_name,
    role: input.role ?? "user",
  };
}

function resolveSurface(input: AttachMemoryContextInput): SurfaceContext {
  return {
    surface: input.surface,
    chat_id: input.chat_id,
    message_id: input.message_id,
    thread_id: input.thread_id,
  };
}

export function resolveProjectFromMessage(message: string): ProjectContext {
  const text = String(message || "");
  let best: ProjectContext = {
    project: "unknown",
    confidence: 0.2,
    reason: "no project keywords matched",
  };

  for (const rule of PROJECT_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      const confidence = rule.weight;
      if (confidence > best.confidence) {
        best = { project: rule.project, confidence, reason: rule.reason };
      }
    }
  }

  return best;
}

function inferIntent(message: string, project: ProjectId): string {
  const text = message.toLowerCase();
  if (/patch|apply|rollback|modify|измени|патч/i.test(text)) return "modify_repo";
  if (/build|create|generate|создай|сгенерируй|проект/i.test(text)) return "build_project";
  if (/kilo|execute|mcp/i.test(text)) return "kilo_execute";
  if (project === "sigma_forge") return "forge_build";
  return "chat";
}

function resolveOrCreateTask(
  user: UserIdentity,
  surface: SurfaceContext,
  message: string,
  project: ProjectContext,
): TaskContext {
  const key = taskKey(user.user_id, surface.chat_id);
  const existing = activeTasks.get(key);
  const intent = inferIntent(message, project.project);

  const isKiloOrForge =
    project.project === "telegpt" ||
    project.project === "sigma_forge" ||
    /kilo|forge|patch|build|execute/i.test(message);

  if (isKiloOrForge && intent !== "chat") {
    const task: TaskContext = {
      task_id: existing?.status === "open" ? existing.task_id : `task_${Date.now().toString(36)}`,
      intent,
      active_pack: project.project === "sigma_forge" ? "sigma_forge_default" : "kilocode_mcp",
      related_files: extractRelatedFiles(message),
      status: "open",
    };
    activeTasks.set(key, task);
    return task;
  }

  if (existing?.status === "open") {
    return existing;
  }

  const chatTask: TaskContext = {
    task_id: `task_${Date.now().toString(36)}`,
    intent: "chat",
    status: "open",
  };
  activeTasks.set(key, chatTask);
  return chatTask;
}

function extractRelatedFiles(message: string): string[] | undefined {
  const paths = message.match(/(?:[\w.-]+\/)+[\w.-]+\.\w{1,8}/g);
  return paths?.length ? [...new Set(paths)].slice(0, 10) : undefined;
}

function loadWorkingContext(surface: SurfaceContext): { short: string[]; working: string[] } {
  const short: string[] = [];
  const working: string[] = [];

  try {
    if (surface.chat_id) {
      const turns = getRecentTurns(surface.chat_id, 3);
      for (const t of turns) {
        short.push(`${t.role}: ${t.content.slice(0, 160)}`);
      }
      const summary = getSessionSummary(surface.chat_id);
      if (summary && summary !== "No conversation history.") {
        working.push(summary);
      }
      const opsSummary = getOpsSessionSummary(surface.chat_id);
      if (opsSummary) {
        working.push(opsSummary);
      }
    }

    const ops = getOperationalSummary();
    if (ops.trim()) {
      working.push(ops.slice(0, 800));
    }

    const packMem = getMemory("active.pack");
    if (packMem?.value) {
      working.push(`active_pack: ${String(packMem.value)}`);
    }
  } catch {
    // empty memory store — non-fatal
  }

  return { short, working };
}

function buildEvidenceRefs(traceId: string, project: ProjectContext): string[] {
  return [
    `trace:${traceId}`,
    `project:${project.project}`,
    `confidence:${project.confidence.toFixed(2)}`,
  ];
}

/**
 * Attach memory context to an incoming message (never throws).
 */
export async function attachMemoryContext(input: AttachMemoryContextInput): Promise<MemoryAttachment> {
  const traceId =
    input.trace_id ?? `mem_${input.surface}_${Date.now().toString(36)}`;

  try {
    const user = resolveUser(input);
    const surface = resolveSurface(input);
    const project = resolveProjectFromMessage(input.message);
    const task = resolveOrCreateTask(user, surface, input.message, project);
    const { short, working } = loadWorkingContext(surface);
    const canonical_keys = [...(CANONICAL_KEYS[project.project] ?? CANONICAL_KEYS.unknown)];
    const evidence_refs = buildEvidenceRefs(traceId, project);

    const attachment: MemoryAttachment = {
      user,
      surface,
      project,
      task,
      canonical_keys,
      evidence_refs,
      short_context: short,
      working_context: working,
    };

    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "memory_context_attached"),
      trace_id: traceId,
      job_id: "memory",
      task_id: task.task_id,
      type: "memory_context_attached",
      timestamp: new Date().toISOString(),
      payload: {
        user_id: user.user_id,
        surface: surface.surface,
        project: project.project,
        project_confidence: project.confidence,
        task_id: task.task_id,
        intent: task.intent,
        canonical_keys_count: canonical_keys.length,
        short_context_count: short.length,
        working_context_count: working.length,
      },
    });

    return attachment;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[memory-context-attachment] fallback empty attachment", message);

    const user = resolveUser(input);
    const surface = resolveSurface(input);
    const fallback: MemoryAttachment = {
      user,
      surface,
      project: { project: "unknown", confidence: 0, reason: `attachment_error: ${message}` },
      task: {
        task_id: `task_fallback_${Date.now().toString(36)}`,
        intent: "chat",
        status: "open",
      },
      canonical_keys: CANONICAL_KEYS.unknown,
      evidence_refs: [`trace:${traceId}`],
      short_context: [],
      working_context: [],
    };

    try {
      await appendEvidenceRecord({
        evidence_id: hashTraceId(traceId, "memory_context_attached"),
        trace_id: traceId,
        job_id: "memory",
        type: "memory_context_attached",
        timestamp: new Date().toISOString(),
        payload: { fallback: true, error: message },
      });
    } catch {
      // evidence store unavailable — still return attachment
    }

    return fallback;
  }
}

/** Test / ops: clear in-memory active tasks */
export function clearActiveTaskStore(): void {
  activeTasks.clear();
}

/** Test / ops: read active task for user+chat */
export function getActiveTask(userId: string, chatId?: string): TaskContext | undefined {
  return activeTasks.get(taskKey(userId, chatId));
}

/** TGR-6.95 — update in-memory task after writeback */
export function updateActiveTaskAfterWriteback(
  userId: string,
  chatId: string | undefined,
  patch: Partial<TaskContext>,
): TaskContext | undefined {
  const key = taskKey(userId, chatId);
  const existing = activeTasks.get(key);
  if (!existing) return undefined;
  const updated: TaskContext = { ...existing, ...patch };
  activeTasks.set(key, updated);
  return updated;
}
