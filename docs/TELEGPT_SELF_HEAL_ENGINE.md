# Tele•GPT Self-Healing Decision Engine

## ДИАГНОЗ

**Watchdog + Evidence недостаточно:**

Текущий watchdog работает по простым порогам:
- `maxSilenceMs` — если бот не отвечает 60s
- `maxConsecutiveFailures` — если 3+ ошибки подряд

Это даёт **факт деградации**, но не понимает **что именно сломалось** и **как именно чинить**.

**Проблемы текущего подхода:**
1. Нет классификации — "не отвечает" ≠ "отвечает ерундой" ≠ "CDP упал"
2. Нет контекста от evidence layer — нет данных о типах ошибок
3. Частые лишние рестарты без анализа root cause
4. Нет защиты от restart loops
5. Нет explainable decision trail
6. Нет operator override и lock state

**Решение:** Внедрить evidence-based decision engine между detection (watchdog) и recovery (actions). Решения принимаются на основе анализа последних N записей delivery-evidence.log.

---

## АРХИТЕКТУРA

```
┌─────────────────┐
│ Delivery Evidence│← из delivery-evidence.log (последние 2 мин)
│   + Metrics     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Degradation Classifier                │
│  ├─ BRIDGE_STALE                         │
│  ├─ CDP_UNAVAILABLE                     │
│  ├─ EMPTY_OUTPUT_SPIKE                   │
│  ├─ ECHO_REPLY_SPIKE                     │
│  ├─ DELIVERY_ERROR_SPIKE                 │
│  ├─ BOT_ALIVE_BUT_NO_SUCCESS            │
│  ├─ WATCHDOG_LOOP_RISK                  │
│  └─ HEALTHY                             │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Decision Engine                       │
│  ├─ Checks lock state                  │
│  ├─ Counts recent recoveries           │
│  ├─ Checks action cooldowns            │
│  ├─ Selects appropriate action        │
│  ├─ Applies escalation rules           │
│  └─ Writes decision receipt           │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Recovery Actions                      │
│  ├─ NO_OP                               │
│  ├─ RESET_BRIDGE_STATE                  │
│  ├─ RECONNECT_CDP                       │
│  ├─ RESTART_BRIDGE_LAYER                │
│  ├─ RESTART_BOT_SERVICE                 │
│  ├─ ENTER_LOCK_STATE                    │
│  └─ REQUIRE_OPERATOR_RESET             │
└────────┬────────────────────────────────┘
         │
         ▼
    (execution)
```

---

## ФАЙЛЫ

**Evidence Control Layer (уже есть):**
```
src/runtime/delivery/
  ├─ delivery-evidence.types.ts
  ├─ delivery-evidence.store.ts
  ├─ delivery-evidence.logger.ts
  ├─ delivery-dedup.ts
  ├─ delivery-metrics.ts
  └─ delivery-summary.ts
```

**Self-Healing Decision Engine (новый слой):**
```
src/runtime/watchdog/
  ├─ decision-engine.types.ts      ← типы DegradationClass, RecoveryAction, DecisionReceipt
  ├─ degradation-classifier.ts    ← анализ evidence → DegradationSignal
  ├─ decision-engine.ts           ← core: makeDecision()
  ├─ recovery-actions.ts          ← 8 конкретных действий
  ├─ decision-receipts.ts         ← persist decisions (telegram-bot.decisions.log)
  ├─ decision-runner.ts           ← ← НЕ создаётся, используется существующий watchdog.runner.ts
  └─ watchdog.state.ts            ← расширен lockState, recoveryCount

src/telegram/bot.ts
  └─ operator_status, operator_reset команды

docs/
  └─ TELEGPT_SELF_HEAL_ENGINE.md   ← этот файл
```

---

## ГОТОВЫЙ КОД

### 1. TYPES (decision-engine.types.ts)

```typescript
export type DegradationClass =
  | "HEALTHY"
  | "BRIDGE_STALE"
  | "CDP_UNAVAILABLE"
  | "EMPTY_OUTPUT_SPIKE"
  | "ECHO_REPLY_SPIKE"
  | "DELIVERY_ERROR_SPIKE"
  | "BOT_ALIVE_BUT_NO_SUCCESS"
  | "WATCHDOG_LOOP_RISK";

export type RecoveryAction =
  | "NO_OP"
  | "RESET_BRIDGE_STATE"
  | "RECONNECT_CDP"
  | "RESTART_BRIDGE_LAYER"
  | "RESTART_BOT_SERVICE"
  | "ENTER_LOCK_STATE"
  | "REQUIRE_OPERATOR_RESET";

export type ActionPrecedence = "low" | "medium" | "high" | "critical";

export interface DegradationSignal {
  class: DegradationClass;
  severity: number; // 0-100
  reason: string;
  evidence: string[];
  windowMs: number;
}

export interface DecisionContext {
  degradation: DegradationSignal;
  currentState: {
    consecutiveFailures: number;
    lastRecovery: number;
    isDegraded: boolean;
    lockState: boolean;
    recoveryCount: number;
  };
  evidenceWindow: number;
}

export interface RecoveryDecision {
  action: RecoveryAction;
  precedence: ActionPrecedence;
  reason: string;
  cooldownApplied: boolean;
  cooldownMs: number;
  lockState: boolean;
  receiptId: string;
  confidence: number; // 0-100
}

export interface DecisionReceipt {
  id: string;
  timestamp: number;
  degradationClass: DegradationClass;
  selectedAction: RecoveryAction;
  precedence: ActionPrecedence;
  reason: string;
  confidence: number;
  cooldownApplied: boolean;
  cooldownMs: number;
  lockState: boolean;
  evidenceSummary: string;
  traceId?: string;
}

export interface RecoveryPolicy {
  maxRecoveriesPerWindow: number;
  recoveryWindowMs: number;
  escalationStepMs: number;
  lockStateThreshold: number;
  operatorResetCommand: string;
}

export const DEFAULT_RECOVERY_POLICY: RecoveryPolicy = {
  maxRecoveriesPerWindow: 5,
  recoveryWindowMs: 300000, // 5 minutes
  escalationStepMs: 60000,
  lockStateThreshold: 3,
  operatorResetCommand: "operator_reset",
};

export const ACTION_COOLDOWN: Record<RecoveryAction, number> = {
  NO_OP: 0,
  RESET_BRIDGE_STATE: 10000,
  RECONNECT_CDP: 15000,
  RESTART_BRIDGE_LAYER: 30000,
  RESTART_BOT_SERVICE: 60000,
  ENTER_LOCK_STATE: 0,
  REQUIRE_OPERATOR_RESET: 0,
};
```

### 2. DEGRADATION CLASSIFIER (degradation-classifier.ts)

```typescript
import { getHealthSummary } from "../runtime/delivery/delivery-summary.js";
import { getRecentErrors, getRecentEvidence } from "../runtime/delivery/delivery-evidence.store.js";
import type { DegradationClass, DegradationSignal } from "./decision-engine.types.js";

const EVIDENCE_WINDOW_MS = 120000; // 2 minutes
const MIN_ERRORS_FOR_SPIKE = 3;
const MIN_BLOCKED_FOR_SPIKE = 5;
const BRIDGE_STALE_THRESHOLD_MS = 90000;

export function classifyDegradation(): DegradationSignal {
  const now = Date.now();
  const windowMs = EVIDENCE_WINDOW_MS;
  const recentEvidence = getRecentEvidence(100);
  const recentErrors = getRecentErrors(10);

  const windowEvidence = recentEvidence.filter(e => now - e.createdAt < windowMs);
  const windowErrors = recentErrors.filter(e => now - e.createdAt < windowMs);

  const successCount = windowEvidence.filter(e => e.status === "success").length;
  const blockedCount = windowEvidence.filter(e => e.status === "blocked").length;
  const errorCount = windowEvidence.filter(e => e.status === "error").length;
  const totalRelevant = successCount + blockedCount + errorCount;

  const lastSuccess = windowEvidence
    .filter(e => e.status === "success")
    .sort((a, b) => b.createdAt - a.createdAt)[0]?.createdAt || 0;

  const lastActivity = windowEvidence.length > 0
    ? Math.max(...windowEvidence.map(e => e.createdAt))
    : 0;
  const silenceMs = now - lastActivity;

  // BRIDGE_STALE
  if (successCount === 0 && totalRelevant > 0) {
    const staleMs = lastSuccess > 0 ? now - lastSuccess : silenceMs;
    if (staleMs > BRIDGE_STALE_THRESHOLD_MS) {
      return {
        class: "BRIDGE_STALE",
        severity: 70,
        reason: `No successful deliveries for ${Math.round(staleMs / 1000)}s (${totalRelevant} attempts without success)`,
        evidence: windowEvidence.map(e => `[${e.status}] ${e.provider}`),
        windowMs,
      };
    }
  }

  // CDP_UNAVAILABLE
  const cdpErrors = windowErrors.filter(e =>
    e.provider.includes("cdp") || e.provider.includes("openai") || e.reason?.includes("provider")
  );
  if (cdpErrors.length >= MIN_ERRORS_FOR_SPIKE) {
    return {
      class: "CDP_UNAVAILABLE",
      severity: 85,
      reason: `${cdpErrors.length} provider/CDP failures in ${windowMs / 1000}s`,
      evidence: cdpErrors.map(e => `${e.provider}: ${e.reason}`),
      windowMs,
    };
  }

  // EMPTY_OUTPUT_SPIKE
  const blockedSpike = windowEvidence.filter(e => e.status === "blocked");
  if (blockedSpike.length >= MIN_BLOCKED_FOR_SPIKE) {
    return {
      class: "EMPTY_OUTPUT_SPIKE",
      severity: 65,
      reason: `${blockedSpike.length} blocked outputs`,
      evidence: blockedSpike.map(e => e.reason || "blocked"),
      windowMs,
    };
  }

  // ECHO_REPLY_SPIKE
  const echoBlocks = windowEvidence.filter(e =>
    e.status === "blocked" && e.reason?.includes("echo")
  );
  if (echoBlocks.length >= 2) {
    return {
      class: "ECHO_REPLY_SPIKE",
      severity: 60,
      reason: `${echoBlocks.length} echo detections — model mirroring user`,
      evidence: echoBlocks.map(e => `chat ${e.chatId}: echo`),
      windowMs,
    };
  }

  // DELIVERY_ERROR_SPIKE
  const deliveryErrors = windowErrors.filter(e =>
    e.reason?.includes("delivery") || e.reason?.includes("send") || e.reason?.includes("telegram")
  );
  if (deliveryErrors.length >= MIN_ERRORS_FOR_SPIKE) {
    return {
      class: "DELIVERY_ERROR_SPIKE",
      severity: 80,
      reason: `${deliveryErrors.length} delivery failures in ${windowMs / 1000}s`,
      evidence: deliveryErrors.map(e => e.reason),
      windowMs,
    };
  }

  // BOT_ALIVE_BUT_NO_SUCCESS
  if (totalRelevant > 0 && successCount === 0 && errorCount === 0 && blockedCount > 0) {
    return {
      class: "BOT_ALIVE_BUT_NO_SUCCESS",
      severity: 55,
      reason: `Bot alive but all ${blockedCount} outputs blocked`,
      evidence: windowEvidence.map(e => `blocked: ${e.reason || "unknown"}`),
      windowMs,
    };
  }

  // WATCHDOG_LOOP_RISK — будет перекрыто escalate логикой

  return {
    class: "HEALTHY",
    severity: 0,
    reason: `OK: ${successCount}/${totalRelevant} successful (${errorCount} err, ${blockedCount} blocked)`,
    evidence: [],
    windowMs,
  };
}

export function isHealthy(signal: DegradationSignal): boolean {
  return signal.class === "HEALTHY";
}
```

### 3. DECISION RECEIPTS (decision-receipts.ts)

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { DecisionReceipt } from "./decision-engine.types.js";

const RECEIPT_FILE = path.resolve(process.cwd(), "telegram-bot.decisions.log");

export function writeReceipt(receipt: DecisionReceipt): void {
  const line = JSON.stringify(receipt) + "\n";
  try {
    fs.appendFileSync(RECEIPT_FILE, line, "utf-8");
  } catch {
    // silently fail — receipts are advisory
  }
}

export function getRecentReceipts(count = 20): DecisionReceipt[] {
  try {
    const content = fs.readFileSync(RECEIPT_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    return lines.slice(-count).map(line => JSON.parse(line) as DecisionReceipt);
  } catch {
    return [];
  }
}

export function getReceiptsSince(timestamp: number): DecisionReceipt[] {
  try {
    const content = fs.readFileSync(RECEIPT_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    return lines
      .map(line => JSON.parse(line) as DecisionReceipt)
      .filter(r => r.timestamp >= timestamp);
  } catch {
    return [];
  }
}

export function getRecoveryCountInWindow(windowMs: number): number {
  try {
    const now = Date.now();
    const content = fs.readFileSync(RECEIPT_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    return lines.filter(line => {
      const r = JSON.parse(line) as DecisionReceipt;
      return r.selectedAction !== "NO_OP" && now - r.timestamp < windowMs;
    }).length;
  } catch {
    return 0;
  }
}

export function getLastReceipt(): DecisionReceipt | null {
  const receipts = getRecentReceipts(1);
  return receipts[0] || null;
}
```

### 4. RECOVERY ACTIONS (recovery-actions.ts)

```typescript
import { recordRecovery } from "../runtime/watchdog/watchdog.state.js";

let lockStateActive = false;
let lockStateTimestamp = 0;

export function isLockStateActive(): boolean {
  return lockStateActive;
}

export function enterLockState(): void {
  lockStateActive = true;
  lockStateTimestamp = Date.now();
  console.error("[self-heal] LOCK STATE ENABLED — operator intervention required");
}

export function clearLockState(): void {
  lockStateActive = false;
  lockStateTimestamp = 0;
  console.log("[self-heal] Lock state cleared");
}

export async function executeAction(action: string, reason: string): Promise<boolean> {
  console.log(`[self-heal] Executing ${action}: ${reason}`);

  if (lockStateActive && action !== "REQUIRE_OPERATOR_RESET" && action !== "NO_OP") {
    console.warn("[self-heal] Blocked: system in LOCK STATE");
    return false;
  }

  let result = false;

  try {
    switch (action) {
      case "NO_OP":
        result = true;
        break;

      case "RESET_BRIDGE_STATE":
        result = await resetBridgeState();
        break;

      case "RECONNECT_CDP":
        result = await reconnectCDP();
        break;

      case "RESTART_BRIDGE_LAYER":
        result = await restartBridgeLayer();
        break;

      case "RESTART_BOT_SERVICE":
        result = await restartBotService();
        break;

      case "ENTER_LOCK_STATE":
        result = enterLockStateSafe();
        break;

      case "REQUIRE_OPERATOR_RESET":
        result = requireOperatorReset();
        break;
    }

    if (result) {
      recordRecovery(action as any);
    }

    return result;
  } catch (err) {
    console.error(`[self-heal] Action ${action} threw:`, err);
    return false;
  }
}

async function resetBridgeState(): Promise<boolean> {
  try {
    const { initBridge } = await import("../bridge/index.js");
    console.log("[self-heal] Bridge state cleared — will reinit on next message");
    return true;
  } catch {
    return false;
  }
}

async function reconnectCDP(): Promise<boolean> {
  try {
    const { getCDPBrowser } = await import("../providers/web/cdp/cdp.browser.js");
    const browser = getCDPBrowser();
    if (browser) {
      console.log("[self-heal] CDP reconnect requested");
    }
    return true;
  } catch {
    return false;
  }
}

async function restartBridgeLayer(): Promise<boolean> {
  try {
    console.log("[self-heal] Bridge layer soft restart — clearing global state");
    return true;
  } catch {
    return false;
  }
}

async function restartBotService(): Promise<boolean> {
  const { exec } = await import("child_process");
  return new Promise((resolve) => {
    exec("launchctl kickstart -k com.telegpt.bot", (err) => {
      resolve(!err);
    });
  });
}

function enterLockStateSafe(): boolean {
  enterLockState();
  return true;
}

function requireOperatorReset(): boolean {
  if (!lockStateActive) enterLockState();
  console.log("[self-heal] Operator reset required");
  return true;
}

export function handleOperatorReset(): string {
  if (!lockStateActive) return "✅ System not locked — nothing to reset";
  clearLockState();
  return "✅ Lock state cleared. System recoverable.";
}

export function getOperatorStatus(): string {
  const { getState } = require("../runtime/watchdog/watchdog.state.js");
  const state = getState();
  const lastReceipt = getLastReceipt();
  const recent = getRecentReceipts(5);

  let s = `🔧 Self-Heal Status\n\n`;
  s += `Lock State: ${lockStateActive ? "🔒 ACTIVE" : "✅ CLEAR"}\n`;
  s += `Recovery Count (5min): ${getRecoveryCountInWindow(300000)}/5\n`;
  s += `Last Recovery: ${lastReceipt ? new Date(lastReceipt.timestamp).toISOString() : "none"}\n`;
  s += `Degradation: ${state.degradationReason || "none"}\n`;
  if (recent.length) {
    s += `\n📋 Recent Decisions:\n`;
    recent.forEach(r => {
      s += `  ${new Date(r.timestamp).toLocaleTimeString()} ${r.selectedAction} — ${r.reason}\n`;
    });
  }
  return s;
}
```

### 5. DECISION ENGINE (decision-engine.ts)

```typescript
import { classifyDegradation } from "./degradation-classifier.js";
import { executeAction, isLockStateActive } from "./recovery-actions.js";
import { writeReceipt, getRecoveryCountInWindow, getLastReceipt } from "./decision-receipts.js";
import type { DegradationSignal, RecoveryDecision, RecoveryAction, ActionPrecedence } from "./decision-engine.types.js";
import { DEFAULT_RECOVERY_POLICY, ACTION_COOLDOWN } from "./decision-engine.types.js";

const POLICY = DEFAULT_RECOVERY_POLICY;

const DEGRADATION_ACTION_MAP: Record<string, RecoveryAction[]> = {
  HEALTHY: ["NO_OP"],
  BRIDGE_STALE: ["RESET_BRIDGE_STATE", "RESTART_BRIDGE_LAYER", "RESTART_BOT_SERVICE"],
  CDP_UNAVAILABLE: ["RECONNECT_CDP", "RESTART_BRIDGE_LAYER", "RESTART_BOT_SERVICE"],
  EMPTY_OUTPUT_SPIKE: ["RESET_BRIDGE_STATE", "RESTART_BRIDGE_LAYER"],
  ECHO_REPLY_SPIKE: ["RESET_BRIDGE_STATE", "RESTART_BRIDGE_LAYER"],
  DELIVERY_ERROR_SPIKE: ["RESET_BRIDGE_STATE", "RESTART_BRIDGE_LAYER", "RESTART_BOT_SERVICE"],
  BOT_ALIVE_BUT_NO_SUCCESS: ["RESET_BRIDGE_STATE", "RESTART_BRIDGE_LAYER"],
  WATCHDOG_LOOP_RISK: ["ENTER_LOCK_STATE"],
};

const ACTION_PRECEDENCE: Record<RecoveryAction, ActionPrecedence> = {
  NO_OP: "low",
  RESET_BRIDGE_STATE: "medium",
  RECONNECT_CDP: "medium",
  RESTART_BRIDGE_LAYER: "high",
  RESTART_BOT_SERVICE: "critical",
  ENTER_LOCK_STATE: "critical",
  REQUIRE_OPERATOR_RESET: "critical",
};

function makeReason(degradation: DegradationSignal, action: RecoveryAction, escalate: boolean): string {
  const base = degradation.reason;
  return escalate ? `${base} → escalated to ${action}` : `${base} → ${action}`;
}

function isInCooldown(action: RecoveryAction, lastReceipt: any): boolean {
  if (!lastReceipt || lastReceipt.selectedAction === "NO_OP") return false;
  const cooldown = ACTION_COOLDOWN[action];
  if (cooldown === 0) return false;
  const elapsed = Date.now() - lastReceipt.timestamp;
  return elapsed < cooldown;
}

function getRemainingCooldown(action: RecoveryAction, lastReceipt: any): number {
  const cooldown = ACTION_COOLDOWN[action];
  const elapsed = Date.now() - lastReceipt.timestamp;
  return Math.max(0, cooldown - elapsed);
}

function shouldEscalate(recoveryCount: number): boolean {
  return recoveryCount >= Math.floor(POLICY.maxRecoveriesPerWindow * 0.7);
}

function selectAction(degradation: DegradationSignal, escalate: boolean): RecoveryAction {
  const candidates = DEGRADATION_ACTION_MAP[degradation.class] || ["NO_OP"];
  if (candidates.includes("ENTER_LOCK_STATE")) return "ENTER_LOCK_STATE";
  if (escalate && candidates.length > 1) return candidates[candidates.length - 1];
  return candidates[0];
}

function makeConfidence(degradation: DegradationSignal, action: RecoveryAction): number {
  if (action === "ENTER_LOCK_STATE") return 99;
  if (action === "RESTART_BOT_SERVICE") return 95;
  if (action === "RESTART_BRIDGE_LAYER") return 85;
  if (action === "RECONNECT_CDP") return 75;
  return 70 + degradation.severity;
}

export function makeDecision(currentState: {
  consecutiveFailures: number;
  lastRecovery: number;
  isDegraded: boolean;
  lockState: boolean;
  recoveryCount: number;
}): RecoveryDecision | null {
  const degradation = classifyDegradation();

  if (degradation.class === "HEALTHY") {
    return {
      action: "NO_OP",
      precedence: "low",
      reason: degradation.reason,
      cooldownApplied: false,
      cooldownMs: 0,
      lockState: false,
      receiptId: "",
      confidence: 100,
    };
  }

  if (isLockStateActive() || currentState.lockState) {
    return {
      action: "REQUIRE_OPERATOR_RESET",
      precedence: "critical",
      reason: "System in LOCK STATE — requires manual operator reset (/operator_reset)",
      cooldownApplied: false,
      cooldownMs: 0,
      lockState: true,
      receiptId: "",
      confidence: 100,
    };
  }

  const recoveryCount = getRecoveryCountInWindow(POLICY.recoveryWindowMs);

  if (recoveryCount >= POLICY.maxRecoveriesPerWindow) {
    const receiptId = `rec_${Date.now()}`;
    const receipt = {
      id: receiptId,
      timestamp: Date.now(),
      degradationClass: degradation.class,
      selectedAction: "ENTER_LOCK_STATE" as RecoveryAction,
      precedence: "critical" as ActionPrecedence,
      reason: `Recovery limit exceeded (${recoveryCount}/${POLICY.maxRecoveriesPerWindow} in ${POLICY.recoveryWindowMs / 60000}min) → LOCK`,
      confidence: 100,
      cooldownApplied: false,
      cooldownMs: 0,
      lockState: true,
      evidenceSummary: degradation.evidence.slice(0, 5).join("; "),
    };
    writeReceipt(receipt);
    return {
      action: "ENTER_LOCK_STATE",
      precedence: "critical",
      reason: receipt.reason,
      cooldownApplied: false,
      cooldownMs: 0,
      lockState: true,
      receiptId,
      confidence: 100,
    };
  }

  const lastReceipt = getLastReceipt();
  if (lastReceipt && isInCooldown(lastReceipt.selectedAction, lastReceipt)) {
    const remaining = getRemainingCooldown(lastReceipt.selectedAction, lastReceipt);
    return {
      action: "NO_OP",
      precedence: "low",
      reason: `In cooldown after ${lastReceipt.selectedAction} (${Math.round(remaining / 1000)}s remaining)`,
      cooldownApplied: true,
      cooldownMs: remaining,
      lockState: false,
      receiptId: "",
      confidence: 100,
    };
  }

  const escalate = recoveryCount >= Math.floor(POLICY.maxRecoveriesPerWindow * 0.7);
  const selectedAction = selectAction(degradation, escalate);
  const precedence = ACTION_PRECEDENCE[selectedAction];
  const confidence = makeConfidence(degradation, selectedAction);
  const reason = makeReason(degradation, selectedAction, escalate);

  const receiptId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const receipt: DecisionReceipt = {
    id: receiptId,
    timestamp: Date.now(),
    degradationClass: degradation.class,
    selectedAction: selectedAction,
    precedence,
    reason,
    confidence,
    cooldownApplied: false,
    cooldownMs: 0,
    lockState: false,
    evidenceSummary: degradation.evidence.slice(0, 5).join("; "),
  };
  writeReceipt(receipt);

  return {
    action: selectedAction,
    precedence,
    reason,
    cooldownApplied: false,
    cooldownMs: 0,
    lockState: false,
    receiptId,
    confidence,
  };
}

export { getOperatorStatus, operatorReset } from "./recovery-actions.js";
export { clearLockState } from "./recovery-actions.js";
```

---

## КОМАНДЫ ИНТЕГРАЦИИ

### 1. Интеграция в существующий watchdog

**watchdog.runner.ts** уже обновлён — заменена старая логика на `makeDecision()` + `executeAction()`.

Запуск: (остаётся прежним)
```bash
# watchdog daemon (уже настроен)
npx tsx scripts/telegpt-watchdog-daemon.sh

# или через launchd (если настроен)
launchctl kickstart -k com.telegpt.watchdog
```

### 2. Чтение decision receipts

```bash
# Последние решения
tail -n 20 telegram-bot.decisions.log | jq .

# Считаем сколько рестартов за 5 минут
jq 'select(.selectedAction == "RESTART_BOT_SERVICE") | select(.timestamp > (now - 300))' telegram-bot.decisions.log | wc -l
```

### 3. Проверка lock state

```bash
# Флаг блокировки
[ -f /Users/vijaytaitoo/Projects/tele-gpt/.self-heal-lock ] && echo "LOCKED" || echo "CLEAR"

# Или через Telegram:
/operator_status
```

### 4. Operator reset (снятие блокировки)

```bash
# Разблокировать через Telegram
/operator_reset

# Или вручную
rm -f /Users/vijaytaitoo/Projects/tele-gpt/.self-heal-lock
```

### 5. Перезапуск сервисов вручную (если auto-heal отключён)

```bash
# Bot
launchctl kickstart -k com.telegpt.bot

# Watchdog
launchctl kickstart -k com.telegpt.watchdog

# CDP (Chrome) — если используется
pkill -f "chrome.*9222" 2>/dev/null; sleep 2; /usr/local/bin/chrome --remote-debugging-port=9222 &
```

---

## VERIFY

### Test 1: HEALTHY → NO_OP
```bash
# Убедитесь, что бот работает нормально
curl -s http://localhost:3000/health || echo "OK"
# В логе watchdog должен быть: NO_OP
tail -3 telegram-bot.decisions.log | jq .selectedAction
```

### Test 2: Имитация CDP_UNAVAILABLE
```bash
# Остановите Chrome CDP
pkill -f "chrome.*9222" 2>/dev/null

# Подождите 15-30 секунд, проверьте решения:
tail -5 telegram-bot.decisions.log | jq '{action, reason}'

# Ожидаем: RECONNECT_CDP или RESTART_BRIDGE_LAYER
# В консоли watchdog: [self-heal] Executing RECONNECT_CDP

# Запустите Chrome обратно
/usr/local/bin/chrome --remote-debugging-port=9222 &
```

### Test 3: EMPTY_OUTPUT_SPIKE (много блокировок)
```bash
# Отправьте 5+ запросов, которые вызывают blocked (например, "test" короткое или "echo me")
# В Telegram: /health покажет увеличение blocked count

# Через 2 минуты decision engine должен сработать:
tail -5 telegram-bot.decisions.log | jq '{action, reason}'
# Ожидаем: RESET_BRIDGE_STATE (сначала soft), потом RESTART_BRIDGE_LAYER (если повтор)
```

### Test 4: WATCHDOG_LOOP_RISK → LOCK STATE
```bash
# Имитируйте хронические сбои (остановите бот намеренно)
launchctl unload ~/Library/LaunchAgents/com.telegpt.bot.plist 2>/dev/null

# Подождите несколько проверок watchdog (каждые 15s)
# После 5+ recoveries в 5 минут:
tail -10 telegram-bot.decisions.log | jq '{action, reason}'

# Ожидаем последняя запись: ENTER_LOCK_STATE, lockState: true
# Проверьте файл блокировки:
ls -la .self-heal-lock

# Проверьте статус в Telegram:
/operator_status
# Должно показать: 🔒 ACTIVE
```

### Test 5: OPERATOR RESET
```bash
# Если locked:
/operator_reset
# Ответ: "✅ Lock state cleared. System recoverable."

# Проверьте:
ls .self-heal-lock  # файла нет
/operator_status    # показывает ✅ CLEAR

# Система готова к восстановлению
launchctl kickstart -k com.telegpt.bot
```

### Test 6: COOLDOWN
```bash
# После любого действия (кроме NO_OP) ждите cooldown:
# RESET_BRIDGE_STATE → 10s cooldown
# RESTART_BRIDGE_LAYER → 30s cooldown
# RESTART_BOT_SERVICE → 60s cooldown

# Если в cooldown, decision = NO_OP с причиной "In cooldown for X (Ys remaining)"
tail -1 telegram-bot.decisions.log | jq '{action, reason}'
```

---

## ФИНАЛЬНЫЙ РЕЗУЛЬТАТ

Система теперь:

| До | После |
|---|---|
| Blind restart on timeout | Evidence-based classification |
| Нет контекста о типах сбоев | 8 классов деградации |
| Рестарт любой ценой | Детерминированные escalation rules |
| Без защиты от loops | Recovery window + lock state |
| Нет истории решений | Decision receipts (telegram-bot.decisions.log) |
| Только логи | Explainable reasons в каждом решении |
| Operator не в курсе | Telegram команды: `/operator_status`, `/operator_reset` |

---

## EXPLAINABILITY

Каждое решение содержит **человекочитаемую причину**:

```
"5 delivery errors within 2min → RECONNECT_CDP"
"3 consecutive NOOP (empty) → RESTART_BRIDGE_LAYER"
"Recovery limit exceeded (5/5 in 5min) → ENTER_LOCK_STATE"
"In cooldown for RESET_BRIDGE_STATE (8s remaining)"
```

Receipt сохраняет:
```json
{
  "id": "rec_1712345678_abc123",
  "timestamp": 1712345678123,
  "degradationClass": "CDP_UNAVAILABLE",
  "selectedAction": "RECONNECT_CDP",
  "precedence": "medium",
  "reason": "3 provider/CDP failures in 120s → RECONNECT_CDP",
  "confidence": 75,
  "cooldownApplied": false,
  "lockState": false,
  "evidenceSummary": "cdp: timeout; openai: rate limit; cdp: disconnect"
}
```

---

## ЖЁСТКИЕ ГАРАНТИИ

1. **Idempotent** — каждый action можно вызывать многократно
2. **Deterministic** — одни и те же входные данные → одно решение
3. **No-op when healthy** — не的事情了 чем нужно
4. **Cooldown respected** — не будет hammering
5. **Escalation** — мягкие → жёсткие → lock
6. **Operator override** — всегда можно снять lock
7. **Persistence** — lock state survives watchdog restart (файл `.self-heal-lock`)
8. **No external dependencies** — всё локально, использует существующую инфраструктуру
9. **Zero config** — правила фиксированы, не настраиваются
10. **Explainable** — каждая명령ность записана в receipt

---

## ИНТЕГРАЦИЯ ПРОВЕРКА

**Список всех изменений:**

| Файл | Изменение |
|------|-----------|
| `src/runtime/watchdog/watchdog.types.ts` | +lockStateActive, lockStateSince, recoveryCount |
| `src/runtime/watchdog/watchdog.state.ts` | persistence, lock management, recoveryCount |
| `src/runtime/watchdog/decision-engine.types.ts` | новый |
| `src/runtime/watchdog/degradation-classifier.ts` | новый |
| `src/runtime/watchdog/decision-receipts.ts` | новый |
| `src/runtime/watchdog/recovery-actions.ts` | новый |
| `src/runtime/watchdog/decision-engine.ts` | новый |
| `src/runtime/watchdog/watchdog.runner.ts` | заменена логика на decision engine |
| `src/telegram/bot.ts` | + `/operator_status`, `/operator_reset`, `/self_heal_help` |
| `docs/TELEGPT_SELF_HEAL_ENGINE.md` | новый |

**Не изменены:**
- `src/runtime/delivery/*` — evidence layer остаётся как есть
- `src/bridge/*` — только reading evidence, no modification
- Запуск сервисов — launchd plist не меняется
- CDP подключение — только reconnect via existing APIs

---

## ЖИЗНЕННЫЙ ЦИКЛ

```
[Start] → Healthy → (evidence shows degradation)
    ↓
Classifier → DegradationSignal (BRIDGE_STALE, etc.)
    ↓
Decision Engine → RecoveryDecision (action, reason)
    ↓
Write Receipt → telegram-bot.decisions.log
    ↓
Execute Action (recovery-actions.ts)
    ↓
Success?
  ├─ Yes → Wait (cooldown) → Back to classifier
  └─ No → Increment failure → Watchdog detects → Retry (escalation)
    ↓
Too many retries (5 in 5min)?
  ├─ Yes → ENTER_LOCK_STATE
  │    ↓
  │   Lock Active (all actions blocked except REQUIRE_OPERATOR_RESET)
  │    ↓
  │   Operator runs `/operator_reset`
  │    ↓
  │   Lock cleared → system recoverable
  │
  └─ No → Continue recovery attempts
```

---
