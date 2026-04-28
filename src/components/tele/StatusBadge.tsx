import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  done: "Done",
  partial: "Partial",
  blocked: "Blocked",
};

export function StatusBadge(props: { status: string; stale?: boolean; className?: string }) {
  const label = LABELS[props.status] ?? "Unknown";
  const text = props.stale ? `${label} · Stale ⏱` : label;
  const withWarning = label === "Blocked" ? `${text} ⚠` : text;

  return (
    <span
      className={cn(
        "tele-glass rounded-tele-pill px-3 py-1 text-xs text-foreground",
        props.className
      )}
    >
      {withWarning}
    </span>
  );
}
