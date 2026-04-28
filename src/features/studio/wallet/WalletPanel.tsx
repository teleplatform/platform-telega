"use client";

import { useEffect, useState } from "react";
import {
  TeleGlassPanel,
  TelePrimaryButton,
  TeleSecondaryButton,
  TeleListItem,
} from "@/components/tele";

type BillingTransaction = {
  tx_id: string;
  happened_at: string;
  kind: "model" | "tool" | "storage" | "compute";
  units: number;
  unit_type: string;
  amount_micros: number;
  session_id: string;
  summary: string;
};

type BillingReceipt = {
  receipt_id: string;
  session_id: string;
  created_at: string;
  total_micros: number;
  breakdown: {
    model_micros: number;
    tool_micros: number;
    storage_micros: number;
    compute_micros: number;
  };
};

type BillingReceiptDetail = BillingReceipt & {
  usage: {
    model_tokens_in: number;
    model_tokens_out: number;
    tool_calls: number;
    storage_bytes: number;
    compute_ms: number;
  };
  integrity: {
    sum_matches_total: boolean;
    ledger_append_only: boolean;
    verified_at: string;
  };
  summary: string;
};

type BillingDispute = {
  dispute_id: string;
  receipt_id: string;
  reason: string;
  status: "open" | "reviewing" | "resolved" | "closed";
  status_view: {
    badge_label: string;
    description: string;
  };
  created_at: string;
  updated_at: string;
  timeline: Array<{
    at: string;
    status: "open" | "reviewing" | "resolved" | "closed";
    message: string;
  }>;
  next_step: {
    hint: string;
    eta_hours: number;
  };
};

type BillingResponse = {
  ok: boolean;
  data: {
    balance_teleton_micros: number;
    transactions: BillingTransaction[];
    receipts: BillingReceipt[];
    disputes: BillingDispute[];
    dispute: {
      create_path: string;
    };
  };
};

export default function WalletPanel({ makerMode }: { makerMode: boolean }) {
  const [data, setData] = useState<BillingResponse["data"] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [disputeReceiptId, setDisputeReceiptId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeStatus, setDisputeStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [receiptDetail, setReceiptDetail] = useState<BillingReceiptDetail | null>(null);
  const [receiptStatus, setReceiptStatus] = useState<"idle" | "loading" | "error">("idle");
  const [disputeDetail, setDisputeDetail] = useState<BillingDispute | null>(null);
  const [disputeDetailStatus, setDisputeDetailStatus] = useState<"idle" | "loading" | "error">("idle");
  const [simulateStatus, setSimulateStatus] = useState<"idle" | "sending" | "error">("idle");
  const [exportStatus, setExportStatus] = useState<"idle" | "sending" | "error">("idle");
  const [receiptExportStatus, setReceiptExportStatus] = useState<"idle" | "sending" | "error">("idle");
  const [manifestExportStatus, setManifestExportStatus] = useState<"idle" | "sending" | "error">("idle");
  const [bundleExportStatus, setBundleExportStatus] = useState<"idle" | "sending" | "error">("idle");
  const [bundleZipExportStatus, setBundleZipExportStatus] = useState<"idle" | "sending" | "error">("idle");
  const [bundleSignedZipExportStatus, setBundleSignedZipExportStatus] = useState<"idle" | "sending" | "error">("idle");

  async function loadBilling() {
    setStatus("loading");
    try {
      const res = await fetch("/api/v1/user/billing");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as BillingResponse;
      setData(json.data);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function submitDispute() {
    if (!disputeReceiptId || !disputeReason.trim() || !data?.dispute.create_path) return;
    setDisputeStatus("sending");
    try {
      const res = await fetch(data.dispute.create_path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: disputeReceiptId,
          reason: disputeReason.trim(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDisputeStatus("ok");
      setDisputeReason("");
      await loadBilling();
    } catch {
      setDisputeStatus("error");
    }
  }

  async function loadReceiptDetail(receiptId: string) {
    setReceiptStatus("loading");
    try {
      const res = await fetch(`/api/v1/user/receipts/${encodeURIComponent(receiptId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { ok: boolean; data: BillingReceiptDetail };
      setReceiptDetail(json.data);
      setDisputeReceiptId(receiptId);
      setReceiptStatus("idle");
    } catch {
      setReceiptDetail(null);
      setReceiptStatus("error");
    }
  }

  async function loadDisputeDetail(disputeId: string) {
    setDisputeDetailStatus("loading");
    try {
      const res = await fetch(`/api/v1/user/disputes/${encodeURIComponent(disputeId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { ok: boolean; data: BillingDispute };
      setDisputeDetail(json.data);
      setDisputeDetailStatus("idle");
    } catch {
      setDisputeDetail(null);
      setDisputeDetailStatus("error");
    }
  }

  function getAllowedNextStatuses(status: BillingDispute["status"]): BillingDispute["status"][] {
    if (status === "open") return ["reviewing", "closed"];
    if (status === "reviewing") return ["resolved", "closed"];
    if (status === "resolved") return ["closed"];
    return [];
  }

  async function simulateDisputeStatus(nextStatus: BillingDispute["status"]) {
    if (!disputeDetail) return;
    setSimulateStatus("sending");
    try {
      const res = await fetch(`/api/v1/user/disputes/${encodeURIComponent(disputeDetail.dispute_id)}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-maker-mode": makerMode ? "1" : "0" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadBilling();
      await loadDisputeDetail(disputeDetail.dispute_id);
      setSimulateStatus("idle");
    } catch {
      setSimulateStatus("error");
    }
  }

  async function exportDisputeEvents(format: "json" | "ndjson") {
    if (!disputeDetail) return;
    setExportStatus("sending");
    try {
      const res = await fetch(
        `/api/v1/user/disputes/${encodeURIComponent(disputeDetail.dispute_id)}/export?format=${format}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${disputeDetail.dispute_id}-events.${format === "ndjson" ? "ndjson" : "json"}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("idle");
    } catch {
      setExportStatus("error");
    }
  }

  async function exportReceiptEvents(format: "json" | "ndjson") {
    if (!receiptDetail) return;
    setReceiptExportStatus("sending");
    try {
      const res = await fetch(
        `/api/v1/user/receipts/${encodeURIComponent(receiptDetail.receipt_id)}/export?format=${format}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${receiptDetail.receipt_id}-events.${format === "ndjson" ? "ndjson" : "json"}`;
      a.click();
      URL.revokeObjectURL(url);
      setReceiptExportStatus("idle");
    } catch {
      setReceiptExportStatus("error");
    }
  }

  async function exportUnifiedManifest(format: "json" | "ndjson") {
    setManifestExportStatus("sending");
    try {
      const res = await fetch(`/api/v1/user/exports/manifest?format=${format}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unified-export-manifest.${format === "ndjson" ? "ndjson" : "json"}`;
      a.click();
      URL.revokeObjectURL(url);
      setManifestExportStatus("idle");
    } catch {
      setManifestExportStatus("error");
    }
  }

  async function exportUnifiedBundle(format: "json" | "ndjson") {
    if (!data) return;
    setBundleExportStatus("sending");
    try {
      const receiptIds = data.receipts.map((item) => item.receipt_id).join(",");
      const disputeIds = data.disputes.map((item) => item.dispute_id).join(",");
      const qs = new URLSearchParams({
        format,
        receipt_ids: receiptIds,
        dispute_ids: disputeIds,
      });
      const res = await fetch(`/api/v1/user/exports/bundle?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unified-export-bundle.${format === "ndjson" ? "ndjson" : "json"}`;
      a.click();
      URL.revokeObjectURL(url);
      setBundleExportStatus("idle");
    } catch {
      setBundleExportStatus("error");
    }
  }

  async function exportUnifiedBundleZip() {
    if (!data) return;
    setBundleZipExportStatus("sending");
    try {
      const receiptIds = data.receipts.map((item) => item.receipt_id).join(",");
      const disputeIds = data.disputes.map((item) => item.dispute_id).join(",");
      const qs = new URLSearchParams({
        receipt_ids: receiptIds,
        dispute_ids: disputeIds,
      });
      const res = await fetch(`/api/v1/user/exports/bundle.zip?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "unified-export-bundle.zip";
      a.click();
      URL.revokeObjectURL(url);
      setBundleZipExportStatus("idle");
    } catch {
      setBundleZipExportStatus("error");
    }
  }

  async function exportUnifiedSignedBundleZip() {
    if (!data) return;
    setBundleSignedZipExportStatus("sending");
    try {
      const receiptIds = data.receipts.map((item) => item.receipt_id).join(",");
      const disputeIds = data.disputes.map((item) => item.dispute_id).join(",");
      const qs = new URLSearchParams({
        receipt_ids: receiptIds,
        dispute_ids: disputeIds,
      });
      const res = await fetch(`/api/v1/user/exports/bundle.signed.zip?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "unified-export-bundle.signed.zip";
      a.click();
      URL.revokeObjectURL(url);
      setBundleSignedZipExportStatus("idle");
    } catch {
      setBundleSignedZipExportStatus("error");
    }
  }

  useEffect(() => {
    void loadBilling();
  }, []);

  return (
    <div className="space-y-4">
      <TeleGlassPanel className="p-4 space-y-3">
        <div className="text-sm text-muted-foreground">K2 Billing UX</div>
        <div className="text-xs text-muted-foreground">Read-only billing surface for current subject.</div>
        <div className="flex flex-wrap gap-2">
          <TeleSecondaryButton onClick={() => void exportUnifiedManifest("json")} className="px-3 py-1.5">
            Export Manifest JSON
          </TeleSecondaryButton>
          <TeleSecondaryButton onClick={() => void exportUnifiedManifest("ndjson")} className="px-3 py-1.5">
            Export Manifest NDJSON
          </TeleSecondaryButton>
          <TeleSecondaryButton onClick={() => void exportUnifiedBundle("json")} className="px-3 py-1.5">
            Export Bundle JSON
          </TeleSecondaryButton>
          <TeleSecondaryButton onClick={() => void exportUnifiedBundle("ndjson")} className="px-3 py-1.5">
            Export Bundle NDJSON
          </TeleSecondaryButton>
          <TeleSecondaryButton onClick={() => void exportUnifiedBundleZip()} className="px-3 py-1.5">
            Export Bundle ZIP
          </TeleSecondaryButton>
          <TeleSecondaryButton onClick={() => void exportUnifiedSignedBundleZip()} className="px-3 py-1.5">
            Export Signed ZIP
          </TeleSecondaryButton>
          {manifestExportStatus === "error" && <div className="text-xs text-red-300">Manifest export failed</div>}
          {bundleExportStatus === "error" && <div className="text-xs text-red-300">Bundle export failed</div>}
          {bundleZipExportStatus === "error" && <div className="text-xs text-red-300">Bundle ZIP export failed</div>}
          {bundleSignedZipExportStatus === "error" && <div className="text-xs text-red-300">Signed ZIP export failed</div>}
        </div>
        {status === "error" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Failed to load billing data.
            <TeleSecondaryButton onClick={loadBilling} className="px-3">
              Retry
            </TeleSecondaryButton>
          </div>
        )}
        {status === "loading" && (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}
      </TeleGlassPanel>

      <TeleGlassPanel className="p-4">
        <div className="text-sm text-muted-foreground mb-3">Balances</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <TeleGlassPanel className="p-4">
            <div className="text-xs text-muted-foreground">Teleton (read-only)</div>
            <div className="text-2xl font-semibold">
              {((data?.balance_teleton_micros ?? 0) / 1_000_000).toFixed(6)}
            </div>
          </TeleGlassPanel>
        </div>
      </TeleGlassPanel>

      <TeleGlassPanel className="p-4">
        <div className="text-sm text-muted-foreground mb-3">Transaction history</div>
        <div className="space-y-2">
          {(data?.transactions ?? []).map((item) => (
            <TeleListItem
              key={item.tx_id}
              title={`${item.summary} • ${(item.amount_micros / 1_000_000).toFixed(6)} TT`}
              subtitle={`${item.kind}/${item.unit_type} • ${new Date(item.happened_at).toLocaleString()}`}
            />
          ))}
          {!data?.transactions?.length && (
            <div className="text-sm text-muted-foreground">No transactions yet.</div>
          )}
        </div>
      </TeleGlassPanel>

      <TeleGlassPanel className="p-4">
        <div className="text-sm text-muted-foreground mb-3">Receipts</div>
        <div className="space-y-2">
          {(data?.receipts ?? []).map((receipt) => (
            <TeleListItem
              key={receipt.receipt_id}
              title={`${receipt.receipt_id} • ${(receipt.total_micros / 1_000_000).toFixed(6)} TT`}
              subtitle={`session ${receipt.session_id} • ${new Date(receipt.created_at).toLocaleString()}`}
              right={"Detail"}
              onClick={() => void loadReceiptDetail(receipt.receipt_id)}
            />
          ))}
          {!data?.receipts?.length && (
            <div className="text-sm text-muted-foreground">No receipts yet.</div>
          )}
        </div>
      </TeleGlassPanel>

      <TeleGlassPanel className="p-4 space-y-2">
        <div className="text-sm text-muted-foreground">Receipt detail (K2.1)</div>
        {receiptStatus === "loading" && <div className="text-xs text-muted-foreground">Loading receipt…</div>}
        {receiptStatus === "error" && <div className="text-xs text-red-300">Failed to load receipt detail.</div>}
        {!receiptDetail && receiptStatus === "idle" && (
          <div className="text-xs text-muted-foreground">Select receipt above to view user-safe detail.</div>
        )}
        {receiptDetail && (
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>{receiptDetail.summary}</div>
            <div>Total: {(receiptDetail.total_micros / 1_000_000).toFixed(6)} TT</div>
            <div>Model: in {receiptDetail.usage.model_tokens_in}, out {receiptDetail.usage.model_tokens_out}</div>
            <div>Tools: {receiptDetail.usage.tool_calls} calls</div>
            <div>Storage: {receiptDetail.usage.storage_bytes} bytes</div>
            <div>Compute: {receiptDetail.usage.compute_ms} ms</div>
            <div>Integrity: {receiptDetail.integrity.sum_matches_total ? "sum-ok" : "sum-mismatch"}</div>
            <div className="pt-2 flex flex-wrap gap-2">
              <TeleSecondaryButton onClick={() => void exportReceiptEvents("json")} className="px-3 py-1.5">
                Export Receipt JSON
              </TeleSecondaryButton>
              <TeleSecondaryButton onClick={() => void exportReceiptEvents("ndjson")} className="px-3 py-1.5">
                Export Receipt NDJSON
              </TeleSecondaryButton>
              {receiptExportStatus === "error" && <div className="text-xs text-red-300">Receipt export failed</div>}
            </div>
          </div>
        )}
      </TeleGlassPanel>

      <TeleGlassPanel className="p-4 space-y-3">
        <div className="text-sm text-muted-foreground">Dispute flow (Layer I)</div>
        <div className="text-xs text-muted-foreground">
          {disputeReceiptId ? `Selected receipt: ${disputeReceiptId}` : "Select a receipt above to open dispute."}
        </div>
        <textarea
          className="w-full min-h-24 rounded-xl bg-black/20 border border-white/10 p-3 text-sm outline-none"
          value={disputeReason}
          onChange={(e) => setDisputeReason(e.target.value)}
          placeholder="Describe the billing issue"
        />
        <div className="flex items-center gap-2">
          <TelePrimaryButton
            onClick={submitDispute}
            disabled={!disputeReceiptId || !disputeReason.trim() || disputeStatus === "sending"}
            className="px-4"
          >
            Submit Dispute
          </TelePrimaryButton>
          {disputeStatus === "ok" && <div className="text-xs text-green-300">Dispute submitted</div>}
          {disputeStatus === "error" && <div className="text-xs text-red-300">Submit failed</div>}
        </div>
      </TeleGlassPanel>

      <TeleGlassPanel className="p-4">
        <div className="text-sm text-muted-foreground mb-3">Disputes (K2.2)</div>
        <div className="space-y-2">
          {(data?.disputes ?? []).map((dispute) => (
            <TeleListItem
              key={dispute.dispute_id}
              title={`${dispute.dispute_id} • ${dispute.status_view.badge_label}`}
              subtitle={`${dispute.receipt_id} • ${new Date(dispute.created_at).toLocaleString()}`}
              right={"Detail"}
              onClick={() => void loadDisputeDetail(dispute.dispute_id)}
            />
          ))}
          {!data?.disputes?.length && (
            <div className="text-sm text-muted-foreground">No disputes yet.</div>
          )}
        </div>
      </TeleGlassPanel>

      <TeleGlassPanel className="p-4 space-y-2">
        <div className="text-sm text-muted-foreground">Dispute detail (K2.2)</div>
        {disputeDetailStatus === "loading" && <div className="text-xs text-muted-foreground">Loading dispute…</div>}
        {disputeDetailStatus === "error" && <div className="text-xs text-red-300">Failed to load dispute detail.</div>}
        {!disputeDetail && disputeDetailStatus === "idle" && (
          <div className="text-xs text-muted-foreground">Select dispute above to view status and timeline.</div>
        )}
        {disputeDetail && (
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>Status: {disputeDetail.status}</div>
            <div>{disputeDetail.status_view.description}</div>
            <div>Receipt: {disputeDetail.receipt_id}</div>
            <div>Reason: {disputeDetail.reason}</div>
            <div>Updated: {new Date(disputeDetail.updated_at).toLocaleString()}</div>
            <div>Next: {disputeDetail.next_step.hint} (ETA ~{disputeDetail.next_step.eta_hours}h)</div>
            <div className="pt-2 flex flex-wrap gap-2">
              <TeleSecondaryButton onClick={() => void exportDisputeEvents("json")} className="px-3 py-1.5">
                Export JSON
              </TeleSecondaryButton>
              <TeleSecondaryButton onClick={() => void exportDisputeEvents("ndjson")} className="px-3 py-1.5">
                Export NDJSON
              </TeleSecondaryButton>
              {exportStatus === "error" && <div className="text-xs text-red-300">Export failed</div>}
            </div>
            {disputeDetail.timeline.map((item, index) => (
              <div key={`${item.at}-${index}`}>
                {new Date(item.at).toLocaleString()} • {item.status} • {item.message}
              </div>
            ))}
            {makerMode && (
              <div className="pt-2 flex flex-wrap gap-2">
                {getAllowedNextStatuses(disputeDetail.status).map((status) => (
                  <TeleSecondaryButton
                    key={status}
                    onClick={() => void simulateDisputeStatus(status)}
                    disabled={simulateStatus === "sending"}
                    className="px-3 py-1.5"
                  >
                    Set {status}
                  </TeleSecondaryButton>
                ))}
                {simulateStatus === "error" && <div className="text-xs text-red-300">Simulation failed</div>}
              </div>
            )}
          </div>
        )}
      </TeleGlassPanel>
    </div>
  );
}
