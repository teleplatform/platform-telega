import type Database from "better-sqlite3";

export function createRouteDecisionsRepo(db: Database.Database) {
  return {
    saveRouteDecision(decision: any): void {
      db.prepare(
        `INSERT INTO runtime_route_decisions (decision_id, task_id, execution_mode, complexity, risk_level, latency_sensitivity, privacy_sensitivity, estimated_token_volume, needs_tools, needs_review, reasons_json, cheaper_mode_available, created_at)
         VALUES (@decision_id, @task_id, @execution_mode, @complexity, @risk_level, @latency_sensitivity, @privacy_sensitivity, @estimated_token_volume, @needs_tools, @needs_review, @reasons_json, @cheaper_mode_available, @created_at)`
      ).run({ decision_id: `dec_${Date.now()}`, task_id: decision.task_id ?? null, execution_mode: decision.execution_mode, complexity: decision.complexity, risk_level: decision.risk_level, latency_sensitivity: decision.latency_sensitivity, privacy_sensitivity: decision.privacy_sensitivity, estimated_token_volume: decision.estimated_token_volume, needs_tools: decision.needs_tools ? 1 : 0, needs_review: decision.needs_review ? 1 : 0, reasons_json: JSON.stringify(decision.reasons), cheaper_mode_available: decision.cheaper_mode_available ?? null, created_at: new Date().toISOString() });
    },
    getRouteDecision(task_id: string): any {
      return db.prepare("SELECT * FROM runtime_route_decisions WHERE task_id = ? ORDER BY created_at DESC LIMIT 1").get(task_id);
    },
  };
}

export function createProviderSelectionsRepo(db: Database.Database) {
  return {
    saveProviderSelection(selection: any): void {
      db.prepare(
        `INSERT INTO runtime_provider_selections (selection_id, task_id, selected_provider_id, selected_provider_type, rejected_json, reasons_json, created_at)
         VALUES (@selection_id, @task_id, @selected_provider_id, @selected_provider_type, @rejected_json, @reasons_json, @created_at)`
      ).run({ selection_id: `sel_${Date.now()}`, task_id: selection.task_id ?? null, selected_provider_id: selection.selected_provider_id, selected_provider_type: selection.selected_provider_type, rejected_json: JSON.stringify(selection.rejected ?? []), reasons_json: JSON.stringify(selection.reasons ?? []), created_at: new Date().toISOString() });
    },
    getProviderSelection(task_id: string): any {
      return db.prepare("SELECT * FROM runtime_provider_selections WHERE task_id = ? ORDER BY created_at DESC LIMIT 1").get(task_id);
    },
  };
}

export function createBudgetEventsRepo(db: Database.Database) {
  return {
    appendBudgetEvent(event: any): void {
      db.prepare(
        `INSERT INTO runtime_budget_events (event_id, task_id, allowed, reasons_json, estimated_cost, estimated_tokens, cheaper_mode_recommended, created_at)
         VALUES (@event_id, @task_id, @allowed, @reasons_json, @estimated_cost, @estimated_tokens, @cheaper_mode_recommended, @created_at)`
      ).run({ event_id: `budget_${Date.now()}`, task_id: event.task_id ?? null, allowed: event.allowed ? 1 : 0, reasons_json: JSON.stringify(event.reasons), estimated_cost: event.estimated_cost ?? null, estimated_tokens: event.estimated_tokens ?? null, cheaper_mode_recommended: event.cheaper_mode_recommended ?? null, created_at: new Date().toISOString() });
    },
    getBudgetEvents(task_id: string): any[] {
      return db.prepare("SELECT * FROM runtime_budget_events WHERE task_id = ? ORDER BY created_at DESC").all(task_id);
    },
  };
}

export function createCostSignalsRepo(db: Database.Database) {
  return {
    saveCostSignals(signals: any): void {
      db.prepare(
        `INSERT INTO runtime_cost_signals (signal_id, task_id, complexity, risk_level, latency_sensitivity, privacy_sensitivity, estimated_token_volume, needs_tools, needs_review, created_at)
         VALUES (@signal_id, @task_id, @complexity, @risk_level, @latency_sensitivity, @privacy_sensitivity, @estimated_token_volume, @needs_tools, @needs_review, @created_at)`
      ).run({ signal_id: `sig_${Date.now()}`, task_id: signals.task_id ?? null, complexity: signals.complexity, risk_level: signals.risk_level, latency_sensitivity: signals.latency_sensitivity, privacy_sensitivity: signals.privacy_sensitivity, estimated_token_volume: signals.estimated_token_volume, needs_tools: signals.needs_tools ? 1 : 0, needs_review: signals.needs_review ? 1 : 0, created_at: new Date().toISOString() });
    },
    getCostSignals(task_id: string): any {
      return db.prepare("SELECT * FROM runtime_cost_signals WHERE task_id = ? ORDER BY created_at DESC LIMIT 1").get(task_id);
    },
  };
}
