# Tele•GPT Operator Telemetry Surface

## ДИАГНОЗ

**Текущее состояние:**
Оператор видит систему разрозненно:
- `/health` — только delivery counters
- `/operator_status` — только self-heal decisions
- логи в консоли
- файлы на диске
- `/operator_reset` — только сброс lock

**Проблемы:**
1. Нужно знать несколько команд
2. Нет единой картины
3. Не видно взаимосвязей (health → decisions → runtime)
4. Нет быстрого доступа к operator actions
5. Нет нативного Telegram UI (рассыпано по разным сообщениям)

**Решение:** Единый компактный control panel `/ops` с навигацией через inline buttons:
- Home — общий статус
- Health — детальная Metrics
- Recovery — recent decisions
- Runtime — текущий контекст
- Actions — operator actions

---

## АРХИТЕКТУРA

```
/ops command → handler → renderScreen("HOME") + inline keyboard
                      ↓
            callback_query → parse payload (nav:*, act:*)
                      ↓
            route to screen OR execute action
                      ↓
            editMessageText / editMessageReplyMarkup
                      ↓
            inline navigation, no spam
```

**Components:**
- `operator-telemetry.types.ts` — types for all screens
- `operator-telemetry.service.ts` — data collectors from evidence/state
- `operator-telemetry.view.ts` — renderers + keyboards
- `operator-telemetry.actions.ts` — operator-initiated recovery actions (with receipts)
- `operator-telemetry.handlers.ts` — Telegraf command + callback routing
- `bot.ts` — integration: `/ops` command + callback_query routing + text command

---

## ФАЙЛЫ

```
src/telegram/operator/
  ├─ operator-telemetry.types.ts      ← TelemetryScreen, snapshots
  ├─ operator-telemetry.service.ts   ← collect*Snapshot()
  ├─ operator-telemetry.view.ts      ← render*Screen(), build*Keyboard()
  ├─ operator-telemetry.actions.ts   ← action*() + receipt
  └─ operator-telemetry.handlers.ts  ← handleOpsCommand, handleCallbackQuery

src/telegram/bot.ts
  ├─ bot.command("ops", ...)
  ├─ bot.on("callback_query", ...) → telemetry route
  └─ bot.on("message", ...) → text command "Ops" support

Runtime data sources (already exist):
  ├─ delivery-evidence.log
  ├─ telegram-bot.decisions.log
  ├─ .self-heal-lock
  └─ watchdog state (runtime)

Docs:
  └─ TELEGPT_OPERATOR_TELEMETRY_SURFACE.md (this file)
```

---

## ГОТОВЫЙ КОД

### Types (operator-telemetry.types.ts)

```typescript
export type TelemetryScreen = "HOME" | "HEALTH" | "RECOVERY" | "RUNTIME" | "ACTIONS";

export interface HomeSnapshot {
  botServiceStatus: "RUNNING" | "DEGRADED" | "STOPPED" | "UNKNOWN";
  watchdogStatus: "RUNNING" | "DEGRADED" | "STOPPED" | "UNKNOWN";
  providerEffective: string;
  bridgeEnabled: boolean;
  lockState: "ACTIVE" | "CLEAR";
  lastSuccessAgeSec: number;
  lastDecision: string;
  lastCritical: string;
  counters: { success: number; blocked: number; error: number };
}

export interface HealthSnapshot {
  windowMs: number; total: number;
  success: number; blocked: number; error: number; fallback: number;
  successRate: string; blockedRate: string; errorRate: string;
  providerStats: Record<string, { success: number; error: number }>;
  trend: "↑ improving" | "→ stable" | "↓ degrading" | "? unknown";
}

export interface RecoverySnapshot {
  recentReceipts: Array<{ timestamp: number; degradationClass: string; selectedAction: string; reason: string; precedence: string; confidence: number }>;
  recoveryCountInWindow: number;
  maxRecoveriesPerWindow: number;
  windowMs: number;
  isLocked: boolean;
}

export interface RuntimeSnapshot {
  bridgeEnabled: boolean;
  forcedProvider: string | null;
  effectiveProvider: string;
  transport: string;
  cdpConnected: boolean;
  cdpEndpoint: string | null;
  lastProviderSuccess: number;
  lastProviderError: string | null;
  uptimeSec: number;
}
```

### Service (operator-telemetry.service.ts)

```typescript
export function collectHomeSnapshot(): HomeSnapshot {
  return {
    botServiceStatus: inferBotServiceStatus(),
    watchdogStatus: inferWatchdogStatus(),
    providerEffective: inferEffectiveProvider(),
    bridgeEnabled: inferBridgeEnabled(),
    lockState: getLockState(),
    lastSuccessAgeSec: getLastSuccessAgeSec(),
    lastDecision: getLastDecision(),
    lastCritical: getLastCriticalEvent(),
    counters: {
      success: getRecentEvidence(100).filter(e => e.status === "success").length,
      blocked: getRecentEvidence(100).filter(e => e.status === "blocked").length,
      error: getRecentEvidence(100).filter(e => e.status === "error").length,
    },
  };
}

export function collectHealthSnapshot(): HealthSnapshot {
  const summary = getHealthSummary(100);
  return {
    windowMs: summary.window,
    total: summary.total,
    success: summary.success,
    blocked: summary.blocked,
    error: summary.error,
    fallback: summary.fallback,
    successRate: `${((summary.success / summary.total) * 100).toFixed(1)}%`,
    blockedRate: `${((summary.blocked / summary.total) * 100).toFixed(1)}%`,
    errorRate: `${((summary.error / summary.total) * 100).toFixed(1)}%`,
    providerStats: getProviderStats(100),
    trend: computeTrend(),
  };
}

export function collectRecoverySnapshot(): RecoverySnapshot {
  const receipts = getRecentReceipts(10);
  return {
    recentReceipts: receipts.map(r => ({ ... })),
    recoveryCountInWindow: getRecentReceipts(100).filter(r => r.selectedAction !== "NO_OP").length,
    maxRecoveriesPerWindow: 5,
    windowMs: 300000,
    isLocked: getLockState() === "ACTIVE",
  };
}

export function collectRuntimeSnapshot(): RuntimeSnapshot {
  const state = getWatchdogState();
  return {
    bridgeEnabled: inferBridgeEnabled(),
    forcedProvider: null,
    effectiveProvider: inferEffectiveProvider(),
    transport: "api",
    cdpConnected: cdpRecent.some(e => e.status === "success"),
    cdpEndpoint: process.env.CDP_ENDPOINT || null,
    lastProviderSuccess: state.lastProviderSuccess,
    lastProviderError: lastError ? `${lastError.provider}: ${lastError.reason}` : null,
    uptimeSec: Math.floor((Date.now() - state.lastHeartbeat) / 1000),
  };
}
```

### View (operator-telemetry.view.ts)

```typescript
export function renderHomeScreen(snap: HomeSnapshot): string {
  return `🛡 Tele•GPT Ops — Home\n\n` +
    `Bot: ${badge(snap.botServiceStatus)} ${snap.botServiceStatus}\n` +
    `Watchdog: ${badge(snap.watchdogStatus)} ${snap.watchdogStatus}\n` +
    `Lock: ${badge(snap.lockState)} ${snap.lockState}\n\n` +
    `📈 counters (recent 100):\n` +
    `  ✅ ${snap.counters.success}\n` +
    `  ⚠️ ${snap.counters.blocked}\n` +
    `  ❌ ${snap.counters.error}\n\n` +
    `🔧 runtime:\n` +
    `  Provider: ${snap.providerEffective}\n` +
    `  Bridge: ${snap.bridgeEnabled ? "ON" : "OFF"}\n` +
    `  Last success: ${formatAge(snap.lastSuccessAgeSec)}\n\n` +
    `📋 last decision: ${snap.lastDecision.slice(0, 80)}\n` +
    `🚨 last critical: ${snap.lastCritical.slice(0, 80)}\n`;
}

export function renderHealthScreen(snap: HealthSnapshot): string {
  return `📊 Health Metrics\n\n` +
    `Window: ${snap.windowMs / 1000}s\nTotal: ${snap.total}\n\n` +
    `✅ Success: ${snap.success} (${snap.successRate})\n` +
    `⚠️ Blocked: ${snap.blocked} (${snap.blockedRate})\n` +
    `❌ Errors: ${snap.error} (${snap.errorRate})\n` +
    `\n📈 Trend: ${snap.trend}\n\n` +
    (Object.keys(snap.providerStats).length > 0
      ? `🏷 Providers:\n${Object.entries(snap.providerStats).map(([p, s]) => `  ${p}: ✅${s.success} ❌${s.error}`).join("\n")}`
      : ""
    );
}

export function renderRecoveryScreen(snap: RecoverySnapshot): string {
  let text = `🔄 Recovery Decisions\n\n`;
  text += `Window: ${snap.windowMs / 60}s\n`;
  text += `Recoveries: ${snap.recoveryCountInWindow}/${snap.maxRecoveriesPerWindow}\n`;
  text += `Lock: ${badge(snap.isLocked ? "ACTIVE" : "CLEAR")} ${snap.isLocked ? "ACTIVE" : "CLEAR"}\n\n`;

  if (snap.recentReceipts.length === 0) {
    text += `No recent recovery actions.\n`;
  } else {
    text += `Recent decisions:\n\n`;
    for (const r of snap.recentReceipts.slice(0, 8)) {
      const time = new Date(r.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      text += `${time} ${r.selectedAction.slice(0, 4)} — ${r.reason.slice(0, 65)}\n`;
    }
  }
  return text;
}

export function renderRuntimeScreen(snap: RuntimeSnapshot): string {
  return `⚙️ Runtime Status\n\n` +
    `Bridge: ${snap.bridgeEnabled ? "ENABLED" : "DISABLED"}\n` +
    `Provider: ${snap.effectiveProvider}\n` +
    `Transport: ${snap.transport}\n` +
    `CDP: ${badge(snap.cdpConnected ? "RUNNING" : "STOPPED")} ${snap.cdpConnected ? "connected" : "disconnected"}\n` +
    (snap.cdpEndpoint ? `  Endpoint: ${snap.cdpEndpoint}\n` : "") +
    `\nUptime: ${formatAge(snap.uptimeSec)}\n` +
    (snap.lastProviderError ? `\n🚨 Last error: ${snap.lastProviderError}\n` : "") +
    `\nForced provider: ${snap.forcedProvider || "none (auto)"}\n`;
}

// Keyboards
export function buildMainKeyboard(current: TelemetryScreen): any {
  return Markup.keyboard([
    [current === "HOME" ? "🏠 Home" : "🏠 Home", current === "HEALTH" ? "📊 Health" : "📊 Health"],
    [current === "RECOVERY" ? "🔄 Recovery" : "🔄 Recovery", current === "RUNTIME" ? "⚙️ Runtime" : "⚙️ Runtime"],
    ["🎬 Actions", "◀️ Back"],
  ]);
}

export function buildActionsKeyboard(): any {
  return Markup.keyboard([
    ["🔄 Refresh"],
    ["🔧 Operator Reset"],
    ["⚡ Soft Recover"],
    ["⌨️ Restart Watchdog"],
    ["🔁 Restart Bot"],
    ["◀️ Back"],
  ]);
}
```

### Handlers (operator-telemetry.handlers.ts)

```typescript
const chatNavState = new Map<number, { screen: TelemetryScreen }>();

export async function handleOpsCommand(ctx: any): Promise<void> {
  const chatId = ctx.chat!.id;
  chatNavState.set(chatId, { screen: "HOME" });
  await ctx.reply(renderScreen("HOME"), { reply_markup: buildMainKeyboard("HOME") });
}

export async function handleCallbackQuery(ctx: any): Promise<void> {
  const payload = ctx.callbackQuery!.data;
  const chatId = ctx.chat!.id;

  let screen: TelemetryScreen;
  let action: string | null = null;

  if (payload.startsWith("nav:")) {
    screen = payload.replace("nav:", "") as TelemetryScreen;
  } else if (payload.startsWith("act:")) {
    action = payload.replace("act:", "");
    screen = chatNavState.get(chatId)?.screen || "HOME";
  } else {
    screen = "HOME";
  }

  if (action) {
    const result = await executeOperatorAction(action);
    await ctx.answerCbQuery(result, { show_alert: true });
  }

  if (payload.startsWith("nav:")) {
    chatNavState.set(chatId, { screen });
  }

  const text = renderScreen(screen);
  const markup = action === "show_actions" ? buildActionsKeyboard() : buildMainKeyboard(screen);

  try {
    await ctx.editMessageText(text, { reply_markup: markup, disable_web_page_preview: true });
  } catch {
    await ctx.reply(text, { reply_markup: markup, disable_web_page_preview: true });
  }
}

export function matchTextCommand(text: string): boolean {
  return ["🛡 Ops", "/ops", "Ops", "ops", "/operator", "operator"].includes(text.trim());
}

export async function handleTextCommand(ctx: any): Promise<void> {
  await handleOpsCommand(ctx);
}
```

### Actions (operator-telemetry.actions.ts)

```typescript
export async function actionRefresh(): Promise<string> {
  writeActionReceipt("REFRESH", "Operator requested status refresh");
  return "✅ Refreshed";
}

export async function actionOperatorReset(): Promise<string> {
  clearLockState();
  writeActionReceipt("OPERATOR_RESET", "Operator cleared lock state");
  return "✅ Lock cleared — system recoverable";
}

export async function actionSoftRecover(): Promise<string> {
  writeActionReceipt("SOFT_RECOVER", "Operator triggered bridge state reset");
  return "✅ Bridge state reset — will reinitialize on next message";
}

export async function actionRestartWatchdog(): Promise<string> {
  const { exec } = await import("child_process");
  return new Promise(resolve => {
    exec("launchctl kickstart -k com.telegpt.watchdog", (err) => {
      if (err) resolve(`❌ Failed: ${err.message}`);
      else {
        writeActionReceipt("RESTART_WATCHDOG", "Operator restarted watchdog");
        resolve(`✅ Watchdog restarted`);
      }
    });
  });
}

export async function actionRestartBot(): Promise<string> {
  const { exec } = await import("child_process");
  return new Promise(resolve => {
    exec("launchctl kickstart -k com.telegpt.bot", (err) => {
      if (err) resolve(`❌ Failed: ${err.message}`);
      else {
        writeActionReceipt("RESTART_BOT", "Operator restarted bot service");
        resolve(`✅ Bot restart initiated`);
      }
    });
  });
}
```

---

## КОМАНДЫ ИНТЕГРАЦИИ

**Запуск:**
- Обычный запуск бота — без изменений (`launchctl kickstart -k com.telegpt.bot`)
- Watchdog — как есть (`launchctl kickstart -k com.telegpt.watchdog`)

**Telegram команды:**
```
/ops              → Open telemetry panel
/health           → Quick health (legacy, still works)
/operator_status  → Text status (legacy, still works)
/operator_reset   → Clear lock (работает и из Actions menu)
```

**Навигация:**
- Inline кнопки: Home, Health, Recovery, Runtime, Actions
- Кнопка "◀️ Back" возвращает в main navigation
- Кнопка "🔄 Refresh" обновляет текущий экран

**Operator actions (из Actions screen):**
- 🔄 Refresh — перечитать данные
- 🔧 Operator Reset — снять lock
- ⚡ Soft Recover — сброс bridge state
- ⌨️ Restart Watchdog — перезапуск watchdog daemon
- 🔁 Restart Bot — перезапуск bot service

---

## VERIFY

**1. Home Screen**
```
/ops
→ Shows:
  Bot: ✅ RUNNING
  Watchdog: ✅ RUNNING
  Lock: ✅ CLEAR
  counters
  provider
  last success age
```

**2. Navigation**
- Tap "📊 Health" → Health screen appears
- Tap "🔄 Recovery" → Recovery decisions list
- Tap "⚙️ Runtime" → runtime details (CDP, bridge, uptime)
- Tap "◀️ Back" → returns to Home
- All screens use `editMessageText` (no new messages)

**3. Actions**
- Navigate to "🎬 Actions"
- Tap "🔄 Refresh" → toast "✅ Refreshed"
- Tap "🔧 Operator Reset" (if locked → clears lock, receipt written)
- Tap "⚡ Soft Recover" → toast + bridge state reset
- Tap "⌨️ Restart Watchdog" → restarts watchdog daemon
- Tap "🔁 Restart Bot" → restarts bot service via launchd

**4. Lock State Visibility**
- When lock active:
  - Home shows `Lock: 🔒 ACTIVE`
  - Actions button still works but Reset is primary
  - Other recovery actions show toast "Blocked: system in LOCK STATE"
  - `/operator_reset` clears it

**5. Evidence Consistency**
- After any operator action:
  - Receipt written to `telegram-bot.decisions.log`
  - `degradationClass: "OPERATOR_INITIATED"`
  - Can be seen in Recovery screen

**6. Error Handling**
- Simulate CDP down → HEALTH shows degrade → Recovery shows decisions
- Trigger repeated failures → lock engages → Actions limited
- Operator reset → lock clears → system recovers

**7. Idempotency**
- Repeated Refresh → OK
- Repeated Reset when not locked → "not locked"
- Restart actions safe to call multiple times

---

## ФИНАЛЬНЫЙ РЕЗУЛЬТАТ

Оператору больше **не нужно**:
- читать логи вручную
- запоминать 6 разных команд
- переключаться между /health /operator_status /why
- гадать "что сейчас происходит"

Оператор получает:

| Экран | Показывает |
|-------|-----------|
| **Home** | Bot/Watchdog status, lock, counters, last activity |
| **Health** | Success/blocked/error rates, trend, provider breakdown |
| **Recovery** | Last 8 decisions, reason, recovery count, lock status |
| **Runtime** | Bridge, provider, CDP, uptime, last error |
| **Actions** | 5 operator actions (reset, recover, restart) |

**Интеграция:**
- One-liner: `/ops`
- Inline navigation — без спама
- Uses existing evidence/metrics/decisions/lock/receipts
- No external dependencies
- Idempotent actions
- Receipt audit trail

**Operator опыт:**
```
/ops
→ Видит единый dashboard
→ Нажимает кнопки — видит результат
→ При проблеме: сразу понимает где (Health) и что делать (Actions)
→ После recovery проверяет Recovery screen для audit trail
```

---

## TECHNICAL NOTES

- Nav state: in-memory per chat (`Map<chatId, {screen}>`). Lost on bot restart — но state восстанавливается (Home по умолчанию).
- Edit failures: fallback to reply (если message too old)
- Lock state: persisted via `.self-heal-lock` file + watchdog state JSON
- Evidence reading: direct file reads (non-blocking, cached by OS)
- Keyboard: reply_markup (не persistent — меняется при переходе)
- All actions write receipt (OPERATOR_INITIATED degradation class)
- No rate limiting — operator explicit actions only

---

Система теперь **управляема через один компактный интерфейс**.
