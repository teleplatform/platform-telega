// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE HARDENING v1.0 — Domain Error Model
// ─────────────────────────────────────────────────────────────

export class ForgeBridgeError extends Error {
  public readonly code: string;
  public readonly bundleId?: string;

  constructor(code: string, message: string, bundleId?: string) {
    super(message);
    this.name = "ForgeBridgeError";
    this.code = code;
    this.bundleId = bundleId;
  }
}

export class ForgeBundleNotFoundError extends ForgeBridgeError {
  constructor(bundleId: string) {
    super("FORGE_BUNDLE_NOT_FOUND", `Bundle not found: ${bundleId}`, bundleId);
    this.name = "ForgeBundleNotFoundError";
  }
}

export class ForgeBundleInvalidError extends ForgeBridgeError {
  constructor(reason: string, bundleId?: string) {
    super("FORGE_BUNDLE_INVALID", `Invalid bundle: ${reason}`, bundleId);
    this.name = "ForgeBundleInvalidError";
  }
}

export class ForgeBundleLanguageUnresolvedError extends ForgeBridgeError {
  constructor(details: string) {
    super("FORGE_BUNDLE_LANGUAGE_UNRESOLVED", `Language unresolved: ${details}`);
    this.name = "ForgeBundleLanguageUnresolvedError";
  }
}

export class ForgeBundlePersonaInvalidError extends ForgeBridgeError {
  constructor(reason: string) {
    super("FORGE_BUNDLE_PERSONA_INVALID", `Invalid persona: ${reason}`);
    this.name = "ForgeBundlePersonaInvalidError";
  }
}

export class ForgeBundleTransferBlockedError extends ForgeBridgeError {
  constructor(reason: string, bundleId?: string) {
    super("FORGE_BUNDLE_TRANSFER_BLOCKED", `Transfer blocked: ${reason}`, bundleId);
    this.name = "ForgeBundleTransferBlockedError";
  }
}

export class ForgeBundleReviewRequiredError extends ForgeBridgeError {
  constructor(bundleId?: string) {
    super("FORGE_BUNDLE_REVIEW_REQUIRED", "Bundle requires review before proceeding", bundleId);
    this.name = "ForgeBundleReviewRequiredError";
  }
}

export class ForgeBundleDuplicateError extends ForgeBridgeError {
  constructor(details: string) {
    super("FORGE_BUNDLE_DUPLICATE", `Duplicate bundle: ${details}`);
    this.name = "ForgeBundleDuplicateError";
  }
}
