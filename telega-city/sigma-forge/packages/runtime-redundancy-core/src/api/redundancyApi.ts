import type {
  TransportChannel,
  IdentityContinuityRecord,
  FailoverEvent,
  RecoveryRecord,
  DeliveryEnvelope,
  TransportLossEvent,
  OperationalDegradationState,
  RedundancyAuditEvent,
} from "../../runtime-redundancy-contracts/src/redundancy.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";
import type { RedundancyRepos } from "../storage/sqlite/redundancyRepo.js";

export interface RedundancyDeps {
  repos: RedundancyRepos;
}

export function createRedundancyApi(deps: RedundancyDeps) {
  const { repos } = deps;

  return {
    registerTransportChannel(input: {
      transport: TransportChannel["transport"];
      identity_key: string;
      priority: number;
    }): TransportChannel {
      const channel: TransportChannel = {
        channel_id: `ch_${randomUUID()}`,
        transport: input.transport,
        identity_key: input.identity_key,
        status: "active",
        priority: input.priority,
        updated_at: nowIso(),
      };
      repos.channels.save(channel);
      repos.audit.append({ event_type: "channel_registered", actor: "system", transport: input.transport, details: { priority: input.priority }, timestamp: nowIso() });
      return channel;
    },

    bindIdentityContinuity(input: {
      transport_identity_key: string;
      transport: string;
      canonical_user_id: string;
      session_id?: string;
    }): IdentityContinuityRecord {
      const existing = repos.identities.getByTransportKey(input.transport_identity_key, input.transport);
      if (existing) return existing;

      const record: IdentityContinuityRecord = {
        identity_id: `idc_${randomUUID()}`,
        transport_identity_key: input.transport_identity_key,
        transport: input.transport,
        canonical_user_id: input.canonical_user_id,
        session_id: input.session_id,
        bound_at: nowIso(),
        updated_at: nowIso(),
      };
      repos.identities.save(record);
      repos.audit.append({ event_type: "identity_bound", actor: "system", transport: input.transport, details: { canonical_user_id: input.canonical_user_id }, timestamp: nowIso() });
      return record;
    },

    recordTransportLoss(input: {
      transport: string;
      severity: TransportLossEvent["severity"];
      reason: string;
      affected_missions: string[];
    }): TransportLossEvent {
      const event: TransportLossEvent = {
        event_id: `loss_${randomUUID()}`,
        transport: input.transport,
        severity: input.severity,
        reason: input.reason,
        affected_missions: input.affected_missions,
        detected_at: nowIso(),
      };
      repos.lossEvents.save(event);
      repos.audit.append({ event_type: "transport_loss_detected", actor: "system", transport: input.transport, details: { severity: input.severity, reason: input.reason }, timestamp: nowIso() });
      return event;
    },

    executeFailover(input: {
      mission_id?: string;
      session_id?: string;
      from_transport: string;
      to_transport: string;
      reason: string;
    }): FailoverEvent {
      const event: FailoverEvent = {
        failover_id: `fail_${randomUUID()}`,
        mission_id: input.mission_id,
        session_id: input.session_id,
        from_transport: input.from_transport,
        to_transport: input.to_transport,
        reason: input.reason,
        status: "completed",
        started_at: nowIso(),
        completed_at: nowIso(),
        result: `migrated_to_${input.to_transport}`,
      };
      repos.failovers.save(event);
      repos.audit.append({ event_type: "failover_executed", actor: "system", transport: input.to_transport, details: { from: input.from_transport, to: input.to_transport, reason: input.reason }, timestamp: nowIso() });
      return event;
    },

    recordRecovery(input: {
      mission_id?: string;
      session_id?: string;
      transport: string;
      method: RecoveryRecord["method"];
      evidence_refs: string[];
    }): RecoveryRecord {
      const record: RecoveryRecord = {
        recovery_id: `rec_${randomUUID()}`,
        mission_id: input.mission_id,
        session_id: input.session_id,
        transport: input.transport,
        method: input.method,
        status: "completed",
        started_at: nowIso(),
        completed_at: nowIso(),
        result_summary: `Recovery via ${input.method} on ${input.transport}`,
        evidence_refs: input.evidence_refs,
      };
      repos.recovery.save(record);
      repos.audit.append({ event_type: "recovery_recorded", actor: "system", transport: input.transport, details: { method: input.method, evidence_count: input.evidence_refs.length }, timestamp: nowIso() });
      return record;
    },

    activateOperationalDegradation(input: {
      scope: OperationalDegradationState["scope"];
      scope_id: string;
      active_transport: string;
      lost_transports: string[];
      affected_operations: string[];
      reason: string;
    }): OperationalDegradationState {
      const state: OperationalDegradationState = {
        degradation_id: `deg_${randomUUID()}`,
        scope: input.scope,
        scope_id: input.scope_id,
        active_transport: input.active_transport as any,
        lost_transports: input.lost_transports as any[],
        degradation_mode: input.lost_transports.length > 2 ? "suspended" : "reduced_capacity",
        affected_operations: input.affected_operations,
        activated_at: nowIso(),
        reason: input.reason,
        status: "active",
      };
      repos.degradation.save(state);
      repos.audit.append({ event_type: "degradation_activated", actor: "system", transport: input.active_transport, details: { scope: input.scope, mode: state.degradation_mode }, timestamp: nowIso() });
      return state;
    },

    createDeliveryEnvelope(input: {
      mission_id?: string;
      target_transport: string;
      fallback_transport?: string;
      payload_ref: string;
      payload_summary: string;
    }): DeliveryEnvelope {
      const envelope: DeliveryEnvelope = {
        delivery_id: `del_${randomUUID()}`,
        mission_id: input.mission_id,
        target_transport: input.target_transport as any,
        fallback_transport: input.fallback_transport as any,
        payload_ref: input.payload_ref,
        payload_summary: input.payload_summary,
        status: "pending",
        attempt_count: 0,
        created_at: nowIso(),
      };
      repos.deliveries.save(envelope);
      repos.audit.append({ event_type: "delivery_envelope_created", actor: "system", transport: input.target_transport, details: { fallback: input.fallback_transport }, timestamp: nowIso() });
      return envelope;
    },

    getChannelStatus(transport: string): TransportChannel | null {
      return repos.channels.getByTransport(transport);
    },

    listActiveChannels(): TransportChannel[] {
      return repos.channels.listActive();
    },
  };
}

export type RedundancyApi = ReturnType<typeof createRedundancyApi>;
