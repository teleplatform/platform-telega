import type { RedactionEntry, RedactionKind } from "../../runtime-safety-contracts/src/compliance.js";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const TOKEN_RE = /(?:sk|pk|api|token|secret|key)[-_]?[a-zA-Z0-9]{10,}/gi;
const CARD_RE = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const CRM_ID_RE = /(?:crm|customer|order|user)[-_]?id[_:-]?\s*[a-zA-Z0-9-]+/gi;

export function detectSensitiveText(text: string): RedactionEntry[] {
  const redactions: RedactionEntry[] = [];

  let m: RegExpExecArray | null;
  const emailRe = new RegExp(EMAIL_RE.source, "g");
  while ((m = emailRe.exec(text)) !== null) {
    redactions.push({ kind: "pii", field: "email", start: m.index, end: m.index + m[0].length, replacement: "[REDACTED_EMAIL]" });
  }

  const phoneRe = new RegExp(PHONE_RE.source, "g");
  while ((m = phoneRe.exec(text)) !== null) {
    redactions.push({ kind: "pii", field: "phone", start: m.index, end: m.index + m[0].length, replacement: "[REDACTED_PHONE]" });
  }

  const tokenRe = new RegExp(TOKEN_RE.source, "g");
  while ((m = tokenRe.exec(text)) !== null) {
    redactions.push({ kind: "secret", field: "token", start: m.index, end: m.index + m[0].length, replacement: "[REDACTED_SECRET]" });
  }

  const cardRe = new RegExp(CARD_RE.source, "g");
  while ((m = cardRe.exec(text)) !== null) {
    redactions.push({ kind: "payment", field: "card", start: m.index, end: m.index + m[0].length, replacement: "[REDACTED_PAYMENT]" });
  }

  const crmRe = new RegExp(CRM_ID_RE.source, "g");
  while ((m = crmRe.exec(text)) !== null) {
    redactions.push({ kind: "crm", field: "crm_id", start: m.index, end: m.index + m[0].length, replacement: "[REDACTED_CRM_ID]" });
  }

  return redactions;
}

export function detectSensitiveFields(obj: Record<string, unknown>): RedactionEntry[] {
  const redactions: RedactionEntry[] = [];
  const sensitiveKeys = [
    { re: /email/i, kind: "pii" as RedactionKind, replacement: "[REDACTED_EMAIL]" },
    { re: /phone|mobile|tel/i, kind: "pii" as RedactionKind, replacement: "[REDACTED_PHONE]" },
    { re: /password|secret|token|api[_-]?key/i, kind: "secret" as RedactionKind, replacement: "[REDACTED_SECRET]" },
    { re: /card|payment|stripe|billing/i, kind: "payment" as RedactionKind, replacement: "[REDACTED_PAYMENT]" },
    { re: /address|street|city|zip|postal/i, kind: "address" as RedactionKind, replacement: "[REDACTED_ADDRESS]" },
    { re: /crm|customer[_-]?id|order[_-]?id/i, kind: "crm" as RedactionKind, replacement: "[REDACTED_CRM_ID]" },
  ];

  for (const [key, value] of Object.entries(obj)) {
    for (const pattern of sensitiveKeys) {
      if (pattern.re.test(key)) {
        redactions.push({ kind: pattern.kind, field: key, replacement: pattern.replacement });
        break;
      }
    }
    if (typeof value === "string") {
      redactions.push(...detectSensitiveText(value).map((r) => ({ ...r, field: key })));
    }
  }

  return redactions;
}

export function detectSensitive(input: string | Record<string, unknown>): RedactionEntry[] {
  if (typeof input === "string") return detectSensitiveText(input);
  return detectSensitiveFields(input);
}
