import { appendEvidenceRecord } from "../../evidence/execution-evidence-store.js";
import { hashTraceId } from "../../evidence/execution-hash.js";
import { NoopBrowserSession } from "./creator-browser-session.js";
import { WebExtractionEngine } from "./web-extraction-engine.js";
import { WebBridgeValidator } from "./web-bridge-validator.js";
import { OpenaiWebAdapter } from "./adapters/openai-web.adapter.js";
import { QwenWebAdapter } from "./adapters/qwen-web.adapter.js";
import { DeepseekWebAdapter } from "./adapters/deepseek-web.adapter.js";
import { StreamingOutputObserver } from "../../delivery/streaming-output-observer.js";
import { BotOutputRelay } from "../../delivery/bot-output-relay.js";
import { OutputBuffer } from "../../delivery/output-buffer.js";
import { LongRunningTaskWatchdog } from "../../delivery/long-running-task-watchdog.js";
import type { CreatorWebBridgeRequest, CreatorWebBridgeResult, CreatorWebBridgeStatus, CreatorWebBridgeRelayInfo } from "./creator-web-bridge.types.js";

const ADAPTER_MAP: Record<string, OpenaiWebAdapter | QwenWebAdapter | DeepseekWebAdapter> = {
  "openai:web": new OpenaiWebAdapter(),
  "qwen:web": new QwenWebAdapter(),
  "deepseek:web": new DeepseekWebAdapter(),
};

export class CreatorWebBridge {
  readonly extractor = new WebExtractionEngine();
  readonly validator = new WebBridgeValidator();
  readonly outputBuffer = new OutputBuffer();
  readonly watchdog = new LongRunningTaskWatchdog();
  readonly observer = new StreamingOutputObserver(this.outputBuffer, this.watchdog);
  relay: BotOutputRelay | null = null;

  initRelay(onSendChunk: (chunk: any) => Promise<boolean>, onSendHeartbeat?: (session: any, pending: any[]) => Promise<void>): void {
    this.relay = new BotOutputRelay(onSendChunk, onSendHeartbeat);
  }

  async execute(req: CreatorWebBridgeRequest): Promise<CreatorWebBridgeResult> {
    const validation = this.validator.validateRequest(req);
    if (!validation.valid) {
      return this.fail(req.provider_id, validation.reason ?? "Validation failed");
    }

    await appendEvidenceRecord({
      evidence_id: hashTraceId(req.trace_id, "creator_web_bridge_started"),
      trace_id: req.trace_id,
      job_id: "provider",
      type: "creator_web_bridge_started" as any,
      timestamp: new Date().toISOString(),
      payload: { provider_id: req.provider_id, prompt_length: req.prompt.length },
    });

    const adapter = ADAPTER_MAP[req.provider_id];
    if (!adapter) {
      return this.fail(req.provider_id, `No adapter for provider '${req.provider_id}'`);
    }

    const session = new NoopBrowserSession();

    try {
      await appendEvidenceRecord({
        evidence_id: hashTraceId(req.trace_id, "creator_web_session_opened"),
        trace_id: req.trace_id,
        job_id: "provider",
        type: "creator_web_session_opened" as any,
        timestamp: new Date().toISOString(),
        payload: { provider_id: req.provider_id, session_id: session.session_id },
      });

      await adapter.open(session);
      await adapter.ensureReady(session);

      await appendEvidenceRecord({
        evidence_id: hashTraceId(req.trace_id, "creator_web_prompt_submitted"),
        trace_id: req.trace_id,
        job_id: "provider",
        type: "creator_web_prompt_submitted" as any,
        timestamp: new Date().toISOString(),
        payload: { provider_id: req.provider_id, prompt_length: req.prompt.length },
      });

      await adapter.submitPrompt(session, req.prompt);

      let rawText: string;
      let relayInfo: CreatorWebBridgeRelayInfo | undefined;

      if (req.options.relay && this.relay) {
        const relayId = `relay_${req.trace_id}`;
        const relaySession = this.observer.createSession(relayId, req.run_id, req.trace_id, req.provider_id, session.session_id, "text");
        this.observer.startPolling(relayId);

        const pollFn = async () => {
          const current = await adapter.extract(session);
          this.outputBuffer.append(relayId, current);
          return current;
        };
        this.observer["pollFn"] = pollFn;

        const idleLimit = req.options.max_wait_ms > 0 ? Math.min(req.options.max_wait_ms, 300_000) : 300_000;
        this.watchdog.getConfig().idle_timeout_text_ms = idleLimit;

        const pollInterval = 2000;
        const maxPolls = Math.ceil((req.options.max_wait_ms || idleLimit) / pollInterval) + 10;

        let prevText = "";
        for (let i = 0; i < maxPolls; i++) {
          await pollFn();
          const fullText = this.outputBuffer.getFullText(relayId);
          const tail = fullText.length > prevText.length ? fullText.slice(prevText.length) : "";
          prevText = fullText;
          req.options.onStreamUpdate?.(tail, fullText);

          const check = this.watchdog.check(relayId, "text");
          if (check.shouldStop) {
            relaySession.status = check.reason === "hard_timeout" ? "failed" : "partial";
            break;
          }
          const sessionCheck = this.observer.getSession(relayId)!;
          const idleElapsed = Date.now() - new Date(sessionCheck.timestamps.last_change_at).getTime();
          if (idleElapsed >= idleLimit && this.outputBuffer.getCharCount(relayId) > 0) {
            relaySession.status = "partial";
            break;
          }
          await new Promise((r) => setTimeout(r, pollInterval));
        }

        this.observer.stopPolling(relayId);
        rawText = this.outputBuffer.getFullText(relayId);
        this.observer.completeSession(relayId);

        if (rawText && this.relay) {
          this.relay.prepareChunks(relayId, rawText);
          const chunks = this.relay.getChunks(relayId);
          relayInfo = {
            relay_id: relayId,
            chars_seen: rawText.length,
            chars_delivered: chunks.filter((c) => c.delivered).reduce((s, c) => s + c.chars, 0),
            chunks_delivered: chunks.filter((c) => c.delivered).length,
          };
        }
      } else {
        await adapter.waitForCompletion(session, req.options.max_wait_ms);
        rawText = await adapter.extract(session);
        if (rawText && req.options.onStreamUpdate) {
          req.options.onStreamUpdate(rawText, rawText);
        }
      }
      const codeBlocks = req.options.preserve_code_blocks ? this.extractor.extractCodeBlocks(rawText) : [];
      const cleanText = req.options.preserve_code_blocks ? rawText : this.extractor.stripCodeBlocks(rawText);

      await appendEvidenceRecord({
        evidence_id: hashTraceId(req.trace_id, "creator_web_output_extracted"),
        trace_id: req.trace_id,
        job_id: "provider",
        type: "creator_web_output_extracted" as any,
        timestamp: new Date().toISOString(),
        payload: { provider_id: req.provider_id, output_length: rawText.length, code_blocks: codeBlocks.length },
      });

      const result: CreatorWebBridgeResult = {
        provider_id: req.provider_id,
        status: relayInfo ? (rawText ? "done" : "partial") : "done",
        output: { text: cleanText, markdown: cleanText, code_blocks: codeBlocks },
        evidence: {
          session_id: session.session_id,
          url: adapter.urls.chat,
          extraction_method: "dom",
        },
        relay: relayInfo,
      };

      await appendEvidenceRecord({
        evidence_id: hashTraceId(req.trace_id, "creator_web_bridge_completed"),
        trace_id: req.trace_id,
        job_id: "provider",
        type: "creator_web_bridge_completed" as any,
        timestamp: new Date().toISOString(),
        payload: { provider_id: req.provider_id, status: result.status },
      });

      return result;
    } catch (e: any) {
      const status = this.mapErrorToStatus(e);
      const result = this.fail(req.provider_id, e?.message ?? "Unknown error", status);
      await appendEvidenceRecord({
        evidence_id: hashTraceId(req.trace_id, "creator_web_bridge_failed"),
        trace_id: req.trace_id,
        job_id: "provider",
        type: "creator_web_bridge_failed" as any,
        timestamp: new Date().toISOString(),
        payload: { provider_id: req.provider_id, status: result.status, error: e?.message },
      });
      return result;
    }
  }

  private mapErrorToStatus(e: any): CreatorWebBridgeStatus {
    const msg = (e?.message ?? "").toLowerCase();
    if (msg.includes("login_required")) return "blocked_login";
    if (msg.includes("captcha_required")) return "blocked_captcha";
    if (msg.includes("rate_limit")) return "blocked_rate_limit";
    if (msg.includes("timeout")) return "timeout";
    return "failed";
  }

  private fail(providerId: string, reason: string, status: CreatorWebBridgeStatus = "failed"): CreatorWebBridgeResult {
    return {
      provider_id: providerId,
      status,
      output: { text: "" },
      evidence: { session_id: "", url: "", extraction_method: "dom" },
    };
  }

  getAdapter(providerId: string): OpenaiWebAdapter | QwenWebAdapter | DeepseekWebAdapter | undefined {
    return ADAPTER_MAP[providerId];
  }

  listAdapters(): string[] {
    return Object.keys(ADAPTER_MAP);
  }
}
