import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface ExchangeRecord {
  exchange_id: string;
  from_runtime: string;
  to_runtime: string;
  resource: string;
  amount: number;
  exchanged_at: string;
}

let exchangeCounter = 0;

export async function exchangeWithFederation(
  fromRuntime: string,
  toRuntime: string,
  resource: string,
  amount: number,
): Promise<ExchangeRecord> {
  exchangeCounter++;
  const record: ExchangeRecord = {
    exchange_id: `fed_ex_${Date.now()}_${exchangeCounter}`,
    from_runtime: fromRuntime,
    to_runtime: toRuntime,
    resource,
    amount,
    exchanged_at: new Date().toISOString(),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(record.exchange_id, "federation_economy_exchanged"),
    trace_id: record.exchange_id,
    job_id: "economy",
    type: "federation_economy_exchanged",
    timestamp: record.exchanged_at,
    payload: {
      exchange_id: record.exchange_id,
      from: fromRuntime,
      to: toRuntime,
      resource,
      amount,
    },
  });
  return record;
}
