// @ts-nocheck
export type BuildTaskStatus = "queued" | "running" | "done" | "failed";

export type TelecoreBuildTaskV1 = {
  kind: "TELECORE_BUILD_TASK_V1";
  id: string;
  created_at: string;
  source: "pantheon";
  status: BuildTaskStatus;
  intent: {
    type: "PACK_CANDIDATE" | "MANUAL_PACK";
    pack: string;
  };
  context: {
    digest_id?: string;
    evidence?: {
      intel_ids?: string[];
      notes?: string[];
      links?: string[];
    };
  };
  deliverable: {
    format: "patch_pack";
    target_repo: "tele-ga";
    target_path_hint: string;
  };
  meta?: {
    retry_of_task?: string;
    retry_of_trace?: string;
  };
};
