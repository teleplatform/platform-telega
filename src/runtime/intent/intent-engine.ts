import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { RuntimeInput } from "../input/runtime-input.types.js";
import type { RuntimeIntent, RuntimeRiskLevel, IntentResult } from "./intent.types.js";
import { extractGoal } from "./goal-extractor.js";
import { detectRisk } from "./risk-detector.js";

export type { RuntimeIntent, RuntimeRiskLevel, IntentResult } from "./intent.types.js";

interface IntentRule {
  patterns: RegExp[];
  intent: RuntimeIntent;
  requires_execution: boolean;
  evidence_required: boolean;
  base_route: string;
}

const INTENT_RULES: IntentRule[] = [
  {
    patterns: [
      /^(build|create|make|generate|write|implement|develop)\s/i,
      /^(создай|сделай|напиши|разработай|сгенерируй)\s/i,
      /new\s+(project|app|service|module|package)/i,
      /generate\s+(project|app|codebase)/i,
      /(новый|новое|новую)\s+(проект|приложение|сервис|модуль|пакет)/i
    ],
    intent: "build_project",
    requires_execution: true,
    evidence_required: true,
    base_route: "sigma_forge",
  },
  {
    patterns: [
      /(fix|refactor|change|update|modify|add|remove|edit)\s/i,
      /(исправь|отредактируй|измени|обнови|добавь|удали|поправь)\s/i,
      /change\s+(code|file|config|function|class)/i,
      /refactor\s/i,
      /implement\s+(feature|functionality)/i,
      /(реализуй|внеси|дополни)\s+(фичу|функционал|код)/i
    ],
    intent: "modify_repo",
    requires_execution: true,
    evidence_required: true,
    base_route: "sigma_forge",
  },
  {
    patterns: [
      /research/i,
      /search\s+for/i,
      /find\s+(information|docs|docs?)/i,
      /what\s+is/i,
      /how\s+(does|to|can|do)/i,
      /explain/i,
      /investigate/i,
      /analyze\s+(the\s+)?(problem|issue|bug|crash)/i,
      /(исследуй|найди|поиск|что\s+такое|как\s+сделать|объясни|проанализируй)/i
    ],
    intent: "research",
    requires_execution: false,
    evidence_required: false,
    base_route: "provider_bridge",
  },
  {
    patterns: [/analyze\s+(this|file|code|the)/i, /review\s+(this|code|file)/i, /check\s+(this|code|file)/i, /inspect/i, /what does this code/i, /explain\s+(this|code|file)/i],
    intent: "analyze_file",
    requires_execution: false,
    evidence_required: false,
    base_route: "direct_answer",
  },
  {
    patterns: [/generate\s+(image|video|audio|media|design|icon|logo)/i, /create\s+(image|video|audio|design)/i, /make\s+(an?\s+)?(image|video|audio)/i],
    intent: "generate_media",
    requires_execution: true,
    evidence_required: false,
    base_route: "provider_bridge",
  },
  {
    patterns: [/publish/i, /deploy/i, /release/i, /submit\s+(to|app)/i, /upload/i],
    intent: "publish_content",
    requires_execution: true,
    evidence_required: true,
    base_route: "sigma_forge",
  },
  {
    patterns: [/(check|show|get|list)\s+(health|status|runtime|system|state)/i, /runtime\s+(status|health)/i, /system\s+(check|status)/i, /diagnostics?/i, /what\s+is\s+(my\s+)?(current\s+)?(state|status)/i],
    intent: "control_runtime",
    requires_execution: false,
    evidence_required: true,
    base_route: "mission_control",
  },
];

let engineCounter = 0;

export function classifyIntent(input: RuntimeInput): IntentResult {
  engineCounter++;
  const content = input.content;

  // TGR-6.59 — Intent Routing Guard
  // Prevent long text requests (reviews, explanations) from going to build_project dispatch
  const isBuildRequest = /(создай|сгенерируй|собери|напиши код|проект|api|bot|приложение|файлом|zip|build|create|make|generate|write|implement|develop)/i.test(content);
  const isLongTextRequest = /(напиши подробный обзор|расскажи|объясни|на \d+\s*символов|текст|статья|review|explain|detailed review|write a text)/i.test(content);

  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(content)) {
        let finalIntent = rule.intent;
        let finalRecommendedRoute = rule.base_route;
        let finalRequiresExecution = rule.requires_execution;

        // Apply Guard: If it looks like a long text request and NOT a clear build request
        if (finalIntent === "build_project" && isLongTextRequest && !isBuildRequest) {
          finalIntent = "chat" as any;
          finalRecommendedRoute = "direct_answer";
          finalRequiresExecution = false;
        }

        const goal = extractGoal(content, finalIntent);
        const riskLevel = detectRisk(content, finalIntent, input.surface);
        const result: IntentResult = {
          intent: finalIntent,
          confidence: 0.7 + Math.random() * 0.25,
          goal,
          risk_level: riskLevel,
          requires_execution: finalRequiresExecution,
          recommended_route: finalRecommendedRoute,
          evidence_required: rule.evidence_required,
        };

        appendEvidenceRecord({
          evidence_id: hashTraceId(input.input_id, "intent_classified"),
          trace_id: input.input_id,
          job_id: "intent",
          type: "intent_classified",
          timestamp: new Date().toISOString(),
          payload: {
            input_id: input.input_id,
            intent: result.intent,
            confidence: Math.round(result.confidence * 100) / 100,
            risk_level: result.risk_level,
            goal: result.goal.slice(0, 200),
            route: result.recommended_route,
          },
        });

        return result;
      }
    }
  }

  const result: IntentResult = {
    intent: "answer",
    confidence: 0.5,
    goal: content.length > 200 ? content.slice(0, 200) + "..." : content,
    risk_level: "low",
    requires_execution: false,
    recommended_route: "direct_answer",
    evidence_required: false,
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(input.input_id, "intent_classified"),
    trace_id: input.input_id,
    job_id: "intent",
    type: "intent_classified",
    timestamp: new Date().toISOString(),
    payload: {
      input_id: input.input_id,
      intent: result.intent,
      confidence: result.confidence,
      risk_level: result.risk_level,
      goal: result.goal.slice(0, 200),
      route: result.recommended_route,
    },
  });

  return result;
}
