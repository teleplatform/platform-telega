# ULTRA-STRICT EXECUTION PROMPT FOR
# R16 LIVE OPERATIONS ACTIVATION
# (Tele•Ga Marketing Department — Live Mode)

## CORE OBJECTIVE
Activate the first live operational department (Tele•Ga Marketing) on the existing R16 perimeter, transitioning from architectural readiness to controlled live operation under real-world pressure.

## NON-NEGOTIABLE CONSTRAINTS
1. **NO synthetic testing** - All validation must come from real marketing mission execution
2. **Perimeter enforcement** - Every mission MUST pass through all S1-S5 gates before execution
3. **HITL requirement** - No mission executes to completion without explicit human override opportunity
4. **Trace harvesting** - Every mission MUST generate operational traces for future S6 scoring
5. **Mission lifecycle** - All missions MUST follow the defined status lifecycle
6. **No architectural additions** - Use ONLY existing perimeter components; no new S-layers

## EXECUTION PHASES

### PHASE 0: PRE-ACTIVATION VALIDATION (MUST COMPLETE BEFORE LIVE)
- [ ] Confirm S1-S5 perimeter is fully implemented and tested in isolation
- [ ] Verify mission intake API endpoint exists and is reachable
- [ ] Confirm cost evaluation service returns deterministic estimates
- [ ] Validate compliance engine blocks known bad patterns
- [ ] Ensure HITL queue system is operational
- [ ] Verify output delivery mechanisms (email, Slack, API webhook) work
- [ ] Confirm trace storage system is writable and queryable
- [ ] Validate mission lifecycle state transitions are implemented

### PHASE 1: CONTROLLED LIVE ACTIVATION
**Activation Criteria:**
- Only marketing department missions permitted initially
- Maximum 3 concurrent missions
- Daily budget cap: $50 USD equivalent
- All missions require HITL confirmation before execution
- Mission complexity limited to: social post creation, email draft, outreach sequence, weekly digest

**Mission Intake Specification:**
```
ACCEPTED MISSION TYPES:
1. content_creation_social - Create platform-specific social media post
2. content_creation_email - Draft marketing email sequence  
3. outreach_sequence - Generate seller/buyer outreach cadence
4. weekly_digest - Compile performance metrics into summary
5. ad_hypothesis - Formulate testable advertising hypothesis

MISSION FORMAT:
{
  "mission_type": "<one of above>",
  "prompt": "<detailed natural language description>",
  "context": {"campaign_id": "...", "audience": "...", "constraints": {...}},
  "priority": "low|medium|high",
  "requested_by": "<human_operator_id>",
  "timestamp": "<ISO 8601>"
}
```

### PHASE 2: MISSION EXECUTION CONTROL
**Strict Execution Flow:**
```
1. mission_received → status: queued
2. cost_evaluation → status: awaiting_cost_guard (if cost > threshold)
3. compliance_check → status: awaiting_compliance (if violation risk)
4. hitl_queued → status: awaiting_human (MANDATORY pause)
5. human_approval → status: executing (or cancelled)
6. route_selection → execute via perimeter-approved tools
7. output_generation → status: delivered
8. result_validation → status: completed/failed
9. trace_capture → store operational data
10. notification → inform requester
```

**Perimeter Gate Requirements:**
- **S1 (Compliance)**: Must return PASS or BLOCK with specific reason
- **S2 (Continuity)**: Must validate transport availability before tool use
- **S3 (HITL)**: Must pause execution and queue for human review
- **S4 (Feedback Memory)**: Must check historical corrections before execution
- **S5 (Economics)**: Must calculate and reserve estimated cost

### PHASE 3: LIVE OPERATOR SURFACE
**Required Visibility Dashboard:**
- **Active Missions Panel**: Shows all missions with status, time in queue, assigned operator
- **Perimeter Gate Logs**: Real-time view of S1-S5 evaluations for current mission
- **HITL Queue**: Pending human approvals with mission details and S3/S4 context
- **Completed Missions**: Last 20 missions with outcome, cost, traces collected
- **System Metrics**: Daily cost, mission success rate, average completion time, HITL override rate
- **Alerts**: Perimeter violations, transport failures, budget threshold warnings

**Operator Actions Available:**
- Approve/reject mission in HITL queue
- Override compliance decision (with mandatory justification)
- Cancel queued/executing mission
- Request mission re-queue with modified parameters
- Add correction feedback to mission trace

### PHASE 4: TRACE HARVESTING SPECIFICATION
**Mandatory Trace Fields per Mission:**
```
{
  "mission_id": "<uuid>",
  "mission_type": "...",
  "request_timestamp": "...",
  "completion_timestamp": "...",
  "status": "completed|failed|cancelled",
  "perimeter_gates": {
    "s1_compliance": {"result": "...", "reason_if_blocked": "...", "ms_elapsed": ...},
    "s2_continuity": {"transport_used": "...", "failover_occurred": bool, "ms_elapsed": ...},
    "s3_hitl": {"human_operator": "...", "override_applied": bool, "justification_if_override": "...", "ms_elapsed": ...},
    "s4_feedback": {"prior_corrections_applied": [...], "new_corrections_suggested": [...]},
    "s5_economics": {"estimated_cost": ..., "actual_cost": ..., "budget_source": "...", "ms_elapsed": ...}
  },
  "execution_trace": {
    "tools_used": [{"tool": "...", "provider": "...", "latency_ms": ..., "success": bool, "error_if_failed": "..."}],
    "route_decisions": [{"decision_point": "...", "chosen_option": "...", "alternatives_considered": [...]}],
    "output_artifacts": [{"type": "...", "size_bytes": "...", "delivery_method": "...", "delivery_status": "..."}]
  },
  "outcome_metrics": {
    "quality_score_human": null,  // To be filled later by human review
    "delivery_success": bool,
    "time_to_complete_ms": ...,
    "cost_per_unit": ...,
    "rework_required": bool
  },
  "context_snapshot": {
    "request_prompt": "...",
    "request_context": {...},
    "system_version": "...",
    "active_perimeter_policies": {...}
  }
}
```

**Trace Storage Requirements:**
- Immutable append-only log
- Queryable by mission_id, timestamp, status, mission_type
- Exportable in JSONL format for S6 analysis
- Retained minimum 90 days
- PII redacted automatically per S1 policies

### PHASE 5: ACTIVATION SUCCESS CRITERIA
**Must achieve ALL before considering activation successful:**
- [ ] 10 consecutive missions completed without perimeter bypass
- [ ] 0 missions executed without S3 HITL confirmation
- [ ] 100% trace completeness (all required fields populated)
- [ ] Daily cost never exceeds $50 cap
- [ ] Average mission completion time < 30 minutes
- [ ] Human override rate < 20% (indicates perimeter tuning)
- [ ] No S1/S2 violations resulting in system state corruption
- [ ] Operator reports dashboard provides sufficient situational awareness

### PHASE 6: TRANSITION CRITERIA TO S6
**Only after meeting ALL activation success criteria for 7 consecutive days:**
- Sufficient operational traces collected for statistical significance
- Baseline performance metrics established
- Perimeter tuning validated through live feedback
- Ready to implement S6 Performance Scoring using REAL traces

## ENFORCEMENT MECHANISMS
**Automatic Abort Triggers:**
- Any mission attempts to execute without full S1-S5 gate passage
- HITL queue bypassed or auto-approved
- Trace generation fails or is incomplete
- Daily budget exceeded
- Operator unable to determine mission status from dashboard
- More than 3 concurrent marketing missions active

**Manual Abort Triggers:**
- Operator declares activation unsafe
- Perimeter components show degradation
- Mission outcomes consistently violate S4 feedback corrections
- Economic efficiency degrades beyond acceptable thresholds

## DELIVERABLES FOR ACTIVATION
Upon successful completion of this activation protocol, provide:
1. Activation log showing 10 consecutive compliant missions
2. Trace export of all missions in JSONL format
3. Operator dashboard screenshot showing live mission visibility
4. Perimeter gate audit report showing 100% compliance
5. Recommendation for S6 scoring model based on collected traces

## FINAL VALIDATION QUESTION
Before declaring activation complete, answer:
** "If this system were the sole marketing department for a real business, could it operate safely and effectively under daily operational pressure while continuously improving from its mistakes?" **

Only answer "YES" if all evidence supports this conclusion.