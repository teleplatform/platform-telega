export type Language = "ru" | "en";

export interface MessageDict {
  en: string;
  ru: string;
}

export const messages: Record<string, MessageDict> = {
  // General
  error: {
    en: "Error: {message}",
    ru: "Ошибка: {message}",
  },
  success: {
    en: "Success",
    ru: "Успешно",
  },
  not_allowed: {
    en: "Access denied",
    ru: "Доступ запрещён",
  },
  owner_only: {
    en: "Owner only",
    ru: "Только для владельца",
  },
  usage: {
    en: "Usage: {usage}",
    ru: "Использование: {usage}",
  },

  // Jobs
  job_created: {
    en: "Task accepted. Job: {jobId}. I will send result when ready.",
    ru: "Задача принята. Job: {jobId}. Я пришлю результат, когда будет готово.",
  },
  job_status: {
    en: "Job {jobId}: {status}",
    ru: "Задача {jobId}: {status}",
  },
  job_completed: {
    en: "Job completed: {jobId}",
    ru: "Задача выполнена: {jobId}",
  },
  job_failed: {
    en: "Job failed: {jobId}",
    ru: "Задача не удалась: {jobId}",
  },
  job_cancelled: {
    en: "Job cancelled: {jobId}",
    ru: "Задача отменена: {jobId}",
  },
  job_not_found: {
    en: "Job not found: {jobId}",
    ru: "Задача не найдена: {jobId}",
  },
  no_active_jobs: {
    en: "No active jobs",
    ru: "Нет активных задач",
  },
  jobs_list: {
    en: "Active jobs ({count}):\n{jobs}",
    ru: "Активные задачи ({count}):\n{jobs}",
  },

  // Limits
  limit_reached: {
    en: "Limit reached: {reason}. Upgrade your plan.",
    ru: "Достигнут лимит: {reason}. Обновите тариф.",
  },
  daily_limit_reached: {
    en: "Daily request limit reached",
    ru: "Достигнут дневной лимит запросов",
  },
  active_jobs_limit: {
    en: "Active jobs limit reached",
    ru: "Достигнут лимит активных задач",
  },
  pending_jobs_limit: {
    en: "Pending jobs limit reached",
    ru: "Достигнут лимит ожидающих задач",
  },
  provider_not_allowed: {
    en: "Provider {provider} not available on your plan ({plan})",
    ru: "Провайдер {provider} недоступен на вашем тарифе ({plan})",
  },

  // User
  user_profile: {
    en: "👤 User: {userId}\nRole: {role}\nPlan: {plan}",
    ru: "👤 Пользователь: {userId}\nРоль: {role}\nТариф: {plan}",
  },
  usage_stats: {
    en: "📊 Usage:\n  Active jobs: {active}/{maxActive}\n  Pending jobs: {pending}/{maxPending}\n  Daily requests: {daily}/{maxDaily}",
    ru: "📊 Использование:\n  Активные задачи: {active}/{maxActive}\n  Ожидающие: {pending}/{maxPending}\n  Запросов сегодня: {daily}/{maxDaily}",
  },
  features: {
    en: "⚡ Features:\n  Multi-agent: {multi}\n  Tools: {tools}\n  Patch plan: {patchPlan}\n  Patch apply: {patchApply}",
    ru: "⚡ Возможности:\n  Мультиагент: {multi}\n  Инструменты: {tools}\n  План патча: {patchPlan}\n  Применение патча: {patchApply}",
  },
  providers_list: {
    en: "🌐 Providers: {providers}",
    ru: "🌐 Провайдеры: {providers}",
  },
  plan_info: {
    en: "📦 Plan: {plan}\n\nActive jobs: {maxActive}\nPending jobs: {maxPending}\nDaily requests: {maxDaily}",
    ru: "📦 Тариф: {plan}\n\nАктивных задач: {maxActive}\nОжидающих: {maxPending}\nЗапросов в день: {maxDaily}",
  },
  upgrade_info: {
    en: "📦 Upgrade plans available:\n\nfree: 2 jobs, basic providers\npro: 5 jobs, tools, patch plan\ncreator: unlimited, full access\n\nContact @owner for upgrade.",
    ru: "📦 Доступные тарифы:\n\nfree: 2 задачи, базовые провайдеры\npro: 5 задач, инструменты, план патча\ncreator: безлимит, полный доступ\n\nСвяжитесь с @owner для обновления.",
  },
  creator_plan: {
    en: "✅ You have full creator plan!",
    ru: "✅ У вас полный Creator тариф!",
  },
  you_are_on_plan: {
    en: "You are on {plan} plan",
    ru: "Вы на тарифе {plan}",
  },

  // Bridge
  bridge_status: {
    en: "🌉 Bridge Status:\n{status}",
    ru: "🌉 Статус моста:\n{status}",
  },
  provider_healthy: {
    en: "🟢 {provider}: healthy",
    ru: "🟢 {provider}: работает",
  },
  provider_degraded: {
    en: "🟡 {provider}: degraded (cooldown)",
    ru: "🟡 {provider}: восстанавливается",
  },
  provider_down: {
    en: "🔴 {provider}: down",
    ru: "🔴 {provider}: не работает",
  },
  bridge_evidence: {
    en: "📋 Last evidence:\n{evidence}",
    ru: "📋 Последние данные:\n{evidence}",
  },
  bridge_failures: {
    en: "❌ Recent failures:\n{failures}",
    ru: "❌ Недавние ошибки:\n{failures}",
  },
  no_failures: {
    en: "No failures recorded",
    ru: "Ошибок не записано",
  },
  bridge_memory: {
    en: "🧠 Memory entries: {count}",
    ru: "🧠 Записей в памяти: {count}",
  },
  memory_find_results: {
    en: "Found {count} matches for '{query}':\n{results}",
    ru: "Найдено {count} совпадений для '{query}':\n{results}",
  },
  no_memory_matches: {
    en: "No memory matches",
    ru: "Нет совпадений в памяти",
  },
  bridge_audit: {
    en: "📊 Audit summary (last {count} records):\n{summary}",
    ru: "📊 Сводка аудита (последние {count} записей):\n{summary}",
  },
  audit_find_results: {
    en: "Found {count} audit records:\n{results}",
    ru: "Найдено {count} записей аудита:\n{results}",
  },
  no_audit_results: {
    en: "No matches",
    ru: "Нет совпадений",
  },
  audit_view: {
    en: "📋 Audit Record #{id}:\n{record}",
    ru: "📋 Запись аудита #{id}:\n{record}",
  },
  audit_not_found: {
    en: "Audit not found: {id}",
    ru: "Аудит не найден: {id}",
  },

  // Patches
  patch_created: {
    en: "📝 Patch plan created: {planId}",
    ru: "📝 План патча создан: {planId}",
  },
  patch_not_found: {
    en: "Patch not found: {planId}",
    ru: "Патч не найден: {planId}",
  },
  patch_applied: {
    en: "✅ Patch applied: {planId}\n{result}",
    ru: "✅ Патч применён: {planId}\n{result}",
  },
  patch_verify_needed: {
    en: "⏳ Patch requires verification. Run /patch_verify {planId}",
    ru: "⏳ Патч требует проверки. Выполните /patch_verify {planId}",
  },
  patch_verified: {
    en: "✅ Patch verified: {planId}",
    ru: "✅ Патч проверен: {planId}",
  },
  patch_failed: {
    en: "❌ Patch failed: {planId}\n{error}",
    ru: "❌ Патч не удался: {planId}\n{error}",
  },
  patch_rollback: {
    en: "🔄 Rolled back to backup: {backupId}",
    ru: "🔄 Откат к резервной копии: {backupId}",
  },

  // Agents
  agents_list: {
    en: "🤖 Agents ({count}):\n{agents}",
    ru: "🤖 Агенты ({count}):\n{agents}",
  },
  no_agents: {
    en: "No agents found",
    ru: "Агенты не найдены",
  },
  agent_created: {
    en: "🤖 Agent created:\n\n{agent}",
    ru: "🤖 Агент создан:\n\n{agent}",
  },
  agent_not_found: {
    en: "Agent not found: {agentId}",
    ru: "Агент не найден: {agentId}",
  },
  agent_run_started: {
    en: "🚀 Agent run started!\n\nRun ID: {runId}\nAgent: {agentName}\nInput: {input}",
    ru: "🚀 Запуск агента!\n\nRun ID: {runId}\nАгент: {agentName}\nВвод: {input}",
  },
  agent_run_limit: {
    en: "❌ {reason}",
    ru: "❌ {reason}",
  },
  agent_paused: {
    en: "⏸️ Agent paused: {agentName}",
    ru: "⏸️ Агент приостановлен: {agentName}",
  },
  agent_resumed: {
    en: "▶️ Agent resumed: {agentName}",
    ru: "▶️ Агент возобновлён: {agentName}",
  },
  agent_runs_list: {
    en: "Agent runs ({count}):\n{runs}",
    ru: "Запуски агента ({count}):\n{runs}",
  },
  no_agent_runs: {
    en: "No runs found",
    ru: "Запуски не найдены",
  },
  agent_status_info: {
    en: "Run today: {limitInfo}",
    ru: "Запусков сегодня: {limitInfo}",
  },

  // Language
  language_set: {
    en: "Language set to English",
    ru: "Язык установлен на русский",
  },
  current_language: {
    en: "Current language: English",
    ru: "Текущий язык: русский",
  },
  language_not_supported: {
    en: "Language not supported: {lang}",
    ru: "Язык не поддерживается: {lang}",
  },


  // Action Buttons
  action_repeat: {
    en: "Repeat",
    ru: "Повторить",
  },
  action_clarify: {
    en: "Clarify",
    ru: "Уточнить",
  },
  action_file: {
    en: "Send as file",
    ru: "В файл",
  },
  action_read_aloud: {
    en: "Read aloud",
    ru: "Озвучить",
  },
  action_image: {
    en: "Generate image",
    ru: "Картинка",
  },
  action_provider: {
    en: "Switch provider",
    ru: "Провайдер",
  },
  action_save: {
    en: "Save",
    ru: "Сохранить",
  },
  action_no_response: {
    en: "No previous response to act on",
    ru: "Нет предыдущего ответа",
  },
  action_saved: {
    en: "Response saved!",
    ru: "Ответ сохранён!",
  },
  action_repeating: {
    en: "Repeating your last request...",
    ru: "Повторяю ваш последний запрос...",
  },
  action_clarifying: {
    en: "Making answer clearer...",
    ru: "Делаю ответ понятнее...",
  },
  action_sent_file: {
    en: "Sent as file!",
    ru: "Отправлено файлом!",
  },
  action_saved_responses: {
    en: "Saved responses:",
    ru: "Сохранённые ответы:",
  },
};

export function t(key: string, lang: Language, vars?: Record<string, any>): string {
  const dict = messages[key];
  if (!dict) {
    console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  
  let text = dict[lang] || dict.en || key;
  
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  
  return text;
}

export function detectLanguage(langCode?: string, text?: string): Language {
  if (langCode) {
    if (langCode.startsWith("ru")) return "ru";
    if (langCode.startsWith("en")) return "en";
  }
  
  if (text) {
    const cyrillic = /[а-яА-ЯёЁ]/.test(text);
    if (cyrillic) return "ru";
  }
  
  return "ru";
}