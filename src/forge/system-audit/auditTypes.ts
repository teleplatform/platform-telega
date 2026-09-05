export type AuditCategory =
  | "registry" | "cross_link" | "health" | "security" | "consistency";

export type AuditSeverity = "ok" | "warning" | "error";

export interface AuditCheck {
  name: string;
  category: AuditCategory;
  severity: AuditSeverity;
  message: string;
  details?: string;
}

export interface AuditResult {
  version: string;
  totalChecks: number;
  ok: number;
  warnings: number;
  errors: number;
  checks: AuditCheck[];
  healthy: boolean;
  timestamp: string;
}
