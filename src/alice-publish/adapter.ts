// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Main Handler
//
// prepareAliceSkillRegistration() does ONLY:
// 1. build skill identity
// 2. build invocation profile
// 3. build manifest
// 4. run environment checks
// 5. run publish validation
// 6. build readiness report
// 7. build checklist summary
// 8. build release summary
// 9. never pretend publish already happened
// ─────────────────────────────────────────────────────────────

import type {
  AliceSkillIdentity,
  AliceSkillInvocationProfile,
  AliceSkillManifest,
  AlicePublishReadinessReport,
  AliceReleaseSummary,
  AlicePublishChecklistItem,
} from "./types.js";
import { buildAliceSkillIdentity } from "./identity.js";
import { buildAliceInvocationProfile } from "./invocation.js";
import { buildAliceSkillManifest } from "./manifest.js";
import { getAliceWebhookPublishPath, buildAliceEndpointRegistrationMeta } from "./endpoints.js";
import { validateAlicePublishReadiness } from "./validation.js";
import { buildAlicePublishChecklist, getChecklistSummary } from "./checklist.js";
import { buildAliceReleaseSummary, formatReleaseSummary } from "./release.js";

export type PublishPrepResult = {
  identity: AliceSkillIdentity;
  invocation: AliceSkillInvocationProfile;
  manifest: AliceSkillManifest;
  endpoint: ReturnType<typeof buildAliceEndpointRegistrationMeta>;
  readiness: AlicePublishReadinessReport;
  checklist: AlicePublishChecklistItem[];
  checklistSummary: ReturnType<typeof getChecklistSummary>;
  releaseSummary: AliceReleaseSummary;
  releaseText: string;
};

export function prepareAliceSkillRegistration(input?: {
  requireSecrets?: boolean;
  baseUrl?: string;
}): PublishPrepResult {
  // 1. Build skill identity
  const identity = buildAliceSkillIdentity();

  // 2. Build invocation profile
  const invocation = buildAliceInvocationProfile();

  // 3. Build manifest
  const manifest = buildAliceSkillManifest({
    identity,
    invocation,
  });

  // 4. Run environment checks
  const endpoint = buildAliceEndpointRegistrationMeta(input?.baseUrl);

  // 5. Run publish validation
  const readiness = validateAlicePublishReadiness({
    manifest,
    invocation,
    requireSecrets: input?.requireSecrets ?? false,
  });

  // 6. Build checklist
  const checklist = buildAlicePublishChecklist(readiness);
  const checklistSummary = getChecklistSummary(checklist);

  // 7. Build release summary
  const releaseSummary = buildAliceReleaseSummary({
    skillId: identity.skillId,
    version: "1.0.0",
    readiness,
    manifest,
    endpointPath: endpoint.url,
  });

  const releaseText = formatReleaseSummary(releaseSummary);

  // 8. Return — publish has NOT happened
  return {
    identity,
    invocation,
    manifest,
    endpoint,
    readiness,
    checklist,
    checklistSummary,
    releaseSummary,
    releaseText,
  };
}
