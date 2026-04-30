# S3 BARRIER FIX BRIEF
# POLICY ENFORCEMENT FOR POLICY_SCOPE

## PROBLEM STATEMENT
The policy boundary currently validates:
- Model permissions
- Quota limits  
- Rate limits

But it does **not** validate the `policy_scope` field from the service envelope, allowing unauthorized policy scopes to proceed to execution.

## EVIDENCE OF BYPASS
Request with:
```json
{
  "actor_id": "phase0-actor",
  "actor_role": "creator", 
  "policy_scope": "public/read-only",  // ← INVALID SCOPE
  "timestamp": "2026-04-01T23:25:17.916Z",
  "client_version": "0.1.0",
  "trace_id": "s3-test-3",
  "idempotency_key": "s3-idem-3",
  "params": {},
  "service": "svc.telegram.respond",
  "method": "service.call"
}
```
Returned:
```json
{
  "trace_id": "s3-test-3",
  "status": "ok",
  "data": {
    "accepted": true,
    "service": "svc.telegram.respond", 
    "method": "service.call",
    "params": {},
    "replayed": false
  }
}
```
And persisted successful execution trace in `idempotency_keys`.

## REQUIRED FIX
Add `policy_scope` validation to the policy gate in `/src/core/policy/policyGate.ts`.

### Valid Policy Scopes
Based on codebase usage:
- `"worktree"` - Default scope for file/system operations
- Likely others: `"public"`, `"private"`, `"restricted"` (to be confirmed)

### Implementation Steps
1. Define allowed policy scopes in policy config or constants
2. Extract `policy_scope` from service envelope in policy gate
3. Validate against allowed list before proceeding to quota/rate checks
4. Return `POLICY_DENIED` error for invalid scopes
5. Trace policy scope validation decision

### Code Changes Needed
In `/src/core/policy/policyGate.ts`:

Add to policy config loading:
```typescript
const policy = loadPolicyConfig(deps.env);
// Add: const allowedPolicyScopes = policy.allowedPolicyScopes ?? ["worktree"];
```

Add validation after identity extraction:
```typescript
// Extract policy_scope from service envelope
const body: any = (req as any).body || {};
const policyScope = body?.policy_scope;

// Validate policy_scope
if (policyScope && !allowedPolicyScopes.includes(policyScope)) {
  reply.code(403);
  return gateError("POLICY_SCOPE_DENIED", "Policy scope not allowed", { 
    policy_scope: policyScope, 
    allowed: allowedPolicyScopes 
  });
}
```

### Testing Protocol
After fix, re-run S3 execution sheet:
1. S3.1 Invalid Actor Role: Should still PASS
2. S3.2 Invalid Policy Scope: Should now FAIL with POLICY_SCOPE_DENIED
3. S3.3 Service/Method Outside Permitted Mode: Test accordingly
4. S3.4 Missing Required Fields: Should still PASS
5. S3.5 Valid Request Still Works: Should still PASS with correct scope

Only proceed to S4 when all S3 test cases PASS.

## EXPECTED OUTCOME
Invalid policy_scope requests return:
- HTTP 403
- Error code: `POLICY_SCOPE_DENIED`
- No service execution
- No persistence trace created

Valid policy_scope requests proceed normally through quota/rate limits to execution.

## APPROVAL CRITERIA
Fix is complete when:
- S3 execution sheet shows all PASS
- No bypass detected
- Policy scope enforcement confirmed
- Ready to advance to S4