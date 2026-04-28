// @ts-nocheck
export type Locale = "ru" | "en" | "uz";

const MSG_RU = {
  makerOnly: "Только Maker.",
  error: "Ошибка",
  badId: "Неверный id",
  cb: {
    retrying: "Повтор…",
    manyRetries: (depth: number) =>
      `Слишком много повторов: depth=${depth}. Похоже на детерминированный сбой.`,
    cooldownWait: (sec: number) => `Пауза: подожди ~${sec}с`,
    retryFailed: "Повтор не выполнен",
    retryLimitReached: "Лимит повторов достигнут.",
    chain: "Цепочка",
    results: "Результаты",
  },
  btn: {
    retry: "🔁 Повтор",
    retryLimit: (depth: number) => `🧱 Лимит повторов (${depth})`,
    chain: "🧬 Цепочка",
    openResults: "📦 Открыть результаты",
    explainSource: "🧠 Пояснить источник",
  },
  reply: {
    traceNotFound: (id: string) => `Trace не найден: ${id}`,
    sourceTaskNotFound: "Не найден исходный task для этого trace.",
    retryQueued: (oldTraceId: string, newTaskId: string, depth: number) =>
      `🔁 Повтор поставлен в очередь\n` +
      `• исходный trace: ${oldTraceId}\n` +
      `• новый task: ${newTaskId}\n` +
      `• глубина повторов: ${depth}`,
    retryReasonSource: (reason: string, stage: string, error: string) =>
      `🧠 Подсказка по повтору (источник)\n` +
      `• ${reason}\n` +
      `• Этап: ${stage}\n` +
      `• Ошибка: ${error}`,
    chainText: (depth: number, root8: string, chain: string) =>
      `🧬 Цепочка повторов\n` +
      `• Глубина: ${depth}\n` +
      `• Корень: ${root8}\n` +
      `• Цепочка: ${chain}`,
    chainTruncated: (n: number) => `\n• Примечание: цепочка обрезана (>${n})`,
    chainCycle: "\n• Внимание: обнаружен цикл",
    retryFailed: (msg: string) => `❌ Повтор не выполнен: ${msg}`,
  },
} as const;

type MsgShape = typeof MSG_RU;
const defineMsg = <T extends MsgShape>(t: T) => t;

export const MSG_EN = defineMsg({
  makerOnly: "Maker only.",
  error: "Error",
  badId: "Bad id",
  cb: {
    retrying: "Retrying…",
    manyRetries: (depth: number) =>
      `Many retries: depth=${depth}. Likely deterministic failure.`,
    cooldownWait: (sec: number) => `Cooldown: wait ~${sec}s`,
    retryFailed: "Retry failed",
    retryLimitReached: "Retry limit reached.",
    chain: "Chain",
    results: "Results",
  },
  btn: {
    retry: "🔁 Retry",
    retryLimit: (depth: number) => `🧱 Retry limit (${depth})`,
    chain: "🧬 Chain",
    openResults: "📦 Open results",
    explainSource: "🧠 Explain source",
  },
  reply: {
    traceNotFound: (id: string) => `Trace not found: ${id}`,
    sourceTaskNotFound: "Source task not found for this trace.",
    retryQueued: (oldTraceId: string, newTaskId: string, depth: number) =>
      `🔁 Retry queued\n` +
      `• source trace: ${oldTraceId}\n` +
      `• new task: ${newTaskId}\n` +
      `• retry depth: ${depth}`,
    retryReasonSource: (reason: string, stage: string, error: string) =>
      `🧠 Retry Reason Hint (source)\n` +
      `• ${reason}\n` +
      `• Stage: ${stage}\n` +
      `• Error: ${error}`,
    chainText: (depth: number, root8: string, chain: string) =>
      `🧬 Retry Chain\n` +
      `• Depth: ${depth}\n` +
      `• Root: ${root8}\n` +
      `• Chain: ${chain}`,
    chainTruncated: (n: number) => `\n• Note: chain truncated (>${n})`,
    chainCycle: "\n• Warning: cycle detected",
    retryFailed: (msg: string) => `❌ Retry failed: ${msg}`,
  },
} as const);

export const MSG_UZ = defineMsg({
  ...MSG_RU,
  // постепенно переведёшь значения; структура зафиксирована типами
} as const);

export const EXPLAIN_MSG_RU = {
  status: "Статус",
  time: "Время",
  stages: "Этапы",
  errors: "Ошибки",
  quickDiff: (id8: string) => `🔎 Быстрый diff (vs ${id8})`,
  quickDiffUnavailable: "• diff недоступен",
  statusLine: (prev: string, cur: string) => `• Статус: ${prev} → ${cur}`,
  timeLine: (prev: string, cur: string) => `• Время: ${prev} → ${cur}`,
  stageDeltaLine: (delta: string) => `• Дельта этапов: ${delta}`,
  errorsLine: (prev: string, cur: string) => `• Ошибки: ${prev} → ${cur}`,
  eventsLine: (prevErr: number, curErr: number, prevStage: number, curStage: number) =>
    `• События: ошибка ${prevErr}→${curErr}, этап ${prevStage}→${curStage}`,
  retryReasonTitle: "🧠 Подсказка по повтору",
  suggestedActionTitle: "🛠 Рекомендованное действие",
  retrySummaryTitle: "📊 Сводка повторов",
  depthRootLine: (depth: number, root8: string) => `• Глубина: ${depth} (корень ${root8})`,
  outcomeLine: (outcome: string, tries: number) => `• Исход: ${outcome} (${tries} попыток)`,
  determinismLine: (deterministic: boolean) =>
    `• Детерминизм: ${deterministic ? "скорее детерминированный" : "скорее временный"}`,
  chainGuardTitle: "🧱 Ограничитель цепочки повторов",
  chainLine: (chain: string) => `• Цепочка: ${chain}`,
  noteTruncated: (n: number) => `• Примечание: цепочка обрезана (>${n})`,
  warningCycle: "• Внимание: обнаружен цикл",
  warningManyRetries: "• Внимание: много повторов; скорее детерминированный сбой",
  hintResolved:
    "Сбой исчез после повтора (вход/spec/контекст, вероятно, изменился).",
  hintDeterministic: "Детерминированный сбой (та же стадия после повтора).",
  hintProgressed:
    "Продвинулись на другую стадию: исходная ошибка изменилась, но осталась другая.",
  hintNoChange: "Повтор не изменил исход; изучи детали ошибки.",
  hintRegression: "Регресс после повтора; входы/окружение могли ухудшиться.",
  hintOutcomeChanged: "Исход изменился после повтора; сравни стадии/ошибки.",
  lineStatus: (prev: string, cur: string) => `Статус: ${prev} → ${cur}`,
  lineStagePrevCur: (prev: string, cur: string) => `Этап(prev): ${prev} → Этап(cur): ${cur}`,
  lineStage: (stage: string) => `Этап: ${stage}`,
  lineErrorPrevCur: (prev: string, cur: string) => `Ошибка(prev): ${prev} → Ошибка(cur): ${cur}`,
  lineTopErrorPrevCur: (prev: string, cur: string) => `Топ-ошибка(prev): ${prev} → ${cur}`,
  lineEventsError: (prev: number, cur: number) => `События: ошибка ${prev}→${cur}`,
  lineErrorCur: (cur: string) => `Ошибка(cur): ${cur}`,
  lineErrorsPrevCur: (prev: string, cur: string) => `Ошибки: ${prev} → ${cur}`,
  suggestValidation:
    "Проверь входы/контекст PackSpec; повтори с обновлённым digest/links; проверь путь к spec.",
  suggestPath:
    "Проверь пути назначения, наличие директорий и пути TELEGA_ROOT/mission-control.",
  suggestPerm: "Проверь права файлов / пользователя запуска / доступ к рабочей папке.",
  suggestTransient:
    "Временный сбой I/O/рантайма: повтори после паузы; проверь локальное окружение.",
  suggestTrace:
    "Трейс неполный: проверь падение воркера/логи и запись trace.",
  suggestFallback:
    "Открой Быстрый diff и Подсказку по повтору; проверь top-ошибку и последнюю стадию.",
  singleHintDefault: "Повтор может помочь, если сбой был временным.",
  singleHintValidation:
    "Похоже на ошибку валидации/входных данных (повтор поможет только при изменении контекста).",
  singleHintTransient: "Похоже на временный сбой I/O/рантайма (повтор часто помогает).",
} as const;

type ExplainShape = typeof EXPLAIN_MSG_RU;
const defineExplain = <T extends ExplainShape>(t: T) => t;

export const EXPLAIN_MSG_EN = defineExplain({
  status: "Status",
  time: "Time",
  stages: "Stages",
  errors: "Errors",
  quickDiff: (id8: string) => `🔎 Quick Diff (vs ${id8})`,
  quickDiffUnavailable: "• diff unavailable",
  statusLine: (prev: string, cur: string) => `• Status: ${prev} → ${cur}`,
  timeLine: (prev: string, cur: string) => `• Time: ${prev} → ${cur}`,
  stageDeltaLine: (delta: string) => `• Stage delta: ${delta}`,
  errorsLine: (prev: string, cur: string) => `• Errors: ${prev} → ${cur}`,
  eventsLine: (prevErr: number, curErr: number, prevStage: number, curStage: number) =>
    `• Events: error ${prevErr}→${curErr}, stage ${prevStage}→${curStage}`,
  retryReasonTitle: "🧠 Retry Reason Hint",
  suggestedActionTitle: "🛠 Suggested action",
  retrySummaryTitle: "📊 Retry Summary",
  depthRootLine: (depth: number, root8: string) => `• Depth: ${depth} (root ${root8})`,
  outcomeLine: (outcome: string, tries: number) => `• Outcome: ${outcome} (${tries} tries)`,
  determinismLine: (deterministic: boolean) =>
    `• Determinism: ${deterministic ? "likely deterministic" : "likely transient"}`,
  chainGuardTitle: "🧱 Retry Chain Guard",
  chainLine: (chain: string) => `• Chain: ${chain}`,
  noteTruncated: (n: number) => `• Note: chain truncated (>${n})`,
  warningCycle: "• Warning: cycle detected",
  warningManyRetries: "• Warning: many retries; likely deterministic failure",
  hintResolved: "Failure resolved after retry (input/spec/context likely changed).",
  hintDeterministic: "Deterministic failure (same stage after retry).",
  hintProgressed:
    "Progressed to a different stage; initial failure changed but another remains.",
  hintNoChange: "Retry did not change outcome; investigate error details.",
  hintRegression: "Regression after retry; inputs/environment likely changed for the worse.",
  hintOutcomeChanged: "Outcome changed after retry; compare stages/errors.",
  lineStatus: (prev: string, cur: string) => `Status: ${prev} → ${cur}`,
  lineStagePrevCur: (prev: string, cur: string) => `Stage(prev): ${prev} → Stage(cur): ${cur}`,
  lineStage: (stage: string) => `Stage: ${stage}`,
  lineErrorPrevCur: (prev: string, cur: string) => `Error(prev): ${prev} → Error(cur): ${cur}`,
  lineTopErrorPrevCur: (prev: string, cur: string) => `Top error(prev): ${prev} → ${cur}`,
  lineEventsError: (prev: number, cur: number) => `Events: error ${prev}→${cur}`,
  lineErrorCur: (cur: string) => `Error(cur): ${cur}`,
  lineErrorsPrevCur: (prev: string, cur: string) => `Errors: ${prev} → ${cur}`,
  suggestValidation:
    "Check PackSpec inputs/context; re-run with updated digest/links; inspect spec file path",
  suggestPath:
    "Verify target paths + ensure directories exist + check TELEGA_ROOT/mission-control paths",
  suggestPerm: "Check file permissions / running user / workspace write access",
  suggestTransient:
    "Transient runtime/I/O: retry after short pause; check local env health",
  suggestTrace: "Trace incomplete: check worker crash/logs; verify trace writing",
  suggestFallback: "Open Quick Diff + Reason Hint; inspect top error and last stage",
  singleHintDefault: "Retry may help if failure was transient.",
  singleHintValidation:
    "Likely validation/input issue (retry helps only if input/context changed).",
  singleHintTransient: "Likely transient I/O/runtime issue (retry often helps).",
} as const);

export const EXPLAIN_MSG_UZ = defineExplain({
  ...EXPLAIN_MSG_RU,
  // постепенно переведёшь значения; структура зафиксирована типами
} as const);

export function getLocaleFromEnv(): string {
  return String(process.env.TELEGA_LOCALE || "").trim().toLowerCase();
}

export function resolveLocale(raw: string): Locale {
  if (raw === "uz") return "uz";
  if (raw === "en") return "en";
  return "ru";
}

export const LOCALE: Locale = resolveLocale(getLocaleFromEnv());

const MSG_DICT = { ru: MSG_RU, en: MSG_EN, uz: MSG_UZ } as const satisfies Record<Locale, MsgShape>;
const EXPLAIN_DICT = {
  ru: EXPLAIN_MSG_RU,
  en: EXPLAIN_MSG_EN,
  uz: EXPLAIN_MSG_UZ,
} as const satisfies Record<Locale, ExplainShape>;

export const MSG = MSG_DICT[LOCALE];
export const EXPLAIN_MSG = EXPLAIN_DICT[LOCALE];

// -------------------------------
// t() helper (typed, no framework)
// ref-only for core
// -------------------------------

type Leaf = string | ((...args: any[]) => string);

export function t<V extends Leaf>(
  value: V,
  ...args: V extends (...a: infer A) => any ? A : []
): string {
  return typeof value === "function" ? (value as any)(...args) : String(value);
}

// ----------------------------------------
// Compile-time guard: keypath must NOT live here
// ----------------------------------------

type _NoKeypathExports =
  // @ts-expect-error - if these ever exist, we want a hard failure
  typeof tMsg |
  // @ts-expect-error - if these ever exist, we want a hard failure
  typeof tExplain |
  // @ts-expect-error - if these ever exist, we want a hard failure
  typeof tFrom;

// This line is never used; it just forces evaluation.
type _assert_no_keypath_in_messages_ts = _NoKeypathExports;
