// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Built-in Language Packs
//
// Seed packs for: en, ru, uz, de, fr, es, ja
// Each pack includes all 10 required components per canonical spec:
//   manifest, understanding, intents, ux, persona, voice, validation, rollout, rollback, capability
// ─────────────────────────────────────────────────────────────

import type { LanguagePack } from "../types.js";
import { buildManifest } from "../manifest.js";
import { buildUnderstandingProfile } from "../understanding.js";
import { buildIntentMappings } from "../intents.js";
import { buildUxPack } from "../ux.js";
import { buildPersonaPack } from "../persona.js";
import { buildVoicePack } from "../voice.js";
import { buildValidationPack } from "../validation.js";
import { buildRolloutConfig } from "../rollout.js";
import { buildRollbackConfig } from "../rollout.js";
import { buildCapabilityMatrix } from "../capability.js";

// Shared minimal intent definitions (language-specific examples differ)
const COMMON_INTENTS = [
  { coreIntentId: "ask_help", examples: [], aliases: ["help", "support"], protected: false },
  { coreIntentId: "create_task", examples: [], aliases: ["build", "generate"], protected: false },
  { coreIntentId: "check_status", examples: [], aliases: ["status", "progress"], protected: false },
  { coreIntentId: "cancel_action", examples: [], aliases: ["stop", "abort"], protected: true },
  { coreIntentId: "confirm_action", examples: [], aliases: ["yes", "confirm"], protected: true },
];

// ── English (en) — Reference pack, Tier 1, Production ──
export const enPack: LanguagePack = {
  languageCode: "en",
  version: "1.0.0",
  status: "production",
  manifest: buildManifest({
    languageCode: "en",
    languageName: "English",
    nativeName: "English",
    tier: "tier1",
    supportedSurfaces: ["web", "tgm", "telegram", "voice", "operator"],
    notes: ["Reference language pack", "Full voice support via alice_bridge"],
  }),
  understanding: buildUnderstandingProfile({
    intentMappingsVersion: "v1",
    entityBehavior: "strict",
    ambiguityPolicy: "clarify",
    protectedIntentHandling: "deny_or_clarify",
    localeHints: ["en-US", "en-GB"],
  }),
  intents: buildIntentMappings({
    version: "v1",
    intents: COMMON_INTENTS.map((i) => ({
      ...i,
      examples: i.coreIntentId === "ask_help"
        ? ["Help me", "I need assistance", "Can you help?"]
        : i.coreIntentId === "create_task"
          ? ["Create a task", "Build something", "Generate content"]
          : i.coreIntentId === "check_status"
            ? ["What's the status?", "How's it going?", "Check progress"]
            : i.coreIntentId === "cancel_action"
              ? ["Stop", "Cancel", "Abort"]
              : ["Yes", "Confirmed", "Go ahead"],
    })),
  }),
  ux: buildUxPack({
    greetings: { default: "Hello!", formal: "Good day!", casual: "Hey!" },
    confirmations: { yes: "Yes, confirmed.", done: "Done." },
    clarifications: {
      uncertain_intent: "I'm not sure I understood correctly. Could you rephrase?",
      uncertain_entity: "Could you provide more details?",
    },
    help: { default: "How can I help you?", detailed: "What would you like to do?" },
    errors: {
      default: "Something went wrong.",
      voice_not_ready: "Voice is not available for this language. Responding in text.",
      protected_action_fallback: "For safety, I need to respond in English for this action.",
      surface_not_ready: "This feature is not available yet.",
    },
    delivery: { sending: "Sending...", delivered: "Delivered." },
    taskStatus: { queued: "Queued", running: "Running", done: "Complete", blocked: "Blocked" },
    blocked: {
      default: "This action is currently blocked.",
      reason_required: "I can't proceed without more information.",
    },
    safeFailure: {
      default: "I couldn't complete that safely. Let me try another way.",
      clarification: "Let me clarify what happened before we proceed.",
    },
  }),
  persona: buildPersonaPack({
    personaId: "arisha",
    toneClassByMode: {
      creator: "collaborative",
      user: "helpful",
      neutral: "professional",
    },
    consistencyNotes: ["One Arisha across all languages"],
  }),
  voice: buildVoicePack({
    textReady: true,
    voiceReady: true,
    preferredVoiceSurface: "alice_bridge",
    fallbackToText: true,
    voiceNotes: ["Primary voice surface: alice_bridge", "Natural cadence, warm tone"],
  }),
  validation: buildValidationPack({
    requiredTests: [
      "intent_understanding_tests",
      "entity_handling_tests",
      "safe_fallback_tests",
      "protected_action_tests",
      "persona_consistency_checks",
      "surface_compatibility_checks",
      "rollout_rollback_checks",
    ],
    personaConsistencyChecks: ["persona_id_match", "tone_class_presence"],
    protectedIntentChecks: ["deny_or_clarify_check"],
    fallbackChecks: ["english_fallback_available"],
    surfaceChecks: ["web_full", "tgm_full", "telegram_full", "voice_full", "operator_full"],
  }),
  rollout: buildRolloutConfig({
    featureFlag: "lang_en",
    enabledSurfaces: ["web", "tgm", "telegram", "voice", "operator"],
    enabledRoles: ["creator", "operator", "user"],
    rolloutStage: "production",
  }),
  rollback: buildRollbackConfig({
    instantDisable: true,
    disableBySurface: true,
    disableByRole: true,
    fallbackLanguage: "en",
    rollbackNotes: ["Instant rollback to English core responses"],
  }),
  capability: buildCapabilityMatrix({
    web: "full",
    tgm: "full",
    telegram: "full",
    voice: "full",
    operator: "full",
    safeActions: true,
    protectedActions: true,
  }),
};

// ── Russian (ru) — Tier 1, Production ──
export const ruPack: LanguagePack = {
  languageCode: "ru",
  version: "1.0.0",
  status: "production",
  manifest: buildManifest({
    languageCode: "ru",
    languageName: "Russian",
    nativeName: "Русский",
    tier: "tier1",
    supportedSurfaces: ["web", "tgm", "telegram", "voice", "operator"],
    notes: ["Одна Ариша на всех языках", "Полная поддержка голоса через alice_bridge"],
  }),
  understanding: buildUnderstandingProfile({
    intentMappingsVersion: "v1",
    entityBehavior: "strict",
    ambiguityPolicy: "clarify",
    protectedIntentHandling: "deny_or_clarify",
    localeHints: ["ru-RU"],
  }),
  intents: buildIntentMappings({
    version: "v1",
    intents: COMMON_INTENTS.map((i) => ({
      ...i,
      examples: i.coreIntentId === "ask_help"
        ? ["Помоги мне", "Мне нужна помощь", "Можешь помочь?"]
        : i.coreIntentId === "create_task"
          ? ["Создай задачу", "Сделай что-нибудь", "Создай контент"]
          : i.coreIntentId === "check_status"
            ? ["Какой статус?", "Как дела?", "Проверь прогресс"]
            : i.coreIntentId === "cancel_action"
              ? ["Стоп", "Отмени", "Прекрати"]
              : ["Да", "Подтверждено", "Давай"],
    })),
  }),
  ux: buildUxPack({
    greetings: { default: "Привет!", formal: "Здравствуйте!", casual: "Привет!" },
    confirmations: { yes: "Да, подтверждено.", done: "Готово." },
    clarifications: {
      uncertain_intent: "Я не совсем поняла. Не могли бы вы переформулировать?",
      uncertain_entity: "Не могли бы вы уточнить детали?",
    },
    help: { default: "Чем могу помочь?", detailed: "Что бы вы хотели сделать?" },
    errors: {
      default: "Что-то пошло не так.",
      voice_not_ready: "Голос недоступен для этого языка. Отвечаю текстом.",
      protected_action_fallback: "Для безопасности мне нужно ответить на английском для этого действия.",
      surface_not_ready: "Эта функция пока недоступна.",
    },
    delivery: { sending: "Отправляю...", delivered: "Доставлено." },
    taskStatus: { queued: "В очереди", running: "Выполняется", done: "Завершено", blocked: "Заблокировано" },
    blocked: {
      default: "Это действие сейчас заблокировано.",
      reason_required: "Я не могу продолжить без дополнительной информации.",
    },
    safeFailure: {
      default: "Я не смогла завершить это безопасно. Давайте попробую иначе.",
      clarification: "Позвольте уточнить, что произошло, прежде чем мы продолжим.",
    },
  }),
  persona: buildPersonaPack({
    personaId: "arisha",
    toneClassByMode: {
      creator: "сотрудничающий",
      user: "помогающий",
      neutral: "профессиональный",
    },
    consistencyNotes: ["Одна Ариша на всех языках"],
  }),
  voice: buildVoicePack({
    textReady: true,
    voiceReady: true,
    preferredVoiceSurface: "alice_bridge",
    fallbackToText: true,
    voiceNotes: ["Основная голосовая поверхность: alice_bridge", "Естественный темп, тёплый тон"],
  }),
  validation: buildValidationPack({
    requiredTests: [
      "intent_understanding_tests",
      "entity_handling_tests",
      "safe_fallback_tests",
      "protected_action_tests",
      "persona_consistency_checks",
      "surface_compatibility_checks",
      "rollout_rollback_checks",
    ],
    personaConsistencyChecks: ["persona_id_match", "tone_class_presence"],
    protectedIntentChecks: ["deny_or_clarify_check"],
    fallbackChecks: ["english_fallback_available"],
    surfaceChecks: ["web_full", "tgm_full", "telegram_full", "voice_full", "operator_full"],
  }),
  rollout: buildRolloutConfig({
    featureFlag: "lang_ru",
    enabledSurfaces: ["web", "tgm", "telegram", "voice", "operator"],
    enabledRoles: ["creator", "operator", "user"],
    rolloutStage: "production",
  }),
  rollback: buildRollbackConfig({
    instantDisable: true,
    disableBySurface: true,
    disableByRole: true,
    fallbackLanguage: "en",
    rollbackNotes: ["Мгновенный откат к английским ответам ядра"],
  }),
  capability: buildCapabilityMatrix({
    web: "full",
    tgm: "full",
    telegram: "full",
    voice: "full",
    operator: "full",
    safeActions: true,
    protectedActions: true,
  }),
};

// ── Uzbek (uz) — Tier 2, Limited Rollout ──
export const uzPack: LanguagePack = {
  languageCode: "uz",
  version: "1.0.0",
  status: "limited_rollout",
  manifest: buildManifest({
    languageCode: "uz",
    languageName: "Uzbek",
    nativeName: "Oʻzbekcha",
    tier: "tier2",
    supportedSurfaces: ["web", "telegram", "operator"],
    notes: ["Bitta Arisha barcha tillarda"],
  }),
  understanding: buildUnderstandingProfile({
    intentMappingsVersion: "v1",
    entityBehavior: "moderate",
    ambiguityPolicy: "safe_fallback",
    protectedIntentHandling: "deny_or_clarify",
    localeHints: ["uz-UZ"],
  }),
  intents: buildIntentMappings({
    version: "v1",
    intents: COMMON_INTENTS.map((i) => ({
      ...i,
      examples: i.coreIntentId === "ask_help"
        ? ["Menga yordam bering", "Yordam kerak", "Yordam bera olasizmi?"]
        : i.coreIntentId === "create_task"
          ? ["Vazifa yarating", "Biror narsa yarating", "Kontent yarating"]
          : i.coreIntentId === "check_status"
            ? ["Holat qanday?", "Qanday ketmoqda?", "Jarayonni tekshiring"]
            : i.coreIntentId === "cancel_action"
              ? ["To'xtat", "Bekor qil", "Bekor qilish"]
              : ["Ha", "Tasdiqlandi", "Davom eting"],
    })),
  }),
  ux: buildUxPack({
    greetings: { default: "Salom!", formal: "Assalomu alaykum!", casual: "Salom!" },
    confirmations: { yes: "Ha, tasdiqlandi.", done: "Bajarildi." },
    clarifications: {
      uncertain_intent: "Men to'g'ri tushunmadim. Qayta aytib berasizmi?",
      uncertain_entity: "Batafsilroq ayta olasizmi?",
    },
    help: { default: "Qanday yordam bera olaman?", detailed: "Nima qilmoqchisiz?" },
    errors: {
      default: "Nimadir xato ketdi.",
      voice_not_ready: "Bu til uchun ovoz mavjud emas. Matn bilan javob beraman.",
      protected_action_fallback: "Xavfsizlik uchun bu harakatga ingliz tilida javob berishim kerak.",
      surface_not_ready: "Bu hali hali ishga tushirilmagan.",
    },
    delivery: { sending: "Yuborilyapti...", delivered: "Yetkazildi." },
    taskStatus: { queued: "Navbatda", running: "Bajarilmoqda", done: "Tugallandi", blocked: "Bloklangan" },
    blocked: {
      default: "Bu amal hozir bloklangan.",
      reason_required: "Qo'shimcha ma'lumotlarsiz davom eta olmayman.",
    },
    safeFailure: {
      default: "Buni xavfsiz tugallay olmadim. Boshqa yo'l bilan urinay.",
      clarification: "Davom etishdan oldin nima bo'lganini aniqlashtiray.",
    },
  }),
  persona: buildPersonaPack({
    personaId: "arisha",
    toneClassByMode: {
      creator: "hamkorlik",
      user: "yordamchi",
      neutral: "professional",
    },
    consistencyNotes: ["Bitta Arisha barcha tillarda"],
  }),
  validation: buildValidationPack({
    requiredTests: [
      "intent_understanding_tests",
      "entity_handling_tests",
      "safe_fallback_tests",
      "protected_action_tests",
      "persona_consistency_checks",
      "surface_compatibility_checks",
      "rollout_rollback_checks",
    ],
    personaConsistencyChecks: ["persona_id_match", "tone_class_presence"],
    protectedIntentChecks: ["deny_or_clarify_check"],
    fallbackChecks: ["english_fallback_available"],
    surfaceChecks: ["web_full", "telegram_text_ready", "operator_text_ready"],
  }),
  rollout: buildRolloutConfig({
    featureFlag: "lang_uz",
    enabledSurfaces: ["web", "telegram", "operator"],
    enabledRoles: ["creator", "operator"],
    rolloutStage: "limited_users",
  }),
  rollback: buildRollbackConfig({
    instantDisable: true,
    disableBySurface: true,
    disableByRole: true,
    fallbackLanguage: "en",
    rollbackNotes: ["Ingliz tiliga qaytish"],
  }),
  capability: buildCapabilityMatrix({
    web: "full",
    tgm: "none",
    telegram: "text_ready",
    voice: "none",
    operator: "text_ready",
    safeActions: true,
    protectedActions: false,
  }),
};

// ── German (de) — Tier 2, Localized ──
export const dePack: LanguagePack = {
  languageCode: "de",
  version: "1.0.0",
  status: "localized",
  manifest: buildManifest({
    languageCode: "de",
    languageName: "German",
    nativeName: "Deutsch",
    tier: "tier2",
    supportedSurfaces: ["web", "operator"],
    notes: ["Eine Arisha über alle Sprachen hinweg"],
  }),
  understanding: buildUnderstandingProfile({
    intentMappingsVersion: "v1",
    entityBehavior: "moderate",
    ambiguityPolicy: "clarify",
    protectedIntentHandling: "deny_or_clarify",
    localeHints: ["de-DE", "de-AT", "de-CH"],
  }),
  intents: buildIntentMappings({
    version: "v1",
    intents: COMMON_INTENTS.map((i) => ({
      ...i,
      examples: i.coreIntentId === "ask_help"
        ? ["Hilf mir", "Ich brauche Hilfe", "Können Sie mir helfen?"]
        : i.coreIntentId === "create_task"
          ? ["Erstelle eine Aufgabe", "Baue etwas", "Generiere Inhalt"]
          : i.coreIntentId === "check_status"
            ? ["Was ist der Status?", "Wie läuft es?", "Fortschritt prüfen"]
            : i.coreIntentId === "cancel_action"
              ? ["Stopp", "Abbrechen", "Abbrechen"]
              : ["Ja", "Bestätigt", "Los"],
    })),
  }),
  ux: buildUxPack({
    greetings: { default: "Hallo!", formal: "Guten Tag!", casual: "Hey!" },
    confirmations: { yes: "Ja, bestätigt.", done: "Erledigt." },
    clarifications: {
      uncertain_intent: "Ich bin mir nicht sicher, ob ich das richtig verstanden habe. Könnten Sie es umformulieren?",
      uncertain_entity: "Könnten Sie mehr Details angeben?",
    },
    help: { default: "Wie kann ich Ihnen helfen?", detailed: "Was möchten Sie tun?" },
    errors: {
      default: "Etwas ist schiefgelaufen.",
      voice_not_ready: "Stimme ist für diese Sprache nicht verfügbar. Antworte in Text.",
      protected_action_fallback: "Aus Sicherheitsgründen muss ich für diese Aktion auf Englisch antworten.",
      surface_not_ready: "Diese Funktion ist noch nicht verfügbar.",
    },
    delivery: { sending: "Senden...", delivered: "Zugestellt." },
    taskStatus: { queued: "In Warteschlange", running: "Läuft", done: "Abgeschlossen", blocked: "Blockiert" },
    blocked: {
      default: "Diese Aktion ist derzeit blockiert.",
      reason_required: "Ich kann ohne weitere Informationen nicht fortfahren.",
    },
    safeFailure: {
      default: "Ich konnte das nicht sicher abschließen. Lass mich es anders versuchen.",
      clarification: "Lass mich klären, was passiert ist, bevor wir fortfahren.",
    },
  }),
  persona: buildPersonaPack({
    personaId: "arisha",
    toneClassByMode: {
      creator: "kooperativ",
      user: "hilfsbereit",
      neutral: "professionell",
    },
    consistencyNotes: ["Eine Arisha über alle Sprachen hinweg"],
  }),
  validation: buildValidationPack({
    requiredTests: [
      "intent_understanding_tests",
      "entity_handling_tests",
      "safe_fallback_tests",
      "protected_action_tests",
      "persona_consistency_checks",
      "surface_compatibility_checks",
      "rollout_rollback_checks",
    ],
    personaConsistencyChecks: ["persona_id_match", "tone_class_presence"],
    protectedIntentChecks: ["deny_or_clarify_check"],
    fallbackChecks: ["english_fallback_available"],
    surfaceChecks: ["web_text_ready", "operator_text_ready"],
  }),
  rollout: buildRolloutConfig({
    featureFlag: "lang_de",
    enabledSurfaces: ["web", "operator"],
    enabledRoles: ["creator"],
    rolloutStage: "internal",
  }),
  rollback: buildRollbackConfig({
    instantDisable: true,
    disableBySurface: true,
    disableByRole: true,
    fallbackLanguage: "en",
    rollbackNotes: ["Sofortiger Rollback zu Englisch"],
  }),
  capability: buildCapabilityMatrix({
    web: "text_ready",
    tgm: "none",
    telegram: "none",
    voice: "none",
    operator: "text_ready",
    safeActions: true,
    protectedActions: false,
  }),
};

// ── French (fr) — Tier 2, Localized ──
export const frPack: LanguagePack = {
  languageCode: "fr",
  version: "1.0.0",
  status: "localized",
  manifest: buildManifest({
    languageCode: "fr",
    languageName: "French",
    nativeName: "Français",
    tier: "tier2",
    supportedSurfaces: ["web", "operator"],
    notes: ["Une seule Arisha pour toutes les langues"],
  }),
  understanding: buildUnderstandingProfile({
    intentMappingsVersion: "v1",
    entityBehavior: "moderate",
    ambiguityPolicy: "clarify",
    protectedIntentHandling: "deny_or_clarify",
    localeHints: ["fr-FR", "fr-CA"],
  }),
  intents: buildIntentMappings({
    version: "v1",
    intents: COMMON_INTENTS.map((i) => ({
      ...i,
      examples: i.coreIntentId === "ask_help"
        ? ["Aidez-moi", "J'ai besoin d'aide", "Pouvez-vous m'aider ?"]
        : i.coreIntentId === "create_task"
          ? ["Crée une tâche", "Construis quelque chose", "Génère du contenu"]
          : i.coreIntentId === "check_status"
            ? ["Quel est le statut ?", "Comment ça se passe ?", "Vérifie la progression"]
            : i.coreIntentId === "cancel_action"
              ? ["Arrête", "Annule", "Abandonne"]
              : ["Oui", "Confirmé", "Vas-y"],
    })),
  }),
  ux: buildUxPack({
    greetings: { default: "Bonjour !", formal: "Bonjour !", casual: "Salut !" },
    confirmations: { yes: "Oui, confirmé.", done: "Terminé." },
    clarifications: {
      uncertain_intent: "Je ne suis pas sûre d'avoir bien compris. Pouvez-vous reformuler ?",
      uncertain_entity: "Pouvez-vous préciser ?",
    },
    help: { default: "Comment puis-je vous aider ?", detailed: "Que souhaitez-vous faire ?" },
    errors: {
      default: "Quelque chose s'est mal passé.",
      voice_not_ready: "La voix n'est pas disponible pour cette langue. Réponse en texte.",
      protected_action_fallback: "Pour des raisons de sécurité, je dois répondre en anglais pour cette action.",
      surface_not_ready: "Cette fonctionnalité n'est pas encore disponible.",
    },
    delivery: { sending: "Envoi...", delivered: "Livré." },
    taskStatus: { queued: "En file d'attente", running: "En cours", done: "Terminé", blocked: "Bloqué" },
    blocked: {
      default: "Cette action est actuellement bloquée.",
      reason_required: "Je ne peux pas continuer sans plus d'informations.",
    },
    safeFailure: {
      default: "Je n'ai pas pu terminer cela en toute sécurité. Essayons autrement.",
      clarification: "Permettez-moi de clarifier ce qui s'est passé avant de continuer.",
    },
  }),
  persona: buildPersonaPack({
    personaId: "arisha",
    toneClassByMode: {
      creator: "collaboratif",
      user: "serviable",
      neutral: "professionnel",
    },
    consistencyNotes: ["Une seule Arisha pour toutes les langues"],
  }),
  validation: buildValidationPack({
    requiredTests: [
      "intent_understanding_tests",
      "entity_handling_tests",
      "safe_fallback_tests",
      "protected_action_tests",
      "persona_consistency_checks",
      "surface_compatibility_checks",
      "rollout_rollback_checks",
    ],
    personaConsistencyChecks: ["persona_id_match", "tone_class_presence"],
    protectedIntentChecks: ["deny_or_clarify_check"],
    fallbackChecks: ["english_fallback_available"],
    surfaceChecks: ["web_text_ready", "operator_text_ready"],
  }),
  rollout: buildRolloutConfig({
    featureFlag: "lang_fr",
    enabledSurfaces: ["web", "operator"],
    enabledRoles: ["creator"],
    rolloutStage: "internal",
  }),
  rollback: buildRollbackConfig({
    instantDisable: true,
    disableBySurface: true,
    disableByRole: true,
    fallbackLanguage: "en",
    rollbackNotes: ["Retour instantané à l'anglais"],
  }),
  capability: buildCapabilityMatrix({
    web: "text_ready",
    tgm: "none",
    telegram: "none",
    voice: "none",
    operator: "text_ready",
    safeActions: true,
    protectedActions: false,
  }),
};

// ── Spanish (es) — Tier 3, Understanding Ready ──
export const esPack: LanguagePack = {
  languageCode: "es",
  version: "1.0.0",
  status: "understanding_ready",
  manifest: buildManifest({
    languageCode: "es",
    languageName: "Spanish",
    nativeName: "Español",
    tier: "tier3",
    supportedSurfaces: ["web", "operator"],
    notes: ["Una sola Arisha en todos los idiomas"],
  }),
  understanding: buildUnderstandingProfile({
    intentMappingsVersion: "v1",
    entityBehavior: "limited",
    ambiguityPolicy: "safe_fallback",
    protectedIntentHandling: "deny_or_clarify",
    localeHints: ["es-ES", "es-MX", "es-AR"],
  }),
  intents: buildIntentMappings({
    version: "v1",
    intents: COMMON_INTENTS.map((i) => ({
      ...i,
      examples: i.coreIntentId === "ask_help"
        ? ["Ayúdame", "Necesito ayuda", "¿Puedes ayudarme?"]
        : i.coreIntentId === "create_task"
          ? ["Crea una tarea", "Construye algo", "Genera contenido"]
          : i.coreIntentId === "check_status"
            ? ["¿Cuál es el estado?", "¿Cómo va?", "Verifica el progreso"]
            : i.coreIntentId === "cancel_action"
              ? ["Para", "Cancela", "Aborta"]
              : ["Sí", "Confirmado", "Adelante"],
    })),
  }),
  ux: buildUxPack({
    greetings: { default: "¡Hola!", formal: "¡Buenos días!", casual: "¡Hola!" },
    confirmations: { yes: "Sí, confirmado.", done: "Hecho." },
    clarifications: {
      uncertain_intent: "No estoy segura de haber entendido bien. ¿Podrías reformular?",
      uncertain_entity: "¿Podrías dar más detalles?",
    },
    help: { default: "¿En qué puedo ayudarte?", detailed: "¿Qué te gustaría hacer?" },
    errors: {
      default: "Algo salió mal.",
      voice_not_ready: "La voz no está disponible para este idioma. Respondiendo en texto.",
      protected_action_fallback: "Por seguridad, necesito responder en inglés para esta acción.",
      surface_not_ready: "Esta función aún no está disponible.",
    },
    delivery: { sending: "Enviando...", delivered: "Entregado." },
    taskStatus: { queued: "En cola", running: "En ejecución", done: "Completado", blocked: "Bloqueado" },
    blocked: {
      default: "Esta acción está actualmente bloqueada.",
      reason_required: "No puedo continuar sin más información.",
    },
    safeFailure: {
      default: "No pude completar eso de forma segura. Intentemos de otra manera.",
      clarification: "Permíteme aclarar qué pasó antes de continuar.",
    },
  }),
  persona: buildPersonaPack({
    personaId: "arisha",
    toneClassByMode: {
      creator: "colaborativo",
      user: "servicial",
      neutral: "profesional",
    },
    consistencyNotes: ["Una sola Arisha en todos los idiomas"],
  }),
  validation: buildValidationPack({
    requiredTests: [
      "intent_understanding_tests",
      "entity_handling_tests",
      "safe_fallback_tests",
      "protected_action_tests",
      "persona_consistency_checks",
      "surface_compatibility_checks",
      "rollout_rollback_checks",
    ],
    personaConsistencyChecks: ["persona_id_match", "tone_class_presence"],
    protectedIntentChecks: ["deny_or_clarify_check"],
    fallbackChecks: ["english_fallback_available"],
    surfaceChecks: ["web_text_ready"],
  }),
  rollout: buildRolloutConfig({
    featureFlag: "lang_es",
    enabledSurfaces: ["web"],
    enabledRoles: ["creator"],
    rolloutStage: "off",
  }),
  rollback: buildRollbackConfig({
    instantDisable: true,
    disableBySurface: true,
    disableByRole: true,
    fallbackLanguage: "en",
    rollbackNotes: ["Desactivación instantánea a inglés"],
  }),
  capability: buildCapabilityMatrix({
    web: "text_ready",
    tgm: "none",
    telegram: "none",
    voice: "none",
    operator: "none",
    safeActions: true,
    protectedActions: false,
  }),
};

// ── Japanese (ja) — Tier 3, Declared ──
export const jaPack: LanguagePack = {
  languageCode: "ja",
  version: "1.0.0",
  status: "declared",
  manifest: buildManifest({
    languageCode: "ja",
    languageName: "Japanese",
    nativeName: "日本語",
    tier: "tier3",
    supportedSurfaces: ["web"],
    notes: ["すべての言語で一人のアリーシャ"],
  }),
  understanding: buildUnderstandingProfile({
    intentMappingsVersion: "v1",
    entityBehavior: "limited",
    ambiguityPolicy: "safe_fallback",
    protectedIntentHandling: "deny_or_clarify",
    localeHints: ["ja-JP"],
  }),
  intents: buildIntentMappings({
    version: "v1",
    intents: COMMON_INTENTS.map((i) => ({
      ...i,
      examples: i.coreIntentId === "ask_help"
        ? ["助けて", "助けが必要", "手伝ってもらえますか？"]
        : i.coreIntentId === "create_task"
          ? ["タスクを作成", "何か作って", "コンテンツを生成"]
          : i.coreIntentId === "check_status"
            ? ["ステータスは？", "どうなってる？", "進捗を確認"]
            : i.coreIntentId === "cancel_action"
              ? ["止めて", "キャンセル", "中止"]
              : ["はい", "確認", "どうぞ"],
    })),
  }),
  ux: buildUxPack({
    greetings: { default: "こんにちは！", formal: "はじめまして！", casual: "やあ！" },
    confirmations: { yes: "はい、確認しました。", done: "完了しました。" },
    clarifications: {
      uncertain_intent: "うまく理解できませんでした。言い換えていただけますか？",
      uncertain_entity: "詳しく教えていただけますか？",
    },
    help: { default: "どうお手伝いしましょうか？", detailed: "何をなさりたいですか？" },
    errors: {
      default: "エラーが発生しました。",
      voice_not_ready: "この言語では音声をご利用できません。テキストで返信します。",
      protected_action_fallback: "安全のため、このアクションは英語で返信する必要があります。",
      surface_not_ready: "この機能はまだご利用いただけません。",
    },
    delivery: { sending: "送信中...", delivered: "配信済み。" },
    taskStatus: { queued: "キューイング中", running: "実行中", done: "完了", blocked: "ブロック済み" },
    blocked: {
      default: "このアクションは現在ブロックされています。",
      reason_required: "詳しい情報なしには続行できません。",
    },
    safeFailure: {
      default: "安全に完了できませんでした。別の方法で試します。",
      clarification: "続ける前に何が起こったか確認させてください。",
    },
  }),
  persona: buildPersonaPack({
    personaId: "arisha",
    toneClassByMode: {
      creator: "協力的",
      user: "親しみやすい",
      neutral: "丁寧",
    },
    consistencyNotes: ["すべての言語で一人のアリーシャ"],
  }),
  validation: buildValidationPack({
    requiredTests: [
      "intent_understanding_tests",
      "entity_handling_tests",
      "safe_fallback_tests",
      "protected_action_tests",
      "persona_consistency_checks",
      "surface_compatibility_checks",
      "rollout_rollback_checks",
    ],
    personaConsistencyChecks: ["persona_id_match", "tone_class_presence"],
    protectedIntentChecks: ["deny_or_clarify_check"],
    fallbackChecks: ["english_fallback_available"],
    surfaceChecks: ["web_text_ready"],
  }),
  rollout: buildRolloutConfig({
    featureFlag: "lang_ja",
    enabledSurfaces: ["web"],
    enabledRoles: ["creator"],
    rolloutStage: "off",
  }),
  rollback: buildRollbackConfig({
    instantDisable: true,
    disableBySurface: true,
    disableByRole: true,
    fallbackLanguage: "en",
    rollbackNotes: ["英語への即時フォールバック"],
  }),
  capability: buildCapabilityMatrix({
    web: "text_ready",
    tgm: "none",
    telegram: "none",
    voice: "none",
    operator: "none",
    safeActions: true,
    protectedActions: false,
  }),
};
