
# CANON SPEC: AgentSession Lifecycle v1

`artifact_id`: CANON_SPEC_AGENTSESSION_LIFECYCLE_v1  
`status`: FIXED  
`classification`: Canon Spec (Lifecycle)  
`owner`: Tele•Ga Core  
`based_on`: canon_interpretation_agent_runtime_patterns_v1  
`created_at`: 2026-02-16

---

## 0) Purpose

Определить формальную жизненную модель AgentSession — что такое агент во времени: когда он рождается, активен, приостановлен, завершён или недействителен.

**Core Principle:**
> Агент — это процесс, а не чат. Процесс имеет жизненный цикл, который должен быть формально определён, наблюдаем и доказуем.

---

## 1) AgentSession Definition

```typescript
type AgentSession = {
  session_id: string;           // UUID v4
  agent_type: string;           // e.g. "planner", "worker", "auditor"
  owner: string;                // e.g. "creator", "user_123"
  created_at: string;           // ISO timestamp
  started_at?: string;          // ISO timestamp
  completed_at?: string;       // ISO timestamp
  terminated_at?: string;       // ISO timestamp
  invalidated_at?: string;      // ISO timestamp

  state: AgentSessionState;
  parent_session_id?: string;   // для sub-agents
  child_session_ids: string[];  // для sub-agents

  // Привязка к Trace Layer
  trace_id: string;             // ссылка на trace.jsonl

  // Привязка к Evidence Bundles
  evidence_bundle_refs: string[];

  // Привязка к Policy-as-Code
  policy_context: {
    allowed_capabilities: string[];
    denied_capabilities: string[];
    budget: {
      max_tokens?: number;
      max_cost?: number;
      max_duration_ms?: number;
    };
  };
};
```

---

## 2) AgentSession States

```typescript
type AgentSessionState =
  | "created"      // создан, но не запущен
  | "starting"     // инициализация, загрузка контекста
  | "active"       // выполняет задачи
  | "paused"       // временно приостановлен
  | "completing"   // завершение, сохранение состояния
  | "completed"    // успешно завершён
  | "terminating"  // принудительное завершение
  | "terminated"   // принудительно завершён
  | "invalidated"  // признан недействительным
  | "failed";      // завершился с ошибкой
```

---

## 3) State Transitions

```
                    ┌─────────────┐
                    │   created   │
                    └──────┬──────┘
                           │ start()
                           ▼
                    ┌─────────────┐
                    │  starting   │
                    └──────┬──────┘
                           │ ready
                           ▼
                    ┌─────────────┐
                    │    active   │◄─────────────────┐
                    └──────┬──────┘                  │
                           │                         │
            ┌──────────────┼──────────────┐         │
            │              │              │         │
     pause()│        complete()   terminate()│      │
            ▼              │              │         │
    ┌─────────────┐        │              │         │
    │    paused   │        │              │         │
    └──────┬──────┘        │              │         │
           │ resume()      │              │         │
           └───────────────┼──────────────┘         │
                           ▼                        │
                    ┌─────────────┐                 │
                    │  completing │                 │
                    └──────┬──────┘                 │
                           │                        │
                           ▼                        │
                    ┌─────────────┐                 │
                    │  completed  │                 │
                    └─────────────┘                 │
                           │                        │
                           │ invalidate()           │
                           ▼                        │
                    ┌─────────────┐                 │
                    │ invalidated │                 │
                    └─────────────┘                 │
                           │                        │
                           ▼                        │
                    ┌─────────────┐                 │
                    │ terminated  │◄────────────────┘
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    failed   │
                    └─────────────┘
```

---

## 4) State Invariants

### 4.1 Created State

```yaml
invariants:
  - session_id is unique
  - agent_type is registered
  - owner is valid
  - created_at is set
  - state is "created"
  - trace_id is assigned
  - evidence_bundle_refs is empty
  - policy_context is initialized

forbidden:
  - started_at is set
  - completed_at is set
  - terminated_at is set
  - invalidated_at is set
  - child_session_ids is not empty
```

### 4.2 Active State

```yaml
invariants:
  - session_id is unique
  - agent_type is registered
  - owner is valid
  - created_at is set
  - started_at is set
  - state is "active"
  - trace_id is assigned
  - policy_context is valid

forbidden:
  - completed_at is set
  - terminated_at is set
  - invalidated_at is set
  - budget exceeded
```

### 4.3 Completed State

```yaml
invariants:
  - session_id is unique
  - agent_type is registered
  - owner is valid
  - created_at is set
  - started_at is set
  - completed_at is set
  - state is "completed"
  - trace_id is assigned
  - evidence_bundle_refs is not empty
  - policy_context is valid

forbidden:
  - terminated_at is set
  - invalidated_at is set
  - child_session_ids contains non-completed sessions
```

### 4.4 Invalidated State

```yaml
invariants:
  - session_id is unique
  - agent_type is registered
  - owner is valid
  - created_at is set
  - invalidated_at is set
  - state is "invalidated"
  - trace_id is assigned
  - evidence_bundle_refs is not empty

forbidden:
  - child_session_ids contains non-terminated sessions
```

---

## 5) Forbidden States

```typescript
type ForbiddenState = {
  state: AgentSessionState;
  reason: string;
  resolution: string;
};

// Примеры запрещённых состояний
const FORBIDDEN_STATES: ForbiddenState[] = [
  {
    state: "active",
    reason: "budget exceeded",
    resolution: "terminate session immediately"
  },
  {
    state: "completed",
    reason: "child sessions not completed",
    resolution: "wait for child sessions or terminate them"
  },
  {
    state: "invalidated",
    reason: "child sessions still active",
    resolution: "terminate all child sessions first"
  }
];
```

---

## 6) Lifecycle Hooks

```typescript
type LifecycleHook = {
  event: "before_state_change" | "after_state_change";
  from_state?: AgentSessionState;
  to_state: AgentSessionState;
  handler: (session: AgentSession, context: any) => Promise<void>;
};

// Примеры хуков
const LIFECYCLE_HOOKS: LifecycleHook[] = [
  {
    event: "before_state_change",
    from_state: "active",
    to_state: "completed",
    handler: async (session, context) => {
      // Сохранить evidence bundle
      await saveEvidenceBundle(session);
      // Обновить billing
      await updateBilling(session);
    }
  },
  {
    event: "after_state_change",
    from_state: "active",
    to_state: "terminated",
    handler: async (session, context) => {
      // Уведомить владельца
      await notifyOwner(session, "Session terminated");
      // Создать audit record
      await createAuditRecord(session, "terminated");
    }
  }
];
```

---

## 7) Integration with Tele•Ga Layers

### 7.1 Trace Layer

```typescript
interface TraceLayer {
  // Создать trace для новой сессии
  createTrace(session_id: string): Promise<string>;

  // Записать событие в trace
  appendEvent(trace_id: string, event: any): Promise<void>;

  // Получить trace для сессии
  getTrace(session_id: string): Promise<Trace>;

  // Закрыть trace при завершении сессии
  closeTrace(trace_id: string): Promise<void>;
}
```

### 7.2 Evidence Bundles

```typescript
interface EvidenceBundle {
  // Создать bundle для сессии
  createBundle(session_id: string): Promise<string>;

  // Добавить evidence в bundle
  addEvidence(bundle_id: string, evidence: any): Promise<void>;

  // Получить bundle для сессии
  getBundle(session_id: string): Promise<EvidenceBundle>;

  // Подписать bundle при завершении сессии
  signBundle(bundle_id: string): Promise<void>;
}
```

### 7.3 Policy-as-Code

```typescript
interface PolicyGate {
  // Проверить, разрешено ли действие
  checkAction(session: AgentSession, action: any): Promise<boolean>;

  // Проверить, не превышен ли бюджет
  checkBudget(session: AgentSession): Promise<boolean>;

  // Обновить бюджет после действия
  updateBudget(session: AgentSession, cost: number): Promise<void>;

  // Проверить, разрешено ли изменение состояния
  checkStateTransition(session: AgentSession, new_state: AgentSessionState): Promise<boolean>;
}
```

---

## 8) Economic Layer Integration

### 8.1 Agent-Hour Billing

```typescript
interface BillingService {
  // Начать биллинг для сессии
  startBilling(session_id: string): Promise<void>;

  // Остановить биллинг для сессии
  stopBilling(session_id: string): Promise<BillingRecord>;

  // Получить текущий биллинг для сессии
  getCurrentBilling(session_id: string): Promise<BillingRecord>;
}

type BillingRecord = {
  session_id: string;
  started_at: string;
  stopped_at?: string;
  duration_ms: number;
  cost: number;
  currency: string;
};
```

### 8.2 Forensic Replay

```typescript
interface ForensicReplay {
  // Создать replay для сессии
  createReplay(session_id: string): Promise<string>;

  // Получить replay для сессии
  getReplay(replay_id: string): Promise<Replay>;

  // Запустить replay
  runReplay(replay_id: string): Promise<void>;
}

type Replay = {
  replay_id: string;
  session_id: string;
  created_at: string;
  trace_id: string;
  evidence_bundle_id: string;
  status: "created" | "running" | "completed" | "failed";
};
```

---

## 9) Canon Verdict

**VERDICT:**  
CONFIRMED — AgentSession Lifecycle формально определён как каноническая модель жизненного цикла агента.

**DECISION:**  
Tele•Ga Runtime должен следовать этой модели без исключений.

**ACTION:**  
No implementation triggered. Document serves as architectural anchor for:
- Tele•GPT Runtime,
- Sigma Forge,
- страховые / комплаенс-модули,
- любые UI-проекции.

---

## 10) Reinforced Principle

> Агент — это процесс, а не чат.  
> Процесс имеет жизненный цикл, который должен быть формально определён, наблюдаем и доказуем.  
> Без формальной модели жизненного цикла невозможно:
> - корректно делать Policy,
> - делать Billing / Insurance,
> - делать Audit / Replay,
> - масштабировать Worker-tier.
