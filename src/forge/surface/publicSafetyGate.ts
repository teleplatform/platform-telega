import { PublicHiddenFeature } from "./publicTypes";
import { PublicRegistry } from "./publicRegistry";

const BLOCKED_PATTERNS = [
  { pattern: /system\.reload/i, feature: "override.controls" as PublicHiddenFeature, message: "Это действие недоступно в обычном режиме." },
  { pattern: /override\.execute/i, feature: "override.controls" as PublicHiddenFeature, message: "Системные переопределения недоступны." },
  { pattern: /provider\.switch/i, feature: "provider.debug" as PublicHiddenFeature, message: "Переключение провайдеров недоступно." },
  { pattern: /policy\.edit/i, feature: "policy.editor" as PublicHiddenFeature, message: "Редактирование политик недоступно." },
  { pattern: /evidence\.raw|evidence\.inspect/i, feature: "evidence.raw" as PublicHiddenFeature, message: "Просмотр evidence недоступен." },
  { pattern: /repair\.(force|run)/i, feature: "repair.controls" as PublicHiddenFeature, message: "Управление ремонтом недоступно." },
  { pattern: /capsule\.open|capsule\.inspect/i, feature: "capsule.internals" as PublicHiddenFeature, message: "Просмотр капсул недоступен." },
];

export interface SafetyCheckResult {
  allowed: boolean;
  feature: string | null;
  message: string;
}

export function checkActionSafety(action: string): SafetyCheckResult {
  for (const bp of BLOCKED_PATTERNS) {
    if (bp.pattern.test(action)) {
      return { allowed: false, feature: bp.feature, message: bp.message };
    }
  }
  return { allowed: true, feature: null, message: "Action allowed" };
}

export function isFeatureHidden(feature: string): boolean {
  return PublicRegistry.getHidden().includes(feature as PublicHiddenFeature);
}
