import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ArrowLeft,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useForgePatch, useForgePatches } from "../hooks/useForge";
import type { KiloPatchPlan } from "../types/forge";

const RISK_COLORS = {
  low: "text-green-400 bg-green-400/10",
  medium: "text-yellow-400 bg-yellow-400/10",
  high: "text-red-400 bg-red-400/10",
};

const STATUS_ICONS = {
  pending: <Clock className="w-5 h-5 text-yellow-400" />,
  approved: <CheckCircle className="w-5 h-5 text-blue-400" />,
  applied: <CheckCircle className="w-5 h-5 text-green-400" />,
  failed: <XCircle className="w-5 h-5 text-red-400" />,
  rolled_back: <XCircle className="w-5 h-5 text-orange-400" />,
};

const STATUS_LABELS = {
  pending: "Pending Review",
  approved: "Approved",
  applied: "Applied",
  failed: "Failed",
  rolled_back: "Rolled Back",
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRiskIcon(risk: string) {
  switch (risk) {
    case "low":
      return <ShieldCheck className="w-5 h-5 text-green-400" />;
    case "medium":
      return <Shield className="w-5 h-5 text-yellow-400" />;
    case "high":
      return <ShieldAlert className="w-5 h-5 text-red-400" />;
    default:
      return <Shield className="w-5 h-5 text-muted" />;
  }
}

export function ForgeDiffScreen() {
  const { id } = useParams<{ id: string }>();
  const { patch, loading, error } = useForgePatch(id ?? "");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    if (patch?.files?.length && !selectedFile) {
      setSelectedFile(patch.files[0]);
    }
  }, [patch, selectedFile]);

  if (loading && !patch) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Clock className="w-12 h-12 text-muted animate-pulse" />
        <p className="text-muted">Loading patch...</p>
      </div>
    );
  }

  if (error || !patch) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-red-400">{error || "Patch not found"}</p>
        <Link to="/forge/patches" className="px-3 py-2 bg-primary/20 rounded hover:bg-primary/30">
          Back to Patches
        </Link>
      </div>
    );
  }

  const risk = patch.risk_level ?? "low";
  const blocked = patch.blocked_files ?? [];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <Link to="/forge/patches" className="p-2 rounded hover:bg-primary/20">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold truncate">Patch Review</h1>
          <p className="text-sm text-muted font-mono">{patch.plan_id}</p>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-3">
          {STATUS_ICONS[patch.status as keyof typeof STATUS_ICONS] ?? <Clock className="w-5 h-5" />}
          <span className="font-semibold">
            {STATUS_LABELS[patch.status as keyof typeof STATUS_LABELS] ?? patch.status}
          </span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded ${RISK_COLORS[risk]}`}>
          {getRiskIcon(risk)}
          <span className="font-bold uppercase text-sm">{risk} Risk</span>
        </div>
      </div>

      {patch.task && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Task</h2>
          <p className="text-sm whitespace-pre-wrap">{patch.task}</p>
        </div>
      )}

      {blocked.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">Blocked Files Detected</span>
          </div>
          <ul className="text-sm text-red-300 font-mono">
            {blocked.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-3 border-b border-border">
          <h2 className="font-semibold">Files to Change ({patch.files?.length ?? 0})</h2>
        </div>
        <div className="flex flex-wrap gap-2 p-3 border-b border-border">
          {patch.files?.map((file) => (
            <button
              key={file}
              onClick={() => setSelectedFile(file)}
              className={`px-3 py-1 rounded text-sm font-mono ${
                selectedFile === file
                  ? "bg-primary text-white"
                  : "bg-background hover:bg-primary/20"
              }`}
            >
              {file}
            </button>
          ))}
        </div>
        {selectedFile && patch.diffs?.[selectedFile] && (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted" />
              <span className="text-sm font-mono">{selectedFile}</span>
            </div>
            <pre className="text-xs font-mono bg-background p-3 rounded overflow-x-auto whitespace-pre">
              {patch.diffs[selectedFile]}
            </pre>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>Created by {patch.account_label}</span>
        <span>{formatTime(patch.created_at)}</span>
      </div>

      {patch.status === "pending" && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-300 text-sm">
            To apply this patch, use the command:{" "}
            <code className="font-mono">/kilo_patch_apply {patch.plan_id}</code>
          </p>
          <p className="text-yellow-300 text-xs mt-1">
            Requires owner (★) role approval
          </p>
        </div>
      )}
    </div>
  );
}

export function ForgePatchesScreen() {
  const { patches, loading } = useForgePatches();

  if (loading && !patches.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Patch Review
        </h1>
        <Link to="/forge" className="px-3 py-2 bg-primary/20 rounded hover:bg-primary/30">
          Dashboard
        </Link>
      </div>

      {!patches.length ? (
        <p className="text-muted text-center py-12">No patches yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {patches.map((patch: KiloPatchPlan) => (
            <Link
              key={patch.plan_id}
              to={`/forge/diff/${patch.plan_id}`}
              className="flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:bg-primary/10"
            >
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm truncate">{patch.plan_id}</p>
                <p className="text-xs text-muted truncate">
                  {patch.task?.slice(0, 60) || `${patch.files?.length ?? 0} files`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${
                    patch.risk_level === "high"
                      ? "bg-red-500/20 text-red-400"
                      : patch.risk_level === "medium"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {patch.risk_level ?? "low"}
                </span>
                {STATUS_ICONS[patch.status as keyof typeof STATUS_ICONS] ?? <Clock className="w-4 h-4 text-muted" />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}