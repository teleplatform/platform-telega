export type SensitivityLevel =
  | "public_safe"
  | "internal_safe"
  | "provider_restricted"
  | "confidential"
  | "regulated";

export type RedactionKind =
  | "pii"
  | "secret"
  | "payment"
  | "crm"
  | "address"
  | "custom";

export interface RedactionEntry {
  kind: RedactionKind;
  field?: string;
  start?: number;
  end?: number;
  replacement: string;
}

export interface ComplianceDecision {
  allowed: boolean;
  sensitivity: SensitivityLevel;
  redactions: RedactionEntry[];
  blocked_reasons: string[];
  outbound_policy: {
    allow_external_model: boolean;
    allow_local_only: boolean;
    allow_tool_calls: boolean;
  };
}
