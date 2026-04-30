
# PACK: Sigma Forge ↔ Tele•GPT Handshake v1

`artifact_id`: pack_forge_handshake_v1  
`status`: FIXED  
`classification`: Pack → System Integration Contract  
`owner`: Tele•GPT Core  
`observed_at`: 2026-02-24  
`depends_on`:
- PACK_RUNTIME_MVP_V1 (Tele•GPT live closed loop)
- PACK_V1_5_TOOL_CALLS_READONLY
- PACK_V1_6_STREAMING_SSE
- PACK_V1_8_EVIDENCE_BUNDLE_V1

---

## 1) Goal (Hard)

Make Tele•GPT Brain and Sigma Forge Hands with a single closed trust boundary:

- One lifecycle owner
- One trace owner
- One evidence signer
- One policy gate (canonical)
- One verify procedure

Result: Tele•GPT becomes runtime kernel; Sigma Forge becomes harness client + workspace executor.

---

## 2) Canonical Ownership (Non-negotiable)

### 2.1 Lifecycle owner

✅ **Tele•GPT owns AgentSession lifecycle**
- creates sid
- transitions states
- emits canonical trace for transitions

### 2.2 Trace owner

✅ **Tele•GPT writes trace.jsonl as source of truth**
- SSE is trace replay + tail only
- UI/IDE never invent semantics

### 2.3 Evidence owner & signer

✅ **Tele•GPT seals and signs Evidence Bundle**
- generates manifest + seal + bundle_hash
- exposes /v1/evidence/verify

### 2.4 Policy gate (single canonical gate)

✅ **Tele•GPT owns Policy Gate for tool calls**
- every tool call must pass Tele•GPT policy gate (allowlist/sandbox/redaction)
- trace events for policy decisions are mandatory

### 2.5 Sigma Forge responsibilities

✅ **Sigma Forge owns Workspaces & Execution Substrate**
- git worktree creation, isolation, teardown
- local sandbox executors (fs, terminal, net) exposed as a ToolProxy
- streaming UI/projection (IDE/CLI/Web) as consumers of Tele•GPT stream

**Key rule**: Sigma Forge is allowed to enforce additional safety checks, but it must not become "meaning owner" of policies. Tele•GPT remains canonical.

---

## 3) Handshake Surface (Minimal)

### 3.1 Tele•GPT endpoint (Brain entry)

POST /v1/agent/run (already exists in MVP) must accept an optional forge block:

```json
{
  "input": {
    "messages": [
      { "role": "user", "content": "…" }
    ]
  },
  "options": {
    "model": "openai:gpt-4o-mini",
    "tools": {
      "fs_read": true,
      "net_fetch": true
    }
  },
  "forge": {
    "workspace": {
      "kind": "worktree",
      "repo": {
        "remote": "https://…",
        "ref": "main",
        "commit": "abc123"
      },
      "root": "/workspace",
      "allow_paths": ["/workspace/docs", "/workspace/contracts", "/workspace/skills"],
      "deny_paths": ["/workspace/.git", "/workspace/node_modules", "/workspace/.env"]
    },
    "tool_proxy": {
      "base_url": "http://forge-toolproxy:7777",
      "auth": {
        "type": "bearer",
        "token": "forge_ephemeral_token"
      }
    },
    "return_channels": {
      "stream": true,
      "stream_url_hint": "sse"
    }
  }
}
```

**Tele•GPT response (canonical):**

```json
{
  "ok": true,
  "sid": "sid_01H…",
  "status": "running",
  "links": {
    "stream": "/v1/agent/stream?sid=sid_01H…",
    "evidence_verify": "/v1/evidence/verify"
  }
}
```

---

## 4) ToolProxy Contract (Hands gateway)

Sigma Forge exposes a single tool proxy endpoint (internal, not public). Tele•GPT is the caller.

### 4.1 ToolProxy call

POST {tool_proxy.base_url}/v1/tools/call

```json
{
  "sid": "sid_01H…",
  "call_id": "toolcall_01H…",
  "kind": "fs.read",
  "args": {
    "path": "/workspace/docs/README.md",
    "max_bytes": 1048576
  tool_proxy": {
    "policy_id": "fs_read_sandbox",
    "decision": "allow",
    "decision_hash": "sha256:…",
    "issued_at": "2026-02-24T00:00:00Z",
    "sig": "ed25519:…"
  }
}
```

### 4.2 ToolProxy result

```json
{
  "ok": true,
  "call_id": "toolcall_01H…",
  "result": {
    "content_base64": "…",
    "bytes": 1234
  },
  "meta": {
    "elapsed_ms": 42
  }
}
```

**Hard rule**: ToolProxy MUST reject calls if tele_gpt_policy.sig is missing/invalid. This keeps a single canonical gate: Tele•GPT decides, Forge enforces signature + local sandboxing.

---

## 5) Trace ↔ ToolProxy Binding (must be provable)

For every tool call:
- Tele•GPT emits policy.checked
- Tele•GPT emits tool.called
- Tele•GPT emits tool.result

call_id must match across:
- trace events
- ToolProxy request/response (optional storage)
- evidence manifest references (if included)

**Invariant**: replaying trace.jsonl must explain tool usage without requiring IDE logs.

---

## 6) Evidence Closure Across Two Systems

### 6.1 What goes into evidence bundle (Tele•GPT)

Tele•GPT evidence MUST include:
- trace.jsonl (authoritative)
- artifacts produced by runner (diffs, reports, summaries, etc.)
- manifest.json + seal.json + bundle_hash.txt

### 6.2 Optional external artifacts (Forge)

Forge MAY contribute additional files (e.g., patch file generated in worktree) via one of two ways:

**Preferred v1 (simple & deterministic)**: Forge uploads artifact bytes to Tele•GPT during session via:
- POST /v1/agent/artifacts (internal, optional endpoint)
- Tele•GPT stores under evidence/<sid>/artifacts/…
- Tele•GPT records evidence.artifact_written

**Rule**: Evidence is sealed only by Tele•GPT. Forge never seals.

---

## 7) Sequence (End-to-end)

1. User in Forge IDE/CLI triggers task
2. Forge prepares worktree + toolproxy token
3. Forge calls Tele•GPT POST /v1/agent/run with forge block
4. Tele•GPT creates sid, starts session, writes trace
5. Tele•GPT requests read-only tools via Forge ToolProxy (signed policy decisions)
6. Tele•GPT streams trace via SSE (/v1/agent/stream)
7. Tele•GPT completes run, seals evidence bundle
8. Forge (or user) calls /v1/evidence/verify to confirm verified:true
9. Forge displays: status + bundle_hash + artifacts

---

## 8) Implementation Plan

### 8.1 Files to add/modify (suggested map)

**New files:**
- `src/types/forgeHandshake.ts` - Forge handshake types
- `src/core/agent/runtime/forgeToolProxy.ts` - ToolProxy client
- `src/core/agent/runtime/forgeSignature.ts` - Ed25519 signature verification
- `src/server/routes/forge.route.ts` - Forge-specific endpoints

**Modified files:**
- `src/server/routes/agent.route.ts` - Add forge block support to /v1/agent/run
- `src/core/agent/runtime/agentRunner.ts` - Integrate ToolProxy calls
- `src/core/agent/runtime/policyGate.ts` - Add signature generation for policy decisions

### 8.2 Signature Protocol (Ed25519)

**Tele•GPT signs policy decisions:**

```typescript
interface PolicySignature {
  policy_id: string;
  decision: "allow" | "deny" | "needs_approval";
  decision_hash: string; // SHA-256 of canonical decision
  issued_at: string; // ISO 8601
  sig: string; // Ed25519 signature (hex)
}
```

**Canonical decision format:**

```typescript
interface CanonicalPolicyDecision {
  sid: string;
  call_id: string;
  tool_kind: ToolKind;
  policy_id: string;
  decision: PolicyDecision;
  issued_at: string;
}
```

**Signature generation:**

```typescript
async function signPolicyDecision(
  decision: CanonicalPolicyDecision,
  privateKey: string
): Promise<string> {
  const canonical = JSON.stringify(decision);
  const hash = createHash("sha256").update(canonical).digest("hex");

  const signature = await sign(hash, privateKey);
  return signature;
}
```

**Signature verification (ToolProxy side):**

```typescript
async function verifyPolicyDecision(
  decision: CanonicalPolicyDecision,
  signature: string,
  publicKey: string
): Promise<boolean> {
  const canonical = JSON.stringify(decision);
  const hash = createHash("sha256").update(canonical).digest("hex");

  return await verify(hash, signature, publicKey);
}
```

### 8.3 ToolProxy Integration

**Modified agentRunner.ts:**

```typescript
private async executeTool(
  session: AgentSession,
  toolCall: ToolCall,
  forgeConfig?: ForgeConfig
): Promise<ToolResult> {
  // Check policy
  const policyResult = await this.policyGate.checkToolExecution(
    session,
    toolCall
  );

  // Emit policy.checked
  await this.traceWriter.writeEvent({
    v: 1,
    ts: new Date().toISOString(),
    rid: session.rid,
    sid: session.sid,
    eid: `evt_${randomUUID()}`,
    type: "policy.checked",
    lvl: "info",
    actor: { kind: "system", id: "policy_gate" },
    span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
    data: {
      rule_id: policyResult.rule_id,
      decision: policyResult.decision,
      scope: `tool.${toolCall.tool_kind}`,
    },
  });

  // If denied, emit policy.denied and return error
  if (!policyResult.allow) {
    await this.traceWriter.writeEvent({
      v: 1,
      ts: new Date().toISOString(),
      rid: session.rid,
      sid: session.sid,
      eid: `evt_${randomUUID()}`,
      type: "policy.denied",
      lvl: "warn",
      actor: { kind: "system", id: "policy_gate" },
      span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
      data: {
        rule_id: policyResult.rule_id,
        reason: policyResult.reason,
        tool_kind: toolCall.tool_kind,
      },
    });

    return {
      ok: false,
      error: policyResult.reason,
    };
  }

  // Generate signature
  const canonicalDecision: CanonicalPolicyDecision = {
    sid: session.sid,
    call_id: toolCall.call_id || `toolcall_${randomUUID()}`,
    tool_kind: toolCall.tool_kind,
    policy_id: policyResult.rule_id,
    decision: policyResult.decision,
    issued_at: new Date().toISOString(),
  };

  const decisionHash = createHash("sha256")
    .update(JSON.stringify(canonicalDecision))
    .digest("hex");

  const signature = await signPolicyDecision(
    canonicalDecision,
    this.privateKey
  );

  // Emit tool.called
  await this.traceWriter.writeEvent({
    v: 1,
    ts: new Date().toISOString(),
    rid: session.rid,
    sid: session.sid,
    eid: `evt_${randomUUID()}`,
    type: "tool.called",
    lvl: "info",
    actor: { kind: "agent", id: "runner" },
    span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
    data: {
      tool_kind: toolCall.tool_kind,
      args_redacted: this.redactArgs(toolCall.params),
      policy_ref: policyResult.rule_id,
      call_id: canonicalDecision.call_id,
      decision_hash: decisionHash,
    },
  });

  // Call ToolProxy if forge config is present
  if (forgeConfig) {
    const toolProxyClient = new ToolProxyClient(forgeConfig.tool_proxy);
    const proxyResult = await toolProxyClient.call({
      sid: session.sid,
      call_id: canonicalDecision.call_id,
      kind: toolCall.tool_kind,
      args: toolCall.params,
      tele_gpt_policy: {
        policy_id: policyResult.rule_id,
        decision: policyResult.decision,
        decision_hash: decisionHash,
        issued_at: canonicalDecision.issued_at,
        sig: signature,
      },
    });

    // Emit tool.result
    await this.traceWriter.writeEvent({
      v: 1,
      ts: new Date().toISOString(),
      rid: session.rid,
      sid: session.sid,
      eid: `evt_${randomUUID()}`,
      type: "tool.result",
      lvl: proxyResult.ok ? "info" : "error",
      actor: { kind: "tool", id: toolCall.tool_kind },
      span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
      data: {
        tool_kind: toolCall.tool_kind,
        ok: proxyResult.ok,
        result_ref: proxyResult.result_ref,
        error: proxyResult.error,
        call_id: canonicalDecision.call_id,
      },
    });

    return proxyResult;
  }

  // Fallback to local execution (MVP v1 behavior)
  return this.executeToolLocal(session, toolCall);
}
```

### 8.4 Forge Artifacts Endpoint

**New endpoint in forge.route.ts:**

```typescript
app.post("/v1/agent/artifacts", async (req, reply) => {
  const { sid, artifact_name, artifact_bytes } = req.body as {
    sid: string;
    artifact_name: string;
    artifact_bytes: string; // base64
  };

  // Validate session exists
  const session = sessionManager.getSession(sid);
  if (!session) {
    return reply.status(404).send({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: `Session ${sid} not found`,
      },
    });
  }

  // Decode and store artifact
  const buffer = Buffer.from(artifact_bytes, "base64");
  const artifactPath = join(evidenceDir, sid, "artifacts", artifact_name);
  await mkdir(join(evidenceDir, sid, "artifacts"), { recursive: true });
  await writeFile(artifactPath, buffer);

  // Emit evidence.artifact_written
  await traceWriter.writeEvent({
    v: 1,
    ts: new Date().toISOString(),
    rid: session.rid,
    sid,
    eid: `evt_${randomUUID()}`,
    type: "evidence.artifact_written",
    lvl: "info",
    actor: { kind: "forge", id: "artifact_uploader" },
    span: { span_id: `sp_${randomUUID()}`, parent_span_id: null },
    data: {
      artifact_name,
      artifact_path: `artifacts/${artifact_name}`,
      artifact_bytes: buffer.length,
      artifact_hash: createHash("sha256").update(buffer).digest("hex"),
    },
  });

  return reply.send({
    ok: true,
    artifact_path: `artifacts/${artifact_name}`,
    artifact_hash: createHash("sha256").update(buffer).digest("hex"),
  });
});
```

---

## 9) Security & Isolation (v1 minimum)

- ToolProxy tokens are ephemeral per session
- ToolProxy allows only scoped operations:
  - fs.read in allowed paths
  - net.fetch only if Tele•GPT policy allows and Forge also has allowlist (defense-in-depth)
- Tele•GPT redaction rules apply before streaming and before evidence sealing
- Forge UI never stores secrets; all secrets live in Tele•GPT env / Forge local runtime only

---

## 10) Done Definition (Handshake v1)

Handshake v1 is DONE when:
- Forge can start Tele•GPT session with workspace + toolproxy parameters
- Tele•GPT can call ToolProxy for fs.read and (optionally) net.fetch
- All tool calls are policy-gated by Tele•GPT and enforced by ToolProxy signature
- SSE works end-to-end in Forge UI (replay + live)
- Evidence bundle seals and verifies successfully
- One owner exists for lifecycle/trace/evidence/policy: Tele•GPT

---

## 11) Validity Tests (must pass)

### Test A — "Read docs from worktree"
- Forge run → Tele•GPT reads /workspace/docs/*
- trace shows policy/tool events
- evidence includes assistant_message.json
- verify returns verified:true

### Test B — "Denied path"
- Tele•GPT attempts /workspace/.env or /workspace/.git/*
- policy denies (Tele•GPT), ToolProxy rejects if signature says deny or if sandbox blocks
- session ends with failure or handled denial (allowed)
- evidence still sealed; verify passes

### Test C — "Replay equivalence"
- Connect SSE late → get full replay from trace + then live tail
- streamed events exactly match trace ordering

---

## 12) Canon Verdict

**VERDICT**: CONFIRMED — Handshake v1 creates a single trust boundary and merges Tele•GPT + Sigma Forge into one system without mixing ownership.

**ACTION**: Implement Handshake v1 next, then proceed by order to:
- TELEGPT_READY_DEFINITION_v1.md (final "what does ready mean" closure)
