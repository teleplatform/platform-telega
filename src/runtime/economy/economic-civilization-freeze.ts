import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllBudgets } from "./runtime-budget-engine.js";
import { getListings } from "./runtime-resource-market.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

const FREEZE_DIR = path.join(process.cwd(), ".data", "economy");
const FREEZE_PATH = path.join(FREEZE_DIR, "economic-civilization-freeze.json");

export interface EconomicCivilizationFreeze {
  frozen_at: string;
  budgets: number;
  listings: number;
  trades: number;
  exchanges: number;
  risks_detected: number;
  cost_blocks: number;
}

export async function freezeEconomicCivilization(): Promise<EconomicCivilizationFreeze> {
  if (!fs.existsSync(FREEZE_DIR)) fs.mkdirSync(FREEZE_DIR, { recursive: true });
  const budgets = getAllBudgets();
  const listings = getListings();
  const evidence = readEvidenceRecords();

  const freeze: EconomicCivilizationFreeze = {
    frozen_at: new Date().toISOString(),
    budgets: budgets.length,
    listings: listings.length,
    trades: evidence.filter((e) => e.type === "resource_market_traded").length,
    exchanges: evidence.filter((e) => e.type === "federation_economy_exchanged").length,
    risks_detected: evidence.filter((e) => e.type === "economic_risk_detected").length,
    cost_blocks: evidence.filter((e) => e.type === "cost_governance_blocked").length,
  };

  fs.writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2));
  await appendEvidenceRecord({
    evidence_id: hashTraceId("eco_civ_freeze", "economic_civilization_freeze_created"),
    trace_id: "eco_civ_freeze",
    job_id: "economy",
    type: "economic_civilization_freeze_created",
    timestamp: freeze.frozen_at,
    payload: { budgets: freeze.budgets, trades: freeze.trades, risks: freeze.risks_detected },
  });
  return freeze;
}
