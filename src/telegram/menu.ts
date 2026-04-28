import { Markup } from "telegraf";
import { getRuntimeRole, hasCapability, type RuntimeRole } from "../core/auth/runtime-access.js";

export type MenuId =
  | "main_public"
  | "main_owner"
  | "main_partner"
  | "arisha"
  | "agents"
  | "tools"
  | "telega"
  | "creator"
  | "runtime_admin"
  | "diagnostics"
  | "help";

export type CallbackAction =
  | "menu:main_public"
  | "menu:arisha"
  | "menu:agents"
  | "menu:tools"
  | "menu:telega"
  | "menu:creator"
  | "menu:help"
  | "arisha:chat"
  | "arisha:context"
  | "arisha:memory"
  | "arisha:voice"
  | "arisha:quick_tasks"
  | "agents:alice_bridge"
  | "agents:creator_bridge"
  | "agents:spyglass"
  | "agents:sigma_forge"
  | "agents:t800"
  | "tools:generate_text"
  | "tools:product_card"
  | "tools:summary"
  | "tools:file_artifact"
  | "tools:translate"
  | "tools:analyze"
  | "telega:studio"
  | "telega:marketbase"
  | "telega:services"
  | "telega:atlas"
  | "telega:mission_control"
  | "telega:wallet"
  | "creator:mode"
  | "creator:providers"
  | "creator:status"
  | "creator:logs"
  | "creator:memory_packs"
  | "creator:policies"
  | "help:capabilities"
  | "help:quick_start"
  | "help:map"
  | "help:diagnostics"
  | "ops:open"
  | "menu:runtime_admin"
  | "menu:diagnostics"
  | "menu:main_owner"
  | "menu:main_partner"
  | "admin:restart_bot"
  | "admin:restart_watchdog"
  | "admin:logs"
  | "admin:services"
  | "diag:health"
  | "diag:providers"
  | "diag:state"
  | "diag:metrics";

export type BotMode =
  | "idle"
  | "awaiting_arisha_chat"
  | "awaiting_generate_text"
  | "awaiting_product_card"
  | "awaiting_summary"
  | "awaiting_file_artifact"
  | "awaiting_translate"
  | "awaiting_analyze";

export type SessionState = {
  mode: BotMode;
  provider?: string;
  bridge_enabled?: boolean;
  creatorMode?: boolean;
  voice_enabled?: boolean;
};

const sessionStore = new Map<number, SessionState>();

export function getSession(chatId: number): SessionState {
  const existing = sessionStore.get(chatId);
  if (existing) return existing;
  const created: SessionState = { mode: "idle" };
  sessionStore.set(chatId, created);
  return created;
}

export function setSessionProvider(chatId: number, provider: string): void {
  const session = getSession(chatId);
  session.provider = provider;
  sessionStore.set(chatId, session);
  console.log("[menu] setSessionProvider:", chatId, provider);
}

export function getSessionProvider(chatId: number): string | undefined {
  return getSession(chatId).provider;
}

export function setMode(chatId: number, mode: BotMode): void {
  const session = getSession(chatId);
  session.mode = mode;
  sessionStore.set(chatId, session);
}

export function resetMode(chatId: number): void {
  setMode(chatId, "idle");
}

export function kb(rows: Array<Array<{ text: string; data: CallbackAction }>>) {
  return Markup.inlineKeyboard(
    rows.map((row) =>
      row.map((button) => Markup.button.callback(button.text, button.data))
    )
  );
}

export interface MenuDefinition {
  title: string;
  text: string;
  keyboard: ReturnType<typeof kb>;
}

export const MAIN_MENU_PUBLIC: MenuDefinition = {
  title: "Tele·GPT",
  text: "Добро пожаловать в Tele·GPT.\n\nОбщайся с Аришей, используй инструменты и помощь.",
  keyboard: kb([
    [
      { text: "🧠 Ариша", data: "menu:arisha" },
      { text: "🧰 Инструменты", data: "menu:tools" },
    ],
    [
      { text: "🏗 Tele·Ga", data: "menu:telega" },
      { text: "❓ Помощь", data: "menu:help" },
    ],
  ]),
};

export const MAIN_MENU_OWNER: MenuDefinition = {
  title: "Tele·GPT Control Surface",
  text: "Добро пожаловать в Tele·GPT Owner Mode.\n\nПолный доступ ко всем функциям системы.",
  keyboard: kb([
    [
      { text: "🧠 Ариша", data: "menu:arisha" },
      { text: "🤖 Агенты", data: "menu:agents" },
    ],
    [
      { text: "🧰 Инструменты", data: "menu:tools" },
      { text: "🏗 Tele·Ga", data: "menu:telega" },
    ],
    [
      { text: "⚙️ Creator", data: "menu:creator" },
      { text: "🛡 Ops", data: "ops:open" },
    ],
    [
      { text: "🔐 Runtime Admin", data: "menu:runtime_admin" },
      { text: "📊 Diagnostics", data: "menu:diagnostics" },
    ],
    [
      { text: "❓ Помощь", data: "menu:help" },
    ],
  ]),
};

export const MAIN_MENU_PARTNER: MenuDefinition = {
  title: "Tele·GPT Partner",
  text: "Добро пожаловать в Tele·GPT Partner Mode.\n\nБезопасный доступ к инструментам.",
  keyboard: kb([
    [
      { text: "🧠 Ариша", data: "menu:arisha" },
      { text: "🤖 Агенты", data: "menu:agents" },
    ],
    [
      { text: "🧰 Инструменты", data: "menu:tools" },
      { text: "🛡 Ops", data: "ops:open" },
    ],
    [
      { text: "❓ Помощь", data: "menu:help" },
    ],
  ]),
};

export const MENU_MAP: Record<MenuId, MenuDefinition> = {
  main_public: MAIN_MENU_PUBLIC,
  main_owner: MAIN_MENU_OWNER,
  main_partner: MAIN_MENU_PARTNER,
  runtime_admin: {
    title: "🔐 Runtime Admin",
    text: "Runtime Admin Panel.\n\nПолный контроль над системой.",
    keyboard: kb([
      [
        { text: "�Restart Bot", data: "admin:restart_bot" },
        { text: "🧹Restart Watchdog", data: "admin:restart_watchdog" },
      ],
      [
        { text: "📜 Логи", data: "admin:logs" },
        { text: "🔧 Services", data: "admin:services" },
      ],
      [
        { text: "⬅️ Назад", data: "menu:main_owner" },
      ],
    ]),
  },
  diagnostics: {
    title: "📊 Diagnostics",
    text: "System Diagnostics.\n\nМетрики и состояние системы.",
    keyboard: kb([
      [
        { text: "📈 Health", data: "diag:health" },
        { text: "🔌 Providers", data: "diag:providers" },
      ],
      [
        { text: "💾 State", data: "diag:state" },
        { text: "⚡ Metrics", data: "diag:metrics" },
      ],
      [
        { text: "⬅️ Назад", data: "menu:main_owner" },
      ],
    ]),
  },

  arisha: {
    title: "🧠 Ариша",
    text: "Раздел Ариши.\n\nЗдесь находится основной persona-layer ассистента: общение, контекст, память и быстрые задачи.",
    keyboard: kb([
      [
        { text: "💬 Написать Арише", data: "arisha:chat" },
        { text: "🗂 Последний контекст", data: "arisha:context" },
      ],
      [
        { text: "🧠 Память проекта", data: "arisha:memory" },
        { text: "🎙 Голосовой режим", data: "arisha:voice" },
      ],
      [{ text: "🪄 Быстрые задачи", data: "arisha:quick_tasks" }],
      [{ text: "⬅️ Назад", data: "menu:main_public" }],
    ]),
  },

  agents: {
    title: "🤖 Агенты",
    text: "Агентная карта Tele·GPT.\n\nЗдесь находятся bridge и agent-модули системы.",
    keyboard: kb([
      [
        { text: "📡 Alice Bridge", data: "agents:alice_bridge" },
        { text: "🌐 Creator Bridge", data: "agents:creator_bridge" },
      ],
      [
        { text: "🔎 Spyglass", data: "agents:spyglass" },
        { text: "🛠 Sigma Forge", data: "agents:sigma_forge" },
      ],
      [{ text: "🧱 T-800", data: "agents:t800" }],
      [{ text: "⬅️ Назад", data: "menu:main_public" }],
    ]),
  },

  tools: {
    title: "🧰 Инструменты",
    text: "Прикладные инструменты.\n\nВыбирай задачу, и бот переключится в нужный режим.",
    keyboard: kb([
      [
        { text: "📝 Сгенерировать текст", data: "tools:generate_text" },
        { text: "📦 Карточка товара", data: "tools:product_card" },
      ],
      [
        { text: "🧾 Сводка / выжимка", data: "tools:summary" },
        { text: "📂 Файл / артефакт", data: "tools:file_artifact" },
      ],
      [
        { text: "🔤 Перевод / адаптация", data: "tools:translate" },
        { text: "📊 Анализ", data: "tools:analyze" },
      ],
      [{ text: "⬅️ Назад", data: "menu:main_public" }],
    ]),
  },

  telega: {
    title: "🏗 Tele·Ga",
    text: "Раздел платформы Tele·Ga.\n\nЗдесь собраны ключевые поверхности и продуктовые модули.",
    keyboard: kb([
      [
        { text: "🏪 Studio", data: "telega:studio" },
        { text: "🛒 MarketBase", data: "telega:marketbase" },
      ],
      [
        { text: "🧑‍🔧 Services", data: "telega:services" },
        { text: "📣 Atlas", data: "telega:atlas" },
      ],
      [
        { text: "📚 Mission Control", data: "telega:mission_control" },
        { text: "🪙 Wallet / Teleton", data: "telega:wallet" },
      ],
      [{ text: "⬅️ Назад", data: "menu:main_public" }],
    ]),
  },

  creator: {
    title: "⚙️ Creator",
    text: "Creator control surface.\n\nЛичный управляющий слой: провайдеры, статус, память, политики.",
    keyboard: kb([
      [
        { text: "🧬 Creator Mode", data: "creator:mode" },
        { text: "🔌 Провайдеры", data: "creator:providers" },
      ],
      [
        { text: "🩺 Статус системы", data: "creator:status" },
        { text: "📜 Логи / трасса", data: "creator:logs" },
      ],
      [
        { text: "🧠 Memory Packs", data: "creator:memory_packs" },
        { text: "🛡 Политики / дост��п", data: "creator:policies" },
      ],
      [{ text: "⬅️ Назад", data: "menu:main_public" }],
    ]),
  },

  help: {
    title: "❓ Помощь",
    text: "Справочный раздел.\n\nЗдесь быстрый старт, карта модулей и диагностика.",
    keyboard: kb([
      [
        { text: "📖 Что умеет бот", data: "help:capabilities" },
        { text: "🚀 Быстрый старт", data: "help:quick_start" },
      ],
      [
        { text: "🗺 Карта модулей", data: "help:map" },
        { text: "🆘 Диагностика", data: "help:diagnostics" },
      ],
      [{ text: "⬅️ Назад", data: "menu:main_public" }],
    ]),
  },
};

export function menuMessage(menuId: MenuId) {
  const menu = MENU_MAP[menuId];
  return {
    text: `*${menu.title}*\n\n${menu.text}`,
    reply_markup: menu.keyboard,
  };
}

export function isMenuAction(action: string): action is `menu:${MenuId}` {
  return action.startsWith("menu:");
}

export function parseMenuId(action: `menu:${MenuId}`): MenuId {
  return action.split(":")[1] as MenuId;
}

export function getMainMenuForRole(userId: string | number): MenuId {
  const role = getRuntimeRole(userId);
  switch (role) {
    case "owner_creator_primary":
    case "owner_creator_secondary":
      return "main_owner";
    case "partner_creator":
      return "main_partner";
    default:
      return "main_public";
  }
}

export function getMainMenuIdForUser(userId?: string | number | null): MenuId {
  if (!userId) return "main_public";
  return getMainMenuForRole(userId);
}

export async function sendMenu(ctx: any, menuId: MenuId, edit = false) {
  // DISABLED: Don't send persistent keyboard from menu.ts
  // Keep telegram-ui.ts as the ONLY source of main keyboard
  const payload = menuMessage(menuId);
  const chatId = (ctx as any)?.chat?.id;
  const messageId = (ctx as any)?.message?.message_id;

  if (edit && messageId) {
    try {
      await (ctx as any).editMessageText(payload.text, {
        message_id: messageId,
        parse_mode: "Markdown",
        // NO keyboard - let telegram-ui handle persistent menu
      });
      return;
    } catch {}
  }

  await (ctx as any)?.reply(payload.text, {
    parse_mode: "Markdown",
    // NO keyboard - let telegram-ui handle persistent menu
  });
}

export async function answerAction(
  ctx: any,
  text: string,
  backTo: MenuId = "main_public",
  mode?: BotMode
) {
  const chatId = (ctx as any)?.chat?.id;
  if (mode && chatId) setMode(chatId, mode);

  // Use inline button instead of reply keyboard
  await (ctx as any)?.reply(text, {
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Назад", callback_data: `menu:${backTo}` }]]
    },
  });
}

export const WELCOME_MESSAGE = `🤖 *Tele·GPT Control Surface*

Это управляющая AI-поверхность Tele·Ga — экосистема нового поколения.

Здесь ты можешь:
• Общаться с *Аришей* — живым AI-ассистентом
• Запускать *агентные модули* для сложных задач
• Использовать *инструменты* для быстрых результатов
• Управлять *Creator-средой* внутри бота

Выбери раздел из меню ниже 👇`;

export async function handleCallback(
  ctx: any,
  action: CallbackAction
): Promise<boolean> {
  const query = (ctx as any)?.callbackQuery;
  const chatId = query?.message?.chat?.id || (ctx as any)?.message?.chat?.id;
  const messageId = query?.message?.message_id || (ctx as any)?.message?.message_id;
  console.log("[menu] handleCallback:", action, "chatId:", chatId);

  if (isMenuAction(action)) {
    const menuId = parseMenuId(action);
    await sendMenu(ctx, menuId, true);
    return true;
  }

  switch (action) {
    case "arisha:chat":
      await answerAction(ctx, "Режим общения с Аришей открыт.\n\nПросто напиши следующее сообщение обычным текстом.", "arisha", "awaiting_arisha_chat");
      return true;

    case "arisha:context":
      await answerAction(ctx, "Последний контекст: загружаю...", "arisha");
      return true;

    case "arisha:memory":
      await answerAction(ctx, "Память проекта — отдельный слой.", "arisha");
      return true;

    case "arisha:voice":
      await answerAction(ctx, "Голосовой режим акти��ир��ван.", "arisha");
      return true;

    case "arisha:quick_tasks":
      await answerAction(ctx, "Быстрые задачи:\n• описание товара\n• краткая сводка\n• перевод\n• анализ текста", "arisha");
      return true;

    case "agents:alice_bridge":
      await answerAction(ctx, "Alice Bridge — voice ingress surface.", "agents");
      return true;

    case "agents:creator_bridge":
      await answerAction(ctx, "Creator Bridge — browser/provider bridge.", "agents");
      return true;

    case "agents:spyglass":
      await answerAction(ctx, "Spyglass — модуль наблюдения.", "agents");
      return true;

    case "agents:sigma_forge":
      try {
        const { executeForgeTask, getForgeHealth } = await import("../core/forge/index.js");
        const health = await getForgeHealth();
        const status = health.ok ? "доступен" : "временно недоступен";
        await answerAction(
          ctx,
          `🛠 Sigma Forge — execution layer.\n\nСтатус: ${status}\nExecutor: ${health.executor}\n\nВведи задачу для выполнения.`,
          "agents"
        );
      } catch (e) {
        await answerAction(ctx, "🛠 Sigma Forge — execution layer.", "agents");
      }
      return true;

    case "agents:t800":
      await answerAction(ctx, "T-800 — системный автомат.", "agents");
      return true;

    case "tools:generate_text":
      await answerAction(ctx, "Режим генерации текста.\n\nПришли задачу следующим сообщением.", "tools", "awaiting_generate_text");
      return true;

    case "tools:product_card":
      await answerAction(ctx, "Режим карточки товара.\n\nПришли описание товара.", "tools", "awaiting_product_card");
      return true;

    case "tools:summary":
      await answerAction(ctx, "Режим сводки.\n\nПришли текст или ссылку.", "tools", "awaiting_summary");
      return true;

    case "tools:file_artifact":
      await answerAction(ctx, "Режим файла/артефакта.\n\nПришли код или текст.", "tools", "awaiting_file_artifact");
      return true;

    case "tools:translate":
      await answerAction(ctx, "Режим перевода.\n\nПришли исходный текст.", "tools", "awaiting_translate");
      return true;

    case "tools:analyze":
      await answerAction(ctx, "Режим анализа.\n\nПришли материал.", "tools", "awaiting_analyze");
      return true;

    case "telega:studio":
      await answerAction(ctx, "Tele·Ga Studio.", "telega");
      return true;

    case "telega:marketbase":
      await answerAction(ctx, "MarketBase.", "telega");
      return true;

    case "telega:services":
      await answerAction(ctx, "Services.", "telega");
      return true;

    case "telega:atlas":
      await answerAction(ctx, "Atlas.", "telega");
      return true;

    case "telega:mission_control":
      await answerAction(ctx, "Mission Control.", "telega");
      return true;

    case "telega:wallet":
      await answerAction(ctx, "Wallet / Teleton.", "telega");
      return true;

    case "creator:mode":
      await answerAction(ctx, "Creator Mode — управляющий режим.", "creator");
      return true;

    case "creator:providers":
      await answerAction(ctx, "Провайдеры — маршрутизация моделей.", "creator");
      return true;

    case "creator:status":
      await answerAction(ctx, "Статус системы — health/readiness.", "creator");
      return true;

    case "creator:logs":
      await answerAction(ctx, "Логи / трасса.", "creator");
      return true;

    case "creator:memory_packs":
      await answerAction(ctx, "Memory Packs.", "creator");
      return true;

    case "creator:policies":
      await answerAction(ctx, "Политики / доступ.", "creator");
      return true;

    case "ops:open":
      const { handleOpsCommand } = await import("./operator/operator-telemetry.handlers.js");
      await handleOpsCommand(ctx);
      return true;

    case "help:capabilities":
      await answerAction(ctx, "Бот умеет: общение с Аришей, агентные поверхности, генерацию текста, сводки, анализ и Creator-управление.", "help");
      return true;

    case "help:quick_start":
      await answerAction(ctx, "Быстрый старт:\n1. Открой раздел\n2. Выбери режим\n3. Отправь задачу", "help");
      return true;

    case "help:map":
      await answerAction(ctx, "Карта модулей:\nАриша → Агенты → Инструменты → Tele·Ga → Creator → Помощь", "help");
      return true;

    case "help:diagnostics":
      await answerAction(ctx, "Диагностика — health checks, bridge state.", "help");
      return true;

    default:
      return false;
  }
}

export async function handleModeMessage(
  ctx: any,
  text: string
): Promise<boolean> {
  const chatId = (ctx as any)?.chat?.id;
  console.log("[menu] handleModeMessage called:", chatId, text?.slice(0, 50));
  if (!chatId) return false;

  await (ctx as any)?.sendChatAction("typing");

  const session = getSession(chatId);

  const modeInstructions: Record<BotMode, string> = {
    idle: "",
    awaiting_arisha_chat: "Ты - Ариша, AI-ассистент. Отвечай на сообщение пользователя.",
    awaiting_generate_text: "Создай креативный текст на основе запроса. Это может быть статья, пост, описание или любой формат.",
    awaiting_product_card: "Создай карточку товара: название, описание, ключевые характеристики, цена (если есть), CTA.",
    awaiting_summary: "Сделай краткую выжимку из текста. Основные тезисы, суть.",
    awaiting_file_artifact: "Создай артефакт (код, документ, инструкцию) на основе запроса.",
    awaiting_translate: "Переведи текст на указанный язык или адаптируй под культурные особенности.",
    awaiting_analyze: "Проанализируй материал: извлеки ключевые данные, тренды, инсайты.",
  };

  const instruction = modeInstructions[session.mode];
  if (!instruction) return false;

  const enhancedPrompt = instruction + `\n\nЗапрос: ${text}`;
  resetMode(chatId);

  try {
    const { routeChat } = await import("../core/router.js");
    const result = await routeChat({
      message: enhancedPrompt,
      chatId: String(chatId),
      userId: String((ctx as any)?.from?.id || ""),
      creatorMode: true,
    } as any);

    console.log("[menu] routeChat result:", JSON.stringify(result).slice(0, 300));

    if (result?.output) {
      const output = result.output;
      const TELEGRAM_LIMIT = 3500;
      
      if (output.length > TELEGRAM_LIMIT) {
        console.log("[menu] output too long, splitting:", output.length);
        await (ctx as any)?.sendChatAction("typing");
        
        const chunks: string[] = [];
        let remaining = output;
        while (remaining.length > TELEGRAM_LIMIT) {
          let cut = remaining.lastIndexOf("\n", TELEGRAM_LIMIT);
          if (cut < TELEGRAM_LIMIT * 0.5) cut = remaining.lastIndexOf(" ", TELEGRAM_LIMIT);
          if (cut < TELEGRAM_LIMIT * 0.5) cut = TELEGRAM_LIMIT;
          chunks.push(remaining.slice(0, cut).trim());
          remaining = remaining.slice(cut).trim();
        }
        if (remaining) chunks.push(remaining);
        
        for (let i = 0; i < chunks.length; i++) {
          await (ctx as any)?.reply(chunks[i]);
          if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 100));
        }
        console.log("[menu] sent", chunks.length, "chunks");
      } else {
        console.log("[menu] sending normal reply:", output.slice(0, 50));
        await (ctx as any)?.sendChatAction("typing");
        const replyResult = await (ctx as any)?.reply(output);
        console.log("[menu] ctx.reply result:", replyResult);
        console.log("[menu] reply sent successfully");
      }
      return true;
    } else {
      console.log("[menu] NO output in result, falling back");
    }
  } catch (err) {
    console.log("[menu] routeChat error:", err);
  }

  await (ctx as any)?.reply(`🧠 ${instruction}\n\nВыполняю: ${text.slice(0, 100)}...`);
  return true;
}