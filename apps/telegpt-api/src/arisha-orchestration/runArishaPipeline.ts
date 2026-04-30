import type {
  ArishaOrchestrationState,
  ArishaPipelineRequest,
} from "./types.js";
import { createInitialState } from "./orchestrationState.js";
import { getTraceId, logWithTrace } from "./tracePropagation.js";
import { routeVoiceRequest } from "../voice/runtime/voiceRouter.js";
import { buildContextPack } from "../relevance/buildContextPack.js";
import { buildAttentionPlan } from "../attention/buildAttentionPlan.js";
import { buildRelationshipPlan } from "../relationship/buildRelationshipPlan.js";
import { buildPresencePlan } from "../presence/buildPresencePlan.js";
import { buildIntentPlan } from "../response-intent/buildIntentPlan.js";
import { buildModePlan } from "../response-mode/buildModePlan.js";
import { buildComposedResponse } from "../response-composition/buildResponse.js";
import { runQualityGate } from "../response-quality/runQualityGate.js";
import { selectSurface } from "../surface-adaptation/surfaceSelector.js";
import { runSurfaceAdaptation } from "../surface-adaptation/runSurfaceAdaptation.js";
import { buildDeliveryPolicy } from "../delivery-policy/buildDeliveryPolicy.js";
import { buildResponseTrace } from "../response-trace/buildResponseTrace.js";

export async function runArishaPipeline(
  req: ArishaPipelineRequest,
): Promise<ArishaOrchestrationState> {
  const state = createInitialState(
    req.trace_id,
    req.session_id,
    req.actor_id,
    req.actor_role,
    req.channel,
    req.raw_input,
  );

  const traceId = getTraceId(state);
  logWithTrace("Pipeline", traceId, "Starting pipeline");

  state.context_pack = buildContextPack({
    raw_input: req.raw_input,
    actor_role: req.actor_role,
    channel: req.channel,
  });

  state.attention_plan = buildAttentionPlan({
    context_pack: state.context_pack,
    raw_input: req.raw_input,
  });

  state.relationship_plan = buildRelationshipPlan({
    raw_input: req.raw_input,
    actor_role: req.actor_role,
    channel: req.channel,
    context_pack: state.context_pack,
  });

  state.presence_plan = buildPresencePlan({
    attention_plan: state.attention_plan,
    relationship_plan: state.relationship_plan,
    raw_text: req.raw_input.text,
  });

  state.intent_plan = buildIntentPlan({
    attention_plan: state.attention_plan,
    relationship_plan: state.relationship_plan,
  });

  state.mode_plan = buildModePlan({
    attention_plan: state.attention_plan,
    relationship_plan: state.relationship_plan,
    intent_plan: state.intent_plan,
  });

  const composedResponse = buildComposedResponse({
    attention_plan: state.attention_plan,
    relationship_plan: state.relationship_plan,
    presence_plan: state.presence_plan,
    intent_plan: state.intent_plan,
    mode_plan: state.mode_plan,
  });

  const qualityResult = runQualityGate({
    composed_response: composedResponse,
    attention_plan: state.attention_plan,
    relationship_plan: state.relationship_plan,
    presence_plan: state.presence_plan,
    raw_text: req.raw_input.text,
  });

  const surface = selectSurface(req.channel);
  const surfaceResult = runSurfaceAdaptation({
    final_text: qualityResult.final_text,
    surface,
    quality_result: qualityResult,
  });

  const deliveryPolicy = buildDeliveryPolicy(surface, surfaceResult.adapted_text);
  logWithTrace("DeliveryPolicy", traceId, deliveryPolicy.rationale);

  state.response_trace = buildResponseTrace({
    attention_plan: state.attention_plan,
    relationship_plan: state.relationship_plan,
    intent_plan: state.intent_plan,
    mode_plan: state.mode_plan,
    composed_response: composedResponse,
    quality_result: qualityResult,
    surface_result: surfaceResult,
    delivery_mode: deliveryPolicy.delivery_mode,
  });

  if (deliveryPolicy.voice_enabled) {
    state.voice_request = {
      provider: "omnivoice",
      mode: req.actor_role === "creator" ? "creator" : "public",
      text: surfaceResult.adapted_text,
      language: "ru",
      policy_scope:
        req.actor_role === "creator" ? "voice.creator" : "voice.public",
      fallback_allowed: true,
      render_strategy: "final_render",
      trace_id: req.trace_id,
    };

    try {
      const voiceResult = await routeVoiceRequest(
        state.voice_request,
        req.actor_role,
      );

      state.surface_reply = {
        channel: req.channel,
        text_output: voiceResult.text_output,
        audio_output: voiceResult.audio_asset_id
          ? {
              asset_id: voiceResult.audio_asset_id,
              file_path: voiceResult.audio_file_path,
              filename: voiceResult.audio_filename,
              mime: voiceResult.audio_mime,
              size_bytes: voiceResult.audio_size_bytes,
              provider: voiceResult.provider,
              duration_ms: voiceResult.duration_ms,
            }
          : undefined,
        payload_shape: deliveryPolicy.payload_shape,
        fallback_used: voiceResult.fallback_used,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown voice routing error";

      state.surface_reply = {
        channel: req.channel,
        text_output: surfaceResult.adapted_text,
        payload_shape: "text_only",
        fallback_used: true,
      };

      state.errors = [
        {
          stage: "VoiceRouting",
          message,
        },
      ];
    }
  } else {
    state.surface_reply = {
      channel: req.channel,
      text_output: surfaceResult.adapted_text,
      payload_shape: deliveryPolicy.payload_shape,
      fallback_used: false,
    };
  }

  return state;
}
