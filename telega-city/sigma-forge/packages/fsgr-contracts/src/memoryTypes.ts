export type MemoryLayer =
  | "bootstrap"
  | "operator"
  | "workspace"
  | "run"
  | "canon"
  | "evidence";

export interface MemoryRecord {
  memory_id: string;
  layer: MemoryLayer;
  scope_key: string;
  record_key: string;
  title: string;
  content: string;
  tags: string[];
  source_run_id?: string;
  source_event_id?: string;
  source_artifact_id?: string;
  importance: "low" | "medium" | "high";
  created_at: string;
  updated_at: string;
}

export interface MemoryQuery {
  layer?: MemoryLayer;
  scope_key?: string;
  tags?: string[];
  record_key?: string;
  source_run_id?: string;
  limit?: number;
}
