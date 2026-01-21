# DEPLOYMENT (tele-gpt)

This document is the deployment contract for the `tele-gpt` HTTP service.
It defines required environment variables, optional knobs, health/readiness checks,
and operational thresholds.

All commands assume you are in the repo root.

---

## 1) Endpoints contract

### Health (liveness)
- `GET /health`
  - `200 OK` when process is alive and not closing.
  - `503` with `{ ok:false, closing:true, version:{...} }` during drain/shutdown.

Use this for: "is the process up?"

### Readiness (accepting traffic)
- `GET /ready`
  - `200 OK` when service is ready to receive traffic.
  - `503` when `isClosing=true` (drain mode), includes version and flags.

Use this for: load balancer / orchestrator routing decisions.

### Metrics (JSON)
- `GET /metrics`
  - JSON snapshot: uptime, version, concurrency, idempotency, http (active/sockets), limits.

Use this for: quick debugging without Prometheus.

### Metrics (Prometheus)
- `GET /metrics.prom`
  - Prometheus exposition format.

Key metrics:
- `telegpt_http_latency_ms{provider,model,status}`
- `telegpt_errors_total{code,kind,provider,model}`
- `telegpt_guardrails_429_total{reason}` (only `shutdown|overloaded`)

---

## 2) Required environment variables

### OpenAI (only required when using openai:* models)
- `OPENAI_API_KEY` (required to call OpenAI)
- `OPENAI_BASE_URL` (optional; default OpenAI API)

If `OPENAI_API_KEY` is empty, OpenAI-backed models may fail with `TELEGPT_AUTH`.

---

## 3) Recommended environment variables (prod defaults)

### Network / runtime
- `TELEGPT_ENV=prod`
- `TELEGPT_HOST=0.0.0.0`
- `TELEGPT_PORT=8787`

Compatibility:
- Some platforms set only `PORT`. If supported by the runtime, set `PORT=8787` too.

### Build metadata (observability)
- `TELEGPT_BUILD_ID` (e.g. `dev`, `staging`, `prod-2026-01-17`)
- `TELEGPT_GIT_SHA` (short git SHA)
These appear in:
- JSON responses (`version`)
- response headers: `x-build-id`, `x-git-sha` (if set)

### Timeouts
- `TELEGPT_REQUEST_TIMEOUT_MS=15000`
Client-side and server-side behavior should treat timeouts as retryable (when appropriate).

---

## 4) Guardrails knobs (recommended)

### Concurrency cap (global semaphore)
- `TELEGPT_MAX_CONCURRENCY=4`
  - Max concurrent generations (or request work units).

### Queue cap (fail-fast)
- `TELEGPT_MAX_QUEUE=50`
  - If inFlight >= max and queued >= maxQueue => fail-fast 429.

NOTE: `TELEGPT_MAX_QUEUE=0` is valid and means "no queue, always fail-fast when saturated".

### Shutdown drain
- `TELEGPT_SHUTDOWN_TIMEOUT_MS=15000`
  - Max time to wait for inflight requests to drain before exiting.

### Idempotency (in-memory dev-safe)
- `IDEMPO_TTL_INFLIGHT_MS=60000`
- `IDEMPO_TTL_DONE_MS=86400000`
- `IDEMPO_MAX_ENTRIES=5000`
- `IDEMPO_LOG_EVERY=200`

---

## 5) HTTP contract (headers)

### Always present
- `x-build-id`
- `x-request-id`
- `x-idempotency-cache: hit|miss`
- `x-concurrency-inflight`, `x-concurrency-queued`, `x-concurrency-max` (where applicable)

### When model/provider known
- `x-model` (from request body `model`)
- `x-used-provider: openai|local`

### When retry advised (429)
- `Retry-After` (seconds)
- `x-retry-after-ms` (milliseconds, preferred by client)

### When normalized error present
- `x-error-code` (e.g. `TELEGPT_OVERLOADED`)
- `x-error-kind` (e.g. `overloaded|shutdown|rate_limit|...`)

---

## 6) Normal operational thresholds (prod guidance)

These are "sane defaults" for small/medium deployments; tune using real traffic.

### Concurrency / queue
- Start: `TELEGPT_MAX_CONCURRENCY=4`, `TELEGPT_MAX_QUEUE=50`
- If frequent `429 overloaded`:
  - Increase concurrency if CPU/latency allow; otherwise decrease queue to reduce tail-latency.
- If latency spikes and timeouts:
  - Lower concurrency and/or increase upstream capacity.

### Latency
Use `telegpt_http_latency_ms` to observe p95/p99.
- If p95 > request timeout, users will feel "random failures" even if system is "up".

### Error budget
Track `telegpt_errors_total` by `{kind,code,provider,model}`.
- `kind=auth` => config error (must be 0 in prod)
- `kind=timeout` => capacity/timeout tuning
- `kind=rate_limit` => upstream quota/usage

### Guardrails 429
`telegpt_guardrails_429_total{reason}`:
- `overloaded` => local saturation
- `shutdown` => drain/restarts (expected during deploy windows)

---

## 7) Deploy checklist (smoke test)

After deploy/restart:

1) Version headers present
```bash
curl -i -sS http://localhost:8787/health | rg -n "HTTP/|x-build-id|x-git-sha"
```

2) Readiness ok
```bash
curl -i -sS http://localhost:8787/ready | rg -n "HTTP/|ready|x-build-id|x-git-sha"
```

3) Prometheus metrics reachable
```bash
curl -sS http://localhost:8787/metrics.prom | rg -n "telegpt_http_latency_ms|telegpt_errors_total|telegpt_guardrails_429_total"
```

4) Chat request works + request-id propagation
```bash
RID=$(uuidgen)
curl -i -sS \
  -H "content-type: application/json" \
  -H "x-request-id: $RID" \
  -d '{"message":"ping","model":"local-demo"}' \
  http://localhost:8787/v1/chat | rg -n "HTTP/|x-request-id|x-idempotency-cache|x-model|x-used-provider"
```

5) Idempotency hit check
```bash
curl -i -sS \
  -H "content-type: application/json" \
  -H "x-request-id: $RID" \
  -d '{"message":"ping","model":"local-demo"}' \
  http://localhost:8787/v1/chat | rg -n "HTTP/|x-idempotency-cache"
# expected: hit
```

---

## 8) Notes on restart behavior

During drain/shutdown:
- `/ready` returns 503 and includes closing:true
- `/health` returns 503 with closing:true
- `/v1/chat` returns 429 with:
  - `Connection: close`
  - `Retry-After` + `x-retry-after-ms`
  - normalized error: `TELEGPT_SHUTDOWN` / `kind=shutdown`

Clients should treat shutdown/overloaded as retryable with backoff.
