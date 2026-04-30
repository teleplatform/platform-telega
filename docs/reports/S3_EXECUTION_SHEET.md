# S3 EXECUTION SHEET
# PHASE 1 — POLICY ENFORCEMENT CHECK
# FAIL-FAST MODE

## OBJECTIVE
Verify that the policy boundary not only exists but actively enforces restrictions on service execution.

## TEST CASES

### 3.1 Invalid Actor Role
* [ ] Request with invalid `actor_role` (e.g., "hacker") is rejected
* [ ] Response contains `accepted = false` or equivalent denial
* [ ] Error message indicates role validation failure
* [ ] No service execution occurs
* [ ] No persistent trace of execution is created

### 3.2 Invalid Policy Scope
* [ ] Request with `policy_scope` not matching allowed values (e.g., "invalid_scope") is rejected
* [ ] Response contains formal denial
* [ ] Service execution is blocked
* [ ] Audit/log shows policy scope violation

### 3.3 Service/Method Outside Permitted Mode
* [ ] Request for a service/method not permitted for the actor's role/policy is rejected
* [ ] Example: Attempt to call admin-only service with user role
* [ ] Response contains `accepted = false` or equivalent
* [ ] No execution trace created

### 3.4 Missing Required Fields
* [ ] Request missing `actor_id`, `actor_role`, `policy_scope`, `timestamp`, `method`, or `params` is rejected
* [ ] Validation occurs before service routing
* [ ] No execution attempt made

### 3.5 Valid Request Still Works
* [ ] A request with all valid fields (matching a known good configuration) is accepted
* [ ] Response shows `accepted = true` and proper execution
* [ ] Ensures we didn't break the happy path

## EVIDENCE REQUIRED
For each test case:
- Request payload sent
- Full response received
- Logs showing policy evaluation and decision
- Confirmation that no execution trace was created for rejected cases
- For valid case: confirmation of successful execution and trace

## PASS CONDITION
All test cases PASS:
- Invalid requests are formally rejected with clear policy-based denial
- Valid request executes successfully
- No silent bypass of policy enforcement
- Persistence layer only contains traces for actually executed services

## FAIL CONDITION
Any test case FAILS:
- Invalid request returns `accepted = true` or executes service
- Valid request is incorrectly rejected
- Policy enforcement missing or inconsistent
- Execution trace created for rejected request

## REPORT FORMAT
After execution, provide:

```
S3.1 Invalid Actor Role: PASS/FAIL
S3.2 Invalid Policy Scope: PASS/FAIL
S3.3 Service/Method Outside Permitted Mode: PASS/FAIL
S3.4 Missing Required Fields: PASS/FAIL
S3.5 Valid Request Still Works: PASS/FAIL

Overall S3: PASS/FAIL
Bypass detected: YES/NO
False rejection: YES/NO
Execution trace integrity: YES/NO
Ready for S4: YES/NO
```

## EXECUTION MODE
FAIL-FAST: Stop at first FAIL. Do not proceed to next test case or next phase.