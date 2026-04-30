# FORGE EXECUTION BENCH v1

## Scenarios

### 1. code_repair_basic

**Вход:** `TaskIntentEnvelope` с `task_kind: "frontend"`, `goal: "Fix UI regression"`

**Ожидаемый run shape:**
- 1 entry node, status: `ready`
- plan_mode: `fast`

**Ожидаемые events:**
- `run.created`
- `plan.built`
- `capsule.updated`

**Критерий успеха:** Run создан, graph валиден, explain доступен

---

### 2. feature_build_bootstrap

**Вход:** `TaskIntentEnvelope` с `task_kind: "backend"`, `execution_mode: "safe"`

**Ожидаемый run shape:**
- 1 entry node, status: `ready`
- plan_mode: `safe`

**Ожидаемые events:**
- `run.created`
- `plan.built`
- `capsule.updated`

**Критерий успеха:** Run создан, capsule содержит goal и plan_mode

---

### 3. research_to_artifact_bootstrap

**Вход:** `TaskIntentEnvelope` с `task_kind: "research"`, `actor_mode: "creator"`

**Ожидаемый run shape:**
- 1 entry node, status: `ready`
- plan_mode: `safe`

**Ожидаемые events:**
- `run.created`
- `plan.built`
- `capsule.updated`

**Критерий успеха:** Run создан, explain включает capsule и run_summary

---

### 4. ops_retry_and_resume

**Вход:** Run с seeded failed node

**Ожидаемый flow:**
1. Node status: `failed`
2. `retryFsgrNode` → node status: `ready`
3. Event `node.retry_scheduled` записан
4. `resumeFsgrRun` для degraded run → status: `running`

**Критерий успеха:** Retry и resume работают корректно, events записаны
