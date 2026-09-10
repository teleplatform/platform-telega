# Phase 6C — SHADOW Observation Window (Evidence)

Status: **DONE (SHADOW only)**
Rollout stage: `DISPATCHER_6C_MODE=shadow` — observation only, zero routing influence.
Committed: `cf5e055` (6C.1 seam, kinds, shadow observer, port, route wiring).
Predecessor: `docs/dispatcher/PHASE-6C-DESIGN.md` (approved design).

---

## 0. What this window proves

The Dispatcher now computes "I would choose X" on the real selection seam
(`planProviderSelectionV2`) and writes the comparison to the audit trail,
**while the real router keeps its exact pre-6C behavior**. This document is the
reviewed evidence required by gate 9 in PHASE-6C-DESIGN (§14) before LIMITED is
considered.

Non-negotiables honored:
- No change to routing behavior (observer returns `{ kind: "none" }` always).
- No session/HTTP trigger needed; driven through the real `selectProvider` seam.
- No prompts, secrets, API keys, or user content are ever logged.

---

## 1. Method

Controlled replay harness (`scripts/dispatcher/shadow-observation-run.ts`, boot
via `shadow-observation-boot.ts`) drives the **real** `selectProvider` →
`planProviderSelectionV2` seam — the same path as `src/core/router.ts:270` and
`src/gateway/index.ts:80` — through an 18-scenario matrix across two health
epochs (healthy / degraded), repeated 4x. Shadow records land in the same
`routing.dispatcher.*` audit kinds a live window would produce; the aggregate
report is regenerable from the raw NDJSON of decisions.

- Scenario matrix: `auto` (no caps / code / reasoning / vision), explicit
  families (`kimi:kimi-k3`, `kimi:prompt-x1`, `deepseek:deepseek-r1`,
  `openai:gpt-5`, `zyloo:zyloo-mini`, `qwen:qwen2.5`, `glm:glm-coder`,
  `local:auto`), unknown provider (`weirdmodel:xyz`), flags (`strict`,
  `noFallback`), and web-namespace models (`kimi_web:kimi`, `chatgpt:gpt-4o`,
  `claude_web:sonnet`).
- Epochs: healthy (API + local healthy, `*_web` circuit-open) / degraded
  (`openai_api`, `deepseek_api`, `zyloo_api` additionally circuit-open).
- Fixture routing rules: default catch-all, capability rules (code/reasoning/
  vision), family rules (kimi, deepseek), latency/native/maker-role rules that
  deliberately never match this input set, and a disabled rule.
- Harness runs from a scratch cwd (`SHADOW_SCRATCH_DIR`), so its audit store and
  dispatcher-6c.json never touch the repo.

Reproducing:
```bash
SHADOW_SCRATCH_DIR=/tmp/shadow-6c node --import tsx \
  scripts/dispatcher/shadow-observation-boot.ts --repeat 4 \
  --out /tmp/shadow-6c
# live window: read production audit trail + write report
node --import tsx scripts/dispatcher/shadow-divergence-report.ts \
  --source .data/runtime/audit.jsonl --out /tmp/shadow-report.md
```

---

## 2. Results (controlled replay, 2026-09-10, 144 decisions)

| metric | count | rate |
|---|---:|---:|
| decisions | 144 | — |
| agree | 40 | 27.78% |
| different_target | 104 | 72.22% |
| no_match | 0 | 0.00% |
| both_reject | 0 | 0.00% |
| shadow evaluation errors | 0 | 0.00% |
| unobserved (terminal selection, no plan) | 0 | — |

Agree rate by epoch: healthy **24/72 (33.3%)**, degraded **16/72 (22.2%)**.

Matched rule breakdown: `rule-default` 72, `rule-family-kimi` 40,
`rule-code` 8, `rule-reasoning` 8, `rule-vision` 8, `rule-family-deepseek` 8.
The fixture's `rule-default` catch-all matches every intent (`condition: {}`), so
capability/family intents matched 2 rules (72 decisions) and generic/other-family
intents matched exactly 1 (the other 72). All 144 produced a winner; 0 `no_match`.

> Fixture note: this matrix always matched a rule (0 `no_match`) and never hit
> an empty eligible set (0 unobserved) by construction. Those two signals MUST
> come from the live window — see §5.

---

## 3. Divergence classification (52 open-target + 52 healthy-target)

Every `different_target` splits into two distinct root causes:

### 3.1 Rule target is ineligible at decision time (52 = 36.1%)
The static rule points at a circuit-open/unavailable provider. Under
authoritative routing the request would land on a failing provider:
- `rule-default` → `openai_api`, degraded epoch: **36** (openai_api open).
- `rule-vision` → `qwen_web`, both epochs: **8** (qwen_web circuit-open).
- `rule-code` → `deepseek_api`, degraded: **4** (deepseek_api open).
- `rule-family-deepseek` → `deepseek_api`, degraded: **4**.

Dispatcher (score + health filtered) instead selected a healthy provider
(network case: `kimi_local_web_api`, `kimi_api`, `qwen_api`). **This is the
healthy behavior a SHADOW window is supposed to reveal: rules ignore health;
the router does not.**

### 3.2 Rule target is healthy but differs from the score winner (52 = 36.1%)
Pure scoring-vs-rule disagreement — both candidates eligible:
- `rule-default` → `openai_api`, healthy: **32** (Dispatcher preferred
  e.g. `kimi_local_web_api`, `qwen2.5`'s `qwen_api`, `glm-coder`'s `glm_api`,
  `local`).
- `rule-family-kimi` on `kimi_web:kimi`: **8** (rule → `kimi_api`; Dispatcher →
  `kimi_local_web_api` — the web-namespace variant left the family).
- `rule-reasoning` → `kimi_api`: **8** (Dispatcher → `kimi_local_web_api`).

### 3.3 Where they agree (40)
- `rule-family-kimi`: `kimi:kimi-k3` and `kimi:prompt-x1` **agree in both
  epochs** (32). Family rules + an available family API provider are the highest
  parity signal observed.
- `rule-family-deepseek` / `rule-default`: agree only while the target is
  healthy (8 total: `deepseek-r1`, `openai:gpt-5` healthy epoch).

**Read-out:** highest-confidence rules are family rules; generic catch-alls and
capability→web-namespace rules are the highest-risk divergence producers, and
their risk grows in degraded epochs.

---

## 4. Parity metrics

| metric | definition | this window |
|---|---|---:|
| Input coverage | decision records / exercised scenarios | 144 / 18 (100%) |
| flags-full | scenarios exercising `strict` / `noFallback` | 2 of 18 exercised |
| modelFamily≈prefix | family-prefix agreement (selected model family matches provider prefix) | 32/32 kimi agree; small sample |

Matcher input coverage is **partial by design**: only `capability` and
`modelFamily` were exercised. `runtimeKind`, `userRole`, `latencyMs`,
`costPerToken`, `providerKind` rules (`rule-latency`, `rule-runtime-native`,
`rule-maker-role`, and the disabled `rule-disabled`) never matched — those input
dimensions remain uncovered fixture inputs to probe under LIMITED.

---

## 5. Unobserved paths (evidence gaps) — GOTO under LIMITED

The post-selection seam cannot produce evidence for decisions that never reach
`planProviderSelectionV2`. `scripts/dispatcher/shadow-report-lib.ts` carries
`unobservedSelections`, but only the harness can supply it today. To close the
remaining coverage under LIMITED, count/annotate these explicitly:

| uncovered path | location | GOTO under LIMITED |
|---|---|---|
| Terminal `NO_ELIGIBLE_PROVIDER` (503; no plan produced) | `src/core/router.ts:270` / `core/router.ts` 503 | pre-selection counter: `NO_ELIGIBLE_PROVIDER` per model family, must remain the Dispatcher's full-fallback outcome |
| `BARE_WEB_PROVIDERS` / auto branch (`local:auto`, auto-router v2) | `src/core/router.ts:587-602` | never routed via `planProviderSelectionV2`; auto-v2 decision is separate — keep OUT of first-cut enforcement, or add its own shadow |
| Web-namespace models selected outside the API family set (`kimi_local_web_api` etc.) | selection result, not a seam | eligibility filter must include the full namespaced provider set or overrides will be dropped |
| `strict` / `noFallback` flag paths | `planProviderSelectionV2` internals | parity assertions on plan shape per flag |
| HTTP/gateway-options routing (kill-switch 401 guard) | `src/server/routes/dispatcher.route.ts` | covered by unit gates, not by this harness |

---

## 6. Architectural decisions for LIMITED (adopted)

1. **The post-selection SHADOW seam is NOT reused as the LIMITED override
   seam.** Observation happens after the decision; enforcement belongs at the
   approved pre-selection point.
2. **LIMITED override injects at the approved point** — inside
   `planProviderSelectionV2`, *after* candidate construction and eligibility
   filtering, *before* the final selection block (PHASE-6C-DESIGN §3)
   — reorder-only (`prefer`), never a `pin`.
3. **The module-level `setDispatcherRoutingObserver` setter is scaffold-only.**
   Before LIMITED/ENABLED production authority, revisit it against explicit
   dependency injection (composition root → orchestrator port) so observer
   lifecycle is owned by wiring, not by a global setter.

---

## 7. Acceptance notes

- **tsc:** the full-tree TypeScript error count is **not a stable baseline**
  because unrelated uncommitted work changes the repository state. For this
  evidence phase, the verified acceptance fact is: **0 new TypeScript errors
  introduced by the Dispatcher 6C.1/evidence changes against the current
  working-tree baseline at validation time** (verified: `tsc --noEmit --pretty
  false` reports zero errors from `scripts/dispatcher/*`, `src/server/
  dispatcher/*`, `src/core/provider-selection-orchestrator.ts`,
  `src/runtime/audit/*`).
- **Tests:** `tests/dispatcher/dispatcher-6c-shadow.test.ts` 16/16 green
  (gates 1–9 + HTTP status/kill-switch guard 401).
- **No behavior change:** observer returns `{ kind: "none" }` in all paths;
  routing plans are unchanged.

---

## 8. Recommendation & next gate

- Window **passes** for system health: shadow observer is quiet (`errors: 0`),
  precise (`1 record per decision`), and demonstrably non-invasive.
- **LIMITED is NOT next.** 72.22% `different_target` is far too much divergence
  to grant authority. SHADOW did its job: it surfaced an architectural
  mismatch between the control plane (static `rule → routeTo`) and execution
  semantics (health + scoring + capability + final executable choice).
- Next phase: **6C.2 — Semantic Reconciliation (design only)**. Enumerate which
  facts must be added to Dispatcher evaluation so it compares against the real
  executable choice, not a bare static target: health eligibility, current
  provider scoring, capability eligibility, latency/cost where actually
  available, and the distinction between "policy preference" and "final
  executable choice". The §5 minimal live evidence (production routing config,
  `no_match`/`unobserved` sample, pre-selection counter) feeds that design.
- The §5 pre-selection counter applies under LIMITED, reaching it only after
  6C.2 variance is reduced to an agreed threshold.