// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Domain Error Model
// ─────────────────────────────────────────────────────────────

export class LanguagePackError extends Error {
  public readonly code: string;
  public readonly languageCode?: string;

  constructor(code: string, message: string, languageCode?: string) {
    super(message);
    this.name = "LanguagePackError";
    this.code = code;
    this.languageCode = languageCode;
  }
}

export class LanguagePackNotFoundError extends LanguagePackError {
  constructor(languageCode: string) {
    super("LANGUAGE_PACK_NOT_FOUND", `Language pack not found: ${languageCode}`, languageCode);
    this.name = "LanguagePackNotFoundError";
  }
}

export class LanguagePackInvalidError extends LanguagePackError {
  constructor(reason: string, languageCode?: string) {
    super("LANGUAGE_PACK_INVALID", `Invalid language pack: ${reason}`, languageCode);
    this.name = "LanguagePackInvalidError";
  }
}

export class LanguagePackValidationFailedError extends LanguagePackError {
  constructor(failedChecks: string[], languageCode: string) {
    super(
      "LANGUAGE_PACK_VALIDATION_FAILED",
      `Validation failed for ${languageCode}: ${failedChecks.join(", ")}`,
      languageCode,
    );
    this.name = "LanguagePackValidationFailedError";
  }
}

export class LanguageRolloutBlockedError extends LanguagePackError {
  constructor(languageCode: string, surface: string, role: string) {
    super(
      "LANGUAGE_ROLLOUT_BLOCKED",
      `Language ${languageCode} not enabled for surface=${surface}, role=${role}`,
      languageCode,
    );
    this.name = "LanguageRolloutBlockedError";
  }
}

export class LanguageNotReadyError extends LanguagePackError {
  constructor(languageCode: string, currentStatus: string) {
    super(
      "LANGUAGE_NOT_READY",
      `Language ${languageCode} not ready (status: ${currentStatus})`,
      languageCode,
    );
    this.name = "LanguageNotReadyError";
  }
}

export class PersonaConsistencyError extends LanguagePackError {
  constructor(languageCode: string, details: string) {
    super(
      "PERSONA_CONSISTENCY_VIOLATION",
      `Persona consistency violation in ${languageCode}: ${details}`,
      languageCode,
    );
    this.name = "PersonaConsistencyError";
  }
}

export class SafeDegradationRequiredError extends LanguagePackError {
  constructor(uncertaintyType: string, languageCode: string) {
    super(
      "SAFE_DEGRADATION_REQUIRED",
      `Safe degradation required for ${languageCode} (uncertainty: ${uncertaintyType})`,
      languageCode,
    );
    this.name = "SafeDegradationRequiredError";
  }
}
