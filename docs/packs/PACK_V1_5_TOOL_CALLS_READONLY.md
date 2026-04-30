
# PACK: Tool Calls Read-Only v1.5

`artifact_id`: PACK_V1_5_TOOL_CALLS_READONLY  
`status`: FIXED  
`classification`: Pack → Tool Calls → Read-Only  
`owner`: Tele•Ga Core  
`based_on`: 
  - canon_spec_trace_layer_minimum_v1
  - canon_spec_agentsession_lifecycle_v1
`created_at`: 2026-02-24

---

## 1. Goal (Hard)

Make tool calls a first-class contract in Tele•Ga Runtime with:
- Read-only operations (net.fetch, fs.read)
- Allowlist-based network access
- Sandbox-based file system access
- Policy-gated execution
- Mandatory trace events

**Core Principle:**
> Tool calls are not features — they are security boundaries. Every tool call must be traced, policy-gated, and sandboxed.

---

## 2. Scope

### 2.1 In Scope

- **net.fetch** — HTTP/HTTPS requests with allowlist
- **fs.read** — File system read operations in sandbox
- **Policy gates** — Pre-execution policy checks
- **Trace events** — Mandatory tool.called + tool.result events
- **Redaction** — Sensitive data redaction in trace

### 2.2 Out of Scope (Explicit)

- Write operations (fs.write, terminal.exec)
- Network operations beyond fetch (WebSocket, etc.)
- Full agent planner / JobGraph v2
- Monetization layers

---

## 3. Tool Contracts

### 3.1 net.fetch

```typescript
interface NetFetchTool {
  name: "net.fetch";

  // Параметры
  params: {
    url: string;           // URL для запроса
    method?: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;      // максимальное время ожидания (ms)
  };

  // Результат
  result: {
    ok: boolean;
    status: number;
    headers: Record<string, string>;
    body: any;
    error?: string;
  };
}
```

#### 3.1.1 Allowlist

```yaml
net_fetch_allowlist:
  # Разрешённые домены
  domains:
    - "api.openai.com"
    - "api.anthropic.com"
    - "*.github.com"
    - "*.gitlab.com"

  # Разрешённые протоколы
  protocols:
    - "https"

  # Ограничения по времени
  timeout_ms:
    default: 30000
    max: 60000

  # Ограничения по размеру ответа
  max_response_size_bytes: 10485760  # 10MB
```

#### 3.1.2 Trace Events

```typescript
// tool.called
{
  "v": 1,
  "ts": "2026-02-24T12:34:56.789Z",
  "rid": "req_01H...",
  "sid": "sess_01H...",
  "eid": "evt_01H...",
  "type": "tool.called",
  "lvl": "info",
  "actor": { "kind": "agent", "id": "planner" },
  "span": { "span_id": "sp_01H...", "parent_span_id": null },
  "data": {
    "tool_kind": "net.fetch",
    "args_redacted": {
      "url": "https://api.example.com/endpoint",
      "method": "GET",
      "headers": "[REDACTED]"
    },
    "policy_ref": "rule_net_fetch_allowlist"
  },
  "hash": { "alg": "sha256", "prev": "…", "self": "…" }
}

// tool.result
{
  "v": 1,
  "ts": "2026-02-24T12:34:57.789Z",
  "rid": "req_01H...",
  "sid": "sess_01H...",
  "eid": "evt_01H...",
  "type": "tool.result",
  "lvl": "info",
  "actor": { "kind": "tool", "id": "net.fetch" },
  "span": { "span_id": "sp_01H...", "parent_span_id": null },
  "data": {
    "tool_kind": "net.fetch",
    "ok": true,
    "result_ref": "artifact://bundle_hash/net_fetch_response.json",
    "status": 200,
    "headers": "[REDACTED]"
  },
  "hash": { "alg": "sha256", "prev": "…", "self": "…" }
}
```

### 3.2 fs.read

```typescript
interface FsReadTool {
  name: "fs.read";

  // Параметры
  params: {
    path: string;          // путь к файлу
    encoding?: "utf-8" | "base64";
    max_size?: number;     // максимальный размер (bytes)
  };

  // Результат
  result: {
    ok: boolean;
    content?: string;
    size?: number;
    error?: string;
  };
}
```

#### 3.2.1 Sandbox

```yaml
fs_read_sandbox:
  # Разрешённые директории
  allowed_directories:
    - "/workspace/docs"
    - "/workspace/skills"
    - "/workspace/contracts"

  # Запрещённые директории
  forbidden_directories:
    - "/workspace/.git"
    - "/workspace/node_modules"
    - "/workspace/.env"

  # Ограничения по размеру файла
  max_file_size_bytes: 1048576  # 1MB

  # Ограничения по количеству файлов
  max_files_per_session: 100
```

#### 3.2.2 Trace Events

```typescript
// tool.called
{
  "v": 1,
  "ts": "2026-02-24T12:34:56.789Z",
  "rid": "req_01H...",
  "sid": "sess_01H...",
  "eid": "evt_01H...",
  "type": "tool.called",
  "lvl": "info",
  "actor": { "kind": "agent", "id": "worker" },
  "span": { "span_id": "sp_01H...", "parent_span_id": null },
  "data": {
    "tool_kind": "fs.read",
    "args_redacted": {
      "path": "/workspace/docs/README.md",
      "encoding": "utf-8"
    },
    "policy_ref": "rule_fs_read_sandbox"
  },
  "hash": { "alg": "sha256", "prev": "…", "self": "…" }
}

// tool.result
{
  "v": 1,
  "ts": "2026-02-24T12:34:57.789Z",
  "rid": "req_01H...",
  "sid": "sess_01H...",
  "eid": "evt_01H...",
  "type": "tool.result",
  "lvl": "info",
  "actor": { "kind": "tool", "id": "fs.read" },
  "span": { "span_id": "sp_01H...", "parent_span_id": null },
  "data": {
    "tool_kind": "fs.read",
    "ok": true,
    "result_ref": "artifact://bundle_hash/fs_read_content.txt",
    "size": 1024
  },
  "hash": { "alg": "sha256", "prev": "…", "self": "…" }
}
```

---

## 4. Policy Gates

### 4.1 Pre-Execution Policy Check

```typescript
interface PolicyGate {
  // Проверить, разрешено ли выполнение инструмента
  checkToolExecution(session: AgentSession, tool: ToolCall): Promise<PolicyResult>;

  // Проверить, разрешены ли аргументы инструмента
  checkToolArguments(session: AgentSession, tool: ToolCall): Promise<PolicyResult>;
}

type ToolCall = {
  tool_kind: string;
  params: any;
};

type PolicyResult = {
  allow: boolean;
  reason: string;
  rule_id: string;
  decision: "allow" | "deny" | "needs_approval";
};
```

### 4.2 Policy Rules

```yaml
policy_rules:
  net_fetch_allowlist:
    id: "rule_net_fetch_allowlist"
    description: "Allow net.fetch only for allowlisted domains"
    applies_to: "net.fetch"
    check: |
      if url.domain not in allowlist:
        return deny
      if url.protocol != "https":
        return deny
      if timeout > max_timeout:
        return deny
      return allow

  fs_read_sandbox:
    id: "rule_fs_read_sandbox"
    description: "Allow fs.read only within sandboxed directories"
    applies_to: "fs.read"
    check: |
      if path not in allowed_directories:
        return deny
      if path in forbidden_directories:
        return deny
      if file_size > max_file_size:
        return deny
      return allow
```

---

## 5. Redaction & Privacy

### 5.1 Sensitive Data Redaction

```typescript
interface RedactionService {
  // Редактировать чувствительные данные
  redact(data: any): any;

  // Хешировать чувствительные данные
  hash(data: string): string;
}

// Примеры редактирования
const REDACTED_FIELDS = [
  "api_key",
  "token",
  "cookie",
  "password",
  "secret",
  "authorization"
];

// Примеры хеширования
const HASHED_FIELDS = [
  "url_with_credentials",
  "private_url"
];
```

### 5.2 Redaction Rules

```yaml
redaction_rules:
  # Поля, которые должны быть полностью удалены
  removed_fields:
    - "api_key"
    - "token"
    - "cookie"
    - "password"
    - "secret"
    - "authorization"

  # Поля, которые должны быть заменены на "[REDACTED]"
  redacted_fields:
    - "headers.authorization"
    - "headers.cookie"
    - "body.api_key"

  # Поля, которые должны быть хешированы
  hashed_fields:
    - "url_with_credentials"
    - "private_url"
    - "connection_string"
```

---

## 6. Implementation Plan

### 6.1 Step 1 — Tool Registry

- [ ] Создать реестр инструментов
- [ ] Зарегистрировать net.fetch
- [ ] Зарегистрировать fs.read
- [ ] Определить контракты инструментов

### 6.2 Step 2 — Policy Gates

- [ ] Реализовать PolicyGate
- [ ] Реализовать правило net_fetch_allowlist
- [ ] Реализовать правило fs_read_sandbox
- [ ] Интегрировать с AgentSession lifecycle

### 6.3 Step 3 — Trace Events

- [ ] Реализовать генерацию tool.called
- [ ] Реализовать генерацию tool.result
- [ ] Интегрировать с Trace Layer Minimum

### 6.4 Step 4 — Redaction

- [ ] Реализовать RedactionService
- [ ] Определить правила редактирования
- [ ] Интегрировать с trace events

### 6.5 Step 5 — Sandbox

- [ ] Реализовать sandbox для fs.read
- [ ] Определить разрешённые директории
- [ ] Определить запрещённые директории
- [ ] Интегрировать с PolicyGate

---

## 7. Validity Tests

### 7.1 Tool Calls Tests

- [ ] net.fetch с разрешённым доменом → разрешено
- [ ] net.fetch с неразрешённым доменом → отклонено
- [ ] net.fetch с HTTP → отклонено
- [ ] net.fetch с timeout > max → отклонено
- [ ] fs.read с разрешённой директорией → разрешено
- [ ] fs.read с запрещённой директорией → отклонено
- [ ] fs.read с файлом > max_size → отклонено

### 7.2 Trace Events Tests

- [ ] tool.called содержит все обязательные поля
- [ ] tool.result содержит все обязательные поля
- [ ] tool.called содержит args_redacted
- [ ] tool.result содержит result_ref или error
- [ ] Все tool calls имеют парные tool.called + tool.result

### 7.3 Redaction Tests

- [ ] API keys редактированы
- [ ] Tokens редактированы
- [ ] Cookies редактированы
- [ ] Passwords редактированы
- [ ] Secrets редактированы
- [ ] URLs с credentials хешированы

---

## 8. Canon Verdict

**VERDICT:**  
CONFIRMED — Tool Calls Read-Only формально определён как каноническая контракт для инструментальных вызовов.

**DECISION:**  
Tele•Ga Runtime должен следовать этому контракту без исключений.

**ACTION:**  
No implementation triggered. Document serves as architectural anchor for:
- Tele•GPT Runtime,
- Sigma Forge,
- любые UI-проекции.

---

## 9. Reinforced Principle

> Tool calls are not features — they are security boundaries.  
> Every tool call must be traced, policy-gated, and sandboxed.  
> Без формального контракта tool calls невозможно:
> - обеспечивать безопасность,
> - делать Audit / Replay,
> - делать Policy Enforcement,
> - масштабировать Worker-tier.
