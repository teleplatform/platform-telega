
# PACK_V1_4_RATE_LIMIT_POLICY_GATE.md

Status: CANONICAL ✅
Pack: v1.4
Name: RATE_LIMIT + POLICY_GATE
Date: 2026-01-30
Owner: Nikita (Creator)
Scope: Tele•GPT Core → Safety Layer: Rate Limiting + Policy Enforcement

---

## 0) Purpose

Создать канонический Safety Layer для Tele•GPT, который обеспечивает:
- Rate limiting (по провайдеру, модели, клиенту)
- Quota enforcement (по пользователю/ключу)
- Policy enforcement (какие модели/инструменты разрешены)

**Core Principle:**
> Без безопасности нельзя пускать tool calls и агентов. Это не UX-фича, это safety-фича.

---

## 1) Canon Rules (НЕЛЬЗЯ нарушать)

- ❌ Никакого обхода лимитов
- ✅ Все запросы проходят через Policy Gate
- ✅ Лимиты enforce'ятся сервером, а не "договорённостью"
- ✅ Policy-fail → 429/403 по контракту
- ✅ Лимиты настраиваются через конфиг, без перезапуска

---

## 2) Rate Limiting Contract

### 2.1 Rate Limit Scope

```typescript
type RateLimitScope = {
  provider?: string;      // e.g. "openai", "local"
  model?: string;         // e.g. "gpt-4", "gpt-3.5-turbo"
  client?: string;        // e.g. "telegram:123456", "api:sk-..."
  user?: string;          // e.g. "creator", "public"
};
```

### 2.2 Rate Limit Config

```typescript
type RateLimitConfig = {
  // Requests per time window
  requests_per_minute?: number;
  requests_per_hour?: number;
  requests_per_day?: number;

  // Tokens per time window
  tokens_per_minute?: number;
  tokens_per_hour?: number;
  tokens_per_day?: number;

  // Cost per time window (in USD)
  cost_per_minute?: number;
  cost_per_hour?: number;
  cost_per_day?: number;
};
```

### 2.3 Rate Limit Check

```typescript
type RateLimitCheck = {
  scope: RateLimitScope;
  config: RateLimitConfig;
  now: string; // ISO timestamp
};

type RateLimitResult = {
  allowed: boolean;
  remaining?: {
    requests?: number;
    tokens?: number;
    cost?: number;
  };
  reset_at?: string; // ISO timestamp
  retry_after?: number; // seconds
  reason?: string;
};
```

---

## 3) Quota Contract

### 3.1 Quota Scope

```typescript
type QuotaScope = {
  user?: string;          // e.g. "creator", "public"
  client?: string;        // e.g. "telegram:123456", "api:sk-..."
  period: "daily" | "weekly" | "monthly";
};
```

### 3.2 Quota Config

```typescript
type QuotaConfig = {
  // Maximum usage per period
  max_requests?: number;
  max_tokens?: number;
  max_cost?: number; // in USD
};
```

### 3.3 Quota Check

```typescript
type QuotaCheck = {
  scope: QuotaScope;
  config: QuotaConfig;
  now: string; // ISO timestamp
};

type QuotaResult = {
  allowed: boolean;
  remaining?: {
    requests?: number;
    tokens?: number;
    cost?: number;
  };
  period_start: string; // ISO timestamp
  period_end: string; // ISO timestamp
  reason?: string;
};
```

---

## 4) Policy Gate Contract

### 4.1 Policy Scope

```typescript
type PolicyScope = {
  user?: string;          // e.g. "creator", "public"
  client?: string;        // e.g. "telegram:123456", "api:sk-..."
  provider?: string;      // e.g. "openai", "local"
  model?: string;         // e.g. "gpt-4", "gpt-3.5-turbo"
  tool?: string;          // e.g. "net.fetch", "fs.read"
};
```

### 4.2 Policy Config

```typescript
type PolicyConfig = {
  // Model access
  allowed_models?: string[];  // e.g. ["gpt-4", "gpt-3.5-turbo"]
  denied_models?: string[];   // e.g. ["gpt-4-32k"]

  // Tool access
  allowed_tools?: string[];  // e.g. ["net.fetch", "fs.read"]
  denied_tools?: string[];   // e.g. ["fs.write", "exec"]

  // Provider access
  allowed_providers?: string[];  // e.g. ["openai", "local"]
  denied_providers?: string[];   // e.g. ["anthropic"]
};
```

### 4.3 Policy Check

```typescript
type PolicyCheck = {
  scope: PolicyScope;
  config: PolicyConfig;
};

type PolicyResult = {
  allowed: boolean;
  reason?: string;
  matched_rule?: {
    type: "model" | "tool" | "provider";
    rule: string;
    action: "allow" | "deny";
  };
};
```

---

## 5) Implementation Plan

### 5.1 Storage Layer

```typescript
interface RateLimitStore {
  // Rate limiting
  checkRateLimit(check: RateLimitCheck): Promise<RateLimitResult>;
  recordRateLimitUsage(scope: RateLimitScope, now: string): Promise<void>;

  // Quota
  checkQuota(check: QuotaCheck): Promise<QuotaResult>;
  recordQuotaUsage(scope: QuotaScope, usage: { requests?: number; tokens?: number; cost?: number }, now: string): Promise<void>;

  // Policy
  checkPolicy(check: PolicyCheck): PolicyResult;
}
```

### 5.2 Middleware

```typescript
interface RateLimitMiddleware {
  // Apply rate limiting to HTTP request
  applyRateLimit(req: HttpRequest): Promise<RateLimitResult>;

  // Apply quota to HTTP request
  applyQuota(req: HttpRequest): Promise<QuotaResult>;

  // Apply policy to HTTP request
  applyPolicy(req: HttpRequest): PolicyResult;
}
```

### 5.3 Configuration

```typescript
interface RateLimitConfigFile {
  // Rate limiting
  rate_limits: {
    [key: string]: RateLimitConfig;
  };

  // Quota
  quotas: {
    [key: string]: QuotaConfig;
  };

  // Policy
  policies: {
    [key: string]: PolicyConfig;
  };
}
```

---

## 6) Error Contract

### 6.1 Rate Limit Exceeded

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry later.",
    "details": {
      "retry_after": 60,
      "reset_at": "2026-01-30T12:00:00Z",
      "scope": {
        "provider": "openai",
        "model": "gpt-4"
      }
    }
  }
}
```

### 6.2 Quota Exceeded

```json
{
  "ok": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Quota exceeded. Please upgrade your plan.",
    "details": {
      "period_start": "2026-01-30T00:00:00Z",
      "period_end": "2026-01-31T00:00:00Z",
      "scope": {
        "user": "public"
      }
    }
  }
}
```

### 6.3 Policy Violation

```json
{
  "ok": false,
  "error": {
    "code": "POLICY_VIOLATION",
    "message": "Policy violation. Access denied.",
    "details": {
      "matched_rule": {
        "type": "model",
        "rule": "gpt-4-32k",
        "action": "deny"
      },
      "scope": {
        "user": "public",
        "model": "gpt-4-32k"
      }
    }
  }
}
```

---

## 7) Definition of Done

- [ ] Rate limiting реализован (по провайдеру, модели, клиенту)
- [ ] Quota enforcement реализован (по пользователю/ключу)
- [ ] Policy enforcement реализован (какие модели/инструменты разрешены)
- [ ] Middleware для HTTP запросов
- [ ] Error contract реализован (429/403 по контракту)
- [ ] Лимиты настраиваются через конфиг, без перезапуска
- [ ] Tracing для всех проверок (кто, что, когда, результат)
- [ ] Тесты для всех сценариев (rate limit, quota, policy)

---

## 8) Next Steps

После завершения Pack v1.4:
- Pack v1.5: TOOL_CALLS_V1 (read-only сначала)
- Pack v1.6: STREAMING_SSE

END
