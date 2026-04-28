// Deny Semantics — Canonical deny logging and trace integration

import type {
  ActorId,
  Action,
  ResourceKind,
  DenyRecord,
  PermissionDecision,
} from "../../types/authz.js";

export type DenySink = (record: DenyRecord) => void;

export class DenyLogger {
  private sinks: DenySink[] = [];
  private log: DenyRecord[] = [];
  private maxLogSize: number;

  constructor(maxLogSize: number = 1000) {
    this.maxLogSize = maxLogSize;
  }

  addSink(sink: DenySink): void {
    this.sinks.push(sink);
  }

  logDeny(record: Omit<DenyRecord, "denied_at">): void {
    const fullRecord: DenyRecord = {
      ...record,
      denied_at: new Date().toISOString(),
    };

    this.log.push(fullRecord);
    if (this.log.length > this.maxLogSize) {
      this.log = this.log.slice(-this.maxLogSize);
    }

    for (const sink of this.sinks) {
      try {
        sink(fullRecord);
      } catch {
        // sink errors are swallowed — deny logging must not crash runtime
      }
    }
  }

  logTraceDeny(
    actorId: ActorId,
    action: Action,
    resourceKind: ResourceKind,
    resourceId: string,
    reason: string,
    traceId?: string
  ): void {
    this.logDeny({
      actor_id: actorId,
      action,
      resource_kind: resourceKind,
      resource_id: resourceId,
      reason,
      trace_id: traceId,
    });
  }

  getLog(): DenyRecord[] {
    return [...this.log];
  }

  getLogForActor(actorId: ActorId): DenyRecord[] {
    return this.log.filter((r) => r.actor_id === actorId);
  }

  clear(): void {
    this.log = [];
  }
}

export function traceSink(emitTraceEvent: (event: Record<string, unknown>) => void): DenySink {
  return (record: DenyRecord) => {
    emitTraceEvent({
      v: 1,
      ts: record.denied_at,
      type: "authz.deny",
      lvl: "warn",
      actor: { kind: "system", id: "authz_guard" },
      data: {
        decision_type: "authz.deny",
        actor_id: record.actor_id,
        action: record.action,
        resource_kind: record.resource_kind,
        resource_id: record.resource_id,
        reason: record.reason,
      },
    });
  };
}

export function consoleSink(): DenySink {
  return (record: DenyRecord) => {
    console.warn(
      `[AUTHZ DENY] actor=${record.actor_id} action=${record.action} ` +
      `resource=${record.resource_kind}:${record.resource_id} reason=${record.reason}`
    );
  };
}

export const denyLogger = new DenyLogger();
denyLogger.addSink(consoleSink());
