export interface ScopeBinding {
  scope_id: string;
  tele_user_id: string;
  workspace_id?: string;
  store_id?: string;
  session_id?: string;
  task_id?: string;
  bound_at: string;
}
