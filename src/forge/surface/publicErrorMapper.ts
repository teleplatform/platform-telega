const ERROR_MAP: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /PROVIDER_FAILED|provider_unavailable|provider_timeout/i, message: "Сейчас ответ не получился. Попробуйте ещё раз." },
  { pattern: /POLICY_DENIED|policy_denied/i, message: "Это действие недоступно в обычном режиме." },
  { pattern: /RESOURCE_DENIED|resource_denied/i, message: "Система занята. Попробуйте чуть позже." },
  { pattern: /SESSION_NOT_FOUND|session not found/i, message: "Сессия не найдена. Начните новый чат." },
  { pattern: /MISSION_NOT_FOUND|mission not found/i, message: "Миссия не найдена." },
  { pattern: /OVERRIDE_REJECTED|override rejected/i, message: "Действие отклонено." },
  { pattern: /EMERGENCY_STOP|emergency stop triggered/i, message: "Система остановлена. Обратитесь к администратору." },
  { pattern: /.*/i, message: "Что-то пошло не так. Попробуйте ещё раз." },
];

export function mapUserError(error: string): string {
  for (const entry of ERROR_MAP) {
    if (entry.pattern.test(error)) return entry.message;
  }
  return "Что-то пошло не так. Попробуйте ещё раз.";
}
