
# Router v1

## Status
🟢 **APPROVED** — Canonical Candidate → Pilot / Integration Ready

## Position in Architecture

```
Tele•Ga Core
└─ Intelligence Layer
   └─ Router v1
```

## Purpose
НЕ автоматизация, а подсказка действия:
- "Это похоже на идею → отправить в M•C?"
- "Это похоже на код → оформить BuildTask?"

**Только предложения. Только подтверждение.**

## ARCHITECTURE

### Core Principles
1. **Non-intrusive** — только предложения, без автоматического выполнения
2. **User-controlled** — пользователь всегда принимает решение
3. **Explainable** — каждое предложение имеет обоснование
4. **Minimal** — только необходимые маршруты, без перегрузки

### Router Types

#### 1. Idea Router
```typescript
interface IdeaRoute {
  type: "idea";
  confidence: number; // 0.0 - 1.0
  destination: "mission_control";
  reason: string;
  metadata: {
    title: string;
    summary: string[];
    proposedPack: string;
  };
}
```

#### 2. Code Router
```typescript
interface CodeRoute {
  type: "code";
  confidence: number; // 0.0 - 1.0
  destination: "sigma_forge";
  reason: string;
  metadata: {
    language: string;
    complexity: "low" | "medium" | "high";
    estimatedLines: number;
  };
}
```

#### 3. Document Router
```typescript
interface DocumentRoute {
  type: "document";
  confidence: number; // 0.0 - 1.0
  destination: "document_ingest" | "marketbase";
  reason: string;
  metadata: {
    documentType: "invoice" | "specification" | "contract" | "other";
    pageCount: number;
    hasTables: boolean;
  };
}
```

### Router Decision

```typescript
interface RouterDecision {
  routes: Route[];
  timestamp: string;
  userId: string;
  context: {
    inputType: "text" | "code" | "document" | "image";
    inputLength: number;
    language?: string;
  };
}

type Route = IdeaRoute | CodeRoute | DocumentRoute;
```

## API CONTRACT

### 1. Analyze Input

```typescript
interface AnalyzeInputOptions {
  input: string;
  inputType: "text" | "code" | "document" | "image";
  userId: string;
  locale?: "ru" | "en" | "uz";
  context?: Record<string, any>;
}

interface AnalyzeInputResult {
  decision: RouterDecision;
  suggestedActions: SuggestedAction[];
}

interface SuggestedAction {
  actionId: string;
  route: Route;
  message: string;
  requiresConfirmation: true; // Always true in v1
}
```

### 2. Confirm Action

```typescript
interface ConfirmActionOptions {
  actionId: string;
  userId: string;
  confirmed: boolean;
}

interface ConfirmActionResult {
  success: boolean;
  actionId: string;
  nextStep?: {
    destination: string;
    payload: any;
  };
  error?: string;
}
```

### 3. Get Action Status

```typescript
interface GetActionStatusOptions {
  actionId: string;
  userId: string;
}

interface GetActionStatusResult {
  actionId: string;
  status: "pending" | "confirmed" | "rejected" | "executed" | "failed";
  route: Route;
  timestamp: string;
  error?: string;
}
```

## ROUTE RULES

### Idea → Mission Control

**Trigger conditions:**
- Текст содержит описание идеи или концепции
- Длина > 50 символов
- Confidence ≥ 0.6

**Example:**
```
Input: "Хочу сделать бота для автоматизации документооборота"
Route: {
  type: "idea",
  confidence: 0.75,
  destination: "mission_control",
  reason: "Текст описывает идею для автоматизации бизнес-процесса",
  metadata: {
    title: "Бот для документооборота",
    summary: ["автоматизация", "документооборот"],
    proposedPack: "business_automation"
  }
}
```

### Code → Sigma Forge

**Trigger conditions:**
- Вход содержит код (определяется по синтаксису)
- Длина > 20 символов
- Confidence ≥ 0.7

**Example:**
```
Input: "function hello() { console.log('Hello'); }"
Route: {
  type: "code",
  confidence: 0.85,
  destination: "sigma_forge",
  reason: "Вход содержит JavaScript код",
  metadata: {
    language: "javascript",
    complexity: "low",
    estimatedLines: 1
  }
}
```

### Document → Document Ingest / MarketBase

**Trigger conditions:**
- Вход — документ (PDF, image)
- Confidence ≥ 0.65

**Example:**
```
Input: invoice.pdf
Route: {
  type: "document",
  confidence: 0.8,
  destination: "marketbase",
  reason: "Документ похож на инвойс",
  metadata: {
    documentType: "invoice",
    pageCount: 2,
    hasTables: true
  }
}
```

## CONFIDENCE THRESHOLDS

```typescript
const CONFIDENCE_THRESHOLDS = {
  IDEA: 0.6,
  CODE: 0.7,
  DOCUMENT: 0.65,
} as const;
```

## TRACE HOOKS

### Router Analysis Hooks

```typescript
interface RouterAnalysisEvent {
  eventType: "route_analyzed" | "route_suggested" | "route_rejected";
  userId: string;
  timestamp: string;
  input: {
    type: string;
    length: number;
    preview: string;
  };
  routes: Route[];
  selectedRoute?: Route;
  confidence: number;
  error?: string;
}
```

### Action Confirmation Hooks

```typescript
interface ActionConfirmationEvent {
  eventType: "action_confirmed" | "action_rejected" | "action_failed";
  userId: string;
  timestamp: string;
  actionId: string;
  route: Route;
  confirmed: boolean;
  error?: string;
}
```

## PILOT SCENARIO

### Objective
Валидировать Router v1 с реальными сценариями использования в Tele•Ga.

### Test Scenarios
1. **Idea routing** — текстовые идеи → Mission Control
2. **Code routing** — код → Sigma Forge
3. **Document routing** — документы → Document Ingest / MarketBase

### Success Criteria
- ✅ Все маршруты корректно определяются
- ✅ Confidence scores адекватны
- ✅ Предложения не навязчивы
- ✅ Trace hooks корректно отправляют события
- ✅ Пользователь всегда контролирует решение

### Pilot Deliverables
- Test results report
- Confidence thresholds analysis
- Trace events analysis
- Recommendations for v2 improvements

## Integration Points

### Consumers
1. **Tele•GPT** — основной потребитель для маршрутизации
2. **Mission Control** — приём идей
3. **Sigma Forge** — приём кода
4. **Document Ingest** — приём документов
5. **MarketBase** — приём бизнес-документов

### Dependencies
- tgHtml.ts (для рендеринга сообщений)
- renderMessage() (для единообразных сообщений)
- Forge Explain (trace hooks)
- Mission Control (monitoring)

## Usage Examples

### Example 1: Idea Routing

```typescript
const decision = await router.analyzeInput({
  input: "Хочу сделать бота для автоматизации документооборота",
  inputType: "text",
  userId: "user123",
  locale: "ru"
});

if (decision.suggestedActions.length > 0) {
  const action = decision.suggestedActions[0];
  const msg = renderMessage("info", {
    title: "Предложение",
    body: action.message
  }, { isPremium: false, locale: "ru" });

  await ctx.reply(msg.text, {
    parse_mode: msg.parse_mode,
    reply_markup: Markup.inlineKeyboard([
      Markup.button.callback("✅ Да", `confirm:${action.actionId}`),
      Markup.button.callback("❌ Нет", `reject:${action.actionId}`)
    ])
  });
}
```

### Example 2: Code Routing

```typescript
const decision = await router.analyzeInput({
  input: "function hello() { console.log('Hello'); }",
  inputType: "code",
  userId: "user123",
  locale: "ru"
});

// Similar to Example 1, but with code-specific message
```

### Example 3: Document Routing

```typescript
const decision = await router.analyzeInput({
  input: "invoice.pdf",
  inputType: "document",
  userId: "user123",
  locale: "ru"
});

// Similar to Example 1, but with document-specific message
```

## License
Apache 2.0 — compatible with Tele•Ga commercial core

## Version History
- v1.0 — Initial canonical specification (2026-02-03)
