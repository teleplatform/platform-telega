import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type CostFactor = "trust" | "risk" | "federation" | "scarcity";

export interface CapabilityPrice {
  capability: string;
  base_cost: number;
  multipliers: Record<CostFactor, number>;
  effective_cost: number;
  priced_at: string;
}

let priceCounter = 0;

export function priceCapability(
  capability: string,
  baseCost: number,
  trustMultiplier = 1,
  riskMultiplier = 1,
  federationMultiplier = 1,
  scarcityMultiplier = 1,
): CapabilityPrice {
  priceCounter++;
  const price: CapabilityPrice = {
    capability,
    base_cost: baseCost,
    multipliers: {
      trust: trustMultiplier,
      risk: riskMultiplier,
      federation: federationMultiplier,
      scarcity: scarcityMultiplier,
    },
    effective_cost: Math.round(baseCost * trustMultiplier * riskMultiplier * federationMultiplier * scarcityMultiplier),
    priced_at: new Date().toISOString(),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(`price_${capability}_${priceCounter}`, "capability_priced"),
    trace_id: `price_${capability}_${priceCounter}`,
    job_id: "economy",
    type: "capability_priced",
    timestamp: price.priced_at,
    payload: {
      capability,
      base_cost: baseCost,
      effective_cost: price.effective_cost,
      multipliers: price.multipliers,
    },
  });

  return price;
}
