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
  category: "core" | "forge" | "kilo" | "mcp" | "system";
  ui: CommandUI;
}

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