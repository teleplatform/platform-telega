import { cn } from "@/lib/utils";

export function TeleGlassPanel(props: {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        props.strong ? "tele-glass-strong" : "tele-glass",
        "rounded-[var(--radius)]",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}
