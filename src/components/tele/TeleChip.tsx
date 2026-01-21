import { cn } from "@/lib/utils";

export function TeleChip(props: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "rounded-[var(--radius-pill)] px-4 py-2 text-sm border transition",
        props.active
          ? "bg-gradient-to-r from-purple-500/70 to-pink-500/60 border-white/20 text-white"
          : "tele-glass border-white/10 text-white/80 hover:bg-white/10"
      )}
    >
      {props.label}
    </button>
  );
}
