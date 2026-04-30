CREATE TABLE IF NOT EXISTS runtime_identities (
  tele_user_id TEXT NOT NULL,
  workspace_id TEXT,
  store_id TEXT,
  session_id TEXT,
  task_id TEXT,
  agent_id TEXT,
  channel_transport TEXT,
  channel_user_id TEXT,
  channel_chat_id TEXT,
  channel_session_ref TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_policies (
  agent_id TEXT PRIMARY KEY,
  allowed_tools_json TEXT NOT NULL,
  denied_tools_json TEXT NOT NULL,
  allowed_memory_scopes_json TEXT NOT NULL,
  write_requires_approval INTEGER NOT NULL,
  external_send_requires_sanitization INTEGER NOT NULL,
  max_parallel_jobs INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_scope_bindings (
  scope_id TEXT PRIMARY KEY,
  tele_user_id TEXT NOT NULL,
  workspace_id TEXT,
  store_id TEXT,
  session_id TEXT,
  task_id TEXT,
  bound_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_compliance_audit (
  audit_id TEXT PRIMARY KEY,
  task_id TEXT,
  session_id TEXT,
  tele_user_id TEXT,
  sensitivity TEXT NOT NULL,
  allowed INTEGER NOT NULL,
  blocked_reasons_json TEXT NOT NULL,
  redactions_json TEXT NOT NULL,
  outbound_policy_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
