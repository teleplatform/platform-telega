export interface Command {
  name: string;
  args: string;
  description_ru: string;
  description_en: string;
}

export const FORGE_COMMANDS: Command[] = [
  {
    name: "/forge_auto",
    args: "<task>",
    description_ru: "запуск автономного workflow",
    description_en: "start autonomous workflow",
  },
  {
    name: "/forge_mode",
    args: "<task_id>",
    description_ru: "режим выполнения (manual / assisted / autonomous)",
    description_en: "execution mode (manual / assisted / autonomous)",
  },
  {
    name: "/forge_stop",
    args: "<task_id>",
    description_ru: "остановка автономного выполнения",
    description_en: "stop autonomous execution",
  },
];

export const TELEGPT_COMMANDS: Command[] = [
  {
    name: "/start",
    args: "",
    description_ru: "начало работы",
    description_en: "start bot",
  },
  {
    name: "/new",
    args: "<prompt>",
    description_ru: "новый запрос",
    description_en: "new request",
  },
  {
    name: "/model",
    args: "<name>",
    description_ru: "выбор модели",
    description_en: "select model",
  },
  {
    name: "/clear",
    args: "",
    description_ru: "очистить контекст",
    description_en: "clear context",
  },
  {
    name: "/retry",
    args: "",
    description_ru: "повторить запрос",
    description_en: "retry request",
  },
  {
    name: "/image",
    args: "<prompt>",
    description_ru: "сгенерировать изображение",
    description_en: "generate image",
  },
  {
    name: "/voice",
    args: "",
    description_ru: "включить голосовой ввод",
    description_en: "enable voice input",
  },
];

export function renderCommands(
  commands: Command[],
  lang: "ru" | "en"
): string {
  const desc = lang === "ru" ? "description_ru" : "description_en";
  return "📋 COMMANDS\n\n" + commands.map((c) =>
    `${c.name} ${c.args}\n— ${c[desc]}`
  ).join("\n\n");
}

export function renderForgeCommands(lang: "ru" | "en"): string {
  return renderCommands(FORGE_COMMANDS, lang);
}

export function renderTeleGPTCommands(lang: "ru" | "en"): string {
  return renderCommands(TELEGPT_COMMANDS, lang);
}