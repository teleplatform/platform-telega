export type DepartmentStatus = 'active' | 'restricted' | 'paused';
export type MissionStatus = 'created' | 'planned' | 'running' | 'completed' | 'failed' | 'rolled_back';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Department {
  department_id: string;
  name: string;
  domain: string;
  profile_type: string;
  active_missions: string[];
  roles: string[];
  status: DepartmentStatus;
  created_at: string;
  created_by: string;
}

export interface Mission {
  mission_id: string;
  department_id: string;
  title: string;
  objective: string;
  mission_type: string;
  constraints: string[];
  success_criteria: string[];
  priority: number;
  status: MissionStatus;
  created_at: string;
  created_by: string;
}

export interface Task {
  task_id: string;
  mission_id: string;
  description: string;
  task_type: string;
  assigned_role: string;
  status: TaskStatus;
  evidence_refs: string[];
  created_at: string;
}

export interface AgentRole {
  role_id: string;
  role_type: string;
  capabilities: string[];
}

export interface MissionPlan {
  mission_id: string;
  tasks: string[];
  dependencies: Record<string, string[]>;
  generated_at: string;
}

export interface TaskResult {
  task_id: string;
  output: unknown;
  evidence_refs: string[];
  validated: boolean;
  validation_notes?: string;
  validated_at?: string;
}

export interface DepartmentAuditEvent {
  event_id: string;
  department_id: string;
  mission_id?: string;
  task_id?: string;
  event_type: string;
  actor_id: string;
  details?: Record<string, unknown>;
  created_at: string;
}
