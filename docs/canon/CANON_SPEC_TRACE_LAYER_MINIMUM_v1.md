
# CANON SPEC: Trace Layer Minimum v1

`artifact_id`: CANON_SPEC_TRACE_LAYER_MINIMUM_v1  
`status`: FIXED  
`classification`: Canon Spec (Observability)  
`owner`: Tele•Ga Core  
`based_on`: 
  - canon_interpretation_agent_runtime_patterns_v1
  - CANON_SPEC_AGENTSESSION_LIFECYCLE_v1
`created_at`: 2026-02-24

---

## 0) Purpose

Определить минимальный контракт Trace Layer — что такое trace, как он создаётся, хранится и запрашивается.

**Core Principle:**
> Observability не опционален. Trace — это не лог, а доказательство исполнения. Без trace нет evidence, без evidence нет доверия.

---

## 1) Trace Definition

```typescript
type Trace = {
  trace_id: string;           // UUID v4
  session_id: string;        // ссылка на AgentSession
  created_at: string;        // ISO timestamp
  started_at?: string;       // ISO timestamp
  completed_at?: string;     // ISO timestamp

  // Метаданные
  metadata: {
    agent_type: string;      // e.g. "planner", "worker", "auditor"
    owner: string;           // e.g. "creator", "user_123"
    parent_trace_id?: string; // для sub-agents
    child_trace_ids: string[]; // для sub-agents
  };

  // События
  events: TraceEvent[];

  // Статус
  status: TraceStatus;

  // Привязка к Evidence Bundle
  evidence_bundle_ref?: string;
};
```

---

## 2) Trace Event Definition

```typescript
type TraceEvent = {
  event_id: string;          // UUID v4
  trace_id: string;         // ссылка на Trace
  timestamp: string;        // ISO timestamp

  // Тип события
  event_type: TraceEventType;

  // Данные события
  data: any;

  // Контекст события
  context: {
    level: "debug" | "info" | "warn" | "error";
    source?: string;         // e.g. "agent", "tool", "policy"
    tags?: Record<string, string>;
  };
};
```

---

## 3) Trace Event Types

```typescript
type TraceEventType =
  | "session_created"       // сессия создана
  | "session_started"       // сессия запущена
  | "session_paused"        // сессия приостановлена
  | "session_resumed"       // сессия возобновлена
  | "session_completed"      // сессия завершена
  | "session_terminated"     // сессия принудительно завершена
  | "session_invalidated"    // сессия признана недействительной
  | "session_failed"        // сессия завершилась с ошибкой

  | "tool_call_started"      // вызов инструмента начат
  | "tool_call_completed"    // вызов инструмента завершён
  | "tool_call_failed"       // вызов инструмента завершился с ошибкой

  | "policy_check_started"   // проверка политики начата
  | "policy_check_completed" // проверка политики завершена
  | "policy_denied"          // политика отклонила действие

  | "state_changed"          // состояние сессии изменено

  | "error"                  // ошибка
  | "warning"                // предупреждение
  | "info"                   // информационное сообщение
  | "debug"                  // отладочное сообщение
  | "custom";                // кастомное событие
```

---

## 4) Trace Status

```typescript
type TraceStatus =
  | "created"    // создан, но не запущен
  | "running"    // выполняется
  | "paused"     // приостановлен
  | "completed"  // завершён
  | "terminated" // принудительно завершён
  | "failed";    // завершился с ошибкой
```

---

## 5) Trace Storage Contract

```typescript
interface TraceStorage {
  // Создать новый trace
  createTrace(session_id: string, metadata: any): Promise<Trace>;

  // Записать событие в trace
  appendEvent(trace_id: string, event: TraceEvent): Promise<void>;

  // Получить trace по ID
  getTrace(trace_id: string): Promise<Trace>;

  // Получить trace по session_id
  getTraceBySessionId(session_id: string): Promise<Trace>;

  // Получить события из trace
  getEvents(trace_id: string, filter?: TraceEventFilter): Promise<TraceEvent[]>;

  // Закрыть trace
  closeTrace(trace_id: string, status: TraceStatus): Promise<void>;

  // Удалить trace
  deleteTrace(trace_id: string): Promise<void>;
}
```

---

## 6) Trace Event Filter

```typescript
type TraceEventFilter = {
  event_type?: TraceEventType[];
  level?: ("debug" | "info" | "warn" | "error")[];
  source?: string[];
  tags?: Record<string, string>;
  start_time?: string;  // ISO timestamp
  end_time?: string;    // ISO timestamp
  limit?: number;
  offset?: number;
};
```

---

## 7) Trace Query Contract

```typescript
interface TraceQuery {
  // Поиск трасс по фильтру
  queryTraces(filter: TraceFilter): Promise<Trace[]>;

  // Получить статистику по трассам
  getTraceStats(filter: TraceFilter): Promise<TraceStats>;

  // Получить агрегированные события
  getAggregatedEvents(filter: TraceEventFilter, aggregation: EventAggregation): Promise<AggregatedEvents>;
}

type TraceFilter = {
  session_id?: string;
  agent_type?: string;
  owner?: string;
  status?: TraceStatus[];
  start_time?: string;  // ISO timestamp
  end_time?: string;    // ISO timestamp
  limit?: number;
  offset?: number;
};

type TraceStats = {
  total_traces: number;
  by_status: Record<TraceStatus, number>;
  by_agent_type: Record<string, number>;
  by_owner: Record<string, number>;
  avg_duration_ms: number;
};

type EventAggregation =
  | "count_by_type"
  | "count_by_level"
  | "count_by_source"
  | "timeline";

type AggregatedEvents = {
  aggregation: EventAggregation;
  data: any;
};
```

---

## 8) Trace Evidence Contract

```typescript
interface TraceEvidence {
  // Создать evidence bundle для trace
  createEvidenceBundle(trace_id: string): Promise<string>;

  // Добавить evidence в bundle
  addEvidence(bundle_id: string, evidence: any): Promise<void>;

  // Получить evidence bundle для trace
  getEvidenceBundle(trace_id: string): Promise<EvidenceBundle>;

  // Подписать evidence bundle
  signEvidenceBundle(bundle_id: string): Promise<void>;

  // Верифицировать evidence bundle
  verifyEvidenceBundle(bundle_id: string): Promise<boolean>;
}

type EvidenceBundle = {
  bundle_id: string;
  trace_id: string;
  created_at: string;
  signed_at?: string;
  signature?: string;
  evidence: any[];
};
```

---

## 9) Trace Invariants

### 9.1 Created State

```yaml
invariants:
  - trace_id is unique
  - session_id is valid
  - created_at is set
  - status is "created"
  - events is empty
  - evidence_bundle_ref is not set

forbidden:
  - started_at is set
  - completed_at is set
  - events is not empty
```

### 9.2 Running State

```yaml
invariants:
  - trace_id is unique
  - session_id is valid
  - created_at is set
  - started_at is set
  - status is "running"
  - events is not empty

forbidden:
  - completed_at is set
  - evidence_bundle_ref is set
```

### 9.3 Completed State

```yaml
invariants:
  - trace_id is unique
  - session_id is valid
  - created_at is set
  - started_at is set
  - completed_at is set
  - status is "completed"
  - events is not empty
  - evidence_bundle_ref is set

forbidden:
  - events is empty
  - evidence_bundle_ref is not set
```

---

## 10) Integration with Tele•Ga Layers

### 10.1 AgentSession Lifecycle

```typescript
interface AgentSessionTraceIntegration {
  // Создать trace для новой сессии
  createTraceForSession(session: AgentSession): Promise<Trace>;

  // Записать событие изменения состояния сессии
  recordStateChange(session: AgentSession, old_state: AgentSessionState, new_state: AgentSessionState): Promise<void>;

  // Закрыть trace при завершении сессии
  closeTraceForSession(session: AgentSession): Promise<void>;
}
```

### 10.2 Policy-as-Code

```typescript
interface PolicyTraceIntegration {
  // Записать проверку политики
  recordPolicyCheck(session: AgentSession, policy_check: PolicyCheck, result: PolicyResult): Promise<void>;

  // Получить все проверки политики для сессии
  getPolicyChecks(session_id: string): Promise<PolicyCheck[]>;
}
```

### 10.3 Evidence Bundles

```typescript
interface EvidenceTraceIntegration {
  // Создать evidence bundle для trace
  createEvidenceBundleForTrace(trace_id: string): Promise<string>;

  // Добавить trace events в evidence bundle
  addTraceEventsToBundle(bundle_id: string, trace_id: string): Promise<void>;

  // Подписать evidence bundle
  signEvidenceBundleForTrace(trace_id: string): Promise<void>;
}
```

---

## 11) Minimum Implementation Requirements

### 11.1 Storage

- [ ] Trace хранится в append-only формате (JSONL)
- [ ] Каждое событие имеет уникальный event_id
- [ ] События упорядочены по timestamp
- [ ] Trace не может быть изменён после закрытия

### 11.2 Query

- [ ] Поддержка фильтрации по event_type
- [ ] Поддержка фильтрации по level
- [ ] Поддержка фильтрации по source
- [ ] Поддержка фильтрации по tags
- [ ] Поддержка временного диапазона
- [ ] Поддержка пагинации (limit/offset)

### 11.3 Evidence

- [ ] Evidence bundle создаётся для каждого закрытого trace
- [ ] Evidence bundle содержит все события trace
- [ ] Evidence bundle подписывается криптографической подписью
- [ ] Evidence bundle может быть верифицирован

### 11.4 Integration

- [ ] Trace создаётся для каждой AgentSession
- [ ] Состояния AgentSession записываются в trace
- [ ] Проверки политики записываются в trace
- [ ] Evidence bundle создаётся при закрытии trace

---

## 12) Canon Verdict

**VERDICT:**  
CONFIRMED — Trace Layer Minimum формально определён как каноническая модель наблюдаемости.

**DECISION:**  
Tele•Ga Runtime должен следовать этой модели без исключений.

**ACTION:**  
No implementation triggered. Document serves as architectural anchor for:
- Tele•GPT Runtime,
- Sigma Forge,
- страховые / комплаенс-модули,
- любые UI-проекции.

---

## 13) Reinforced Principle

> Observability не опционален.  
> Trace — это не лог, а доказательство исполнения.  
> Без trace нет evidence, без evidence нет доверия.  
> Без формальной модели trace невозможно:
> - делать Audit / Replay,
> - делать Billing / Insurance,
> - делать Policy Enforcement,
> - масштабировать Worker-tier.
