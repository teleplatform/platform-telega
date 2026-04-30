# EXECUTION ECONOMICS CORE R2

**Статус:** `IMPLEMENTATION_SPEC`
**Модуль:** `telega-city/sigma-forge/packages/runtime-economics-core`
**Роль:** cost-aware-router + provider-router + execution-budget-guard

---

## Purpose

Экономически дисциплинированный execution entry для Sigma Forge / Tele•Ga:
- task complexity classification → orchestration depth gating
- provider selection (scoring by capability, privacy, cost, latency)
- budget guard (tokens, cost, tools, retries, fanout, chain depth)

---

## Architecture

```
Inbound Task
→ R1 Identity / Policy / Compliance
→ R2 Cost-Aware Router (complexity → execution mode)
→ R2 Provider Router (score → select)
→ R2 Budget Guard (estimate → allow/deny)
→ FSGR Planning / Execution
→ Trace / Explain / Audit
```

---

## Modules

| Module | Files |
|--------|-------|
| Cost-Aware Router | taskComplexity, orchestrationDepth, costSignals, cheaperMode, costAwareRouter |
| Provider Router | providerCatalog, providerScoring, providerPolicy, providerRouter |
| Budget Guard | budgetGuard (estimate + check + summary) |
| Storage | schema.sql (4 tables), routeDecisionsRepo, providerSelectionsRepo, budgetEventsRepo, costSignalsRepo |

---

## Execution Modes

| Mode | When |
|------|------|
| single_call | Trivial answer |
| single_worker | One-step execution |
| tool_augmented | One worker + tools |
| multi_agent | Multi-step / multi-skill |
| multi_agent_reviewed | High-risk / review-required |
| human_approval_required | Explicit approval needed |

---

## Provider Scoring Factors

- Capability fit (tools, structured output, reasoning, long context)
- Privacy fit (local_only ≤ restricted ≤ external_safe)
- Cost fit (provider tier vs preference)
- Latency bonus (< 2000ms)

---

## Budget Guard Rules

- tokens > max → deny
- cost > max → deny
- tools > max → deny
- retries > max → deny
- fanout > max → deny
- chain depth > max → deny

---

## SQLite Schema

- `runtime_route_decisions` — execution mode, complexity, risk, cheaper mode
- `runtime_provider_selections` — selected provider, rejected, reasons
- `runtime_budget_events` — allowed/denied, estimates, cheaper recommendation
- `runtime_cost_signals` — complexity, risk, latency/privacy sensitivity, token volume

---

## Definition of Done

- ✅ runtime-economics-contracts package
- ✅ runtime-economics-core package
- ✅ cost-aware-router (complexity → execution mode → cheaper suggestion)
- ✅ provider-router (catalog + scoring + policy filter + selection)
- ✅ execution-budget-guard (estimate + check + summary)
- ✅ SQLite schema + repos (4 tables)
- ✅ API facades (routeTask)
- ✅ Unit tests: 32 passed, 0 failed
- ✅ Integration tests: 7 passed, 0 failed
