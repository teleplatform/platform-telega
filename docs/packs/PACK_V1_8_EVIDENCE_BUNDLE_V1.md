
# PACK v1.8 — Evidence Bundle v1 (Seal + Verify)

`artifact_id`: pack_v1_8_evidence_bundle_v1  
`status`: FIXED  
`classification`: Pack → Evidence / Audit / Sealing  
`owner`: Tele•Ga Core  
`applies_to`: Tele•GPT Runtime, Sigma Forge Harness, Autonomous Departments  
`depends_on`:
  - canon_spec_trace_layer_minimum_v1
  - pack_v1_5_tool_calls_readonly
  - pack_v1_6_streaming_sse
  - pack_v1_7_agent_runner_minimal  
`fixed_at`: 2026-02-24

---

## 0. Goal (жёстко)

Сделать доказательную замкнутость любого agent-run:
- trace.jsonl + все артефакты исполнения складываются в один Evidence Bundle
- bundle получает tamper-evident seal (хэш + манифест)
- появляется verify процедура, которая однозначно говорит: bundle целый или нет
- Runner может объявить completed/failed только после bundle_finalized

**Core Principle:**
> Без Evidence Bundle агент — это рассказчик. С Evidence Bundle агент — это инженер, которого можно проверить.

---

## 1. Scope (v1)

### Входит:
- структура evidence/
- manifest.json (index + метаданные)
- seal.json (bundle_hash + правила канонизации)
- verify алгоритм (детерминированный)
- связь с Trace Layer (evidence.bundle_finalized обязателен)

### Не входит:
- подпись ключом (PKI) (можно v2)
- удалённое хранилище/репликация (можно позже)
- шифрование (можно позже)
- дифф/патч стандарты (могут быть в другом паке)

---

## 2. Bundle Layout (Canonical)

Каждый запуск создаёт директорию:
```
evidence/
  bundle.json            (optional alias to manifest+seal)
  manifest.json
  seal.json
  trace.jsonl
  artifacts/
    ... files ...
  meta/
    run.json             (optional: run summary)
    env.json             (optional: sanitized env snapshot)
```

### 2.1 Required files
- manifest.json
- seal.json
- trace.jsonl

### 2.2 Recommended (but optional)
- meta/run.json — summary (state, timings, counters)
- meta/env.json — sanitized environment snapshot

---

## 3. Manifest Contract (manifest.json)

Manifest — это полный индекс всего, что входит в bundle.

Minimal schema (normative fields):
```json
{
  "v": 1,
  "bundle_id": "eb_01H...",
  "sid": "sess_01H...",
  "rid": "req_01H...",
  "created_at": "2026-02-24T12:34:56.789Z",
  "producer": {
    "kind": "tele-gpt",
    "version": "x.y.z"
  },
  "files": [
    {
      "path": "trace.jsonl",
      "bytes": 12345,
      "sha256": "…",
      "kind": "trace"
    },
    {
      "path": "artifacts/diff.patch",
      "bytes": 0,
      "sha256": "…",
      "kind": "artifact",
      "tags": ["diff"]
    }
  ],
  "redaction": {
    "ruleset_id": "pack_v1_5_redaction",
    "notes": "authorization headers removed; urls hashed"
  }
}
```

Rules:
- files[] MUST list every file in bundle (including manifest and seal themselves—см. ниже).
- path uses forward slashes.
- sha256 is hex lowercase.
- bytes is exact size.

---

## 4. Seal Contract (seal.json)

Seal — это тампер-детектор: если кто-то поменяет любой байт в bundle, seal не пройдёт verify.

```json
{
  "v": 1,
  "alg": "sha256",
  "canonicalization": "jcs",
  "bundle_hash": "sha256:…",
  "manifest_sha256": "…",
  "trace_sha256": "…",
  "sealed_at": "2026-02-24T12:35:10.000Z",
  "policy": {
    "hash_includes": "all_files_except_seal",
    "order": "lexicographic_by_path"
  }
}
```

---

## 5. Canonical Hashing Rules (Deterministic)

### 5.1 File hashes

For each file f, compute:
```
sha256(file_bytes)
```

### 5.2 Manifest hash

```
manifest_sha256 = sha256(JCS(manifest_without_seal_fields_if_any))
```

Practical rule (v1):
manifest.json does NOT embed seal.json, so we just hash the raw bytes of manifest.json.

### 5.3 Bundle hash (the seal)

Bundle hash MUST be computed as:

1. Take all files in bundle excluding seal.json
2. Sort by path lexicographically
3. Build a hashing stream:
   For each file in order, append:
   - path as UTF-8 bytes
   - 

   - sha256(file_bytes) as hex UTF-8 bytes
   - 

   - bytes as decimal UTF-8 bytes
   - 

4. bundle_hash = sha256(stream_bytes)
5. Store as:
   bundle_hash = "sha256:" + hex

This makes bundle_hash:
- stable across OS
- independent of file timestamps
- sensitive to any content/size/path change

---

## 6. Finalization Rule (Runtime Gate)

Agent Runner MUST NOT declare session terminal as "validly completed/failed" until:
- manifest.json written
- seal.json written
- trace.jsonl included and hashed
- evidence.bundle_finalized event emitted into trace with:
  - bundle_hash
  - bundle_id
  - manifest_ref: artifact://<bundle_hash>/manifest.json

Hard rule:
session.completed or session.failed is only valid if evidence.bundle_finalized exists earlier in trace.

(Технически terminal event может идти после finalized — и должен.)

---

## 7. Verify Procedure (Canonical)

Verifier input:
- path to evidence/ directory (or packed archive)

Verifier steps:
1. reads seal.json
2. recomputes bundle_hash using rules above
3. compares with seal.json.bundle_hash
4. recomputes manifest_sha256, trace_sha256
5. ensures manifest.files[] matches actual files list exactly

Verifier output (ok):
```json
{
  "ok": true,
  "bundle_hash": "sha256:…",
  "issues": []
}
```

Verifier output (fail):
```json
{
  "ok": false,
  "bundle_hash_expected": "sha256:…",
  "bundle_hash_actual": "sha256:…",
  "issues": [
    "MISSING_FILE: artifacts/x",
    "HASH_MISMATCH: trace.jsonl",
    "EXTRA_FILE: meta/tmp"
  ]
}
```

---

## 8. Packaging (Optional but Allowed)

v1 allows two transport forms:
1. Directory bundle (as above)
2. Archive (zip/tar) that contains exactly that directory structure

Archive MUST preserve:
- file bytes
- relative paths

No timestamps used in hashing, so archive metadata doesn't matter.

---

## 9. Privacy & Redaction Binding (Pack v1.5)

Evidence Bundle MUST contain only already-redacted trace + artifacts.

Rules:
- trace must be redaction-safe
- artifacts must not include secrets
- if an artifact can be sensitive, it must either:
  - be excluded, or
  - be sanitized, or
  - be hashed-only reference (store pointer, not data)

---

## 10. Validity Tests (Must Pass)

A runtime is v1.8-compliant if:
- evidence/ layout exists
- manifest.json, seal.json, trace.jsonl present
- manifest.files[] exactly matches file tree
- bundle_hash recomputes exactly
- trace.jsonl contains evidence.bundle_finalized with that hash
- terminal events happen only after finalize

Fail any → non-compliant runtime.

---

## 11. Canon Verdict

**VERDICT:**  
CONFIRMED — Evidence Bundle v1 is canonically fixed as the unit of truth for any agent run.

**DECISION:**  
Tele•Ga treats unsealed runs as non-auditable and therefore invalid for "trust-grade" execution.

**ACTION:**  
No implementation is forced by the pack itself — but any "done" claim without evidence is rejected by policy gates.

---

## Status After v1.8 (Milestone)

✅ AgentSession Lifecycle  
✅ Trace Layer Minimum  
✅ Tool Calls Read-Only  
✅ Streaming (SSE)  
✅ Agent Runner v1  
✅ Evidence Bundle v1  

Это и есть минимальный замкнутый контур Tele•GPT Runtime, который можно считать "завершённым по фундаменту".

---

## Technical Note on Files

Часть ранее загруженных файлов в этой сессии у тебя истекла/стала недоступна (так иногда бывает в среде). Если тебе нужно, чтобы я проверил/синхронизировал Pack'и прямо по твоим локальным markdown-файлам — просто перезагрузи их сюда, и я сделаю сверку 1:1 по содержимому.
