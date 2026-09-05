import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { RuntimeSurface, RuntimeInputType, RuntimeInput, RuntimeAttachment, RuntimeInputMetadata } from "./runtime-input.types.js";
import { RuntimeModeResolver } from "../mode/runtime-mode-resolver.js";

export type { RuntimeSurface, RuntimeInputType, RuntimeInput, RuntimeAttachment, RuntimeInputMetadata } from "./runtime-input.types.js";

const _modeResolver = new RuntimeModeResolver();

let normalizerCounter = 0;

function detectInputType(content: string, attachments: Array<{ kind?: string; mime_type?: string }>): RuntimeInputType {
  if (attachments.length > 0) {
    const a = attachments[0];
    if (a.kind === "image") return "image";
    if (a.kind === "audio") return "voice";
    if (a.kind === "video" || a.kind === "file") return "file";
    if (a.kind === "link" || (a.mime_type && a.mime_type.startsWith("text/"))) return "file";
  }
  const trimmed = content.trim();
  if (trimmed.startsWith("/")) return "command";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("www.")) return "link";
  return "text";
}

function generateInputId(): string {
  return `in_${Date.now()}_${normalizerCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeInput(raw: {
  content: string;
  user_id?: string;
  surface?: string;
  attachments?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  message_id?: string;
  chat_id?: string;
  project_id?: string;
  repo_path?: string;
}): RuntimeInput {
  normalizerCounter++;

  const attachments: RuntimeAttachment[] = (raw.attachments || []).map((a, i) => ({
    id: `att_${Date.now()}_${i}`,
    kind: (a.kind || "file") as RuntimeAttachment["kind"],
    name: a.name as string | undefined,
    mime_type: a.mime_type as string | undefined,
    url: a.url as string | undefined,
    local_path: a.local_path as string | undefined,
  }));

  const surface: RuntimeSurface = (raw.surface === "web" || raw.surface === "telegram" || raw.surface === "voice" || raw.surface === "ide" || raw.surface === "browser" || raw.surface === "api")
    ? raw.surface as RuntimeSurface
    : "api";

  const type = detectInputType(raw.content, attachments);
  const inputId = generateInputId();
  const receivedAt = new Date().toISOString();

  const metadata: RuntimeInputMetadata = {
    source_message_id: raw.message_id,
    chat_id: raw.chat_id,
    project_id: raw.project_id,
    repo_path: raw.repo_path,
    raw: raw.metadata,
  };

  const input: RuntimeInput = {
    input_id: inputId,
    user_id: raw.user_id || "anonymous",
    surface,
    type,
    content: raw.content,
    attachments,
    metadata,
    received_at: receivedAt,
  };

  const modeResolution = _modeResolver.resolve(input);
  input.metadata.runtime_mode = modeResolution.runtime_mode;
  if (modeResolution.runtime_mode === "creator") {
    input.metadata.creator_verified = true;
    input.metadata.creator_user_id = input.user_id;
  }

  appendEvidenceRecord({
    evidence_id: hashTraceId(inputId, "runtime_input_normalized"),
    trace_id: inputId,
    job_id: "input",
    type: "runtime_input_normalized",
    timestamp: receivedAt,
    payload: {
      input_id: inputId,
      surface,
      type,
      content_length: raw.content.length,
      attachment_count: attachments.length,
      user_id: input.user_id,
      runtime_mode: input.metadata.runtime_mode,
    },
  });

  return input;
}
