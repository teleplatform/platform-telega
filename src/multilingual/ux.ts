// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — UX Localization Pack
// ─────────────────────────────────────────────────────────────

import type { LanguageUxPack } from "./types.js";
import { LanguagePackInvalidError } from "./errors.js";

export function buildUxPack(input: {
  greetings: Record<string, string>;
  confirmations: Record<string, string>;
  clarifications: Record<string, string>;
  help: Record<string, string>;
  errors: Record<string, string>;
  delivery: Record<string, string>;
  taskStatus: Record<string, string>;
  blocked: Record<string, string>;
  safeFailure: Record<string, string>;
}): LanguageUxPack {
  if (!input.greetings || Object.keys(input.greetings).length === 0) {
    throw new LanguagePackInvalidError("greetings is required and must not be empty");
  }
  if (!input.confirmations || Object.keys(input.confirmations).length === 0) {
    throw new LanguagePackInvalidError("confirmations is required and must not be empty");
  }
  if (!input.clarifications || Object.keys(input.clarifications).length === 0) {
    throw new LanguagePackInvalidError("clarifications is required and must not be empty");
  }
  if (!input.help || Object.keys(input.help).length === 0) {
    throw new LanguagePackInvalidError("help is required and must not be empty");
  }
  if (!input.errors || Object.keys(input.errors).length === 0) {
    throw new LanguagePackInvalidError("errors is required and must not be empty");
  }
  if (!input.delivery || Object.keys(input.delivery).length === 0) {
    throw new LanguagePackInvalidError("delivery is required and must not be empty");
  }
  if (!input.taskStatus || Object.keys(input.taskStatus).length === 0) {
    throw new LanguagePackInvalidError("taskStatus is required and must not be empty");
  }
  if (!input.blocked || Object.keys(input.blocked).length === 0) {
    throw new LanguagePackInvalidError("blocked is required and must not be empty");
  }
  if (!input.safeFailure || Object.keys(input.safeFailure).length === 0) {
    throw new LanguagePackInvalidError("safeFailure is required and must not be empty");
  }

  return {
    greetings: input.greetings,
    confirmations: input.confirmations,
    clarifications: input.clarifications,
    help: input.help,
    errors: input.errors,
    delivery: input.delivery,
    taskStatus: input.taskStatus,
    blocked: input.blocked,
    safeFailure: input.safeFailure,
  };
}

export function validateUxPack(ux: LanguageUxPack): string[] {
  const errors: string[] = [];

  if (!ux.greetings || Object.keys(ux.greetings).length === 0) errors.push("greetings is required and must not be empty");
  if (!ux.confirmations || Object.keys(ux.confirmations).length === 0) errors.push("confirmations is required and must not be empty");
  if (!ux.clarifications || Object.keys(ux.clarifications).length === 0) errors.push("clarifications is required and must not be empty");
  if (!ux.help || Object.keys(ux.help).length === 0) errors.push("help is required and must not be empty");
  if (!ux.errors || Object.keys(ux.errors).length === 0) errors.push("errors is required and must not be empty");
  if (!ux.delivery || Object.keys(ux.delivery).length === 0) errors.push("delivery is required and must not be empty");
  if (!ux.taskStatus || Object.keys(ux.taskStatus).length === 0) errors.push("taskStatus is required and must not be empty");
  if (!ux.blocked || Object.keys(ux.blocked).length === 0) errors.push("blocked is required and must not be empty");
  if (!ux.safeFailure || Object.keys(ux.safeFailure).length === 0) errors.push("safeFailure is required and must not be empty");

  return errors;
}

export function getUxString(ux: LanguageUxPack, category: keyof LanguageUxPack, key: string): string | undefined {
  const section = ux[category];
  return section?.[key];
}
