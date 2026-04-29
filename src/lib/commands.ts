export interface CommandDescription {
  ru: string;
  en: string;
}

export interface CommandUI {
  showInHelp: boolean;
  showInCommands: boolean;
  showInButtons: boolean;
}

export interface CommandDefinition {
  name: string;
  args: string;
  description: CommandDescription;
  usage_ru: string;
  usage_en: string;
  roles: string[];
  category: "core" | "forge" | "kilo" | "mcp" | "system" | "bridge";
  ui: CommandUI;
}

export const CREATOR_BRIDGE_COMMANDS: CommandDefinition[] = [
  {
    name: "/bridge_status",
    args: "",
    description: { ru: "статус провайдеров моста", en: "bridge providers status" },
    usage_ru: "/bridge_status",
    usage_en: "/bridge_status",
    roles: ["★", "★★", "★★★"],
    category: "bridge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/bridge_reset_provider",
    args: "<provider_name>",
    description: { ru: "сбросить состояние провайдера", en: "reset provider state" },
    usage_ru: "/bridge_reset_provider openai",
    usage_en: "/bridge_reset_provider openai",
    roles: ["★"],
    category: "bridge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/bridge_failures",
    args: "",
    description: { ru: "последние ошибки", en: "recent failures" },
    usage_ru: "/bridge_failures",
    usage_en: "/bridge_failures",
    roles: ["★"],
    category: "bridge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
];

export const TELEGPT_COMMANDS: CommandDefinition[] = [
  {
    name: "/start",
    args: "",
    description: { ru: "начало работы", en: "start bot" },
    usage_ru: "/start",
    usage_en: "/start",
    roles: ["★", "★★", "★★★"],
    category: "core",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/new",
    args: "<prompt>",
    description: { ru: "новый запрос GPT", en: "new GPT request" },
    usage_ru: "/new создать функцию",
    usage_en: "/new create function",
    roles: ["★", "★★", "★★★"],
    category: "core",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/model",
    args: "<name>",
    description: { ru: "выбор модели", en: "select model" },
    usage_ru: "/model gpt-4",
    usage_en: "/model gpt-4",
    roles: ["★", "★★", "★★★"],
    category: "core",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/clear",
    args: "",
    description: { ru: "очистить контекст", en: "clear context" },
    usage_ru: "/clear",
    usage_en: "/clear",
    roles: ["★", "★★", "★★★"],
    category: "core",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/retry",
    args: "",
    description: { ru: "повторить последний запрос", en: "retry last request" },
    usage_ru: "/retry",
    usage_en: "/retry",
    roles: ["★", "★★", "★★★"],
    category: "core",
    ui: { showInHelp: true, showInCommands: false, showInButtons: true },
  },
  {
    name: "/e2e_validate",
    args: "",
    description: { ru: "E2E валидация системы", en: "run E2E validation" },
    usage_ru: "/e2e_validate",
    usage_en: "/e2e_validate",
    roles: ["★"],
    category: "system",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/provider_verify",
    args: "<provider>",
    description: { ru: "верифицировать провайдер", en: "verify single provider" },
    usage_ru: "/provider_verify chatgpt_web",
    usage_en: "/provider_verify chatgpt_web",
    roles: ["★"],
    category: "bridge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/provider_verify_all",
    args: "",
    description: { ru: "верифицировать все провайдеры", en: "verify all providers" },
    usage_ru: "/provider_verify_all",
    usage_en: "/provider_verify_all",
    roles: ["★"],
    category: "bridge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/provider_verify_report",
    args: "",
    description: { ru: "отчёт верификации", en: "verification report" },
    usage_ru: "/provider_verify_report",
    usage_en: "/provider_verify_report",
    roles: ["★"],
    category: "bridge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/runtime_status",
    args: "",
    description: { ru: "статус рантайма", en: "runtime status dashboard" },
    usage_ru: "/runtime_status",
    usage_en: "/runtime_status",
    roles: ["★"],
    category: "system",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/watchdog_status",
    args: "",
    description: { ru: "статус вотчдога", en: "watchdog status" },
    usage_ru: "/watchdog_status",
    usage_en: "/watchdog_status",
    roles: ["★"],
    category: "system",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/watchdog_pause",
    args: "",
    description: { ru: "пауза вотчдога", en: "pause watchdog" },
    usage_ru: "/watchdog_pause",
    usage_en: "/watchdog_pause",
    roles: ["★"],
    category: "system",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/watchdog_resume",
    args: "",
    description: { ru: "возобновить вотчдог", en: "resume watchdog" },
    usage_ru: "/watchdog_resume",
    usage_en: "/watchdog_resume",
    roles: ["★"],
    category: "system",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/watchdog_logs",
    args: "",
    description: { ru: "логи вотчдога", en: "watchdog logs" },
    usage_ru: "/watchdog_logs",
    usage_en: "/watchdog_logs",
    roles: ["★"],
    category: "system",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/image",
    args: "<prompt>",
    description: { ru: "сгенерировать изображение", en: "generate image" },
    usage_ru: "/image котик",
    usage_en: "/image cat",
    roles: ["★", "★★", "★★★"],
    category: "core",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/voice",
    args: "",
    description: { ru: "голосовой ввод вкл/выкл", en: "toggle voice input" },
    usage_ru: "/voice",
    usage_en: "/voice",
    roles: ["★", "★★", "★★★"],
    category: "core",
    ui: { showInHelp: true, showInCommands: false, showInButtons: true },
  },
  {
    name: "/help",
    args: "",
    description: { ru: "список команд", en: "list commands" },
    usage_ru: "/help",
    usage_en: "/help",
    roles: ["★", "★★", "★★★"],
    category: "system",
    ui: { showInHelp: true, showInCommands: false, showInButtons: false },
  },
  {
    name: "/commands",
    args: "",
    description: { ru: "только коман��ы Forge", en: "Forge commands only" },
    usage_ru: "/commands",
    usage_en: "/commands",
    roles: ["★", "★★", "★★★"],
    category: "system",
    ui: { showInHelp: false, showInCommands: false, showInButtons: false },
  },
];

export const FORGE_COMMANDS: CommandDefinition[] = [
  {
    name: "/forge_auto",
    args: "<task>",
    description: { ru: "запуск автономного workflow", en: "start autonomous workflow" },
    usage_ru: "/forge_auto добавить фичу X",
    usage_en: "/forge_auto add feature X",
    roles: ["★", "★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/forge_mode",
    args: "<task_id> [mode]",
    description: { ru: "режим выполнения", en: "execution mode" },
    usage_ru: "/forge_mode wf_abc123 manual",
    usage_en: "/forge_mode wf_abc123 manual",
    roles: ["★", "★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/forge_stop",
    args: "<task_id>",
    description: { ru: "остановка автономного выполнения", en: "stop autonomous execution" },
    usage_ru: "/forge_stop wf_abc123",
    usage_en: "/forge_stop wf_abc123",
    roles: ["★", "★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/forge_new",
    args: "<task>",
    description: { ru: "создать workflow", en: "create workflow" },
    usage_ru: "/forge_new задача",
    usage_en: "/forge_new task",
    roles: ["★", "★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/forge_next",
    args: "<task_id>",
    description: { ru: "следующий этап", en: "next stage" },
    usage_ru: "/forge_next wf_abc123",
    usage_en: "/forge_next wf_abc123",
    roles: ["★", "★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: true },
  },
  {
    name: "/forge_validate",
    args: "<task_id>",
    description: { ru: "валидация gates", en: "validate gates" },
    usage_ru: "/forge_validate wf_abc123",
    usage_en: "/forge_validate wf_abc123",
    roles: ["★", "★★", "★★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/forge_report",
    args: "<task_id>",
    description: { ru: "отчёт о выполнении", en: "execution report" },
    usage_ru: "/forge_report wf_abc123",
    usage_en: "/forge_report wf_abc123",
    roles: ["★", "★★", "★★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/forge_timeline",
    args: "<task_id>",
    description: { ru: "временная шкала", en: "timeline" },
    usage_ru: "/forge_timeline wf_abc123",
    usage_en: "/forge_timeline wf_abc123",
    roles: ["★", "★★", "★★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/forge_diagnose",
    args: "<task_id>",
    description: { ru: "диагностика ошибки", en: "error diagnosis" },
    usage_ru: "/forge_diagnose wf_abc123",
    usage_en: "/forge_diagnose wf_abc123",
    roles: ["★", "★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/forge_heal_plan",
    args: "<task_id>",
    description: { ru: "план самолечения", en: "self-heal plan" },
    usage_ru: "/forge_heal_plan wf_abc123",
    usage_en: "/forge_heal_plan wf_abc123",
    roles: ["★", "★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/forge_heal_apply",
    args: "<plan_id>",
    description: { ru: "применить план лечения", en: "apply heal plan" },
    usage_ru: "/forge_heal_apply heal_abc123",
    usage_en: "/forge_heal_apply heal_abc123",
    roles: ["★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/forge_pause",
    args: "<task_id>",
    description: { ru: "приостановить workflow", en: "pause workflow" },
    usage_ru: "/forge_pause wf_abc123",
    usage_en: "/forge_pause wf_abc123",
    roles: ["★", "★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: true },
  },
  {
    name: "/forge_resume",
    args: "<task_id>",
    description: { ru: "возобновить workflow", en: "resume workflow" },
    usage_ru: "/forge_resume wf_abc123",
    usage_en: "/forge_resume wf_abc123",
    roles: ["★", "★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: true },
  },
  {
    name: "/forge_list",
    args: "",
    description: { ru: "список active workflows", en: "list active workflows" },
    usage_ru: "/forge_list",
    usage_en: "/forge_list",
    roles: ["★", "★★", "★★★"],
    category: "forge",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
];

export const KILO_COMMANDS: CommandDefinition[] = [
  {
    name: "/kilo_ping",
    args: "",
    description: { ru: "проверить Kilo readiness", en: "check Kilo readiness" },
    usage_ru: "/kilo_ping",
    usage_en: "/kilo_ping",
    roles: ["★", "★★", "★★★"],
    category: "kilo",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/kilo_read",
    args: "<path>",
    description: { ru: "прочитать файл", en: "read file" },
    usage_ru: "/kilo_read src/index.ts",
    usage_en: "/kilo_read src/index.ts",
    roles: ["★", "★★", "★★★"],
    category: "kilo",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/kilo_grep",
    args: "<pattern>",
    description: { ru: "поиск в коде", en: "search code" },
    usage_ru: "/kilo_grep function",
    usage_en: "/kilo_grep function",
    roles: ["★", "★★", "★★★"],
    category: "kilo",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/kilo_patch_plan",
    args: "<task>",
    description: { ru: "создать план изменений", en: "create patch plan" },
    usage_ru: "/kilo_patch_plan исправить баг",
    usage_en: "/kilo_patch_plan fix bug",
    roles: ["★", "★★"],
    category: "kilo",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/kilo_patch_apply",
    args: "<plan_id>",
    description: { ru: "применить патч", en: "apply patch" },
    usage_ru: "/kilo_patch_apply plan_abc123",
    usage_en: "/kilo_patch_apply plan_abc123",
    roles: ["★"],
    category: "kilo",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/kilo_patch_rollback",
    args: "<apply_id>",
    description: { ru: "откатить изменения", en: "rollback changes" },
    usage_ru: "/kilo_patch_rollback apply_abc123",
    usage_en: "/kilo_patch_rollback apply_abc123",
    roles: ["★"],
    category: "kilo",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
];

export const MCP_COMMANDS: CommandDefinition[] = [
  {
    name: "/mcp_status",
    args: "",
    description: { ru: "статус MCP серверов", en: "MCP servers status" },
    usage_ru: "/mcp_status",
    usage_en: "/mcp_status",
    roles: ["★", "★★", "★★★"],
    category: "mcp",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/mcp_tools",
    args: "",
    description: { ru: "доступные MCP инструменты", en: "available MCP tools" },
    usage_ru: "/mcp_tools",
    usage_en: "/mcp_tools",
    roles: ["★", "★★", "★★★"],
    category: "mcp",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
  {
    name: "/mcp_test",
    args: "<tool_name>",
    description: { ru: "тест MCP инструмента", en: "test MCP tool" },
    usage_ru: "/mcp_test git_status",
    usage_en: "/mcp_test git_status",
    roles: ["★", "★★"],
    category: "mcp",
    ui: { showInHelp: true, showInCommands: true, showInButtons: false },
  },
];

export const ALL_COMMANDS = [
  ...TELEGPT_COMMANDS,
  ...FORGE_COMMANDS,
  ...KILO_COMMANDS,
  ...MCP_COMMANDS,
];

export function filterByRole(
  commands: CommandDefinition[],
  role: string
): CommandDefinition[] {
  return commands.filter((c) => c.roles.includes(role) || c.roles.includes("★★★"));
}

export function filterByCategory(
  commands: CommandDefinition[],
  category: string
): CommandDefinition[] {
  return commands.filter((c) => c.category === category);
}

export function filterByUI(
  commands: CommandDefinition[],
  field: keyof CommandUI,
  value: boolean
): CommandDefinition[] {
  return commands.filter((c) => c.ui[field] === value);
}

export function renderCommands(
  commands: CommandDefinition[],
  lang: "ru" | "en"
): string {
  const desc = lang === "ru" ? "description" : "description";
  const usage = lang === "ru" ? "usage_ru" : "usage_en";

  const lines = commands.map((c) => `${c.name} ${c.args}\n— ${c.description[lang]}\n  ${c[usage]}`);
  return "📋 COMMANDS\n\n" + lines.join("\n\n");
}

export function renderForgeCommands(lang: "ru" | "en", role?: string): string {
  let commands = filterByCategory(FORGE_COMMANDS, "forge");
  if (role) {
    commands = filterByRole(commands, role);
  }
  return renderCommands(commands, lang);
}

export function renderAllCommands(lang: "ru" | "en", role?: string): string {
  let commands = [...ALL_COMMANDS];
  if (role) {
    commands = filterByRole(commands, role);
  }
  return renderCommands(commands, lang);
}

export interface CommandContext {
  role: string;
  current_workflow_id?: string;
  current_patch_id?: string;
  last_provider?: string;
  last_error?: string;
  last_response_length?: number;
  has_pending_heal?: boolean;
  has_active_workflow?: boolean;
  has_stalled_workflow?: boolean;
}

export function suggestCommands(context: CommandContext): string[] {
  const suggestions: string[] = [];
  const { role, current_workflow_id, last_error, has_active_workflow, has_stalled_workflow, has_pending_heal } = context;

  if (!role) return suggestions;

  if (has_stalled_workflow && (role === "★" || role === "★★")) {
    if (current_workflow_id) {
      suggestions.push("/forge_diagnose");
      suggestions.push("/forge_heal_plan");
    }
  }

  if (has_active_workflow && current_workflow_id) {
    suggestions.push("/forge_next");
    suggestions.push("/forge_report");
    suggestions.push("/forge_timeline");
    if (role === "★" || role === "★★") {
      suggestions.push("/forge_pause");
    }
  }

  if (has_pending_heal && role === "★") {
    suggestions.push("/forge_heal_apply");
  }

  if (last_error) {
    if (role === "★" || role === "★★") {
      suggestions.push("/mcp_status");
      suggestions.push("/mcp_test");
    }
    suggestions.push("/forge_diagnose");
  }

  if ((role === "★" || role === "★★") && !current_workflow_id) {
    suggestions.push("/forge_auto");
    suggestions.push("/forge_new");
  }

  return suggestions;
}

export function renderSuggestions(context: CommandContext, lang: "ru" | "en"): string {
  const suggestionNames = suggestCommands(context);
  if (suggestionNames.length === 0) return "";

  const available = filterByRole(ALL_COMMANDS, context.role);
  const toRender = available.filter(c => suggestionNames.includes(c.name));

  if (toRender.length === 0) return "";

  return toRender.map(c => c.name).join(" • ");
}

export type ActionSeverity = "info" | "warning" | "danger" | "success";

export interface ActionCard {
  card_id: string;
  title_ru: string;
  title_en: string;
  description_ru: string;
  description_en: string;
  severity: ActionSeverity;
  commands: string[];
  context_match: Partial<CommandContext>;
  expires_at?: number;
  created_at: number;
}

export const ACTION_CARDS: ActionCard[] = [
  {
    card_id: "stalled_workflow",
    title_ru: "Workflow приостановлен",
    title_en: "Workflow stalled",
    description_ru: "Обнаружен приостановленный workflow. Требуется диагностика.",
    description_en: "Stalled workflow detected. Diagnostics required.",
    severity: "danger",
    commands: ["/forge_diagnose", "/forge_heal_plan", "/forge_report"],
    context_match: { has_stalled_workflow: true },
    created_at: 0,
  },
  {
    card_id: "pending_apply",
    title_ru: "Patch ожидает одобрения",
    title_en: "Patch awaiting approval",
    description_ru: "Patch готов к применению. Требуется одобрение ★",
    description_en: "Patch ready to apply. Requires ★ approval.",
    severity: "warning",
    commands: ["/kilo_patch_preview", "/kilo_patch_apply", "/kilo_patch_reject"],
    context_match: { has_pending_heal: true },
    created_at: 0,
  },
  {
    card_id: "provider_failed",
    title_ru: "Провайдер недоступен",
    title_en: "Provider failed",
    description_ru: "Последний запрос не прошёл. Проверьте статус провайдера.",
    description_en: "Last request failed. Check provider status.",
    severity: "danger",
    commands: ["/mcp_status", "/mcp_test", "/provider_health"],
    context_match: { last_error: "" },
    created_at: 0,
  },
  {
    card_id: "active_workflow",
    title_ru: "Workflow выполняется",
    title_en: "Workflow running",
    description_ru: "Активный workflow. Мониторинг выполнения.",
    description_en: "Active workflow. Monitoring execution.",
    severity: "info",
    commands: ["/forge_next", "/forge_report", "/forge_timeline", "/forge_pause"],
    context_match: { has_active_workflow: true },
    created_at: 0,
  },
  {
    card_id: "gates_failed",
    title_ru: "Gates не пройдены",
    title_en: "Gates failed",
    description_ru: "Quality gates не пройдены. Проверьте и исправьте.",
    description_en: "Quality gates failed. Check and fix.",
    severity: "danger",
    commands: ["/forge_validate", "/forge_diagnose", "/forge_heal_plan"],
    context_match: { last_error: "gate" },
    created_at: 0,
  },
];

export function findActionCards(context: CommandContext): ActionCard[] {
  return ACTION_CARDS.filter((card) => {
    if (!card.context_match) return false;
    for (const [key, value] of Object.entries(card.context_match)) {
      if (context[key as keyof CommandContext] === value) return true;
      if (typeof value === "string" && value === "") {
        if (context[key as keyof CommandContext]) return true;
      }
    }
    return false;
  });
}

export function getSeverityColor(severity: ActionSeverity): string {
  switch (severity) {
    case "info": return "🔵";
    case "warning": return "🟡";
    case "danger": return "🔴";
    case "success": return "🟢";
    default: return "⚪";
  }
}

export function renderActionCard(card: ActionCard, lang: "ru" | "en"): string {
  const title = lang === "ru" ? card.title_ru : card.title_en;
  const description = lang === "ru" ? card.description_ru : card.description_en;
  const severityIcon = getSeverityColor(card.severity);

  return `${severityIcon} ${title}\n${description}\n\n${card.commands.join(" • ")}`;
}