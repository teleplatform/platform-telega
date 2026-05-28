import { Markup } from "telegraf";
import { MSG } from "#i18n/messages";
import { listBuildResultsFromIndex, getBuildResultsCount } from "../../intel/buildResultIndex.js";
import type { TelegramRole, TelegramProvider, UserRuntimeSettings } from "../state/telegram-state.js";

export const TELEGRAM_PROVIDERS: Array<{ id: TelegramProvider; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "openai_web", label: "OpenAI Web" },
  { id: "qwen_web", label: "Qwen Web" },
  { id: "deepseek_web", label: "DeepSeek Web" },
  { id: "kimi_web", label: "Kimi Web" },
  { id: "ollama_local", label: "Local/Ollama" },
];

export function providerLabel(provider: TelegramProvider | undefined): string {
  return TELEGRAM_PROVIDERS.find((p) => p.id === provider)?.label || "Auto";
}

export function menuButtonKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("▦ Menu", "split:v2:main")]]);
}

export function compactMenuKeyboard(role: TelegramRole) {
   if (role === "owner") {
     return Markup.inlineKeyboard([
       [Markup.button.callback("🤖 Chat", "split:v2:chat"), Markup.button.callback("🧠 Providers", "split:v2:providers")],
       [Markup.button.callback("🌉 Creator Bridge", "split:v2:bridge")],
       [Markup.button.callback("⚙️ Settings", "split:v2:settings")],
       [Markup.button.callback("❌ Collapse", "split:v2:collapse")],
     ]);
   }
   if (role === "partner") {
     return Markup.inlineKeyboard([
       [Markup.button.callback("🤖 Chat", "split:v2:chat"), Markup.button.callback("🧠 Providers", "split:v2:providers")],
       [Markup.button.callback("⚙️ Settings", "split:v2:settings")],
       [Markup.button.callback("❌ Collapse", "split:v2:collapse")],
     ]);
   }
   return Markup.inlineKeyboard([
     [Markup.button.callback("🤖 Chat", "split:v2:chat")],
     [Markup.button.callback("❓ Help", "split:v2:help"), Markup.button.callback("⚙️ Settings", "split:v2:settings")],
     [Markup.button.callback("❌ Collapse", "split:v2:collapse")],
   ]);
 }

export function providerKeyboard(settings: UserRuntimeSettings, role: TelegramRole) {
    const rows: any[][] = [];
    
    if (role !== "public") {
      // Add header with current status for creators
      const currentProvider = settings.provider || "auto";
      const providerLabelText = providerLabel(currentProvider);
      
      // Determine mode
      let mode = "Auto";
      if (currentProvider === "ollama_local") mode = "Local";
      else if (["openai_web", "qwen_web", "deepseek_web", "kimi_web"].includes(currentProvider)) mode = "Web";
      else if (currentProvider === "auto") {
        // Determine actual mode for auto
        const llmProvider = (process.env.LLM_PROVIDER || "").toLowerCase();
        if (llmProvider === "ollama") mode = "Local";
        else {
          const localUrl = (process.env.LOCAL_OPENAI_BASE_URL || "").trim();
          const localModel = (process.env.LOCAL_OPENAI_MODEL || "").trim();
          if (localUrl && localModel) mode = "Local";
          else mode = "API";
        }
      }
      
      // Add status header
      rows.push([
        Markup.button.callback(`⚡ Provider Control\nMode: ${mode}\nActive: ${providerLabelText}`, "provider:status:header")
      ]);
      rows.push([Markup.button.callback("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "provider:separator")]);
    }
    
    // Main provider selection buttons
    if (role === "public") {
      // Public users see only basic controls
      rows.push([Markup.button.callback("🤖 Chat", "split:v2:chat")]);
      rows.push([Markup.button.callback("❓ Help", "split:v2:help")]);
      rows.push([Markup.button.callback("⚙️ Settings", "split:v2:settings")]);
    } else {
      // Creator users see full provider controls
      // Mode selection
      rows.push([
        Markup.button.callback(`🔄 Auto${(settings.provider || "auto") === "auto" ? " ✅" : ""}`, "provider:set:auto"),
        Markup.button.callback(`💻 Local${(settings.provider || "auto") === "ollama_local" ? " ✅" : ""}`, "provider:set:ollama_local")
      ]);
      rows.push([
        Markup.button.callback(`🌐 API${(settings.provider || "auto") === "openai_web" || (settings.provider || "auto") === "qwen_web" || (settings.provider || "auto") === "deepseek_web" || (settings.provider || "auto") === "kimi_web" ? " ✅" : ""}`, "provider:mode:api"),
        Markup.button.callback(`🌍 Web${settings.bridgeEnabled ? " ✅" : ""}`, "provider:mode:web")
      ]);
      
      // API provider buttons
      rows.push([Markup.button.callback("━━━ API Providers ━━━", "provider:separator")]);
      const apiProviders = [
        { id: "openai_web", label: "OpenAI API" },
        { id: "qwen_web", label: "Qwen API" },
        { id: "deepseek_web", label: "DeepSeek API" }
      ];
      
      for (const provider of apiProviders) {
        const selected = (settings.provider || "auto") === provider.id ? "✅ " : "";
        rows.push([Markup.button.callback(`${selected}${provider.label}`, `provider:set:${provider.id}`)]);
      }
      
      // Web provider buttons
      rows.push([Markup.button.callback("━━━ Web Providers ━━━", "provider:separator")]);
      const webProviders = [
        { id: "openai_web", label: "OpenAI Web" },
        { id: "qwen_web", label: "Qwen Web" },
        { id: "deepseek_web", label: "DeepSeek Web" }
      ];
      
      for (const provider of webProviders) {
        const selected = (settings.provider || "auto") === provider.id ? "✅ " : "";
        rows.push([Markup.button.callback(`${selected}${provider.label}`, `provider:set:${provider.id}`)]);
      }
      
      // Health check buttons
      rows.push([Markup.button.callback("━━━ Diagnostics ━━━", "provider:separator")]);
      rows.push([
        Markup.button.callback("🔍 API Smoke", "provider:action:api_smoke"),
        Markup.button.callback("🌐 Web Health", "provider:action:web_health")
      ]);
    }
    
    // Back button (always shown)
    rows.push([Markup.button.callback("⬅️ Back to Main Menu", "split:v2:main")]);
    
    return Markup.inlineKeyboard(rows);
  }

export function bridgeKeyboard(settings: UserRuntimeSettings, currentProviderLabel: string) {
   return Markup.inlineKeyboard([
     [
       Markup.button.callback(
         `Bridge ${settings.bridgeEnabled ? "ON" : "OFF"}`,
         "bridge:toggle"
       ),
     ],
     [
       Markup.button.callback(
         `Creator Mode ${settings.creatorMode ? "ON" : "OFF"}`,
         "creator:toggle"
       ),
     ],
     [Markup.button.callback(`Current provider: ${currentProviderLabel}`, "split:v2:providers")],
     [Markup.button.callback("Health check", "bridge:health")],
     [Markup.button.callback("⬅️ Back", "split:v2:main")],
   ]);
 }

export function buildMenuText(
    settings: UserRuntimeSettings,
    role: TelegramRole,
    providerLabelText: string,
    currentModel: string
  ): string {
    return (
      `⚡ TeleGPT — Split Runtime\n` +
      `Role: ${role} | ${providerLabelText} / ${currentModel}`
    );
  }

export interface ShowMenuDeps {
  getTelegramRole(userId: string): TelegramRole;
  userIdOf(ctx: any): string;
  settingsOf(ctx: any): UserRuntimeSettings;
  editOrReply(ctx: any, text: string, extra?: any): Promise<void>;
}

export async function showCompactMenu(ctx: any, deps: ShowMenuDeps) {
  const role = deps.getTelegramRole(deps.userIdOf(ctx));
  const settings = deps.settingsOf(ctx);
  const text = buildMenuText(
    settings,
    role,
    providerLabel(settings.provider),
    settings.model || ""
  );
  await deps.editOrReply(ctx, text, compactMenuKeyboard(role));
}

export function renderBuildResultsPayload(page: number, telegaRoot: string, PAGE_SIZE: number) {
  const p = Math.max(1, page | 0);
  const offset = (p - 1) * PAGE_SIZE;

  const items = listBuildResultsFromIndex(telegaRoot, PAGE_SIZE, offset);
  const lines = items.length
    ? items.map((it, i) => {
        const when = (it.created_at || "").slice(11, 19) || "??:??:??";
        const art0 = it.artifacts?.[0]?.path ? ` • ${it.artifacts[0].path}` : "";
        const err = it.status === "failed" && it.error?.message ? ` • err: ${it.error.message}` : "";
        return `${offset + i + 1}) ${when} • ${it.pack} • ${it.status} • ${it.id}${art0}${err}`;
      })
    : ["(empty)"];

  const rows: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const row: any[] = [];
    row.push(Markup.button.callback(`📦 #${offset + i + 1} ${it.pack}`, `br:${it.id}`));
    if (it.trace_id) {
    row.push(Markup.button.callback(MSG.btn.explainSource, `trace:${it.trace_id}`));
    }
    rows.push(row);
  }

  const total = getBuildResultsCount(telegaRoot);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const nav: any[] = [];
  if (p > 1) nav.push(Markup.button.callback("⬅️ Prev", `brp:${p - 1}`));
  nav.push(Markup.button.callback("⏪ -10", `brj:${p}:-10`));
  nav.push(Markup.button.callback("🔄 Refresh", `brr:${p}`));
  nav.push(Markup.button.callback("🔍 Search", `brs:${p}`));
  if (p < lastPage) nav.push(Markup.button.callback("В конец ⏭️", `brl:${lastPage}`));
  nav.push(Markup.button.callback("+10 ⏩", `brj:${p}:10`));
  if (items.length === PAGE_SIZE) nav.push(Markup.button.callback("Next ➡️", `brp:${p + 1}`));
  rows.push(nav);
  rows.push([Markup.button.callback("🗑 Очистить", "brc:1")]);

  const text = `📚 Результаты (страница ${p}, последние ${PAGE_SIZE})\n${lines.join("\n")}\n\nНажми кнопку чтобы открыть результат:`;
  return { text, keyboard: Markup.inlineKeyboard(rows) };
}
