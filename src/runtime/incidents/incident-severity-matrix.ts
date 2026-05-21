import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type IncidentSeverity = "info" | "low" | "medium" | "high" | "critical" | "civilization_risk";

export interface SeverityClassification {
  matched_keywords: string[];
  severity: IncidentSeverity;
  reason: string;
}

const SEVERITY_RULES: Array<{ keywords: string[]; severity: IncidentSeverity; reason: string }> = [
  {
    keywords: ["constitution", "violation", "corruption"],
    severity: "civilization_risk",
    reason: "Constitutional integrity affected",
  },
  {
    keywords: ["disaster", "crash", "collapse", "catastrophic"],
    severity: "critical",
    reason: "Critical system failure",
  },
  {
    keywords: ["freeze", "sovereign", "override", "unauthorized"],
    severity: "high",
    reason: "High-impact sovereignty event",
  },
  {
    keywords: ["degraded", "partial", "warning", "instability"],
    severity: "medium",
    reason: "Degraded operation",
  },
  {
    keywords: ["minor", "notice", "info"],
    severity: "low",
    reason: "Minor issue",
  },
];

export function classifySeverity(description: string): IncidentSeverity {
  const lower = description.toLowerCase();

  for (const rule of SEVERITY_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) {
      return rule.severity;
    }
  }

  return "info";
}

export function classifyAndRecordSeverity(
  description: string,
  context?: Record<string, unknown>,
): SeverityClassification {
  const severity = classifySeverity(description);
  const matchedRule = SEVERITY_RULES.find((r) => r.severity === severity);

  const result: SeverityClassification = {
    matched_keywords: matchedRule?.keywords || [],
    severity,
    reason: matchedRule?.reason || "Default classification",
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(`sev_${Date.now()}`, "incident_severity_classified"),
    trace_id: `sev_${Date.now()}`,
    job_id: "incidents",
    type: "incident_severity_classified",
    timestamp: new Date().toISOString(),
    payload: {
      severity,
      reason: result.reason,
      context,
    },
  });

  return result;
}

export function getSeverityRules(): typeof SEVERITY_RULES {
  return [...SEVERITY_RULES];
}
