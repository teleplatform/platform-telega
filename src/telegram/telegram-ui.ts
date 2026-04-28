import type { Context, Telegraf } from "telegraf";

const BTN = {
  arisha: "🧠 Ариша",
  agents: "🤖 Агенты",
  tools: "🧰 Инструменты",
  telega: "🏗 Tele•Ga",
  creator: "⚙️ Creator",
  help: "❓ Помощь",
  back: "🔙 Назад",

  write: "💬 Написать Арише",
  context: "🗂 Последний контекст",
  memory: "🧠 Память проекта",
  voice: "🎙 Голосовой режим",
  quick: "🪄 Быстрые задачи",

  alice: "📡 Alice Bridge",
  creatorBridge: "🌐 Creator Bridge",
  spyglass: "🔎 Spyglass",
  sigma: "🛠 Sigma Forge",
  t800: "🧱 T-800",
  moreAgents: "➕ Ещё агенты",

  genText: "📝 Сгенерировать текст",
  productCard: "📦 Карточка товара",
  summary: "🧾 Сводка / выжимка",
  file: "📂 Файл / артефакт",
  translate: "🔤 Перевод / адаптация",
  analysis: "📊 Анализ",

  studio: "🏪 Studio",
  marketbase: "🛒 MarketBase",
  services: "🧑‍🔧 Services",
  atlas: "📈 Atlas",
  mission: "📚 Mission Control",
  wallet: "🪙 Wallet / Teleton",

  creatorMode: "🧬 Creator Mode",
  providers: "🔌 Провайдеры",
  systemStatus: "🩺 Статус системы",
  logs: "📜 Логи / трасса",
  memoryPacks: "🧠 Memory Packs",
  policies: "🛡 Политики / доступ",

  capabilities: "📖 Что умеет бот",
  quickstart: "🚀 Быстрый старт",
  modules: "🗺 Карта модулей",
  diagnostics: "🆘 Диагностика",
} as const;

type MenuKey =
  | "main"
  | "arisha"
  | "agents"
  | "tools"
  | "telega"
  | "creator"
  | "help";

const MENU_TEXT: Record<MenuKey, string> = {
  main:
    "Привет. Это Tele•GPT — управляющая AI-поверхность Tele•Ga.\n\n" +
    "Здесь ты можешь общаться с Аришей, запускать агентные модули, использовать инструменты и управлять Creator-средой.",
  arisha: "🧠 Ариша\n\nОсновной persona-layer ассистента.",
  agents: "🤖 Агенты\n\nКарта агентных модулей Tele•GPT.",
  tools: "🧰 Инструменты\n\nБыстрые прикладные действия и результатные задачи.",
  telega: "🏗 Tele•Ga\n\nПлатформенные сущности и точки входа в экосистему.",
  creator: "⚙️ Creator\n\nЗакрытая управляющая зона и control surface.",
  help: "❓ Помощь\n\nНавигация, возможности и диагностика.",
};

function keyboard(rows: string[][]) {
  return {
    keyboard: rows.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
    is_persistent: true,
    one_time_keyboard: false,
    input_field_placeholder: "Выбери раздел или напиши сообщение",
  };
}

function menuKeyboard(menu: MenuKey) {
  switch (menu) {
    case "main":
      return keyboard([
        [BTN.arisha, BTN.agents],
        [BTN.tools, BTN.telega],
        [BTN.creator, BTN.help],
      ]);
    case "arisha":
      return keyboard([
        [BTN.write, BTN.context],
        [BTN.memory, BTN.voice],
        [BTN.quick],
        [BTN.back],
      ]);
    case "agents":
      return keyboard([
        [BTN.alice, BTN.creatorBridge],
        [BTN.spyglass, BTN.sigma],
        [BTN.t800, BTN.moreAgents],
        [BTN.back],
      ]);
    case "tools":
      return keyboard([
        [BTN.genText, BTN.productCard],
        [BTN.summary, BTN.file],
        [BTN.translate, BTN.analysis],
        [BTN.back],
      ]);
    case "telega":
      return keyboard([
        [BTN.studio, BTN.marketbase],
        [BTN.services, BTN.atlas],
        [BTN.mission, BTN.wallet],
        [BTN.back],
      ]);
    case "creator":
      return keyboard([
        [BTN.creatorMode, BTN.providers],
        [BTN.systemStatus, BTN.logs],
        [BTN.memoryPacks, BTN.policies],
        [BTN.back],
      ]);
    case "help":
      return keyboard([
        [BTN.capabilities, BTN.quickstart],
        [BTN.modules, BTN.diagnostics],
        [BTN.back],
      ]);
  }
}

async function safeReply(ctx: Context, text: string, reply_markup?: any) {
  try {
    if (reply_markup) {
      await ctx.reply(text, { reply_markup });
      return;
    }
    await ctx.reply(text);
  } catch (error) {
    console.error("[telegram-ui] reply failed:", error);
  }
}

async function openMenu(ctx: Context, menu: MenuKey) {
  console.log("[telegram-ui] openMenu", menu, "chat:", ctx.chat?.id);
  await safeReply(ctx, MENU_TEXT[menu], menuKeyboard(menu));
}

type ActionHandler = (ctx: Context) => Promise<void>;

const ACTIONS: Record<string, ActionHandler> = {
  [BTN.arisha]: async (ctx) => openMenu(ctx, "arisha"),
  [BTN.agents]: async (ctx) => openMenu(ctx, "agents"),
  [BTN.tools]: async (ctx) => openMenu(ctx, "tools"),
  [BTN.telega]: async (ctx) => openMenu(ctx, "telega"),
  [BTN.creator]: async (ctx) => openMenu(ctx, "creator"),
  [BTN.help]: async (ctx) => openMenu(ctx, "help"),
  [BTN.back]: async (ctx) => openMenu(ctx, "main"),

  [BTN.write]: async (ctx) => {
    await safeReply(ctx, "Напиши задачу для Ариши.");
  },
  [BTN.context]: async (ctx) => {
    await safeReply(ctx, "Открываю последний контекст.");
  },
  [BTN.memory]: async (ctx) => {
    await safeReply(ctx, "Открываю память проекта.");
  },
  [BTN.voice]: async (ctx) => {
    await safeReply(ctx, "Открываю голосовой режим.");
  },
  [BTN.quick]: async (ctx) => {
    await safeReply(ctx, "Показываю быстрые задачи.");
  },

  [BTN.alice]: async (ctx) => {
    await safeReply(ctx, "📡 Alice Bridge");
  },
  [BTN.creatorBridge]: async (ctx) => {
    await safeReply(ctx, "🌐 Creator Bridge");
  },
  [BTN.spyglass]: async (ctx) => {
    await safeReply(ctx, "🔎 Spyglass");
  },
  [BTN.sigma]: async (ctx) => {
    await safeReply(ctx, "🛠 Sigma Forge");
  },
  [BTN.t800]: async (ctx) => {
    await safeReply(ctx, "🧱 T-800");
  },
  [BTN.moreAgents]: async (ctx) => {
    await safeReply(ctx, "Список дополнительных агентов.");
  },

  [BTN.genText]: async (ctx) => {
    await safeReply(ctx, "Запуск генерации текста.");
  },
  [BTN.productCard]: async (ctx) => {
    await safeReply(ctx, "Открываю режим карточки товара.");
  },
  [BTN.summary]: async (ctx) => {
    await safeReply(ctx, "Открываю режим сводки / выжимки.");
  },
  [BTN.file]: async (ctx) => {
    await safeReply(ctx, "Открываю работу с файлами / артефактами.");
  },
  [BTN.translate]: async (ctx) => {
    await safeReply(ctx, "Открываю перевод / адаптацию.");
  },
  [BTN.analysis]: async (ctx) => {
    await safeReply(ctx, "Открываю анализ.");
  },

  [BTN.studio]: async (ctx) => {
    await safeReply(ctx, "🏪 Tele•Ga Studio");
  },
  [BTN.marketbase]: async (ctx) => {
    await safeReply(ctx, "🛒 MarketBase");
  },
  [BTN.services]: async (ctx) => {
    await safeReply(ctx, "🧑‍🔧 Services");
  },
  [BTN.atlas]: async (ctx) => {
    await safeReply(ctx, "📣 Atlas");
  },
  [BTN.mission]: async (ctx) => {
    await safeReply(ctx, "📚 Mission Control");
  },
  [BTN.wallet]: async (ctx) => {
    await safeReply(ctx, "🪙 Wallet / Teleton");
  },

  [BTN.creatorMode]: async (ctx) => {
    await safeReply(ctx, "🧬 Creator Mode");
  },
  [BTN.providers]: async (ctx) => {
    await safeReply(ctx, "🔌 Провайдеры");
  },
  [BTN.systemStatus]: async (ctx) => {
    await safeReply(ctx, "🩺 Статус системы");
  },
  [BTN.logs]: async (ctx) => {
    await safeReply(ctx, "📜 Логи / трасса");
  },
  [BTN.memoryPacks]: async (ctx) => {
    await safeReply(ctx, "🧠 Memory Packs");
  },
  [BTN.policies]: async (ctx) => {
    await safeReply(ctx, "🛡 Политики / доступ");
  },

  [BTN.capabilities]: async (ctx) => {
    await safeReply(ctx, "Показываю, что умеет бот.");
  },
  [BTN.quickstart]: async (ctx) => {
    await safeReply(ctx, "Открываю быстрый старт.");
  },
  [BTN.modules]: async (ctx) => {
    await safeReply(ctx, "Открываю карту модулей.");
  },
  [BTN.diagnostics]: async (ctx) => {
    await safeReply(ctx, "Открываю диагностику.");
  },
};

export async function initTelegramUi(bot: Telegraf): Promise<void> {
  const commands = [
    { command: "start", description: "Запуск бота" },
    { command: "menu", description: "Главное меню" },
    { command: "help", description: "Помощь" },
    { command: "settings", description: "Настройки" },
    { command: "status", description: "Статус" },
  ];

  try {
    await bot.telegram.deleteMyCommands({ scope: { type: "default" } }).catch(() => {});
    await bot.telegram.deleteMyCommands({ scope: { type: "all_private_chats" } }).catch(() => {});

    await bot.telegram.setMyCommands(commands, { scope: { type: "default" } });
    await bot.telegram.setMyCommands(commands, { scope: { type: "all_private_chats" } });

    await bot.telegram
      .setChatMenuButton({
        menuButton: { type: "commands" },
      })
      .catch((error) => {
        console.error("[telegram-ui] setChatMenuButton failed:", error);
      });
  } catch (error) {
    console.error("[telegram-ui] init failed:", error);
  }

  registerTelegramUiHandlers(bot);
}

export function registerTelegramUiHandlers(bot: Telegraf): void {
  bot.command("start", async (ctx) => {
    await openMenu(ctx, "main");
  });

  bot.command("menu", async (ctx) => {
    await openMenu(ctx, "main");
  });

  bot.command("help", async (ctx) => {
    await openMenu(ctx, "help");
  });

  for (const [label, handler] of Object.entries(ACTIONS)) {
    bot.hears(label, async (ctx) => {
      await handler(ctx);
    });
  }

  
  bot.command("keyboard", async (ctx) => {
    await openMenu(ctx, "main");
  });

console.log("[telegram-ui] Canonical menu v1 registered");
}
