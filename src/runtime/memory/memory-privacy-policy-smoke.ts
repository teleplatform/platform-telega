/**
 * TGR-7.00 — Memory Privacy & Retention Policy regression gate
 */

import {
  applyMemoryRetentionPolicy,
  classifyMemoryPrivacy,
  classifyMemoryRetention,
  isMemoryAllowedInPrompt,
  redactMemorySecrets,
  shouldExpireMemoryItem,
  sanitizeMemoryTextForPrompt,
  RETENTION_TTL_MS,
} from "./memory-retention-policy.js";
import { attachMemoryContext, clearActiveTaskStore } from "./memory-context-attachment.js";
import { retrieveMemoryForPrompt } from "./memory-retrieval-guard.js";
import { writebackMemory } from "./memory-writeback.js";
import { setMemory, getMemory } from "./runtime-memory-store.js";
import { buildMemoryDebugPanel } from "./memory-debug-panel.js";
import { redactSecrets } from "./memory-debug-panel.js";
import { buildTaskCanonicalCandidatesKey, CANONICAL_DECISION_CATEGORY } from "./memory-canon-keys.js";

export type MemoryPrivacyPolicyGuardStatus = "pass" | "fail";

export interface MemoryPrivacyPolicySmokeCheck {
  id: string;
  pass: boolean;
  detail?: string;
}

export interface MemoryPrivacyPolicySmokeResult {
  memory_privacy_policy_guard: MemoryPrivacyPolicyGuardStatus;
  pass: boolean;
  checks: MemoryPrivacyPolicySmokeCheck[];
  error?: string;
  timestamp: string;
}

function check(id: string, pass: boolean, detail?: string): MemoryPrivacyPolicySmokeCheck {
  return { id, pass, detail };
}

export async function runMemoryPrivacyPolicySmoke(): Promise<MemoryPrivacyPolicySmokeResult> {
  const timestamp = new Date().toISOString();
  const checks: MemoryPrivacyPolicySmokeCheck[] = [];
  let error: string | undefined;

  try {
    const secretText = "api_key=sk-testsecret12345678901234567890";
    checks.push(
      check(
        "secret_not_in_prompt",
        !isMemoryAllowedInPrompt({ text: secretText, category: "session" }),
      ),
    );
    checks.push(
      check(
        "secret_redacted_on_apply",
        applyMemoryRetentionPolicy({ text: secretText }).redacted_text.includes("[REDACTED]"),
      ),
    );

    checks.push(
      check(
        "creator_private_hidden_from_public",
        !isMemoryAllowedInPrompt(
          { key: "creator.debug.panel", category: "creator_debug", text: "internal trace" },
          "public_user_999",
        ),
      ),
    );
    checks.push(
      check(
        "creator_private_visible_to_creator",
        isMemoryAllowedInPrompt(
          { key: "creator.debug.panel", category: "creator_debug", text: "internal trace" },
          "267246987",
        ),
      ),
    );

    const redacted = redactMemorySecrets("password=abc token=xyz bearer deadbeef");
    checks.push(
      check(
        "debug_redacts_secrets",
        redacted.includes("[REDACTED]") && redactSecrets(redacted).includes("[REDACTED]"),
      ),
    );

    const ephemeralOld = {
      category: "ephemeral",
      created_at: Date.now() - (RETENTION_TTL_MS.ephemeral ?? 0) - 1000,
    };
    checks.push(check("ephemeral_expires", shouldExpireMemoryItem(ephemeralOld)));

    const sessionOld = {
      category: "session",
      type: "session",
      created_at: Date.now() - (RETENTION_TTL_MS.session ?? 0) - 1000,
    };
    checks.push(check("session_has_ttl", shouldExpireMemoryItem(sessionOld)));

    checks.push(
      check(
        "working_expires_when_task_closed",
        shouldExpireMemoryItem({
          key: "task.t1.working",
          category: "task_working",
          task_status: "done",
        }),
      ),
    );
    checks.push(
      check(
        "working_kept_while_task_open",
        !shouldExpireMemoryItem({
          key: "task.t1.working",
          category: "task_working",
          task_status: "open",
        }),
      ),
    );

    const evidenceSanitized = sanitizeMemoryTextForPrompt({
      type: "evidence",
      text: "x".repeat(500),
      ref: "trace:ev1",
    });
    checks.push(
      check(
        "evidence_prompt_excerpt_only",
        evidenceSanitized.text.includes("evidence_ref:") &&
          evidenceSanitized.text.length < 500,
      ),
    );

    checks.push(
      check(
        "canon_unverified_not_in_prompt",
        !isMemoryAllowedInPrompt({
          category: CANONICAL_DECISION_CATEGORY,
          verified: false,
          text: "TGR — DONE",
        }),
      ),
    );

    clearActiveTaskStore();
    const attachment = await attachMemoryContext({
      message: "privacy smoke",
      surface: "telegram",
      user_id: "privacy_public",
      chat_id: "privacy_chat",
      trace_id: `privacy_${Date.now().toString(36)}`,
      role: "user",
    });

    setMemory(
      "creator_private.vault.note",
      { note: "creator only diagnostics" },
      "creator_private",
      false,
    );
    setMemory(
      buildTaskCanonicalCandidatesKey(attachment.task.task_id),
      ["unverified canon line"],
      "canonical",
      false,
    );

    const retrieval = await retrieveMemoryForPrompt({
      memory_attachment: attachment,
      user_message: "continue",
    });

    const noSecretInPrompt = !retrieval.selected_items.some((i) =>
      /sk-[a-zA-Z0-9]{20,}|api_key=/i.test(i.text),
    );
    checks.push(check("retrieval_no_secrets", noSecretInPrompt));

    const noCreatorPrivate = !retrieval.selected_items.some((i) =>
      i.text.includes("creator only diagnostics"),
    );
    checks.push(check("retrieval_no_creator_private_for_public", noCreatorPrivate));

    const noUnverifiedCanon = !retrieval.selected_items.some(
      (i) => i.type === "canonical" && i.text.includes("unverified canon"),
    );
    checks.push(check("retrieval_no_unverified_canon", noUnverifiedCanon));

    await writebackMemory({
      memory_attachment: attachment,
      user_message: "token=supersecret",
      assistant_response: "ok",
      response_id: `privacy_wb_${Date.now().toString(36)}`,
      status: "delivered",
    });

    const working = getMemory(`task.${attachment.task.task_id}.working`);
    const workingText = JSON.stringify(working?.value ?? "");
    checks.push(
      check(
        "writeback_redacts_secrets",
        !workingText.includes("supersecret") || workingText.includes("[REDACTED]"),
      ),
    );

    const panel = buildMemoryDebugPanel(attachment.evidence_refs[0]?.replace("trace:", "") ?? "none");
    const panelJson = JSON.stringify(panel);
    checks.push(
      check(
        "debug_panel_redacted",
        !panelJson.includes("supersecret"),
      ),
    );

    checks.push(
      check(
        "classify_retention_session",
        classifyMemoryRetention({ category: "session", type: "session" }) === "session",
      ),
    );
    checks.push(
      check(
        "classify_privacy_secret",
        classifyMemoryPrivacy({ text: "password=hunter2" }) === "secret",
      ),
    );
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
    checks.push(check("privacy_smoke_execution", false, error));
  }

  const pass = checks.length > 0 && checks.every((c) => c.pass) && !error;

  return {
    memory_privacy_policy_guard: pass ? "pass" : "fail",
    pass,
    checks,
    error,
    timestamp,
  };
}

export const runMemoryPrivacyPolicyGuard = runMemoryPrivacyPolicySmoke;
