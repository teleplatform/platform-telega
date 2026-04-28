// Decision Log — Pack 3.4
// Records and queries router decision traces

import type { DecisionTrace, DecisionType } from "./traceTypes.js";

export class DecisionLog {
  private entries: DecisionTrace[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 5000) {
    this.maxEntries = maxEntries;
  }

  append(entry: DecisionTrace): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  getByDecisionId(decisionId: string): DecisionTrace | undefined {
    return this.entries.find((e) => e.decision_id === decisionId);
  }

  getBySessionId(sessionId: string): DecisionTrace[] {
    return this.entries.filter((e) => e.session_id === sessionId);
  }

  getByActorId(actorId: string): DecisionTrace[] {
    return this.entries.filter((e) => e.actor_id === actorId);
  }

  getByDecisionType(decisionType: DecisionType): DecisionTrace[] {
    return this.entries.filter((e) => e.decision_type === decisionType);
  }

  getRecent(limit: number = 20): DecisionTrace[] {
    return this.entries.slice(-limit).reverse();
  }

  getFallbackEvents(): DecisionTrace[] {
    return this.entries.filter(
      (e) => e.decision_type === "router.fallback"
    );
  }

  getRejections(): DecisionTrace[] {
    return this.entries.filter(
      (e) => e.decision_type === "router.reject"
    );
  }

  clear(): void {
    this.entries = [];
  }

  size(): number {
    return this.entries.length;
  }
}

export const decisionLog = new DecisionLog();
