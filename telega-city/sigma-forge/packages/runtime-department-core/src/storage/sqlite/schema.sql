CREATE TABLE IF NOT EXISTS departments (
  department_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  profile_type TEXT NOT NULL,
  active_missions_json TEXT NOT NULL,
  roles_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS missions (
  mission_id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  mission_type TEXT NOT NULL,
  constraints_json TEXT NOT NULL,
  success_criteria_json TEXT NOT NULL,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  description TEXT NOT NULL,
  task_type TEXT NOT NULL,
  assigned_role TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (mission_id) REFERENCES missions(mission_id)
);

CREATE TABLE IF NOT EXISTS mission_plans (
  mission_id TEXT PRIMARY KEY,
  tasks_json TEXT NOT NULL,
  dependencies_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  FOREIGN KEY (mission_id) REFERENCES missions(mission_id)
);

CREATE TABLE IF NOT EXISTS task_results (
  task_id TEXT PRIMARY KEY,
  output_json TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  validated INTEGER NOT NULL,
  validation_notes TEXT,
  validated_at TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id)
);

CREATE TABLE IF NOT EXISTS department_audit (
  audit_id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL,
  mission_id TEXT,
  task_id TEXT,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);
