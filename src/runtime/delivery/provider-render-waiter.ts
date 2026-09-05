import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type RenderStatus = "rendering" | "image_detected" | "image_loaded" | "artifact_saved" | "completed";

interface RenderWaitState {
  renderId: string;
  traceId: string;
  status: RenderStatus;
  hasImage: boolean;
  imageLoaded: boolean;
  loadingActive: boolean;
  startedAt: number;
  lastProgressAt: number;
}

export class ProviderRenderWaiter {
  private renders = new Map<string, RenderWaitState>();
  private checkRenderFn: (renderId: string) => Promise<{ hasImage: boolean; imageLoaded: boolean; loadingActive: boolean }>;

  constructor(checkRenderFn?: (renderId: string) => Promise<{ hasImage: boolean; imageLoaded: boolean; loadingActive: boolean }>) {
    this.checkRenderFn = checkRenderFn ?? (async () => ({ hasImage: false, imageLoaded: false, loadingActive: true }));
  }

  startWaiting(renderId: string, traceId: string): void {
    const state: RenderWaitState = {
      renderId,
      traceId,
      status: "rendering",
      hasImage: false,
      imageLoaded: false,
      loadingActive: true,
      startedAt: Date.now(),
      lastProgressAt: Date.now(),
    };
    this.renders.set(renderId, state);

    appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "image_render_wait_started"),
      trace_id: traceId,
      job_id: "delivery",
      type: "image_render_wait_started" as any,
      timestamp: new Date().toISOString(),
      payload: { render_id: renderId },
    });
  }

  async poll(renderId: string): Promise<RenderStatus> {
    const state = this.renders.get(renderId);
    if (!state) return "completed";

    const check = await this.checkRenderFn(renderId);
    state.hasImage = check.hasImage;
    state.imageLoaded = check.imageLoaded;
    state.loadingActive = check.loadingActive;

    if (state.loadingActive) {
      state.lastProgressAt = Date.now();
      state.status = "rendering";

      appendEvidenceRecord({
        evidence_id: hashTraceId(state.traceId, "image_render_progress_observed"),
        trace_id: state.traceId,
        job_id: "delivery",
        type: "image_render_progress_observed" as any,
        timestamp: new Date().toISOString(),
        payload: { render_id: renderId, has_image: state.hasImage, image_loaded: state.imageLoaded },
      });
    }

    if (state.imageLoaded) {
      state.status = "image_loaded";
    }

    if (state.hasImage && state.imageLoaded) {
      state.status = "completed";

      appendEvidenceRecord({
        evidence_id: hashTraceId(state.traceId, "image_render_completed"),
        trace_id: state.traceId,
        job_id: "delivery",
        type: "image_render_completed" as any,
        timestamp: new Date().toISOString(),
        payload: { render_id: renderId },
      });
    }

    return state.status;
  }

  getStatus(renderId: string): RenderStatus | undefined {
    return this.renders.get(renderId)?.status;
  }

  isComplete(renderId: string): boolean {
    return this.renders.get(renderId)?.status === "completed";
  }

  isStillWaiting(renderId: string): boolean {
    const state = this.renders.get(renderId);
    if (!state) return false;
    return state.status === "rendering" || state.status === "image_detected";
  }

  remove(renderId: string): void {
    this.renders.delete(renderId);
  }
}
