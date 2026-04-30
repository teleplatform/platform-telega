# CREATOR WEB TRACE v1


Required fields:
- trace_id (uuid)
- provider_id
- source_url
- policy_id
- usage_scope = personal_internal
- vendor_approval = confirmed
- action_type (open/send/wait/read/select/health/login/relogin_required)
- delay_applied_ms
- policy_verdict (allowed/slow_mode/paused/blocked)
- created_at (ts)
- meta (json)
  - runner_job_id (string, optional)
  - lifecycle (string, optional) e.g. runner_job_started / runner_job_finished
  - runner_action (string, optional)
  - runner_status (string, optional)
  - exit_code (number, optional)
