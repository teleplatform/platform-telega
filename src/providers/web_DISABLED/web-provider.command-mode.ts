import type { WebProvider } from './web-provider.types';
import type { RehabStage } from './web-provider.state';
import type { WebRuntimePolicyName } from './web-provider.policy';
import { getMissionControlView, type WebMissionControlView } from './web-provider.mission-control';
import { executeWebOperatorAction, type WebOperatorActionInput } from './web-provider.actions';
import { getAuditLog } from './web-provider.audit';
import { getActiveWebRuntimePolicy, setActiveWebRuntimePolicy, listWebRuntimePolicies } from './web-provider.policy-apply';
import { getRecommendedWebRuntimePolicy } from './web-provider.policy-hints';
import { 
  applyPolicyHint, 
  forcePolicy, 
  revertPolicy, 
  getPolicyGovernorStatus 
} from './web-provider.policy-governor';
import { 
  forceRuntimeMode, 
  clearIncidentMode, 
  getRuntimeModeStatus,
  detectAndUpdateRuntimeMode,
  type RuntimeMode 
} from './web-provider.incident';

export interface WebMissionControlCommandInput {
  action?: 'reset' | 'disable' | 'enable' | 'rehab_set' | 'clear_cooldown';
  provider?: WebProvider;
  reason?: string;
  rehabStage?: RehabStage;
  policy?: WebRuntimePolicyName;
  policyHint?: boolean;
  policyApplyHint?: boolean;
  policyForce?: WebRuntimePolicyName;
  policyRevert?: boolean;
  incidentForce?: RuntimeMode;
  incidentClear?: boolean;
  json?: boolean;
  auditLimit?: number;
}

export interface WebMissionControlCommandResult {
  ok: boolean;
  mode: 'read' | 'action' | 'policy' | 'policy_hint' | 'incident';
  action?: string;
  provider?: WebProvider;
  policyChanged?: WebRuntimePolicyName;
  policyHintApplied?: boolean;
  policyReverted?: boolean;
  incidentChanged?: boolean;
  incidentCleared?: boolean;
  error?: string;
  missionControlSnapshot: WebMissionControlView;
  auditTail?: Array<{ ts: number; action: string; provider: string; reason?: string }>;
  policies?: Array<{ name: string; description: string }>;
  policyHint?: {
    recommended: WebRuntimePolicyName;
    confidence: string;
    reasons: string[];
  };
}

export async function executeMissionControlCommand(
  input: WebMissionControlCommandInput
): Promise<WebMissionControlCommandResult> {
  const snapshot = await getMissionControlView();

  const auditTail = getAuditLog(input.auditLimit || 20).map(e => ({
    ts: e.ts,
    action: e.action,
    provider: e.provider,
    reason: e.reason,
  }));

  // Incident commands first
  if (input.incidentForce) {
    if (!input.reason) {
      return {
        ok: false,
        mode: 'incident',
        error: 'reason_required_for_incident_override',
        missionControlSnapshot: snapshot,
        auditTail,
      };
    }

    forceRuntimeMode(input.incidentForce, input.incidentForce === 'incident' ? 'incident' : 'degraded', input.reason);
    const updatedSnapshot = await getMissionControlView();

    return {
      ok: true,
      mode: 'incident',
      incidentChanged: true,
      missionControlSnapshot: updatedSnapshot,
      auditTail,
    };
  }

  if (input.incidentClear) {
    if (!input.reason) {
      return {
        ok: false,
        mode: 'incident',
        error: 'reason_required_for_incident_clear',
        missionControlSnapshot: snapshot,
        auditTail,
      };
    }

    clearIncidentMode(input.reason);
    const updatedSnapshot = await getMissionControlView();

    return {
      ok: true,
      mode: 'incident',
      incidentCleared: true,
      missionControlSnapshot: updatedSnapshot,
      auditTail,
    };
  }

  if (input.policy) {
    const newPolicy = setActiveWebRuntimePolicy(input.policy);
    const updatedSnapshot = await getMissionControlView();

    return {
      ok: true,
      mode: 'policy',
      policyChanged: input.policy,
      missionControlSnapshot: updatedSnapshot,
      auditTail,
    };
  }

  if (input.policyHint) {
    const hint = getRecommendedWebRuntimePolicy();
    return {
      ok: true,
      mode: 'policy_hint',
      missionControlSnapshot: snapshot,
      auditTail,
      policyHint: {
        recommended: hint.recommended,
        confidence: hint.confidence,
        reasons: hint.reasons,
      },
    };
  }

  if (input.policyApplyHint) {
    const hint = getRecommendedWebRuntimePolicy();
    const result = applyPolicyHint(hint.recommended, hint.confidence);
    
    if (!result.ok) {
      return {
        ok: false,
        mode: 'policy_hint',
        error: result.error,
        missionControlSnapshot: snapshot,
        auditTail,
        policyHint: {
          recommended: hint.recommended,
          confidence: hint.confidence,
          reasons: hint.reasons,
        },
      };
    }
    
    const updatedSnapshot = await getMissionControlView();
    
    return {
      ok: true,
      mode: 'policy_hint',
      policyChanged: hint.recommended,
      policyHintApplied: true,
      missionControlSnapshot: updatedSnapshot,
      auditTail,
      policyHint: {
        recommended: hint.recommended,
        confidence: hint.confidence,
        reasons: hint.reasons,
      },
    };
  }

  if (input.policyForce) {
    if (!input.reason) {
      return {
        ok: false,
        mode: 'policy',
        error: 'reason_required_for_override',
        missionControlSnapshot: snapshot,
        auditTail,
      };
    }
    
    forcePolicy(input.policyForce, input.reason);
    const updatedSnapshot = await getMissionControlView();
    
    return {
      ok: true,
      mode: 'policy',
      policyChanged: input.policyForce,
      missionControlSnapshot: updatedSnapshot,
      auditTail,
    };
  }

  if (input.policyRevert) {
    const result = revertPolicy();
    
    if (!result.ok) {
      return {
        ok: false,
        mode: 'policy',
        error: result.error,
        missionControlSnapshot: snapshot,
        auditTail,
      };
    }
    
    const updatedSnapshot = await getMissionControlView();
    
    return {
      ok: true,
      mode: 'policy',
      policyChanged: result.revertedTo,
      policyReverted: true,
      missionControlSnapshot: updatedSnapshot,
      auditTail,
    };
  }

  if (input.incidentForce) {
    if (!input.reason) {
      return {
        ok: false,
        mode: 'incident',
        error: 'reason_required_for_incident_override',
        missionControlSnapshot: snapshot,
        auditTail,
      };
    }

    forceRuntimeMode(input.incidentForce, input.incidentForce === 'incident' ? 'incident' : 'degraded', input.reason);
    const updatedSnapshot = await getMissionControlView();

    return {
      ok: true,
      mode: 'incident',
      incidentChanged: true,
      missionControlSnapshot: updatedSnapshot,
      auditTail,
    };
  }

  console.log('DEBUG: input.incidentForce =', input.incidentForce);

  if (input.incidentClear) {
    if (!input.reason) {
      return {
        ok: false,
        mode: 'incident',
        error: 'reason_required_for_incident_clear',
        missionControlSnapshot: snapshot,
        auditTail,
      };
    }
    
    clearIncidentMode(input.reason);
    const updatedSnapshot = await getMissionControlView();
    
    return {
      ok: true,
      mode: 'incident',
      incidentCleared: true,
      missionControlSnapshot: updatedSnapshot,
      auditTail,
    };
  }

  if (!input.action) {
    return {
      ok: true,
      mode: 'read',
      missionControlSnapshot: snapshot,
      auditTail,
    };
  }

  if (!input.provider) {
    return {
      ok: false,
      mode: 'action',
      error: 'provider_required_for_action',
      missionControlSnapshot: snapshot,
      auditTail,
    };
  }

  const actionInput: WebOperatorActionInput = {
    action: input.action,
    provider: input.provider,
    reason: input.reason,
    rehabStage: input.rehabStage,
  };

  const actionResult = await executeWebOperatorAction(actionInput);

  if (!actionResult.ok) {
    const updatedSnapshot = await getMissionControlView();
    const updatedAudit = getAuditLog(input.auditLimit || 20).map(e => ({
      ts: e.ts,
      action: e.action,
      provider: e.provider,
      reason: e.reason,
    }));

    return {
      ok: false,
      mode: 'action',
      action: input.action,
      provider: input.provider,
      error: actionResult.error,
      missionControlSnapshot: updatedSnapshot,
      auditTail: updatedAudit,
    };
  }

  return {
    ok: true,
    mode: 'action',
    action: input.action,
    provider: input.provider,
    missionControlSnapshot: actionResult.missionControlSnapshot!,
    auditTail,
  };
}