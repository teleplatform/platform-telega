import fs from "fs/promises";
import path from "path";

const ACTION_LOG = path.join(process.cwd(), "data/forge/audit-log.jsonl");

async function logAction(req: any, action: string, result: any) {
  const entry = {
    timestamp: Date.now(),
    user_id: req?.user_id ?? "anonymous",
    account_label: req?.account_label ?? "unknown",
    action,
    result: result?.success ? "success" : "failed",
    error: result?.error,
    ip: req?.ip ?? "unknown",
  };
  try {
    await fs.appendFile(ACTION_LOG, JSON.stringify(entry) + "\n");
  } catch {
    // ignore
  }
}

const ALL_ACTIONS = [
  "forge_next",
  "forge_pause",
  "forge_resume",
  "forge_report",
  "forge_validate",
  "patch_apply_request",
  "patch_rollback_request",
] as const;

const VALID_ACTIONS: string[] = [...ALL_ACTIONS];
type ForgeAction = typeof ALL_ACTIONS[number];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  "★": VALID_ACTIONS,
  "★★": VALID_ACTIONS,
  "★★★": ["forge_report", "forge_validate"],
};

function checkPermission(role: string, action: ForgeAction): boolean {
  const allowed = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS["★★★"];
  return allowed.includes(action);
}

function getActionMessage(action: ForgeAction, lang: string): string {
  const messages: Record<ForgeAction, { ru: string; en: string }> = {
    forge_next: { ru: "Переход к следующему этапу", en: "Proceed to next stage" },
    forge_pause: { ru: "Приостановить workflow", en: "Pause workflow" },
    forge_resume: { ru: "Возобновить workflow", en: "Resume workflow" },
    forge_report: { ru: "Создать отчет", en: "Generate report" },
    forge_validate: { ru: "Валидировать gates", en: "Validate gates" },
    patch_apply_request: { ru: "Запрос на применение патча", en: "Patch apply request" },
    patch_rollback_request: { ru: "Запрос на откат", en: "Rollback request" },
  };
  return messages[action]?.[lang === "ru" ? "ru" : "en"] ?? action;
}

export async function registerForgeActionRoute(server: any) {
  server.post("/api/forge/action", async (req: any, reply: any) => {
    try {
      const { action, workflow_id, patch_id, user_id, account_label } = req.body ?? {};
      const role = account_label ?? "★★★";

      if (!action || !VALID_ACTIONS.includes(action)) {
        await logAction(req, action, { success: false, error: "Invalid action" });
        return reply.code(400).send({
          success: false,
          error: "Invalid action",
          allowed_actions: VALID_ACTIONS,
        });
      }

      if (!checkPermission(role, action)) {
        await logAction(req, action, { success: false, error: "Permission denied" });
        return reply.code(403).send({
          success: false,
          error: "Permission denied",
          required_role: "★",
          your_role: role,
        });
      }

      const lang = "en";
      const result: any = { success: true, action, timestamp: Date.now() };

      switch (action) {
        case "forge_next": {
          result.message = getActionMessage("forge_next", lang);
          result.command_hint = workflow_id
            ? `/forge_next ${workflow_id}`
            : "/forge_next";
          break;
        }
        case "forge_pause": {
          result.message = getActionMessage("forge_pause", lang);
          result.command_hint = workflow_id
            ? `/forge_pause ${workflow_id}`
            : "/forge_pause";
          break;
        }
        case "forge_resume": {
          result.message = getActionMessage("forge_resume", lang);
          result.command_hint = workflow_id
            ? `/forge_resume ${workflow_id}`
            : "/forge_resume";
          break;
        }
        case "forge_report": {
          result.message = getActionMessage("forge_report", lang);
          result.command_hint = workflow_id
            ? `/forge_report ${workflow_id}`
            : "/forge_report";
          break;
        }
        case "forge_validate": {
          result.message = getActionMessage("forge_validate", lang);
          result.command_hint = workflow_id
            ? `/forge_validate ${workflow_id}`
            : "/forge_validate";
          break;
        }
        case "patch_apply_request": {
          result.message = getActionMessage("patch_apply_request", lang);
          result.command_hint = patch_id
            ? `/kilo_patch_apply ${patch_id}`
            : "/kilo_patch_apply";
          result.warning = "Requires ★ owner approval via Telegram";
          break;
        }
        case "patch_rollback_request": {
          result.message = getActionMessage("patch_rollback_request", lang);
          result.command_hint = patch_id
            ? `/kilo_patch_rollback ${patch_id}`
            : "/kilo_patch_rollback";
          result.warning = "Requires ★ owner approval via Telegram";
          break;
        }
        default:
          result.message = "Action acknowledged";
      }

      await logAction(req, action, result);
      return reply.send(result);
    } catch (e: any) {
      await logAction(req, "unknown", { success: false, error: e?.message });
      return reply.code(500).send({
        success: false,
        error: e?.message ?? "Internal error",
      });
    }
  });

  server.get("/api/forge/actions", async (_req: any, _reply: any) => {
    return {
      actions: VALID_ACTIONS,
      descriptions: {
        forge_next: { ru: "Переход к следующему этапу", en: "Proceed to next stage" },
        forge_pause: { ru: "Приостановить workflow", en: "Pause workflow" },
        forge_resume: { ru: "Возобновить workflow", en: "Resume workflow" },
        forge_report: { ru: "Создать отчет", en: "Generate report" },
        forge_validate: { ru: "Валидировать gates", en: "Validate gates" },
        patch_apply_request: { ru: "Запрос на apply", en: "Request patch apply" },
        patch_rollback_request: { ru: "Запрос на rollback", en: "Request rollback" },
      },
    };
  });

  server.get("/api/forge/audit-log", async (_req: any, _reply: any) => {
    try {
      const content = await fs.readFile(ACTION_LOG, "utf-8");
      const entries = content.trim().split("\n").filter(Boolean).slice(-50).reverse();
      return { audit_log: entries.map((l) => JSON.parse(l)).reverse() };
    } catch {
      return { audit_log: [] };
    }
  });
}