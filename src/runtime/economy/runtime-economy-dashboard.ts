import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllBudgets } from "./runtime-budget-engine.js";
import { getListings } from "./runtime-resource-market.js";
import { detectEconomicRisks } from "./economic-risk-ledger.js";

export interface EconomyDashboard {
  dashboard_id: string;
  viewed_at: string;
  budgets: number;
  listings: number;
  risks: number;
  rendered: string;
}

let dashCounter = 0;

export function viewEconomyDashboard(): EconomyDashboard {
  dashCounter++;
  const budgets = getAllBudgets();
  const listings = getListings();
  const risks = detectEconomicRisks();

  const lines: string[] = [
    "╔══════════════════════════════════════╗",
    "║     RUNTIME ECONOMY DASHBOARD         ║",
    "╚══════════════════════════════════════╝",
    "",
    "--- Budgets ---",
    ...budgets.map((b) => `  ${b.category}: ${b.used}/${b.limit} (${b.period})`),
    "",
    "--- Resource Market ---",
    `  Listings: ${listings.length}`,
    ...listings.slice(0, 5).map((l) => `  • ${l.resource}: ${l.quantity} units @ ${l.price_per_unit}`),
    "",
    "--- Risks ---",
    ...risks.map((r) => `  [${r.severity}] ${r.description}`),
  ];

  const dash: EconomyDashboard = {
    dashboard_id: `eco_dash_${Date.now()}_${dashCounter}`,
    viewed_at: new Date().toISOString(),
    budgets: budgets.length,
    listings: listings.length,
    risks: risks.length,
    rendered: lines.join("\n"),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(dash.dashboard_id, "economy_dashboard_viewed"),
    trace_id: dash.dashboard_id,
    job_id: "economy",
    type: "economy_dashboard_viewed",
    timestamp: dash.viewed_at,
    payload: { dashboard_id: dash.dashboard_id, budgets: dash.budgets, listings: dash.listings, risks: dash.risks },
  });

  return dash;
}
