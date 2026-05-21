import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type ResourceType = "compute_slot" | "gpu" | "storage" | "execution_capacity";

export interface MarketListing {
  listing_id: string;
  resource: ResourceType;
  quantity: number;
  price_per_unit: number;
  provider: string;
  listed_at: string;
}

export interface MarketTrade {
  trade_id: string;
  listing_id: string;
  buyer: string;
  quantity: number;
  total_cost: number;
  traded_at: string;
}

const LISTINGS: Map<string, MarketListing> = new Map();
const TRADES: Map<string, MarketTrade> = new Map();
let listingCounter = 0;
let tradeCounter = 0;

export async function listResource(
  resource: ResourceType,
  quantity: number,
  pricePerUnit: number,
  provider: string,
): Promise<MarketListing> {
  listingCounter++;
  const listing: MarketListing = {
    listing_id: `listing_${Date.now()}_${listingCounter}`,
    resource,
    quantity,
    price_per_unit: pricePerUnit,
    provider,
    listed_at: new Date().toISOString(),
  };
  LISTINGS.set(listing.listing_id, listing);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(listing.listing_id, "resource_market_listed"),
    trace_id: listing.listing_id,
    job_id: "economy",
    type: "resource_market_listed",
    timestamp: listing.listed_at,
    payload: { listing_id: listing.listing_id, resource, quantity, price: pricePerUnit, provider },
  });
  return listing;
}

export async function tradeResource(
  listingId: string,
  buyer: string,
  quantity: number,
): Promise<MarketTrade | null> {
  const listing = LISTINGS.get(listingId);
  if (!listing || listing.quantity < quantity) return null;

  tradeCounter++;
  const trade: MarketTrade = {
    trade_id: `trade_${Date.now()}_${tradeCounter}`,
    listing_id: listingId,
    buyer,
    quantity,
    total_cost: quantity * listing.price_per_unit,
    traded_at: new Date().toISOString(),
  };
  TRADES.set(trade.trade_id, trade);
  listing.quantity -= quantity;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(trade.trade_id, "resource_market_traded"),
    trace_id: trade.trade_id,
    job_id: "economy",
    type: "resource_market_traded",
    timestamp: trade.traded_at,
    payload: { trade_id: trade.trade_id, listing_id: listingId, resource: listing.resource, quantity, cost: trade.total_cost },
  });
  return trade;
}

export function getListings(resource?: ResourceType): MarketListing[] {
  const all = Array.from(LISTINGS.values());
  return resource ? all.filter((l) => l.resource === resource) : all;
}
